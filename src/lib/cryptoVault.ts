/**
 * 档案加密保险库（AES-256-GCM + PBKDF2）
 *
 * 安全模型：
 * 1. 导出（仅 App/桌面端）：用私有盐值作密码，PBKDF2 派生 256 位 AES 密钥
 *    → AES-GCM 加密明文 payload → 输出 iv + ciphertext + sign
 * 2. 导入（Web / App 端）：用户提供盐值（会话密钥）
 *    → PBKDF2 派生密钥 → AES-GCM 解密 → 验签 → 通过才写入
 *
 * 防护效果：
 * - 抓包看到的是 base64 乱码（ciphertext），无法阅读
 * - 篡改 ciphertext → AES-GCM 解密失败（认证加密自带完整性校验）
 * - 伪造文件 → 没有盐值无法加密，无法生成有效 sign
 *
 * 统一错误处理：任何失败（解密失败 / 验签不一致 / 格式错误）
 * 一律抛出 VaultError，外层展示「文件无效」并丢弃详细错误，防试探攻击。
 *
 * 调试日志：所有 [Vault] console.debug 均经 __DEBUG_BUILD__ 门控，
 * release 构建时 __DEBUG_BUILD__=false → 死分支被 tree-shaking 整段移除
 * （含字符串字面量），产物中不残留任何密钥指纹 / 签名 / IV 长度等信息。
 */

const PBKDF2_ITERATIONS = 150_000; // 暴力破解成本权衡
const IV_BYTES = 12;               // AES-GCM 推荐 96 位 IV
const KEY_BITS = 256;

// PBKDF2 派生用的固定盐（公开常量，作用是避免彩虹表；真正的密钥来自私有盐值）
// 用项目命名空间做派生盐，与其他项目隔离
const PBKDF2_SALT = new TextEncoder().encode('orpheus-archive-vault-v2');

/** 加密保险库统一错误类型 — 可携带诊断信息（对用户文案仍为"文件无效"） */
export class VaultError extends Error {
  diag?: string;
  constructor(diag?: string) {
    super('文件无效');
    this.name = 'VaultError';
    this.diag = diag;
  }
}

