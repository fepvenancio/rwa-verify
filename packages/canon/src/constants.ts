// Identifiers from specs/erc-8326.md "Schema, Role, and Profile Identifiers".
import { keccak256Hex } from "./hash.js";

const id = (s: string) => keccak256Hex(new TextEncoder().encode(s));

export const SCHEMA_V1 = id("ERC-8326:BUNDLE:V1");

export const ROLES = {
  LEGAL_BASIS: id("LEGAL_BASIS"),
  EVIDENCE: id("EVIDENCE"),
  CERTIFICATION: id("CERTIFICATION"),
  AGREEMENT: id("AGREEMENT"),
  AMENDMENT: id("AMENDMENT"),
  SUPPORTING: id("SUPPORTING"),
} as const;

export const PROFILE_RAW = id("NORM:RAW:V1");
export const PROFILE_JSON_RFC8785 = id("NORM:JSON:RFC8785:V1");
export const PROFILE_XML_C14N11 = id("NORM:XML:C14N11:V1");
