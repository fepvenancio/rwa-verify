import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { keccak256Hex } from "./hash.js";
import { normalizeJsonRfc8785 } from "./json.js";

const enc = new TextEncoder();
const dec = new TextDecoder();
const canon = (s: string | Uint8Array) => dec.decode(normalizeJsonRfc8785(s));
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

describe("ERC-8326 normative JSON vector", () => {
  it("{\"b\":2,\"a\":1} -> {\"a\":1,\"b\":2} with the published contentHash", () => {
    const out = normalizeJsonRfc8785(enc.encode('{"b":2,"a":1}'));
    expect(hex(out)).toBe("7b2261223a312c2262223a327d");
    expect(keccak256Hex(out)).toBe("0xb8ffb64722137f4b100665a52e3c943f8066e8ab8ba3b427e6f4b404defd82b0");
  });
});

describe("RFC 8785 §3.2.3 property sorting vector", () => {
  it("sorts by UTF-16 code units", () => {
    const input = `{
       "\\u20ac": "Euro Sign",
       "\\r": "Carriage Return",
       "\\ufb33": "Hebrew Letter Dalet With Dagesh",
       "1": "One",
       "\\ud83d\\ude00": "Emoji: Grinning Face",
       "\\u0080": "Control",
       "\\u00f6": "Latin Small Letter O With Diaeresis"
     }`;
    const values = [...canon(input).matchAll(/:"([^"]*)"/g)].map((m) => m[1]);
    expect(values).toEqual([
      "Carriage Return",
      "One",
      "Control",
      "Latin Small Letter O With Diaeresis",
      "Euro Sign",
      "Emoji: Grinning Face",
      "Hebrew Letter Dalet With Dagesh",
    ]);
  });
});

describe("RFC 8785 §3.2.4 UTF-8 output vector", () => {
  // The RFC's sample input contains 333333333.33333329, a literal that is not
  // value-preserving under IEEE-754 double (it serialises as 333333333.3333333).
  // Our strict I-JSON reading rejects it (see below), so the vector is fed the
  // value-preserving spelling, which the RFC shows yields the same output bytes.
  const sample = `{
       "numbers": [333333333.3333333, 1E30, 4.50,
                   2e-3, 0.000000000000000000000000001],
       "string": "\\u20ac$\\u000F\\u000aA'\\u0042\\u0022\\u005c\\\\\\"\\/",
       "literals": [null, true, false]
     }`;
  const expected =
    "7b226c69746572616c73223a5b6e756c6c2c747275652c66616c73655d2c226e756d62657273223a5b3333333333333333332e333333333333332c31652b33302c342e352c302e3030322c31652d32375d2c22737472696e67223a22e282ac245c7530303066" +
    "5c6e4127425c225c5c5c5c5c222f227d";

  it("produces the RFC's exact bytes", () => {
    expect(hex(normalizeJsonRfc8785(sample))).toBe(expected);
  });

  it("rejects the RFC's original 333333333.33333329 (not value-preserving as a double)", () => {
    expect(() => canon("[333333333.33333329]")).toThrow(/number/);
  });
});

describe("RFC 8785 Appendix B number serialisation", () => {
  // [IEEE 754 bits, JSON representation]
  const table: [string, string][] = [
    ["0000000000000000", "0"],
    ["8000000000000000", "0"],
    ["0000000000000001", "5e-324"],
    ["8000000000000001", "-5e-324"],
    ["7fefffffffffffff", "1.7976931348623157e+308"],
    ["ffefffffffffffff", "-1.7976931348623157e+308"],
    ["4340000000000000", "9007199254740992"],
    ["c340000000000000", "-9007199254740992"],
    ["4430000000000000", "295147905179352830000"],
    ["44b52d02c7e14af5", "9.999999999999997e+22"],
    ["44b52d02c7e14af6", "1e+23"],
    ["44b52d02c7e14af7", "1.0000000000000001e+23"],
    ["444b1ae4d6e2ef4e", "999999999999999700000"],
    ["444b1ae4d6e2ef4f", "999999999999999900000"],
    ["444b1ae4d6e2ef50", "1e+21"],
    ["3eb0c6f7a0b5ed8c", "9.999999999999997e-7"],
    ["3eb0c6f7a0b5ed8d", "0.000001"],
    ["41b3de4355555553", "333333333.3333332"],
    ["41b3de4355555554", "333333333.33333325"],
    ["41b3de4355555555", "333333333.3333333"],
    ["41b3de4355555556", "333333333.3333334"],
    ["41b3de4355555557", "333333333.33333343"],
    ["becbf647612f3696", "-0.0000033333333333333333"],
    ["43143ff3c1cb0959", "1424953923781206.2"],
  ];
  const fromBits = (h: string) => {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setBigUint64(0, BigInt("0x" + h));
    return dv.getFloat64(0);
  };

  it.each(table)("bits %s serialise as %s and re-canonicalise to themselves", (bits, json) => {
    expect(String(fromBits(bits))).toBe(json); // platform Number::toString is the RFC's reference
    expect(canon(`[${json}]`)).toBe(`[${json}]`);
  });

  it("rejects NaN and Infinity spellings and out-of-range magnitudes", () => {
    for (const bad of ["NaN", "Infinity", "-Infinity", "1E400", "-1e400", "1e999999999999"]) {
      expect(() => canon(`[${bad}]`)).toThrow();
    }
  });
});

