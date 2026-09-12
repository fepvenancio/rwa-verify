#!/usr/bin/env node
// Differential-test surface (called by packages/solidity via vm.ffi). `hash` prints exactly one line.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { Hex } from "@rwa-verify/core";
import { computeBundleHash, computeCanonicalBundleHash, type DocumentEntry } from "./bundle.js";
import { PROFILE_JSON_RFC8785, PROFILE_RAW, PROFILE_XML_C14N11, ROLES } from "./constants.js";
import { buildEntry } from "./entry.js";

const USAGE = `usage:
  cli hash [--strict] <entries.json>
  cli entry --file <path> --role <ROLE_NAME|0xrole> --mime <type> --profile raw|json|xml [--filename <name>]`;

const PROFILES: Record<string, Hex> = { raw: PROFILE_RAW, json: PROFILE_JSON_RFC8785, xml: PROFILE_XML_C14N11 };
const FIELDS = ["contentHash", "role", "mimeTypeHash", "filenameHash", "normProfileId"] as const;

function main(argv: string[]): string {
  const [cmd, ...rest] = argv;
  if (cmd === "hash") {
    const { values, positionals } = parseArgs({ args: rest, options: { strict: { type: "boolean" } }, allowPositionals: true });
    if (positionals.length !== 1) throw new Error(USAGE);
    const entries = parseEntries(readFileSync(positionals[0] as string, "utf8"));
    return values.strict ? computeBundleHash(entries) : computeCanonicalBundleHash(entries);
  }
  if (cmd === "entry") {
    const { values } = parseArgs({
      args: rest,
      options: { file: { type: "string" }, role: { type: "string" }, mime: { type: "string" }, profile: { type: "string" }, filename: { type: "string" } },
    });
    const { file, role, mime, profile, filename } = values;
    if (!file || !role || !mime || !profile) throw new Error(USAGE);
    const profileId = PROFILES[profile];
    if (!profileId) throw new Error(`unknown profile ${profile} (raw|json|xml)`);
    const roleId = role in ROLES ? ROLES[role as keyof typeof ROLES] : role.startsWith("0x") ? (role as Hex) : undefined;
    if (!roleId) throw new Error(`unknown role ${role} (${Object.keys(ROLES).join("|")} or 0x-prefixed bytes32)`);
    const entry = buildEntry({ content: new Uint8Array(readFileSync(file)), filename: filename ?? file, mimeType: mime, role: roleId, profile: profileId });
    return JSON.stringify(entry, null, 2);
  }
  throw new Error(USAGE);
}

function parseEntries(text: string): DocumentEntry[] {
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("entries file must contain a JSON array");
  return data.map((item, i) => {
    if (typeof item !== "object" || item === null) throw new Error(`entry ${i} is not an object`);
    const entry: Record<string, Hex> = {};
    for (const f of FIELDS) {
      const v = (item as Record<string, unknown>)[f];
      if (typeof v !== "string") throw new Error(`entry ${i}: missing string field ${f}`);
      entry[f] = v as Hex;
    }
    return entry as unknown as DocumentEntry;
  });
}

try {
  process.stdout.write(`${main(process.argv.slice(2))}\n`);
} catch (e) {
  process.stderr.write(`error: ${(e as Error).message}\n`);
  process.exitCode = 1;
}
