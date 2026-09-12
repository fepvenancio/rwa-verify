# @rwa-verify/canon

Off-chain canonicaliser and bundle hash for ERC-8326 (WS1). Targets the vendored spec text in `specs/erc-8326.md` at the pinned commit. Implements the spec, not any reference implementation.

## API

- `SCHEMA_V1`, `ROLES.{LEGAL_BASIS,EVIDENCE,CERTIFICATION,AGREEMENT,AMENDMENT,SUPPORTING}`, `PROFILE_RAW`, `PROFILE_JSON_RFC8785`, `PROFILE_XML_C14N11` — keccak256 of the spec strings.
- `filenameHash(name)`, `mimeTypeHash(mime)` — as specified (basename after `/` or `\`, ASCII A–Z folding only, NFC; media type with parameters stripped, lowercased, validated as `type/subtype`).
- `normalizeJsonRfc8785(bytes | string)`, `normalizeXmlC14n11(bytes | string)` — profile transforms returning the committed bytes.
- `buildEntry({ content, filename, mimeType, role, profile })` → `DocumentEntry`.
- `compareEntries`, `sortEntries`, `leafHash`, `computeBundleHash(sorted)` (throws on empty or unsorted), `computeCanonicalBundleHash(entries)` (sorts first).

## CLI

```
pnpm --filter @rwa-verify/canon exec tsx src/cli.ts hash [--strict] <entries.json>
pnpm --filter @rwa-verify/canon exec tsx src/cli.ts entry --file <path> --role <ROLE_NAME|0xrole> --mime <type> --profile raw|json|xml [--filename <name>]
```

`hash` reads a JSON array of `DocumentEntry` objects (five 0x-prefixed bytes32 strings) and prints exactly one line, the 0x bundle hash. `--strict` uses the pre-sorted path. `entry` prints the derived `DocumentEntry` as JSON. Any error exits 1 with a message on stderr and nothing on stdout. `pnpm --filter @rwa-verify/canon cli ...` is a shorthand; `bin` (`rwa-canon`) points at the built `dist/cli.js`. `packages/solidity/test/diff/BundleHash.diff.t.sol` calls `hash` through `vm.ffi`.

## PROFILE_JSON_RFC8785 decisions

RFC 8785 output plus I-JSON (RFC 7493) rejection, with a hand-written parser (needed to detect duplicate keys). Where the ERC leaves room, the strictest crisp reading was taken; each is logged in `docs/spec-findings.md`:

- Duplicate member names are compared after escape processing (`"a"` and `"\u0061"` collide).
- Lone surrogates and Unicode noncharacters are rejected whether raw or escaped; invalid UTF-8 (including encoded surrogates and overlongs) is rejected by a fatal decoder.
- Numbers: a literal is accepted only if it is value-preserving, i.e. its ECMAScript `Number::toString` serialisation (the RFC's reference algorithm, provided by V8) denotes the same decimal value. `4.50`, `1E30`, `0.1`, `-0` pass; `1E400`, `1e-400`, `9007199254740993`, `0.10000000000000001`, `333333333.33333329` fail. This means RFC 8785's §3.2.2 sample document is rejected as written; the test feeds the value-preserving spelling and checks the RFC's exact output bytes.
- A leading byte order mark is rejected. Whitespace is RFC 8259's four characters only. Any JSON value is accepted at top level (RFC 7493 §4.1 is only a SHOULD).
- String values are never Unicode-normalised.

## PROFILE_XML_C14N11 decisions and route

Route taken: parse with `@xmldom/xmldom`, serialise with our own implementation of the Canonical XML 1.1 §2.3 processing model (`src/xml.ts`, ~150 lines). `xml-crypto`'s `C14nCanonicalization` was evaluated first against the W3C §3 examples and rejected:

- §3.3 fails: it tracks in-scope namespaces by prefix only, so `e9`'s `xmlns:a` re-bound to a different URI is dropped.
- Processing instructions inside elements are rendered as escaped text (it treats any node with `.data` as text), and it cannot process a Document node, so PIs outside the document element and their `\n` separators are unsupported.
- A default namespace declared on a prefixed element is never rendered.
- Namespace prefixes are sorted with `localeCompare` (locale-dependent) and attributes by string-concatenated `namespaceURI + localName` rather than as a (URI, local name) pair.
- It passes §3.2 and its text/attribute escaping tables are correct.

`xml-crypto` is therefore not imported by this package; the dependency can be dropped from `package.json` by whoever next touches the lockfile.

Whole-document C14N 1.1 equals C14N 1.0: the 1.1 additions (§2.4 `xml:lang`/`xml:space` inheritance and `xml:base` fixup) apply only "when an XPath node-set is given as input and the element's parent is omitted from the node-set", verified against the spec text. §3.7–3.8 (document subsets) therefore do not apply.

Choices:

- Every `DOCTYPE` is rejected. This disables external entity resolution outright and also refuses internal subsets, whose entity declarations, `ATTLIST` defaults and attribute-type normalisation would change the canonical form and which xmldom does not process. Consequently W3C §3.1, 3.3 and 3.4 are tested with their DOCTYPE removed (expectations lose only what the DTD contributed: `attr="default"` on `e9`; NMTOKENS/ID normalisation on `normNames`/`normId`) and §3.5 is a rejection test. §3.2 and §3.6 run unmodified. The W3C page's hidden comment copy of §3.3 has a stray trailing space after `</e5>` that its visible rendering lacks; the test removes it.
- Input encodings: UTF-8 (default, BOM optional), UTF-16 with BOM, ISO-8859-1 and US-ASCII by declaration. Anything else is rejected rather than approximated.
- Line ends are normalised per XML 1.0 §2.11 (CRLF and CR → LF) before parsing; xmldom's default would also fold XML 1.1 characters.
- xmldom parses non-fatally by default; every reported warning or error is turned into a rejection, except its "Unicode replacement character detected" warning (U+FFFD is a legitimate character after strict decoding).
- Rejected as ill-formed: undeclared prefixes, undefined entity references, prefix undeclaration (`xmlns:p=""`), `xml` bound to another URI, characters outside the XML `Char` production, text outside the document element.
- Namespace and attribute ordering compares Unicode code points, not UTF-16 code units.

## Verification

```
pnpm --filter @rwa-verify/canon typecheck && pnpm --filter @rwa-verify/canon test
```

Vectors: ERC-8326 normative vectors (all constants, three entries, bundle hash), RFC 8785 §3.2.3 sorting, §3.2.4 output bytes, Appendix B numbers (24 rows), W3C C14N 1.1 §3.1–3.6 as described above, `fixtures/own/erc8326/*.json` (re-derived from their documents on every run), fast-check properties (permutation invariance, duplicate retention, strict-path rejection of every unsorted permutation, JSON idempotence and key-order invariance).
