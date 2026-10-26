// Binary envelope for match_snapshot and shot_result (D055):
//   [u32 LE header length][header: JSON, ASCII only][payload: trajectory v1]
// The header escapes every character above U+007F as \uXXXX, so it can be written and read byte by
// byte. This code also runs in the Nakama runtime (goja), which has no TextEncoder, TextDecoder,
// Buffer or atob/btoa: everything here is plain JavaScript.

const LENGTH_BYTES = 4;
const CHUNK = 1024;

export function encodeEnvelope(header: unknown, payload: Uint8Array = new Uint8Array(0)): Uint8Array {
  const json = JSON.stringify(header);
  if (typeof json !== 'string') throw new TypeError('envelope header must be JSON-serializable');
  // A loop over UTF-16 code units, not a regex: goja's regex engine and surrogate pairs are uncertain.
  // Surrogates are escaped one by one, which JSON.parse reads back as the same pair.
  let ascii = '';
  let from = 0;
  for (let i = 0; i < json.length; i++) {
    const code = json.charCodeAt(i);
    if (code <= 0x7f) continue;
    ascii += json.slice(from, i) + '\\u' + (code + 0x10000).toString(16).slice(1);
    from = i + 1;
  }
  ascii += json.slice(from);

  const bytes = new Uint8Array(LENGTH_BYTES + ascii.length + payload.length);
  new DataView(bytes.buffer).setUint32(0, ascii.length, true);
  for (let i = 0; i < ascii.length; i++) bytes[LENGTH_BYTES + i] = ascii.charCodeAt(i);
  bytes.set(payload, LENGTH_BYTES + ascii.length);
  return bytes;
}

/** The payload is a view into `bytes`, not a copy. */
export function decodeEnvelope(bytes: Uint8Array): { header: any; payload: Uint8Array } {
  if (bytes.length < LENGTH_BYTES) throw new RangeError(`truncated envelope: ${bytes.length} bytes`);
  const headerLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
  const headerEnd = LENGTH_BYTES + headerLength;
  if (headerEnd > bytes.length) {
    throw new RangeError(`truncated envelope: the header needs ${headerEnd} bytes, has ${bytes.length}`);
  }

  let text = '';
  for (let from = LENGTH_BYTES; from < headerEnd; from += CHUNK) {
    const codes: number[] = [];
    for (let i = from; i < Math.min(from + CHUNK, headerEnd); i++) {
      if (bytes[i] >= 0x80) throw new RangeError(`envelope header has a non-ASCII byte at ${i}`);
      codes.push(bytes[i]);
    }
    text += String.fromCharCode.apply(null, codes);
  }
  let header: any;
  try {
    header = JSON.parse(text);
  } catch {
    throw new RangeError('envelope header is not valid JSON');
  }
  return { header, payload: bytes.subarray(headerEnd) };
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUES: number[] = [];
for (let i = 0; i < BASE64.length; i++) BASE64_VALUES[BASE64.charCodeAt(i)] = i;

export function bytesToBase64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const rest = bytes.length - i;
    const n = (bytes[i] << 16) | ((rest > 1 ? bytes[i + 1] : 0) << 8) | (rest > 2 ? bytes[i + 2] : 0);
    text += BASE64[n >> 18] + BASE64[(n >> 12) & 63] + (rest > 1 ? BASE64[(n >> 6) & 63] : '=') + (rest > 2 ? BASE64[n & 63] : '=');
  }
  return text;
}

/** Standard alphabet with padding and nothing else: no whitespace, no URL-safe variant. */
export function base64ToBytes(text: string): Uint8Array {
  if (text.length % 4 !== 0) throw new RangeError(`invalid base64: the length ${text.length} is not a multiple of 4`);
  let padding = 0;
  if (text.length > 0 && text[text.length - 1] === '=') padding = text[text.length - 2] === '=' ? 2 : 1;
  const bytes = new Uint8Array((text.length / 4) * 3 - padding);
  let at = 0;
  for (let i = 0; i < text.length; i += 4) {
    let n = 0;
    for (let j = 0; j < 4; j++) {
      const value = i + j >= text.length - padding ? 0 : BASE64_VALUES[text.charCodeAt(i + j)];
      if (value === undefined) throw new RangeError(`invalid base64 character at ${i + j}`);
      n = (n << 6) | value;
    }
    bytes[at++] = n >> 16;
    if (at < bytes.length) bytes[at++] = (n >> 8) & 255;
    if (at < bytes.length) bytes[at++] = n & 255;
  }
  return bytes;
}