describe("number acceptance (I-JSON strict reading: literal must be value-preserving)", () => {
  it.each([
    ["1.0", "1"],
    ["4.50", "4.5"],
    ["1E30", "1e+30"],
    ["2e-3", "0.002"],
    ["0.000000000000000000000000001", "1e-27"],
    ["-0", "0"],
    ["-0.0", "0"],
    ["0.1", "0.1"],
    ["100000000000000000000000", "1e+23"],
    ["295147905179352830000", "295147905179352830000"],
    ["1e21", "1e+21"],
    ["123456789012345680000", "123456789012345680000"],
    ["0.30000000000000004", "0.30000000000000004"],
  ])("%s -> %s", (input, out) => {
    expect(canon(`[${input}]`)).toBe(`[${out}]`);
  });

  it.each([
    "9007199254740993", // rounds to ...992
    "295147905179352825856", // exact 2**68, but its double serialises as 295147905179352830000
    "3.141592653589793238462643383279", // I-JSON's own example
    "0.10000000000000001", // %.17g spelling of 0.1
    "1e-400", // underflows to 0
    "123456789012345678901234567890",
  ])("rejects %s", (input) => {
    expect(() => canon(`[${input}]`)).toThrow(/number/);
  });

  it("rejects non-RFC 8259 number syntax", () => {
    for (const bad of ["01", "+1", "1.", ".5", "0x1", "1e", "1e+", "--1", "1_000", "١"]) {
      expect(() => canon(`[${bad}]`)).toThrow();
    }
  });
});

describe("strings", () => {
  it("escapes exactly as RFC 8785 §3.2.2.2", () => {
    const input = '"\\u0000\\u001f\\b\\t\\n\\f\\r\\"\\\\\\/\\u007f\\u2028\\u00e9"';
    expect(canon(input)).toBe('"\\u0000\\u001f\\b\\t\\n\\f\\r\\"\\\\/\u007f\u2028é"');
  });

  it("decodes surrogate pairs and emits them as raw UTF-8", () => {
    expect(hex(normalizeJsonRfc8785('"\\ud83d\\ude00"'))).toBe("22f09f988022");
  });

  it("rejects lone surrogates, escaped or raw", () => {
    expect(() => canon('"\\udead"')).toThrow(/surrogate/);
    expect(() => canon('"\\ud800x"')).toThrow(/surrogate/);
    expect(() => canon('"\\ude00"')).toThrow(/surrogate/);
    expect(() => canon('"\uD800"')).toThrow(/surrogate/);
    // UTF-8-encoded surrogate (ED A0 80) is invalid UTF-8
    expect(() => canon(new Uint8Array([0x22, 0xed, 0xa0, 0x80, 0x22]))).toThrow(/UTF-8/);
  });

  it("rejects Unicode noncharacters (I-JSON §2.1)", () => {
    expect(() => canon('"\\ufffe"')).toThrow(/noncharacter/);
    expect(() => canon('"\\ufdd0"')).toThrow(/noncharacter/);
    expect(() => canon('"\u{1FFFF}"')).toThrow(/noncharacter/);
    expect(canon('"\ufdcf\ufdf0"')).toBe('"\ufdcf\ufdf0"');
  });

  it("rejects raw control characters and invalid escapes", () => {
    expect(() => canon('"a\u0001b"')).toThrow();
    expect(() => canon('"a\nb"')).toThrow();
    expect(() => canon('"\\x"')).toThrow();
    expect(() => canon('"\\u12"')).toThrow();
    expect(() => canon('"\\u12G4"')).toThrow();
    expect(() => canon('"unterminated')).toThrow();
  });

  it("does not NFC-normalise string values", () => {
    const decomposed = "e\u0301";
    expect(canon(`"${decomposed}"`)).toBe(`"${decomposed}"`);
  });
});

