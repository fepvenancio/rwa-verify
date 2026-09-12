import { describe, expect, it } from "vitest";
import { filenameHash, keccak256Hex, mimeTypeHash } from "./hash.js";
import { hexToBytes32, toHex } from "./hex.js";

describe("hex helpers", () => {
  it("round-trips 32 bytes", () => {
    const b = new Uint8Array(32).map((_, i) => i);
    expect(hexToBytes32(toHex(b))).toEqual(b);
  });

  it("hexToBytes32 accepts either case and rejects malformed input", () => {
    const upper = "0x" + "AB".repeat(32);
    expect(toHex(hexToBytes32(upper))).toBe("0x" + "ab".repeat(32));
    for (const bad of ["", "0x", "0x" + "ab".repeat(31), "0x" + "ab".repeat(33), "ab".repeat(32), "0x" + "zz".repeat(32)]) {
      expect(() => hexToBytes32(bad)).toThrow();
    }
  });
});

describe("keccak256Hex", () => {
  it("matches the known keccak256 of the empty input", () => {
    expect(keccak256Hex(new Uint8Array())).toBe("0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
  });
});

// Vectors from specs/erc-8326.md "Normative Test Vectors".
describe("filenameHash", () => {
  it("takes the basename after '/', folds ASCII case, applies NFC", () => {
    // "records/Café.JSON" -> "café.json" (NFC composes e + U+0301 into U+00E9)
    expect(filenameHash("records/Café.JSON")).toBe(
      "0x3b40ecd25f3375868ddf559a0ef47c2dc15863a529ac592bec5e1b618bcbaf3e",
    );
  });

  it("treats '\\' as a path separator too", () => {
    expect(filenameHash("Evidence\\Proof.XML")).toBe(
      "0x696b36bf7095c1b1564382a37b8f5ba7d259b36be7639a7a1b50c97cd13cfe39",
    );
  });

  it("hashes a plain name", () => {
    expect(filenameHash("README.TXT")).toBe("0x31f491635b16d6fb45a7d770fcbcc8cbb6eae32ac98ab622631f4bc4a8c7e9ce");
  });

  it("uses the last separator of either kind", () => {
    expect(filenameHash("a/b\\c/README.TXT")).toBe(filenameHash("README.TXT"));
    expect(filenameHash("a\\b/c\\README.TXT")).toBe(filenameHash("README.TXT"));
  });

  it("lowercases ASCII A-Z only, leaving non-ASCII letters untouched", () => {
    // U+00C9 (É) must not be folded; only ASCII letters are.
    expect(filenameHash("ÉCHO.TXT")).toBe(keccak256Hex(new TextEncoder().encode("Écho.txt")));
    expect(filenameHash("ÉCHO.TXT")).not.toBe(filenameHash("écho.txt"));
  });

  it("rejects lone surrogates instead of silently replacing them", () => {
    expect(() => filenameHash("bad\uD800.txt")).toThrow(/surrogate/);
  });
});

describe("mimeTypeHash", () => {
  it("matches the normative vectors", () => {
    expect(mimeTypeHash("application/json")).toBe("0x82e6a468c95da6cfe399f69ee0782fd009e354a8030ea5636ea9c7db0edcf7f5");
    expect(mimeTypeHash("application/xml")).toBe("0x37aaf14a93fea5695fd8577aacfb548c98692a106d439219bfb9b83e3011ea2f");
    expect(mimeTypeHash("text/plain")).toBe("0xb25570cad408307f58d995c1dadde60bc76e94924d640305a148c9a11f8303bf");
  });

  it("strips parameters, trims, and lowercases", () => {
    const expected = mimeTypeHash("application/json");
    expect(mimeTypeHash("application/json; charset=utf-8")).toBe(expected);
    expect(mimeTypeHash("  Application/JSON ;q=1")).toBe(expected);
  });

  it("rejects strings that are not a type/subtype token pair", () => {
    for (const bad of ["", "json", "application/", "/json", "application/json/extra", "appli cation/json", "text/pläin"]) {
      expect(() => mimeTypeHash(bad)).toThrow();
    }
  });
});
