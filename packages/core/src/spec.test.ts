import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ERC, SPEC_COMMIT, specRef } from "./spec.js";

const pinned = readFileSync(new URL("../../../specs/PINNED.md", import.meta.url), "utf8");

describe("spec pinning (ADR-001)", () => {
  it("SPEC_COMMIT matches specs/PINNED.md", () => {
    expect(pinned).toContain(`SHA: ${SPEC_COMMIT}`);
  });

  it("every ERC in scope has vendored text", () => {
    for (const n of Object.values(ERC)) {
      const text = readFileSync(new URL(`../../../specs/erc-${n}.md`, import.meta.url), "utf8");
      expect(text.startsWith("---\neip: " + n)).toBe(true);
    }
  });

  it("specRef carries the pinned commit", () => {
    expect(specRef(ERC.DOCUMENT_BUNDLE_ANCHOR)).toEqual({ erc: 8326, commit: SPEC_COMMIT });
  });
});
