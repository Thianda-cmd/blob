// Zip files, written and read without libraries: an .xlsx is a zip of XML parts. Writing stores
// each part, or deflates it with the browser's own CompressionStream("deflate-raw") when that is
// available and makes it smaller; reading inflates with DecompressionStream("deflate-raw") (in
// every current browser and in Node 18+, so the check script runs the same code).
//
// Only what Office files need: no zip64 (parts stay far below 4 GB), no encryption, no spanning.
//
// Reading stays bounded whatever the file says: deflate packs repeated text about 1000:1, so a
// file of a few hundred kilobytes can unpack to gigabytes. A part is unpacked only when the sizes
// the file declares are within the limits below, and unpacking stops as soon as the bytes that
// come out pass the declared size.

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
/** General purpose flag: file names are UTF-8. */
const UTF8 = 0x0800;

let crcTable: Uint32Array | null = null;

function table(): Uint32Array {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

/** CRC-32 (the zip and PNG checksum) of some bytes, as an unsigned number. */
export function crc32(data: Uint8Array): number {
  const t = table();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Bytes through a CompressionStream or DecompressionStream (whole, not streamed piece by piece). */
async function through(data: Uint8Array, stream: { readable: ReadableStream<Uint8Array>; writable: WritableStream<BufferSource> }): Promise<Uint8Array> {
  // A Blob's stream feeds the transform while the Response reads it, so big parts can't stall.
  const piped = new Blob([data as BlobPart]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

/** Raw deflate, or null where the browser can't (then the part is stored). */
export async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    return await through(data, new CompressionStream("deflate-raw" as CompressionFormat));
  } catch {
    return null;
  }
}

/**
 * Raw inflate, piece by piece: more than `limit` bytes coming out stops it at once (ZipError
 * "tooBig") instead of filling the memory first.
 */
export async function inflateRaw(data: Uint8Array, limit = Infinity): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new ZipError("unsupported");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat) as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        reader.cancel().catch(() => {});
        throw new ZipError("tooBig");
      }
      chunks.push(value);
    }
  } catch (e) {
    throw e instanceof ZipError ? e : new ZipError("broken");
  }
  if (chunks.length === 1) return chunks[0];
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export class ZipError extends Error {
  /** "tooBig": a part (or all parts together) would unpack to more than the limits allow. */
  constructor(public code: "not-zip" | "broken" | "encrypted" | "unsupported" | "tooBig") {
    super(`zip: ${code}`);
  }
}

/** The most one part may unpack to; real sheets stay far below (Blob saves at most 5 MB a page). */
export const MAX_PART_BYTES = 64 * 1024 * 1024;
/** The most all parts read from one file may unpack to together. */
export const MAX_UNPACKED_BYTES = 256 * 1024 * 1024;

export type ZipEntry = { name: string; data: Uint8Array };

