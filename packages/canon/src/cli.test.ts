import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pkgDir = fileURLToPath(new URL("..", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "canon-cli-"));

function cli(...args: string[]) {
  const r = spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], { cwd: pkgDir, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const JSON_E = {
  contentHash: "0xb8ffb64722137f4b100665a52e3c943f8066e8ab8ba3b427e6f4b404defd82b0",
  role: "0x566614d5b403a4ea71e1ef1027b77ff1e1a13a54c7f393aa64a1368de23a5f92",
  mimeTypeHash: "0x82e6a468c95da6cfe399f69ee0782fd009e354a8030ea5636ea9c7db0edcf7f5",
  filenameHash: "0x3b40ecd25f3375868ddf559a0ef47c2dc15863a529ac592bec5e1b618bcbaf3e",
  normProfileId: "0x464861b0846e795db3d9c52e9c49870c7e83f2bb07f73764f7e4850151994f40",
};
const XML_E = {
  contentHash: "0xde64c753c807c4620bf010c7e855bcd38bd389e980c4054b81abd5d44d45eab1",
  role: "0x7477535acdef313b25d16b4871e7023fac62af68d6312bbdbdb96203a4710dc3",
  mimeTypeHash: "0x37aaf14a93fea5695fd8577aacfb548c98692a106d439219bfb9b83e3011ea2f",
  filenameHash: "0x696b36bf7095c1b1564382a37b8f5ba7d259b36be7639a7a1b50c97cd13cfe39",
  normProfileId: "0x72efa7a47196f4ad021a5a3758b19b14d8e09d7b7b211bf4745b35cba62e49c2",
};
const RAW_E = {
  contentHash: "0x06750728a91d155294f77f992fec49acabb0470481439ed5e3bb59854df82ec9",
  role: "0xb0e9b5730d97b99270ce15f439eec98a4f9580e1dfbfb8f5c9e0e3ab71d4bca6",
  mimeTypeHash: "0xb25570cad408307f58d995c1dadde60bc76e94924d640305a148c9a11f8303bf",
  filenameHash: "0x31f491635b16d6fb45a7d770fcbcc8cbb6eae32ac98ab622631f4bc4a8c7e9ce",
  normProfileId: "0xbe97b35c60bb0caee86a5a99022973ef2aa47cbf9586dd34065141c6668b430b",
};
const SPEC_HASH = "0xbe712c4a5eb51d9eb303f1a5c896417a8407a420936fa210626bb66b1a6d0613\n";

describe("cli hash", () => {
  const unsorted = join(dir, "unsorted.json");
  const sorted = join(dir, "sorted.json");
  writeFileSync(unsorted, JSON.stringify([RAW_E, JSON_E, XML_E]));
  writeFileSync(sorted, JSON.stringify([JSON_E, XML_E, RAW_E]));

  it("prints exactly one 0x line for the canonical path", () => {
    const r = cli("hash", unsorted);
    expect(r).toEqual({ code: 0, out: SPEC_HASH, err: "" });
  });

  it("--strict accepts sorted input and rejects unsorted input with no stdout", () => {
    expect(cli("hash", "--strict", sorted)).toEqual({ code: 0, out: SPEC_HASH, err: "" });
    const r = cli("hash", "--strict", unsorted);
    expect(r.code).toBe(1);
    expect(r.out).toBe("");
    expect(r.err).toMatch(/not sorted/);
  });

  it("fails with a stderr message on empty bundles, malformed entries, missing files, and bad usage", () => {
    const empty = join(dir, "empty.json");
    writeFileSync(empty, "[]");
    const bad = join(dir, "bad.json");
    writeFileSync(bad, JSON.stringify([{ ...RAW_E, role: "0x12" }]));
    const notArray = join(dir, "obj.json");
    writeFileSync(notArray, "{}");
    for (const args of [["hash", empty], ["hash", bad], ["hash", notArray], ["hash", join(dir, "missing.json")], ["hash"], ["hash", sorted, sorted], ["nope"], []]) {
      const r = cli(...args);
      expect(r.code, args.join(" ")).toBe(1);
      expect(r.out).toBe("");
      expect(r.err).toMatch(/^error: /);
    }
  });
});

describe("cli entry", () => {
  it("builds the normative raw entry, defaulting the filename to the file path", () => {
    const file = join(dir, "README.TXT");
    writeFileSync(file, "Hello, ERC-8326!\n");
    const r = cli("entry", "--file", file, "--role", "SUPPORTING", "--mime", "text/plain", "--profile", "raw");
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toEqual(RAW_E);
  });

  it("accepts --filename and a 0x role, and applies the json profile", () => {
    const file = join(dir, "doc.json");
    writeFileSync(file, '{"b":2,"a":1}');
    const r = cli("entry", "--file", file, "--role", JSON_E.role, "--mime", "application/json; charset=utf-8", "--profile", "json", "--filename", "records/Café.JSON");
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toEqual(JSON_E);
  });

  it("applies the xml profile", () => {
    const file = join(dir, "Proof.XML");
    writeFileSync(file, '<doc b="2" a="1"></doc>');
    const r = cli("entry", "--file", file, "--role", "EVIDENCE", "--mime", "application/xml", "--profile", "xml", "--filename", "Evidence\\Proof.XML");
    expect(JSON.parse(r.out)).toEqual(XML_E);
  });

  it("rejects unknown roles/profiles, missing options, and invalid documents", () => {
    const file = join(dir, "dup.json");
    writeFileSync(file, '{"a":1,"a":2}');
    for (const args of [
      ["entry", "--file", file, "--role", "NOPE", "--mime", "application/json", "--profile", "json"],
      ["entry", "--file", file, "--role", "EVIDENCE", "--mime", "application/json", "--profile", "yaml"],
      ["entry", "--file", file, "--role", "EVIDENCE", "--profile", "json"],
      ["entry", "--file", file, "--role", "EVIDENCE", "--mime", "application/json", "--profile", "json"],
    ]) {
      const r = cli(...args);
      expect(r.code, args.join(" ")).toBe(1);
      expect(r.out).toBe("");
      expect(r.err).toMatch(/^error: /);
    }
  });
});
