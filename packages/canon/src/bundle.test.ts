import type { Hex } from "@rwa-verify/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  compareEntries,
  computeBundleHash,
  computeCanonicalBundleHash,
  type DocumentEntry,
  leafHash,
  sortEntries,
} from "./bundle.js";
import { PROFILE_JSON_RFC8785, PROFILE_RAW, PROFILE_XML_C14N11, ROLES } from "./constants.js";
import { toHex } from "./hex.js";

// specs/erc-8326.md "Normative Test Vectors"
const JSON_ENTRY: DocumentEntry = {
  contentHash: "0xb8ffb64722137f4b100665a52e3c943f8066e8ab8ba3b427e6f4b404defd82b0",
  role: ROLES.AGREEMENT,
  mimeTypeHash: "0x82e6a468c95da6cfe399f69ee0782fd009e354a8030ea5636ea9c7db0edcf7f5",
  filenameHash: "0x3b40ecd25f3375868ddf559a0ef47c2dc15863a529ac592bec5e1b618bcbaf3e",
  normProfileId: PROFILE_JSON_RFC8785,
};
const XML_ENTRY: DocumentEntry = {
  contentHash: "0xde64c753c807c4620bf010c7e855bcd38bd389e980c4054b81abd5d44d45eab1",
  role: ROLES.EVIDENCE,
  mimeTypeHash: "0x37aaf14a93fea5695fd8577aacfb548c98692a106d439219bfb9b83e3011ea2f",
  filenameHash: "0x696b36bf7095c1b1564382a37b8f5ba7d259b36be7639a7a1b50c97cd13cfe39",
  normProfileId: PROFILE_XML_C14N11,
};
const RAW_ENTRY: DocumentEntry = {
  contentHash: "0x06750728a91d155294f77f992fec49acabb0470481439ed5e3bb59854df82ec9",
  role: ROLES.SUPPORTING,
  mimeTypeHash: "0xb25570cad408307f58d995c1dadde60bc76e94924d640305a148c9a11f8303bf",
  filenameHash: "0x31f491635b16d6fb45a7d770fcbcc8cbb6eae32ac98ab622631f4bc4a8c7e9ce",
  normProfileId: PROFILE_RAW,
};
const SPEC_BUNDLE_HASH = "0xbe712c4a5eb51d9eb303f1a5c896417a8407a420936fa210626bb66b1a6d0613";

const bytes32 = fc.uint8Array({ minLength: 32, maxLength: 32 }).map(toHex);
const entryArb: fc.Arbitrary<DocumentEntry> = fc.record({
  contentHash: bytes32,
  role: bytes32,
  mimeTypeHash: bytes32,
  filenameHash: bytes32,
  normProfileId: bytes32,
});

const isSorted = (es: DocumentEntry[]) => es.every((e, i) => i === 0 || compareEntries(es[i - 1] as DocumentEntry, e) <= 0);

describe("leafHash", () => {
  it("matches the normative vectors (field order content, role, mime, filename, profile)", () => {
    expect(leafHash(JSON_ENTRY)).toBe("0xe78934e3ee972b7eae660a945de9780c77e5656203bfe437ab117413adf3ad2b");
    expect(leafHash(XML_ENTRY)).toBe("0x8c72daea8a7297c8d307dd41e24038ff71065f9b0932a07e9016942abbc5c9ac");
    expect(leafHash(RAW_ENTRY)).toBe("0xa418892b0b93cf88e9d840cf38d36f5bfa16813774f22f5cf02d6b4fcc48375a");
  });
});