describe("objects", () => {
  it("rejects duplicate keys, including duplicates after escape processing", () => {
    expect(() => canon('{"a":1,"a":2}')).toThrow(/duplicate/);
    expect(() => canon('{"a":1,"\\u0061":2}')).toThrow(/duplicate/);
    expect(() => canon('{"x":{"a":1,"a":1}}')).toThrow(/duplicate/);
  });

  it("sorts recursively, leaves array order alone", () => {
    expect(canon('[{"b":[{"z":1,"y":2}],"a":{"d":1,"c":2}}, 3, 1]')).toBe('[{"a":{"c":2,"d":1},"b":[{"y":2,"z":1}]},3,1]');
  });

  it("empty string key sorts first", () => {
    expect(canon('{"a":1,"":2}')).toBe('{"":2,"a":1}');
  });

  it("rejects trailing commas and missing separators", () => {
    for (const bad of ['{"a":1,}', "[1,]", '{"a" 1}', '{"a":1 "b":2}', "[1 2]", '{a:1}', "{'a':1}"]) {
      expect(() => canon(bad)).toThrow();
    }
  });
});

describe("document level", () => {
  it("accepts any top-level value and RFC 8259 whitespace", () => {
    expect(canon(" \t\r\n[ ] \r\n")).toBe("[]");
    expect(canon("{ }")).toBe("{}");
    expect(canon(" true ")).toBe("true");
    expect(canon("null")).toBe("null");
    expect(canon('"s"')).toBe('"s"');
    expect(canon("1")).toBe("1");
  });

  it("rejects empty input, trailing content, and non-JSON whitespace", () => {
    for (const bad of ["", "   ", "[] []", "[]x", "\u00a0[]", "\f[]", "[1,\u200b2]"]) {
      expect(() => canon(bad)).toThrow();
    }
  });

  it("rejects a leading byte order mark", () => {
    expect(() => canon(new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]))).toThrow(/byte order mark/);
    expect(() => canon("\ufeff{}")).toThrow(/byte order mark/);
  });

  it("rejects invalid UTF-8", () => {
    expect(() => canon(new Uint8Array([0x5b, 0xff, 0x5d]))).toThrow(/UTF-8/);
    expect(() => canon(new Uint8Array([0x22, 0xc0, 0x80, 0x22]))).toThrow(/UTF-8/); // overlong NUL
  });

  it("rejects literals that are not exactly null/true/false", () => {
    for (const bad of ["True", "nul", "truee", "undefined"]) expect(() => canon(bad)).toThrow();
  });
});

describe("properties", () => {
  const key = fc.string({ maxLength: 6 });
  it("idempotent, whitespace-insensitive, key-order-insensitive, and JSON.parse-equivalent", () => {
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 4, stringUnit: "grapheme" as never }), (v) => {
        const compact = JSON.stringify(v);
        const pretty = JSON.stringify(v, null, 2);
        const out = canon(compact);
        expect(canon(pretty)).toBe(out);
        expect(canon(out)).toBe(out);
        expect(JSON.parse(out)).toEqual(JSON.parse(compact));
      }),
    );
  });

  it("object member order does not affect the output", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.tuple(key, fc.integer()), { selector: (t) => t[0], minLength: 1, maxLength: 8 }), (pairs) => {
        const text = (ps: [string, number][]) => "{" + ps.map(([k, n]) => `${JSON.stringify(k)}:${n}`).join(",") + "}";
        const expected = canon(text(pairs));
        return fc.assert(
          fc.property(fc.shuffledSubarray(pairs, { minLength: pairs.length }), (perm) => {
            expect(canon(text(perm))).toBe(expected);
          }),
          { numRuns: 3 },
        );
      }),
    );
  });

  it("any duplicated key is rejected", () => {
    fc.assert(
      fc.property(fc.uniqueArray(key, { minLength: 1, maxLength: 5 }), fc.nat(), (keys, pick) => {
        const dup = keys[pick % keys.length] as string;
        const text = "{" + [...keys, dup].map((k) => `${JSON.stringify(k)}:0`).join(",") + "}";
        expect(() => canon(text)).toThrow(/duplicate/);
      }),
    );
  });
});
