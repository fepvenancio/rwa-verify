import type { Hex } from "@rwa-verify/core";
import { describe, expect, it } from "vitest";
import { PROFILE_JSON_RFC8785, PROFILE_RAW, PROFILE_XML_C14N11, ROLES } from "./constants.js";
import { buildEntry, normalize } from "./entry.js";

const enc = new TextEncoder();

// specs/erc-8326.md "Normative Test Vectors", end to end from raw documents.
describe("buildEntry", () => {
  it("JSON entry", () => {
    expect(
      buildEntry({
        content: enc.encode('{"b":2,"a":1}'),
        filename: "records/Café.JSON",
        mimeType: "application/json",
        role: ROLES.AGREEMENT,
        profile: PROFILE_JSON_RFC8785,
      }),
    ).toEqual({
      contentHash: "0xb8ffb64722137f4b100665a52e3c943f8066e8ab8ba3b427e6f4b404defd82b0",
      role: "0x566614d5b403a4ea71e1ef1027b77ff1e1a13a54c7f393aa64a1368de23a5f92",
      mimeTypeHash: "0x82e6a468c95da6cfe399f69ee0782fd009e354a8030ea5636ea9c7db0edcf7f5",
      filenameHash: "0x3b40ecd25f3375868ddf559a0ef47c2dc15863a529ac592bec5e1b618bcbaf3e",
      normProfileId: "0x464861b0846e795db3d9c52e9c49870c7e83f2bb07f73764f7e4850151994f40",
    });
  });

  it("XML entry", () => {
    expect(
      buildEntry({
        content: enc.encode('<doc b="2" a="1"></doc>'),
        filename: "Evidence\\Proof.XML",
        mimeType: "application/xml",
        role: ROLES.EVIDENCE,
        profile: PROFILE_XML_C14N11,
      }),
    ).toEqual({
      contentHash: "0xde64c753c807c4620bf010c7e855bcd38bd389e980c4054b81abd5d44d45eab1",
      role: "0x7477535acdef313b25d16b4871e7023fac62af68d6312bbdbdb96203a4710dc3",
      mimeTypeHash: "0x37aaf14a93fea5695fd8577aacfb548c98692a106d439219bfb9b83e3011ea2f",
      filenameHash: "0x696b36bf7095c1b1564382a37b8f5ba7d259b36be7639a7a1b50c97cd13cfe39",
      normProfileId: "0x72efa7a47196f4ad021a5a3758b19b14d8e09d7b7b211bf4745b35cba62e49c2",
    });
  });

  it("raw entry", () => {
    expect(
      buildEntry({
        content: enc.encode("Hello, ERC-8326!\n"),
        filename: "README.TXT",
        mimeType: "text/plain",
        role: ROLES.SUPPORTING,
        profile: PROFILE_RAW,
      }),
    ).toEqual({
      contentHash: "0x06750728a91d155294f77f992fec49acabb0470481439ed5e3bb59854df82ec9",
      role: "0xb0e9b5730d97b99270ce15f439eec98a4f9580e1dfbfb8f5c9e0e3ab71d4bca6",
      mimeTypeHash: "0xb25570cad408307f58d995c1dadde60bc76e94924d640305a148c9a11f8303bf",
      filenameHash: "0x31f491635b16d6fb45a7d770fcbcc8cbb6eae32ac98ab622631f4bc4a8c7e9ce",
      normProfileId: "0xbe97b35c60bb0caee86a5a99022973ef2aa47cbf9586dd34065141c6668b430b",
    });
  });

  it("normalises role/profile hex to lowercase and rejects malformed values", () => {
    const upper = ROLES.AGREEMENT.toUpperCase().replace("0X", "0x") as Hex;
    const e = buildEntry({ content: enc.encode("x"), filename: "a", mimeType: "text/plain", role: upper, profile: PROFILE_RAW });
    expect(e.role).toBe(ROLES.AGREEMENT);
    expect(() => buildEntry({ content: enc.encode("x"), filename: "a", mimeType: "text/plain", role: "0x12" as Hex, profile: PROFILE_RAW })).toThrow(/bytes32/);
  });

  it("rejects an unknown profile and propagates profile rejections", () => {
    const custom = `0x${"11".repeat(32)}` as Hex;
    expect(() => normalize(enc.encode("x"), custom)).toThrow(/unknown normalization profile/);
    expect(() =>
      buildEntry({ content: enc.encode('{"a":1,"a":2}'), filename: "d.json", mimeType: "application/json", role: ROLES.EVIDENCE, profile: PROFILE_JSON_RFC8785 }),
    ).toThrow(/duplicate/);
    expect(() =>
      buildEntry({ content: enc.encode("<a>"), filename: "d.xml", mimeType: "application/xml", role: ROLES.EVIDENCE, profile: PROFILE_XML_C14N11 }),
    ).toThrow(/XML/);
  });

  it("raw profile commits to the exact input bytes", () => {
    const bytes = new Uint8Array([0, 255, 0xef, 0xbb, 0xbf, 10]);
    expect(normalize(bytes, PROFILE_RAW)).toBe(bytes);
  });
});
