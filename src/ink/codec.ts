// A stroke's points, small: each point's x, y and width in tenths of a unit, as differences from the
// point before (most fit in one byte each), zigzag + varint coded, then base64url. A typical
// handwritten letter takes 100–200 characters.

const VERSION = 1;
/** More points than any real stroke has (a damaged or hostile value stops here). */
const MAX_POINTS = 50_000;
const SCALE = 10;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const LOOKUP = new Int16Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

export function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + ALPHABET[n & 63];
  }
  if (i < bytes.length) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8);
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += ALPHABET[(n >> 6) & 63];
  }
  return out;
}

export function fromBase64Url(text: string): Uint8Array | null {
  const len = text.length;
  if (len % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((len * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < len; i++) {
    const c = text.charCodeAt(i);
    const v = c < 128 ? LOOKUP[c] : -1;
    if (v < 0) return null;
    acc = ((acc << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

/** The points as stored (widths are full widths, not radii). */
export function encodePoints(xs: ArrayLike<number>, ys: ArrayLike<number>, ws: ArrayLike<number>): string {
  const n = Math.min(xs.length, ys.length, ws.length, MAX_POINTS);
  const bytes = new Uint8Array(1 + n * 15);
  let o = 0;
  bytes[o++] = VERSION;
  let px = 0;
  let py = 0;
  let pw = 0;
  const put = (v: number) => {
    // zigzag, then 7 bits at a time (values stay well inside 32 bits: ±100 000 units).
    let z = v >= 0 ? v * 2 : -v * 2 - 1;
    while (z >= 0x80) {
      bytes[o++] = (z & 0x7f) | 0x80;
      z = Math.floor(z / 128);
    }
    bytes[o++] = z;
  };
  for (let i = 0; i < n; i++) {
    const x = clampInt(Math.round(xs[i] * SCALE));
    const y = clampInt(Math.round(ys[i] * SCALE));
    const w = Math.max(1, clampInt(Math.round(ws[i] * SCALE)));
    put(x - px);
    put(y - py);
    put(w - pw);
    px = x;
    py = y;
    pw = w;
  }
  return toBase64Url(bytes.subarray(0, o));
}

export type Points = { xs: Float32Array; ys: Float32Array; ws: Float32Array };

/** The points back; null when the text isn't a stroke this version can read. */
export function decodePoints(text: string): Points | null {
  if (typeof text !== "string" || !text) return null;
  const bytes = fromBase64Url(text);
  if (!bytes || bytes.length < 1 || bytes[0] !== VERSION) return null;
  // Each point takes at least 3 bytes.
  const cap = Math.min(MAX_POINTS, Math.floor((bytes.length - 1) / 3));
  const xs = new Float32Array(cap);
  const ys = new Float32Array(cap);
  const ws = new Float32Array(cap);
  let i = 1;
  let n = 0;
  let x = 0;
  let y = 0;
  let w = 0;
  const get = (): number | null => {
    let z = 0;
    let mul = 1;
    for (let k = 0; k < 5; k++) {
      if (i >= bytes.length) return null;
      const b = bytes[i++];
      z += (b & 0x7f) * mul;
      if (b < 0x80) return z % 2 ? -(z + 1) / 2 : z / 2;
      mul *= 128;
    }
    return null;
  };
  while (i < bytes.length && n < cap) {
    const dx = get();
    const dy = get();
    const dw = get();
    if (dx === null || dy === null || dw === null) return null;
    x += dx;
    y += dy;
    w += dw;
    if (w < 1 || Math.abs(x) > 1e6 || Math.abs(y) > 1e6 || w > 1e5) return null;
    xs[n] = x / SCALE;
    ys[n] = y / SCALE;
    ws[n] = w / SCALE;
    n++;
  }
  if (i < bytes.length || !n) return null;
  return { xs: xs.slice(0, n), ys: ys.slice(0, n), ws: ws.slice(0, n) };
}

const clampInt = (v: number) => (Number.isFinite(v) ? Math.max(-1_000_000, Math.min(1_000_000, Math.trunc(v))) : 0);
