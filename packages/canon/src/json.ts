// RFC 8785 (JSON Canonicalization Scheme) with I-JSON (RFC 7493) rejection, for
// ERC-8326 PROFILE_JSON_RFC8785. A hand-written parser is required because
// JSON.parse cannot report duplicate keys.
//
// Rejected: duplicate member names (after escape processing), invalid UTF-8,
// lone surrogates and Unicode noncharacters (escaped or raw), a leading byte
// order mark, whitespace outside RFC 8259's four characters, and any number
// literal that is not value-preserving as an IEEE-754 double, i.e. whose
// ECMAScript Number::toString serialisation denotes a different decimal value
// (covers NaN/Infinity, overflow, underflow, and excess precision).

const WS = " \t\n\r";
const NUMBER_RE = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;
const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const SHORT_ESCAPES: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };

export function normalizeJsonRfc8785(input: Uint8Array | string): Uint8Array {
  let text: string;
  if (typeof input === "string") {
    if (LONE_SURROGATE_RE.test(input)) throw new Error("JSON: input contains a lone surrogate");
    text = input;
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(input);
    } catch {
      throw new Error("JSON: input is not valid UTF-8");
    }
  }
  if (text.startsWith("﻿")) throw new Error("JSON: leading byte order mark is not allowed");
  const p = new Parser(text);
  p.skipWs();
  const out = p.value();
  p.skipWs();
  if (p.i !== text.length) throw p.fail("unexpected trailing content");
  return new TextEncoder().encode(out);
}

class Parser {
  i = 0;
  constructor(private readonly s: string) {}

  fail(msg: string): Error {
    return new Error(`JSON: ${msg} at offset ${this.i}`);
  }

  skipWs(): void {
    while (this.i < this.s.length && WS.includes(this.s[this.i] as string)) this.i++;
  }

  /** Parses one value and returns its canonical serialisation. */
  value(): string {
    const c = this.s[this.i];
    if (c === "{") return this.object();
    if (c === "[") return this.array();
    if (c === '"') return JSON.stringify(this.string());
    if (c === "-" || (c !== undefined && c >= "0" && c <= "9")) return this.number();
    for (const lit of ["null", "true", "false"]) {
      if (this.s.startsWith(lit, this.i)) {
        this.i += lit.length;
        return lit;
      }
    }
    throw this.fail(c === undefined ? "unexpected end of input" : `unexpected character ${JSON.stringify(c)}`);
  }

  object(): string {
    this.i++; // {
    const members: [string, string][] = [];
    const seen = new Set<string>();
    this.skipWs();
    if (this.s[this.i] === "}") {
      this.i++;
      return "{}";
    }
    for (;;) {
      this.skipWs();
      if (this.s[this.i] !== '"') throw this.fail("expected string key");
      const key = this.string();
      if (seen.has(key)) throw this.fail(`duplicate key ${JSON.stringify(key)}`);
      seen.add(key);
      this.skipWs();
      if (this.s[this.i] !== ":") throw this.fail("expected ':'");
      this.i++;
      this.skipWs();
      members.push([key, this.value()]);
      this.skipWs();
      const c = this.s[this.i];
      this.i++;
      if (c === "}") break;
      if (c !== ",") throw this.fail("expected ',' or '}'");
    }
    // RFC 8785 §3.2.3: sort by UTF-16 code units; JS string comparison does exactly that.
    members.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return "{" + members.map(([k, v]) => `${JSON.stringify(k)}:${v}`).join(",") + "}";
  }

  array(): string {
    this.i++; // [
    const items: string[] = [];
    this.skipWs();
    if (this.s[this.i] === "]") {
      this.i++;
      return "[]";
    }
    for (;;) {
      this.skipWs();
      items.push(this.value());
      this.skipWs();
      const c = this.s[this.i];
      this.i++;
      if (c === "]") break;
      if (c !== ",") throw this.fail("expected ',' or ']'");
    }
    return "[" + items.join(",") + "]";
  }

  /** Parses a string literal and returns its decoded (raw) value, validated per I-JSON §2.1. */
  string(): string {
    this.i++; // opening quote
    let out = "";
    for (;;) {
      const c = this.s[this.i++];
      if (c === undefined) throw this.fail("unterminated string");
      if (c === '"') break;
      if (c < " ") throw this.fail("raw control character in string");
      if (c !== "\\") {
        out += c;
        continue;
      }
      const e = this.s[this.i++];
      if (e === "u") {
        const hex = this.s.slice(this.i, this.i + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw this.fail("invalid \\u escape");
        this.i += 4;
        out += String.fromCharCode(parseInt(hex, 16));
      } else if (e !== undefined && e in SHORT_ESCAPES) {
        out += SHORT_ESCAPES[e];
      } else {
        throw this.fail("invalid escape");
      }
    }
    for (const ch of out) {
      const cp = ch.codePointAt(0) as number;
      if (cp >= 0xd800 && cp <= 0xdfff) throw this.fail("lone surrogate in string");
      if ((cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xfffe) === 0xfffe) throw this.fail("Unicode noncharacter in string");
    }
    return out;
  }

  number(): string {
    const start = this.i;
    while (this.i < this.s.length && "+-0123456789.eE".includes(this.s[this.i] as string)) this.i++;
    const literal = this.s.slice(start, this.i);
    if (!NUMBER_RE.test(literal)) throw this.fail(`invalid number literal ${JSON.stringify(literal)}`);
    const d = Number(literal);
    const canonical = String(d); // ECMAScript Number::toString, as RFC 8785 §3.2.2.3 requires
    if (!Number.isFinite(d) || !sameDecimalValue(literal, canonical)) {
      throw this.fail(`number ${literal} is not value-preserving as an IEEE-754 double`);
    }
    return canonical;
  }
}

/** True when two decimal literals denote the same rational value. */
function sameDecimalValue(a: string, b: string): boolean {
  const x = decimal(a);
  const y = decimal(b);
  return x.neg === y.neg && x.digits === y.digits && x.exp === y.exp;
}

function decimal(lit: string): { neg: boolean; digits: bigint; exp: number } {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(lit);
  if (!m) throw new Error(`not a decimal literal: ${lit}`);
  const frac = m[3] ?? "";
  let digits = BigInt(`${m[2]}${frac}`);
  let exp = Number(m[4] ?? "0") - frac.length;
  if (digits === 0n) return { neg: false, digits: 0n, exp: 0 };
  while (digits % 10n === 0n) {
    digits /= 10n;
    exp++;
  }
  return { neg: m[1] === "-", digits, exp };
}
