import type { Hex } from "@rwa-verify/core";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeBundleHash, computeCanonicalBundleHash, type DocumentEntry, sortEntries } from "./bundle.js";
import { PROFILE_JSON_RFC8785, PROFILE_RAW, PROFILE_XML_C14N11, ROLES } from "./constants.js";
import { buildEntry } from "./entry.js";

interface Doc {
  filename: string;
  mimeType: string;
  role: string;
  profile: "raw" | "json" | "xml";
  content?: string;
  contentHex?: string;
}
interface Fixture {
  description: string;
  documents: Doc[];
  entries: DocumentEntry[];
  bundleHash: Hex;
}

const dir = fileURLToPath(new URL("../../../fixtures/own/erc8326/", import.meta.url));
const PROFILES: Record<Doc["profile"], Hex> = { raw: PROFILE_RAW, json: PROFILE_JSON_RFC8785, xml: PROFILE_XML_C14N11 };
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const load = (f: string) => JSON.parse(readFileSync(dir + f, "utf8")) as Fixture;

function bytes(d: Doc): Uint8Array {
  if (d.contentHex !== undefined) return Uint8Array.from((d.contentHex.slice(2).match(/../g) ?? []).map((h) => parseInt(h, 16)));
  return new TextEncoder().encode(d.content as string);
}

describe("fixtures/own/erc8326", () => {
  it("has provenance and at least six fixtures", () => {
    expect(existsSync(dir + "SOURCE.md")).toBe(true);
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  it.each(files)("%s: entries derive from the documents and both hashing paths reproduce bundleHash", (f) => {
    const fx = load(f);
    expect(fx.documents.length).toBe(fx.entries.length);
    const rebuilt = fx.documents.map((d) =>
      buildEntry({
        content: bytes(d),
        filename: d.filename,
        mimeType: d.mimeType,
        role: d.role in ROLES ? ROLES[d.role as keyof typeof ROLES] : (d.role as Hex),
        profile: PROFILES[d.profile],
      }),
    );
    expect(rebuilt).toEqual(fx.entries);
    expect(computeCanonicalBundleHash(fx.entries)).toBe(fx.bundleHash);
    expect(computeBundleHash(sortEntries(fx.entries))).toBe(fx.bundleHash);
  });

  it("spec-normative-bundle matches the ERC's published bundle hash", () => {
    expect(load("spec-normative-bundle.json").bundleHash).toBe("0xbe712c4a5eb51d9eb303f1a5c896417a8407a420936fa210626bb66b1a6d0613");
  });

  it("duplicate-entries keeps all copies and hashes differently from single-raw", () => {
    const dup = load("duplicate-entries.json");
    expect(dup.entries).toHaveLength(3);
    expect(new Set(dup.entries.map((e) => JSON.stringify(e))).size).toBe(1);
    expect(dup.bundleHash).not.toBe(load("single-raw.json").bundleHash);
  });

  it("covers the JSON profile, the XML profile, and every spec role", () => {
    const all = files.map(load);
    const profiles = new Set(all.flatMap((fx) => fx.documents.map((d) => d.profile)));
    expect([...profiles].sort()).toEqual(["json", "raw", "xml"]);
    const roles = new Set(all.flatMap((fx) => fx.documents.map((d) => d.role)));
    for (const r of Object.keys(ROLES)) expect(roles.has(r), r).toBe(true);
  });
});
