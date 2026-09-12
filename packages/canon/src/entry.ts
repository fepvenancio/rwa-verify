import type { Hex } from "@rwa-verify/core";
import type { DocumentEntry } from "./bundle.js";
import { PROFILE_JSON_RFC8785, PROFILE_RAW, PROFILE_XML_C14N11 } from "./constants.js";
import { filenameHash, keccak256Hex, mimeTypeHash } from "./hash.js";
import { hexToBytes32, toHex } from "./hex.js";
import { normalizeJsonRfc8785 } from "./json.js";
import { normalizeXmlC14n11 } from "./xml.js";

export interface EntryInput {
  content: Uint8Array;
  filename: string;
  mimeType: string;
  role: Hex;
  profile: Hex;
}

/** Applies the named normalization profile and returns the bytes committed by `contentHash`. */
export function normalize(content: Uint8Array, profile: Hex): Uint8Array {
  switch (profile.toLowerCase()) {
    case PROFILE_RAW:
      return content;
    case PROFILE_JSON_RFC8785:
      return normalizeJsonRfc8785(content);
    case PROFILE_XML_C14N11:
      return normalizeXmlC14n11(content);
    default:
      throw new Error(`unknown normalization profile ${profile}`);
  }
}

/** Builds an ERC-8326 DocumentEntry from a raw document. Hex fields are emitted lowercase. */
export function buildEntry({ content, filename, mimeType, role, profile }: EntryInput): DocumentEntry {
  return {
    contentHash: keccak256Hex(normalize(content, profile)),
    role: toHex(hexToBytes32(role)),
    mimeTypeHash: mimeTypeHash(mimeType),
    filenameHash: filenameHash(filename),
    normProfileId: toHex(hexToBytes32(profile)),
  };
}