// ============ Base64 ↔ Uint8Array ============
function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ============ PBKDF2 密钥派生 ============
async function deriveKey(password: string): Promise<CryptoKey> {
  if (!password) throw new VaultError();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: PBKDF2_SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ============ SHA-256 签名（与 hiddenUnlock.sha256Hex 一致） ============
async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 加密 payload，输出 v2 格式容器
 * @param payload 明文 payload 对象（entries/eras/novel* 等）
 * @param privateKey 私有盐值（App 端构建时注入；Web 端调用方传入会话密钥）
 * @returns v2 容器对象：{ v:2, encrypted:true, iv, ciphertext, sign }
 */
export async function encryptPayload(
  payload: Record<string, unknown>,
  privateKey: string,
): Promise<{ v: 2; encrypted: true; iv: string; ciphertext: string; sign: string }> {
  if (!privateKey) throw new VaultError();
  // 打印密钥指纹（不泄露本体），便于和导入端比对（release 构建经 __DEBUG_BUILD__ 门控移除）
  if (__DEBUG_BUILD__) {
    (async () => {
      try {
        const sha = await sha256Hex(privateKey);
        console.debug('[Vault] 加密启动，privateKey 指纹：', sha.slice(0, 8) + '...' + sha.slice(-6));
      } catch { /* 指纹打印失败不影响主流程 */ }
    })();
  }
  const key = await deriveKey(privateKey);

  // 1. 序列化 payload（key 顺序两端必须一致 → 用稳定序列化）
  const payloadStr = stableStringify(payload);

  // 2. 计算签名（防篡改第二道保险，AES-GCM 是第一道）
  const sign = await sha256Hex(payloadStr + privateKey);

  // 3. AES-GCM 加密
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(payloadStr);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  const ciphertext = bytesToBase64(new Uint8Array(cipherBuf));

  return {
    v: 2,
    encrypted: true,
    iv: bytesToBase64(iv),
    ciphertext,
    sign,
  };
}

/**
 * 解密 v2 容器并验签
 * @param container v2 容器对象
 * @param privateKey 会话密钥（= 私有盐值）
 * @returns 解密后的明文 payload 对象；任何失败统一抛 VaultError
 */
export async function decryptPayload(
  container: Record<string, unknown>,
  privateKey: string,
): Promise<Record<string, unknown>> {
  if (!privateKey) throw new VaultError();

  async function keyFingerprint(k: string): Promise<string> {
    const sha = await sha256Hex(k);
    return sha.slice(0, 8) + '...' + sha.slice(-6);
  }

  const v = container.v;
  const encrypted = container.encrypted;
  const ivB64 = container.iv;
  const ciphertextB64 = container.ciphertext;
  const sign = container.sign;

  if (__DEBUG_BUILD__) {
    console.debug('[Vault] 解密启动，privateKey 指纹：', await keyFingerprint(privateKey));
    console.debug('[Vault] v=', v, 'encrypted=', encrypted, 'iv?=', typeof ivB64, 'ct?=', typeof ciphertextB64, 'sign?=', typeof sign);
  }

  // 格式校验：任何字段缺失/类型不符 → 统一「文件无效」
  if (v !== 2 || encrypted !== true ||
      typeof ivB64 !== 'string' || typeof ciphertextB64 !== 'string' ||
      typeof sign !== 'string') {
    if (__DEBUG_BUILD__) console.debug('[Vault] ❌ 格式校验失败', { v, encrypted, ivT: typeof ivB64, ctT: typeof ciphertextB64, signT: typeof sign });
    throw new VaultError('v2 容器字段缺失/类型不符（encrypted/iv/ciphertext/sign 必须都存在且为字符串）');
  }

  let key: CryptoKey;
  try {
    key = await deriveKey(privateKey);
    if (__DEBUG_BUILD__) console.debug('[Vault] ✅ PBKDF2 密钥派生成功');
  } catch (e) {
    if (__DEBUG_BUILD__) console.debug('[Vault] ❌ PBKDF2 密钥派生失败', e);
    throw new VaultError('PBKDF2 密钥派生失败（crypto.subtle 不可用？）');
  }

  // AES-GCM 解密（密钥错误/数据被篡改 → 解密抛异常 → 统一「文件无效」）
  let plaintext: Uint8Array;
  try {
    const iv = base64ToBytes(ivB64);
    const ciphertext = base64ToBytes(ciphertextB64);
    if (__DEBUG_BUILD__) console.debug('[Vault] iv 字节数=', iv.length, '（需=12），ciphertext 字节数=', ciphertext.length);
    const buf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    plaintext = new Uint8Array(buf);
    if (__DEBUG_BUILD__) console.debug('[Vault] ✅ AES-GCM 解密成功，明文 ', plaintext.length, '字节');
  } catch (e) {
    if (__DEBUG_BUILD__) console.debug('[Vault] ❌ AES-GCM 解密失败（最常见原因：密钥不匹配 / 数据被篡改 / auth tag 不匹配）', e);
    throw new VaultError('AES-GCM 解密失败（密钥不匹配 或 数据被篡改 / auth tag 不匹配）');
  }

  // 解析 payload
  let payloadStr: string;
  let payload: Record<string, unknown>;
  try {
    payloadStr = new TextDecoder().decode(plaintext);
    payload = JSON.parse(payloadStr);
    if (__DEBUG_BUILD__) console.debug('[Vault] ✅ JSON 解析成功，字段：', Object.keys(payload));
  } catch (e) {
    if (__DEBUG_BUILD__) console.debug('[Vault] ❌ 明文解析失败', e);
    throw new VaultError('解密后明文不是合法 JSON（密钥不对导致明文乱码？）');
  }

  // 验签（第二道保险，防止极端情况下的绕过）
  let computed: string;
  try {
    computed = await sha256Hex(payloadStr + privateKey);
  } catch {
    throw new VaultError('算签 sha256Hex 失败');
  }
  if (__DEBUG_BUILD__) console.debug('[Vault] 验签 computed=', computed.slice(0, 16), '… container.sign=', sign.slice(0, 16), '… match=', computed === sign);
  if (computed !== sign) {
    if (__DEBUG_BUILD__) console.debug('[Vault] ❌ 验签失败：computed=', computed, '  container.sign=', sign);
    throw new VaultError('v2 验签失败（sign 被篡改 或 密钥不匹配）');
  }

  return payload;
}

/**
 * 稳定 JSON 序列化：对象 key 按字典序排列，避免两端序列化差异导致验签失败
 * 仅处理 plain object / array / 基本类型；遇到 undefined 跳过，与 JSON.stringify 一致
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(stableNormalize(value));
}

function stableNormalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stableNormalize);
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(value as Record<string, unknown>).sort();
  for (const k of keys) {
    const v = (value as Record<string, unknown>)[k];
    if (v !== undefined) sorted[k] = stableNormalize(v);
  }
  return sorted;
}