/** MS-DOS time and date (the zip format's), in local time like every zip tool writes them. */
function dosTime(d: Date) {
  const year = Math.max(1980, Math.min(2107, d.getFullYear()));
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * A zip file of these entries, in this order. `compress`: deflate the parts that get smaller
 * (default true); without CompressionStream everything is stored, which every reader accepts too.
 */
export async function makeZip(entries: ZipEntry[], opts: { compress?: boolean; date?: Date } = {}): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const { time, date } = dosTime(opts.date ?? new Date());
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = enc.encode(entry.name.replace(/^\/+/, ""));
    const crc = crc32(entry.data);
    let method = 0;
    let body = entry.data;
    if (opts.compress !== false && entry.data.length > 64) {
      const packed = await deflateRaw(entry.data);
      if (packed && packed.length < entry.data.length) {
        method = 8;
        body = packed;
      }
    }
    const head = new Uint8Array(30 + name.length);
    const h = new DataView(head.buffer);
    h.setUint32(0, LOCAL, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, UTF8, true);
    h.setUint16(8, method, true);
    h.setUint16(10, time, true);
    h.setUint16(12, date, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, body.length, true);
    h.setUint32(22, entry.data.length, true);
    h.setUint16(26, name.length, true);
    h.setUint16(28, 0, true);
    head.set(name, 30);

    const dir = new Uint8Array(46 + name.length);
    const c = new DataView(dir.buffer);
    c.setUint32(0, CENTRAL, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, UTF8, true);
    c.setUint16(10, method, true);
    c.setUint16(12, time, true);
    c.setUint16(14, date, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, body.length, true);
    c.setUint32(24, entry.data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint16(30, 0, true);
    c.setUint16(32, 0, true);
    c.setUint16(34, 0, true);
    c.setUint16(36, 0, true);
    c.setUint32(38, 0, true);
    c.setUint32(42, offset, true);
    dir.set(name, 46);

    parts.push(head, body);
    central.push(dir);
    offset += head.length + body.length;
  }
  const dirSize = central.reduce((s, d) => s + d.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, END, true);
  e.setUint16(4, 0, true);
  e.setUint16(6, 0, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, dirSize, true);
  e.setUint32(16, offset, true);
  e.setUint16(20, 0, true);

  const out = new Uint8Array(offset + dirSize + end.length);
  let at = 0;
  for (const p of [...parts, ...central, end]) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

type Located = { name: string; method: number; flags: number; crc: number; size: number; packed: number; offset: number };

/**
 * The files of a zip, read on demand. Names are matched without case (Office part names ignore
 * case). Reading a part bigger than the limits throws ZipError "tooBig".
 */
export type ZipReader = {
  names: string[];
  has: (name: string) => boolean;
  /** The file's bytes (inflated), or null when there is no such file. */
  get: (name: string) => Promise<Uint8Array | null>;
  /** The file as UTF-8 text (a byte order mark is dropped), or null. */
  text: (name: string) => Promise<string | null>;
};

export function readZip(input: Uint8Array, limits: { part?: number; total?: number } = {}): ZipReader {
  const maxPart = limits.part ?? MAX_PART_BYTES;
  const maxTotal = limits.total ?? MAX_UNPACKED_BYTES;
  /** Bytes unpacked so far, all parts together. */
  let unpacked = 0;
  const data = input;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length < 22 || view.getUint32(0, true) !== LOCAL) throw new ZipError("not-zip");
  // The end record sits in the last 22 bytes plus a comment of up to 64 KB.
  let endAt = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === END) {
      endAt = i;
      break;
    }
  }
  if (endAt < 0) throw new ZipError("broken");
  const count = view.getUint16(endAt + 10, true);
  let at = view.getUint32(endAt + 16, true);
  if (at === 0xffffffff || count === 0xffff) throw new ZipError("unsupported");
  const dec = new TextDecoder();
  const entries = new Map<string, Located>();
  for (let i = 0; i < count; i++) {
    if (at + 46 > data.length || view.getUint32(at, true) !== CENTRAL) throw new ZipError("broken");
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const packed = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = dec.decode(data.subarray(at + 46, at + 46 + nameLen)).replace(/\\/g, "/").replace(/^\/+/, "");
    if (!name.endsWith("/")) entries.set(name.toLowerCase(), { name, method, flags, crc, size, packed, offset });
    at += 46 + nameLen + extraLen + commentLen;
  }

  const find = (name: string) => entries.get(name.replace(/^\/+/, "").toLowerCase());
  const get = async (name: string): Promise<Uint8Array | null> => {
    const e = find(name);
    if (!e) return null;
    if (e.flags & 1) throw new ZipError("encrypted");
    if (e.offset + 30 > data.length || view.getUint32(e.offset, true) !== LOCAL) throw new ZipError("broken");
    const start = e.offset + 30 + view.getUint16(e.offset + 26, true) + view.getUint16(e.offset + 28, true);
    if (start + e.packed > data.length) throw new ZipError("broken");
    // Refused before unpacking: bigger than a part may be, or than what is left for the file.
    if (e.size > maxPart || unpacked + e.size > maxTotal) throw new ZipError("tooBig");
    const raw = data.subarray(start, start + e.packed);
    let out: Uint8Array;
    if (e.method === 0) out = raw.slice();
    else if (e.method === 8) {
      try {
        out = await inflateRaw(raw, e.size);
      } catch (err) {
        // More bytes than the file declared: it is damaged, or made to fill the memory.
        throw err instanceof ZipError && err.code === "tooBig" ? new ZipError("broken") : err;
      }
    } else throw new ZipError("unsupported");
    if (out.length !== e.size || crc32(out) !== e.crc) throw new ZipError("broken");
    unpacked += out.length;
    return out;
  };
  return {
    names: [...entries.values()].map((e) => e.name),
    has: (name) => !!find(name),
    get,
    text: async (name) => {
      const bytes = await get(name);
      if (!bytes) return null;
      // XML parts are UTF-8 almost always; a few tools write UTF-16 (with a byte order mark).
      const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
      return new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, "");
    },
  };
}
