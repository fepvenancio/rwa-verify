import type { Hex } from "@rwa-verify/core";
import { SCHEMA_V1 } from "./constants.js";
import { keccak256Hex } from "./hash.js";
import { compareBytes, hexToBytes32 } from "./hex.js";

/** ERC-8326 `DocumentEntry`: five bytes32 fields as 0x-prefixed hex. */
export interface DocumentEntry {
  contentHash: Hex;
  role: Hex;
  mimeTypeHash: Hex;
  filenameHash: Hex;
  normProfileId: Hex;
}

// Canonical Ordering keys, in precedence order. Note this differs from the leaf field order.
const SORT_KEYS: readonly (keyof DocumentEntry)[] = ["role", "filenameHash", "contentHash", "mimeTypeHash", "normProfileId"];

/** Lexicographic comparison on raw bytes32 values, keys role, filenameHash, contentHash, mimeTypeHash, normProfileId. */
export function compareEntries(a: DocumentEntry, b: DocumentEntry): number {
  for (const k of SORT_KEYS) {
    const d = compareBytes(hexToBytes32(a[k]), hexToBytes32(b[k]));
    if (d !== 0) return d;
  }
  return 0;
}

/** Returns a sorted copy. Duplicates are retained. */
export function sortEntries(entries: readonly DocumentEntry[]): DocumentEntry[] {
  return [...entries].sort(compareEntries);
}

/** keccak256(abi.encodePacked(contentHash, role, mimeTypeHash, filenameHash, normProfileId)) */
export function leafHash(e: DocumentEntry): Hex {
  return keccak256Hex(
    concat([e.contentHash, e.role, e.mimeTypeHash, e.filenameHash, e.normProfileId].map(hexToBytes32)),
  );
}

/** Strict path: input must already be in canonical order. Throws on empty or unsorted input. */
export function computeBundleHash(sorted: readonly DocumentEntry[]): Hex {
  if (sorted.length === 0) throw new Error("bundle is empty");
  for (let i = 1; i < sorted.length; i++) {
    if (compareEntries(sorted[i - 1] as DocumentEntry, sorted[i] as DocumentEntry) > 0) {
      throw new Error(`entries are not sorted (index ${i})`);
    }
  }
  return keccak256Hex(concat([hexToBytes32(SCHEMA_V1), ...sorted.map((e) => hexToBytes32(leafHash(e)))]));
}

/** Canonical path: sorts, then hashes. */
export function computeCanonicalBundleHash(entries: readonly DocumentEntry[]): Hex {
  if (entries.length === 0) throw new Error("bundle is empty");
  return computeBundleHash(sortEntries(entries));
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.length * 32);
  parts.forEach((p, i) => out.set(p, i * 32));
  return out;
}
