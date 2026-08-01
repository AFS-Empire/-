/**
 * 隐藏解锁状态管理
 *
 * 网页浏览版：关于页面标题点击 5 次后弹出密码框，
 * 输入正确密码后解锁导入/导出功能。
 *
 * 密码不存明文，只存 SHA-256(password + salt) 的哈希值。
 * 即使有人扒出编译后的 JS，也只能看到哈希和盐值，无法逆推密码。
 */
import { create } from 'zustand';

// 密码：Orpheus@2026!Archive
// 盐值：dae8b46163aacf81e88f698724702bfb79f0eca2f0295ec8bece21c53d957df1
// 哈希：c5b6842d098c5af1a56177eefe2a6171c4537ea8db7327ced592e052f9d0b986
const HIDDEN_SALT = 'dae8b46163aacf81e88f698724702bfb79f0eca2f0295ec8bece21c53d957df1';
const HIDDEN_HASH = 'c5b6842d098c5af1a56177eefe2a6171c4537ea8db7327ced592e052f9d0b986';

/** 纯 JS SHA-256（不依赖 crypto.subtle，兼容所有浏览器） */
async function sha256Hex(text: string): Promise<string> {
  // 优先用原生 crypto.subtle
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch { /* 降级到纯 JS */ }
  }
  // 纯 JS 降级（跟 crypto.ts 里同一套实现）
  return sha256PureJS(text);
}

/** 纯 JS SHA-256 实现 */
function sha256PureJS(message: string): string {
  function rrot(x: number, n: number): number { return (x >>> n) | (x << (32 - n)); }
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ]);
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const bytes = new TextEncoder().encode(message);
  const l = bytes.length;
  const bitLen = l * 8;
  const withPad = new Uint8Array(((l + 9 + 63) >> 6) << 6);
  withPad.set(bytes);
  withPad[l] = 0x80;
  const dv = new DataView(withPad.buffer);
  dv.setUint32(withPad.length - 4, bitLen >>> 0, false);
  dv.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000), false);
  const W = new Uint32Array(64);
  for (let i = 0; i < withPad.length; i += 64) {
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = rrot(W[t-15],7) ^ rrot(W[t-15],18) ^ (W[t-15] >>> 3);
      const s1 = rrot(W[t-2],17) ^ rrot(W[t-2],19) ^ (W[t-2] >>> 10);
      W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rrot(e,6) ^ rrot(e,11) ^ rrot(e,25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = rrot(a,2) ^ rrot(a,13) ^ rrot(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h=g; g=f; f=e; e=(d+temp1)>>>0; d=c; c=b; b=a; a=(temp1+temp2)>>>0;
    }
    H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
  }
  return Array.from(H).map(x => x.toString(16).padStart(8,'0')).join('');
}

interface HiddenUnlockState {
  isUnlocked: boolean;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
}

export const useHiddenUnlock = create<HiddenUnlockState>((set) => ({
  isUnlocked: false,

  unlock: async (password: string) => {
    const hash = await sha256Hex(password + HIDDEN_SALT);
    if (hash === HIDDEN_HASH) {
      set({ isUnlocked: true });
      return true;
    }
    return false;
  },

  lock: () => set({ isUnlocked: false }),
}));
