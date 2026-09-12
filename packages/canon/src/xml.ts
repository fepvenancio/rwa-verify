// Canonical XML 1.1 (https://www.w3.org/TR/2008/REC-xml-c14n11-20080502/) without
// comments, for ERC-8326 PROFILE_XML_C14N11. Parsing is delegated to @xmldom/xmldom;
// the serialisation below implements the §2.3 processing model for a whole document.
// §2.4 (xml:lang/xml:space inheritance and xml:base fixup) only applies to document
// subsets whose parent elements are omitted, so it never applies here.
//
// External entity resolution is disabled by rejecting every DOCTYPE. xmldom never
// fetches external entities, but internal subsets (entity and default-attribute
// declarations) would change the canonical form and are not processed by xmldom
// either, so any DOCTYPE is refused rather than silently mis-canonicalised.
import { DOMParser, type Attr, type CharacterData, type Element, type ProcessingInstruction } from "@xmldom/xmldom";

const XMLNS_URI = "http://www.w3.org/2000/xmlns/";
const XML_URI = "http://www.w3.org/XML/1998/namespace";
const ELEMENT = 1;
const TEXT = 3;
const CDATA = 4;
const PI = 7;
const COMMENT = 8;
// XML 1.0 §2.2 Char production, negated.
const INVALID_CHAR_RE = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/u;
const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export function normalizeXmlC14n11(input: Uint8Array | string): Uint8Array {
  const text = typeof input === "string" ? input : decode(input);
  if (LONE_SURROGATE_RE.test(text)) throw new Error("XML: input contains a lone surrogate");
  if (INVALID_CHAR_RE.test(text)) throw new Error("XML: input contains a character outside the XML Char production");

  let doc;
  try {
    doc = new DOMParser({
      locator: false,
      // XML 1.0 §2.11 only; xmldom's default also folds the XML 1.1 line-end characters.
      normalizeLineEndings: (s: string) => s.replace(/\r\n?/g, "\n"),
      onError: (level: string, message: string) => {
        // xmldom flags U+FFFD as a probable encoding problem; the input was decoded strictly, so it is a real character.
        if (level === "warning" && message.startsWith("Unicode replacement character detected")) return;
        throw new Error(message);
      },
    }).parseFromString(text, "text/xml");
  } catch (e) {
    throw new Error(`XML: ${(e as Error).message.split("\n")[0]}`);
  }
  if (doc.doctype) throw new Error("XML: DOCTYPE is not allowed (external entity resolution is disabled; no DTD processing)");
  if (!doc.documentElement) throw new Error("XML: missing document element");

  let out = "";
  let seenRoot = false;
  for (const node of doc.childNodes) {
    switch (node.nodeType) {
      case ELEMENT:
        out += element(node as Element, new Map());
        seenRoot = true;
        break;
      case PI: {
        const p = node as ProcessingInstruction;
        if (p.target.toLowerCase() === "xml") break; // xmldom surfaces the XML declaration as a PI
        out += seenRoot ? `\n${pi(p)}` : `${pi(p)}\n`;
        break;
      }
      case COMMENT:
        break;
      case TEXT:
        if ((node as CharacterData).data.trim() !== "") throw new Error("XML: text outside the document element");
        break;
      default:
        throw new Error(`XML: unsupported node type ${node.nodeType} at document level`);
    }
  }
  return new TextEncoder().encode(out);
}

