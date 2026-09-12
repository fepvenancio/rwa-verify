import { describe, expect, it } from "vitest";
import {
  PROFILE_JSON_RFC8785,
  PROFILE_RAW,
  PROFILE_XML_C14N11,
  ROLES,
  SCHEMA_V1,
} from "./constants.js";

// Values from specs/erc-8326.md "Normative Test Vectors".
describe("ERC-8326 identifiers", () => {
  it("SCHEMA_V1 = keccak256('ERC-8326:BUNDLE:V1')", () => {
    expect(SCHEMA_V1).toBe("0x1853dddb0c73884633f2ff8e736679ec654a11f704ed868aacca79d8ae4caf67");
  });

  it("role ids match the normative vectors", () => {
    expect(ROLES.AGREEMENT).toBe("0x566614d5b403a4ea71e1ef1027b77ff1e1a13a54c7f393aa64a1368de23a5f92");
    expect(ROLES.EVIDENCE).toBe("0x7477535acdef313b25d16b4871e7023fac62af68d6312bbdbdb96203a4710dc3");
    expect(ROLES.SUPPORTING).toBe("0xb0e9b5730d97b99270ce15f439eec98a4f9580e1dfbfb8f5c9e0e3ab71d4bca6");
  });

  it("defines all six spec roles, all distinct", () => {
    const names = ["LEGAL_BASIS", "EVIDENCE", "CERTIFICATION", "AGREEMENT", "AMENDMENT", "SUPPORTING"];
    expect(Object.keys(ROLES).sort()).toEqual([...names].sort());
    expect(new Set(Object.values(ROLES)).size).toBe(6);
  });

  it("profile ids match the normative vectors", () => {
    expect(PROFILE_JSON_RFC8785).toBe("0x464861b0846e795db3d9c52e9c49870c7e83f2bb07f73764f7e4850151994f40");
    expect(PROFILE_XML_C14N11).toBe("0x72efa7a47196f4ad021a5a3758b19b14d8e09d7b7b211bf4745b35cba62e49c2");
    expect(PROFILE_RAW).toBe("0xbe97b35c60bb0caee86a5a99022973ef2aa47cbf9586dd34065141c6668b430b");
  });
});
