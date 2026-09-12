import { keccak_256 } from "@noble/hashes/sha3.js";
import type { Hex } from "@rwa-verify/core";
import { toHex } from "./hex.js";

const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
// RFC 6838 §4.2 restricted-name for both type and subtype.
const MEDIA_TYPE_RE = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}$/;

export function keccak256(bytes: Uint8Array): Uint8Array {
  return keccak_256(bytes);
}

export function keccak256Hex(bytes: Uint8Array): Hex {
  return toHex(keccak_256(bytes));
}

export function utf8(s: string): Uint8Array {
  if (LONE_SURROGATE_RE.test(s)) throw new Error("string contains a lone surrogate");
  return new TextEncoder().encode(s);
}

/**
 * ERC-8326 filenameHash: substring after the last U+002F or U+005C, ASCII A-Z
 * lowercased (non-ASCII letters untouched), Unicode NFC, UTF-8, keccak256.
 */
export function filenameHash(name: string): Hex {
  const cut = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const base = name
    .slice(cut + 1)
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
    .normalize("NFC");
  return keccak256Hex(utf8(base));
}

/**
 * ERC-8326 mimeTypeHash: keccak256 of the lowercase IANA media type without
 * parameters. Everything from the first ';' is dropped; the remainder must be
 * a `type/subtype` token pair.
 */
export function mimeTypeHash(mime: string): Hex {
  const semi = mime.indexOf(";");
  const type = (semi === -1 ? mime : mime.slice(0, semi)).trim().toLowerCase();
  if (!MEDIA_TYPE_RE.test(type)) throw new Error(`not a media type: ${JSON.stringify(mime)}`);
  return keccak256Hex(new TextEncoder().encode(type));
}