/** `parentScope` is the set of in-scope namespace nodes of the parent element (prefix -> URI, "" = default). */
function element(el: Element, parentScope: Map<string, string>): string {
  if (el.prefix && !el.namespaceURI) throw new Error(`XML: undeclared prefix on element ${el.tagName}`);
  const scope = new Map(parentScope);
  const ns: [string, string][] = [];
  const attrs: Attr[] = [];
  for (const a of el.attributes) {
    if (a.namespaceURI !== XMLNS_URI) {
      if (a.prefix && !a.namespaceURI) throw new Error(`XML: undeclared prefix on attribute ${a.name}`);
      attrs.push(a);
      continue;
    }
    const prefix = a.name === "xmlns" ? "" : (a.localName as string);
    const uri = a.value;
    if (prefix === "xml") {
      if (uri !== XML_URI) throw new Error("XML: the xml prefix must be bound to the XML namespace");
      continue; // never output (C14N 1.1 §2.3, Namespace Axis)
    }
    if (prefix !== "" && uri === "") throw new Error(`XML: undeclaring prefix ${prefix} is not allowed in XML 1.0 namespaces`);
    scope.set(prefix, uri);
    if (prefix === "" && uri === "") {
      if ((parentScope.get("") ?? "") !== "") ns.push(["", ""]);
    } else if (parentScope.get(prefix) !== uri) {
      ns.push([prefix, uri]);
    }
  }
  ns.sort(([a], [b]) => compareCodePoints(a, b));
  attrs.sort(
    (a, b) =>
      compareCodePoints(a.namespaceURI ?? "", b.namespaceURI ?? "") ||
      compareCodePoints(a.localName as string, b.localName as string),
  );

  let out = `<${el.tagName}`;
  for (const [prefix, uri] of ns) out += prefix === "" ? ` xmlns="${escapeAttr(uri)}"` : ` xmlns:${prefix}="${escapeAttr(uri)}"`;
  for (const a of attrs) out += ` ${a.name}="${escapeAttr(a.value)}"`;
  out += ">";
  for (const child of el.childNodes) {
    switch (child.nodeType) {
      case TEXT:
      case CDATA:
        out += escapeText((child as CharacterData).data);
        break;
      case ELEMENT:
        out += element(child as Element, scope);
        break;
      case PI:
        out += pi(child as ProcessingInstruction);
        break;
      case COMMENT:
        break;
      default:
        throw new Error(`XML: unsupported node type ${child.nodeType} inside ${el.tagName}`);
    }
  }
  return `${out}</${el.tagName}>`;
}

function pi(p: ProcessingInstruction): string {
  return p.data === "" ? `<?${p.target}?>` : `<?${p.target} ${p.data}?>`;
}

function escapeText(s: string): string {
  return s.replace(/[&<>\r]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\r": "&#xD;" })[c] as string);
}

function escapeAttr(s: string): string {
  return s.replace(
    /[&<"\t\n\r]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", '"': "&quot;", "\t": "&#x9;", "\n": "&#xA;", "\r": "&#xD;" })[c] as string,
  );
}

/** Lexicographic comparison by Unicode code point (not UTF-16 code unit). */
function compareCodePoints(a: string, b: string): number {
  const xs = Array.from(a, (c) => c.codePointAt(0) as number);
  const ys = Array.from(b, (c) => c.codePointAt(0) as number);
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const d = (xs[i] as number) - (ys[i] as number);
    if (d !== 0) return d;
  }
  return xs.length - ys.length;
}

/** Decodes the entity bytes: BOM first, then the XML declaration's encoding, default UTF-8. */
function decode(bytes: Uint8Array): string {
  const strict = (label: string, b: Uint8Array) => {
    try {
      return new TextDecoder(label, { fatal: true, ignoreBOM: true }).decode(b);
    } catch {
      throw new Error(`XML: input is not valid ${label}`);
    }
  };
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return strict("utf-8", bytes.subarray(3));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return strict("utf-16be", bytes.subarray(2));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return strict("utf-16le", bytes.subarray(2));

  const head = String.fromCharCode(...bytes.subarray(0, 256));
  const declared = /^<\?xml\s[^>]*?encoding\s*=\s*["']([A-Za-z][A-Za-z0-9._-]*)["']/.exec(head)?.[1]?.toLowerCase() ?? "utf-8";
  switch (declared) {
    case "utf-8":
      return strict("utf-8", bytes);
    case "iso-8859-1":
    case "latin1":
      return String.fromCharCode(...bytes);
    case "us-ascii":
    case "ascii":
      if (bytes.some((b) => b > 0x7f)) throw new Error("XML: input is not valid US-ASCII");
      return String.fromCharCode(...bytes);
    default:
      throw new Error(`XML: unsupported encoding ${declared} (UTF-8, UTF-16 with BOM, ISO-8859-1, US-ASCII)`);
  }
}