describe("compareEntries / sortEntries", () => {
  it("sorts the normative entries JSON, XML, raw by role", () => {
    expect(sortEntries([RAW_ENTRY, XML_ENTRY, JSON_ENTRY])).toEqual([JSON_ENTRY, XML_ENTRY, RAW_ENTRY]);
  });

  it("applies the keys in order role, filenameHash, contentHash, mimeTypeHash, normProfileId", () => {
    const lo: Hex = `0x${"00".repeat(32)}`;
    const hi: Hex = `0x${"ff".repeat(32)}`;
    const base: DocumentEntry = { contentHash: lo, role: lo, mimeTypeHash: lo, filenameHash: lo, normProfileId: lo };
    const keys: (keyof DocumentEntry)[] = ["role", "filenameHash", "contentHash", "mimeTypeHash", "normProfileId"];
    for (let i = 0; i < keys.length; i++) {
      // a is greater on a later key, b is greater on this key: this key must decide.
      const later = keys.slice(i + 1);
      const a: DocumentEntry = { ...base };
      for (const k of later) a[k] = hi;
      const b: DocumentEntry = { ...base, [keys[i] as keyof DocumentEntry]: hi };
      expect(compareEntries(a, b)).toBeLessThan(0);
      expect(compareEntries(b, a)).toBeGreaterThan(0);
    }
    expect(compareEntries(base, { ...base })).toBe(0);
  });

  it("compares raw bytes, not hex text case", () => {
    const a: DocumentEntry = { ...JSON_ENTRY, role: JSON_ENTRY.role.toUpperCase().replace("0X", "0x") as DocumentEntry["role"] };
    expect(compareEntries(a, JSON_ENTRY)).toBe(0);
  });

  it("does not mutate its input and retains duplicates", () => {
    const input = [RAW_ENTRY, JSON_ENTRY, RAW_ENTRY];
    const out = sortEntries(input);
    expect(input).toEqual([RAW_ENTRY, JSON_ENTRY, RAW_ENTRY]);
    expect(out).toEqual([JSON_ENTRY, RAW_ENTRY, RAW_ENTRY]);
  });

  it("property: output is sorted and is a permutation of the input", () => {
    fc.assert(
      fc.property(fc.array(entryArb, { maxLength: 12 }), (es) => {
        const out = sortEntries(es);
        expect(out).toHaveLength(es.length);
        expect(isSorted(out)).toBe(true);
        expect([...out].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))).toEqual(
          [...es].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))),
        );
      }),
    );
  });
});

describe("computeBundleHash (strict, pre-sorted)", () => {
  it("matches the normative bundle vector", () => {
    expect(computeBundleHash([JSON_ENTRY, XML_ENTRY, RAW_ENTRY])).toBe(SPEC_BUNDLE_HASH);
  });

  it("rejects an empty bundle", () => {
    expect(() => computeBundleHash([])).toThrow(/empty/);
  });

  it("rejects unsorted input", () => {
    expect(() => computeBundleHash([XML_ENTRY, JSON_ENTRY, RAW_ENTRY])).toThrow(/sorted/);
  });

  it("property: rejects every non-sorted permutation, accepts every sorted one", () => {
    fc.assert(
      fc.property(fc.array(entryArb, { minLength: 1, maxLength: 8 }), (es) => {
        const sorted = sortEntries(es);
        expect(computeBundleHash(sorted)).toBe(computeCanonicalBundleHash(es));
        // fc.shuffledSubarray with minLength = length gives a full permutation
        return fc.assert(
          fc.property(fc.shuffledSubarray(es, { minLength: es.length }), (perm) => {
            if (isSorted(perm)) expect(computeBundleHash(perm)).toBe(computeBundleHash(sorted));
            else expect(() => computeBundleHash(perm)).toThrow(/sorted/);
          }),
          { numRuns: 5 },
        );
      }),
    );
  });
});

describe("computeCanonicalBundleHash", () => {
  it("matches the normative bundle vector from any input order", () => {
    expect(computeCanonicalBundleHash([RAW_ENTRY, JSON_ENTRY, XML_ENTRY])).toBe(SPEC_BUNDLE_HASH);
    expect(computeCanonicalBundleHash([XML_ENTRY, RAW_ENTRY, JSON_ENTRY])).toBe(SPEC_BUNDLE_HASH);
  });

  it("rejects an empty bundle", () => {
    expect(() => computeCanonicalBundleHash([])).toThrow(/empty/);
  });

  it("property: permutation invariance", () => {
    fc.assert(
      fc.property(fc.array(entryArb, { minLength: 1, maxLength: 10 }), (es) => {
        const h = computeCanonicalBundleHash(es);
        return fc.assert(
          fc.property(fc.shuffledSubarray(es, { minLength: es.length }), (perm) => {
            expect(computeCanonicalBundleHash(perm)).toBe(h);
          }),
          { numRuns: 5 },
        );
      }),
    );
  });

  it("property: duplicates are retained (n copies hash differently from one copy)", () => {
    fc.assert(
      fc.property(entryArb, fc.integer({ min: 2, max: 6 }), (e, n) => {
        const single = computeCanonicalBundleHash([e]);
        const many = computeCanonicalBundleHash(Array.from({ length: n }, () => e));
        expect(many).not.toBe(single);
        expect(sortEntries(Array.from({ length: n }, () => e))).toHaveLength(n);
      }),
    );
  });

  it("property: a single-entry bundle hash differs from the leaf (schema prefix is applied)", () => {
    fc.assert(
      fc.property(entryArb, (e) => {
        expect(computeCanonicalBundleHash([e])).not.toBe(leafHash(e));
      }),
    );
  });

  it("rejects malformed hex fields", () => {
    expect(() => computeCanonicalBundleHash([{ ...RAW_ENTRY, role: "0x1234" as DocumentEntry["role"] }])).toThrow(/bytes32/);
  });
});
