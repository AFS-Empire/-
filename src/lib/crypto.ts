/**
 * 加密模块
 *
 * PBKDF2-SHA256 加盐哈希：管理员密码校验
 *
 * 优先用浏览器原生 SubtleCrypto（HTTPS/localhost 安全上下文）；
 * 若 crypto.subtle 不可用（某些 webview 非安全上下文），回退到纯 JS 实现。
 */

// ============ SubtleCrypto 可用性检测 + 回退 ============

/** 检测 crypto.subtle 是否可用 */
function hasSubtleCrypto(): boolean {
  return typeof crypto !== 'undefined'
    && typeof crypto.subtle !== 'undefined'
    && typeof crypto.subtle.importKey === 'function';
}

// ============ 纯 JS SHA-256 实现（回退用） ============
// 当 crypto.subtle 不可用时使用，纯前端环境下强度足够

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** 纯 JS SHA-256，输入 Uint8Array，返回 Uint8Array(32) */
function sha256Bytes(data: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  // 填充
  const bitLen = data.length * 8;
  const padLen = ((data.length + 8) >> 6) + 1;
  const padded = new Uint8Array(padLen * 64);
  padded.set(data);
  padded[data.length] = 0x80;
  // 长度（64位大端，这里只写高32位为0，低32位）
  const dv = new DataView(padded.buffer);
  dv.setUint32(padLen * 64 - 4, bitLen >>> 0, false);
  dv.setUint32(padLen * 64 - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = dv.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K256[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, h[i], false);
  return out;
}

/** 统一的 SHA-256 接口：优先原生，回退纯 JS */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  if (hasSubtleCrypto()) {
    const buf = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
    return new Uint8Array(buf);
  }
  return sha256Bytes(data);
}

// ============ PBKDF2 密码哈希 ============

const PBKDF2_ITERATIONS = 100_000; // 10万次迭代，兼顾安全与性能
const SALT_LENGTH = 16; // 16字节随机盐
const KEY_LENGTH = 32; // 256位

/** 生成随机盐（hex 字符串） */
function generateSalt(): string {
  const arr = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 字符串 → Uint8Array */
function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** hex 字符串 → Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}

/** Uint8Array → hex 字符串 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * PBKDF2-HMAC-SHA256 派生密钥（纯 JS 实现，兼容非安全上下文）
 * 当 crypto.subtle 可用时优先用原生
 */
async function pbkdf2(password: Uint8Array, salt: Uint8Array, iterations: number, keyLen: number): Promise<Uint8Array> {
  if (hasSubtleCrypto()) {
    const keyMaterial = await crypto.subtle.importKey('raw', password as unknown as ArrayBuffer, { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt as unknown as ArrayBuffer, iterations, hash: 'SHA-256' },
      keyMaterial,
      keyLen * 8,
    );
    return new Uint8Array(bits as ArrayBuffer);
  }
  // 纯 JS PBKDF2-HMAC-SHA256
  const out = new Uint8Array(keyLen);
  const hmacLen = 32;
  const blocks = Math.ceil(keyLen / hmacLen);
  for (let blockIndex = 1; blockIndex <= blocks; blockIndex++) {
    const u = new Uint8Array(salt.length + 4);
    u.set(salt);
    const dv = new DataView(u.buffer);
    dv.setUint32(salt.length, blockIndex, false);
    let t = await hmacSha256(password, u);
    const block = new Uint8Array(t);
    for (let i = 1; i < iterations; i++) {
      t = await hmacSha256(password, t);
      for (let j = 0; j < hmacLen; j++) block[j] ^= t[j];
    }
    const offset = (blockIndex - 1) * hmacLen;
    const copyLen = Math.min(hmacLen, keyLen - offset);
    out.set(block.subarray(0, copyLen), offset);
  }
  return out;
}

/** HMAC-SHA256（纯 JS） */
async function hmacSha256(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const blockSize = 64;
  let k = key;
  if (k.length > blockSize) k = await sha256(k);
  if (k.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(k);
    k = padded;
  }
  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = k[i] ^ 0x36;
    opad[i] = k[i] ^ 0x5c;
  }
  const inner = new Uint8Array(blockSize + msg.length);
  inner.set(ipad);
  inner.set(msg, blockSize);
  const innerHash = await sha256(inner);
  const outer = new Uint8Array(blockSize + innerHash.length);
  outer.set(opad);
  outer.set(innerHash, blockSize);
  return sha256(outer);
}

/**
 * 用 PBKDF2-SHA256 哈希密码
 * 返回格式：pbkdf2$<iterations>$<salt>$<hash>
 * 兼容旧格式校验：旧格式是 h<数字>，长度短且无 $ 分隔
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await pbkdf2(strToBytes(password), hexToBytes(salt), PBKDF2_ITERATIONS, KEY_LENGTH);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${bytesToHex(hash)}`;
}

/**
 * 校验密码是否匹配哈希
 * 兼容旧哈希格式（简单字符串哈希 h<数字>）—— 旧用户首次登录后建议改密触发升级
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // 旧格式兼容：h 开头 + 纯数字
  if (stored.startsWith('h') && /^h-?\d+$/.test(stored)) {
    return legacyHash(password) === stored;
  }
  // 新格式：pbkdf2$iter$salt$hash
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iter = parseInt(parts[1], 10);
  const salt = parts[2];
  const expectedHash = parts[3];
  if (!iter || !salt || !expectedHash) return false;

  const actualHash = await pbkdf2(strToBytes(password), hexToBytes(salt), iter, KEY_LENGTH);
  // 定时安全比较，防时序攻击
  return timingSafeEqual(bytesToHex(actualHash), expectedHash);
}

/** 定时安全字符串比较 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** 旧版简单哈希（仅用于兼容校验，不再用于新哈希） */
function legacyHash(pwd: string): string {
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) {
    const ch = pwd.charCodeAt(i);
    hash = (hash << 5) - hash + ch;
    hash |= 0;
  }
  return `h${hash}`;
}

/** 判断存储的哈希是否是旧格式（需要升级） */
export function isLegacyHash(stored: string): boolean {
  return stored.startsWith('h') && /^h-?\d+$/.test(stored);
}
