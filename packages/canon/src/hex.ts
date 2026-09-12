import type { Hex } from "@rwa-verify/core";

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

export function toHex(bytes: Uint8Array): Hex {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return `0x${s}`;
}

export function hexToBytes32(hex: string): Uint8Array {
  if (!BYTES32_RE.test(hex)) throw new Error(`expected 0x-prefixed bytes32 hex, got ${JSON.stringify(hex)}`);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(2 + i * 2, 4 + i * 2), 16);
  return out;
}

/** Lexicographic comparison on raw bytes (equal-length inputs). */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] as number) - (b[i] as number);
    if (d !== 0) return d;
  }
  return 0;
}
