import { describe, expect, it } from "vitest";
import { keccak256Hex } from "./hash.js";
import { normalizeXmlC14n11 } from "./xml.js";

const enc = new TextEncoder();
const dec = new TextDecoder();
const canon = (s: string | Uint8Array) => dec.decode(normalizeXmlC14n11(s));
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

describe("ERC-8326 normative XML vector", () => {
  it('<doc b="2" a="1"></doc> -> <doc a="1" b="2"></doc> with the published contentHash', () => {
    const out = normalizeXmlC14n11(enc.encode('<doc b="2" a="1"></doc>'));
    expect(hex(out)).toBe("3c646f6320613d22312220623d2232223e3c2f646f633e");
    expect(keccak256Hex(out)).toBe("0xde64c753c807c4620bf010c7e855bcd38bd389e980c4054b81abd5d44d45eab1");
  });
});

// Input/output pairs from https://www.w3.org/TR/2008/REC-xml-c14n11-20080502/ §3, taken
// verbatim from the HTML comments the spec carries next to each example. Where an input
// carries a DOCTYPE, this profile rejects it (external entity resolution disabled, no DTD
// processing), so the DOCTYPE-free variant is tested and the expectation loses only what
// the DTD contributed (default attribute in 3.3; NMTOKENS/ID attribute-type normalisation
// in 3.4). 3.7 and 3.8 are document-subset examples and do not apply to whole documents.
describe("W3C Canonical XML 1.1 §3 examples", () => {
  const in31 = "<?xml version=\"1.0\"?>\n\n<?xml-stylesheet   href=\"doc.xsl\"\n   type=\"text/xsl\"   ?>\n\n<!DOCTYPE doc SYSTEM \"doc.dtd\">\n\n<doc>Hello, world!<!-- Comment 1 --></doc>\n\n<?pi-without-data     ?>\n\n<!-- Comment 2 -->\n\n<!-- Comment 3 -->";
  const out31 = "<?xml-stylesheet href=\"doc.xsl\"\n   type=\"text/xsl\"   ?>\n<doc>Hello, world!</doc>\n<?pi-without-data?>";
  it("3.1 PIs, comments, outside of document element (uncommented form), DOCTYPE line removed", () => {
    expect(canon(in31.replace('<!DOCTYPE doc SYSTEM "doc.dtd">\n\n', ""))).toBe(out31);
  });
  it("3.1 as published is rejected: DOCTYPE with external subset", () => {
    expect(() => canon(in31)).toThrow(/DOCTYPE/);
  });

  const ex32 = "<doc>\n   <clean>   </clean>\n   <dirty>   A   B   </dirty>\n   <mixed>\n      A\n      <clean>   </clean>\n      B\n      <dirty>   A   B   </dirty>\n      C\n   </mixed>\n</doc>";
  it("3.2 whitespace in document content is retained (input equals output)", () => {
    expect(canon(ex32)).toBe(ex32);
  });

  const in33 = "<!DOCTYPE doc [<!ATTLIST e9 attr CDATA \"default\">]>\n<doc>\n   <e1   />\n   <e2   ></e2>\n   <e3    name = \"elem3\"   id=\"elem3\"    />\n   <e4    name=\"elem4\"   id=\"elem4\"    ></e4>\n   <e5 a:attr=\"out\" b:attr=\"sorted\" attr2=\"all\" attr=\"I'm\"\n       xmlns:b=\"http://www.ietf.org\" \n       xmlns:a=\"http://www.w3.org\"\n       xmlns=\"http://example.org\"/>\n   <e6 xmlns=\"\" xmlns:a=\"http://www.w3.org\">\n       <e7 xmlns=\"http://www.ietf.org\">\n           <e8 xmlns=\"\" xmlns:a=\"http://www.w3.org\">\n               <e9 xmlns=\"\" xmlns:a=\"http://www.ietf.org\"/>\n           </e8>\n       </e7>\n   </e6>\n</doc>";
  const out33 = "<doc>\n   <e1></e1>\n   <e2></e2>\n   <e3 id=\"elem3\" name=\"elem3\"></e3>\n   <e4 id=\"elem4\" name=\"elem4\"></e4>\n   <e5 xmlns=\"http://example.org\" xmlns:a=\"http://www.w3.org\" xmlns:b=\"http://www.ietf.org\" attr=\"I'm\" attr2=\"all\" b:attr=\"sorted\" a:attr=\"out\"></e5> \n   <e6 xmlns:a=\"http://www.w3.org\">\n       <e7 xmlns=\"http://www.ietf.org\">\n           <e8 xmlns=\"\">\n               <e9 xmlns:a=\"http://www.ietf.org\" attr=\"default\"></e9>\n           </e8>\n       </e7>\n   </e6>\n</doc>";
  it("3.3 start and end tags, DOCTYPE removed (drops the ATTLIST default attr=\"default\" on e9)", () => {
    // The page's hidden comment copy has a stray trailing space after </e5>; the input has no
    // whitespace there and the spec's visible rendering has none either.
    const expected = out33.replace(' attr="default"', "").replace("</e5> \n", "</e5>\n");
    expect(canon(in33.replace(/^<!DOCTYPE[\s\S]*?\]>\n/, ""))).toBe(expected);
  });
  it("3.3 as published is rejected: DOCTYPE", () => {
    expect(() => canon(in33)).toThrow(/DOCTYPE/);
  });

  const in34 = "<!DOCTYPE doc [\n<!ATTLIST normId id ID #IMPLIED>\n<!ATTLIST normNames attr NMTOKENS #IMPLIED>\n]>\n<doc>\n   <text>First line&#x0d;&#10;Second line</text>\n   <value>&#x32;</value>\n   <compute><![CDATA[value>\"0\" && value<\"10\" ?\"valid\":\"error\"]]></compute>\n   <compute expr='value>\"0\" &amp;&amp; value&lt;\"10\" ?\"valid\":\"error\"'>valid</compute>\n   <norm attr=' &apos;   &#x20;&#13;&#xa;&#9;   &apos; '/>\n   <normNames attr='   A   &#x20;&#13;&#xa;&#9;   B   '/>\n   <normId id=' &apos;   &#x20;&#13;&#xa;&#9;   &apos; '/>\n</doc>";
  const out34 = "<doc>\n   <text>First line&#xD;\nSecond line</text>\n   <value>2</value>\n   <compute>value&gt;\"0\" &amp;&amp; value&lt;\"10\" ?\"valid\":\"error\"</compute>\n   <compute expr=\"value>&quot;0&quot; &amp;&amp; value&lt;&quot;10&quot; ?&quot;valid&quot;:&quot;error&quot;\">valid</compute>\n   <norm attr=\" '    &#xD;&#xA;&#x9;   ' \"></norm>\n   <normNames attr=\"A &#xD;&#xA;&#x9; B\"></normNames>\n   <normId id=\"' &#xD;&#xA;&#x9; '\"></normId>\n</doc>";
  it("3.4 character modifications and character references, DOCTYPE removed (normNames/normId become CDATA-typed)", () => {
    const expected = out34
      .replace('<normNames attr="A &#xD;&#xA;&#x9; B">', '<normNames attr="   A    &#xD;&#xA;&#x9;   B   ">')
      .replace(`<normId id="' &#xD;&#xA;&#x9; '">`, `<normId id=" '    &#xD;&#xA;&#x9;   ' ">`);
    expect(canon(in34.replace(/^<!DOCTYPE[\s\S]*?\]>\n/, ""))).toBe(expected);
  });

  const in35 = "<!DOCTYPE doc [\n<!ATTLIST doc attrExtEnt ENTITY #IMPLIED>\n<!ENTITY ent1 \"Hello\">\n<!ENTITY ent2 SYSTEM \"world.txt\">\n<!ENTITY entExt SYSTEM \"earth.gif\" NDATA gif>\n<!NOTATION gif SYSTEM \"viewgif.exe\">\n]>\n<doc attrExtEnt=\"entExt\">\n   &ent1;, &ent2;!\n</doc>\n\n<!-- Let world.txt contain \"world\" (excluding the quotes) -->";
  it("3.5 entity references: rejected (DOCTYPE with internal and external entity declarations)", () => {
    expect(() => canon(in35)).toThrow(/DOCTYPE|entity/i);
  });
  it("3.5 without the DOCTYPE is still rejected: undeclared entity references", () => {
    expect(() => canon(in35.replace(/^<!DOCTYPE[\s\S]*?\]>\n/, ""))).toThrow(/entity/i);
  });

  const in36 = "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>\n<doc>&#169;</doc>";
  it("3.6 UTF-8 encoding: ISO-8859-1 input, &#169; becomes the octets C2 A9", () => {
    expect(hex(normalizeXmlC14n11(enc.encode(in36)))).toBe("3c646f633ec2a93c2f646f633e");
  });
});

describe("processing model details", () => {
  it("drops the XML declaration, comments, and whitespace outside the document element", () => {
    expect(canon('<?xml version="1.0" encoding="UTF-8"?>\n<!-- c -->\n<a><!-- c --><b/></a>\n\n')).toBe("<a><b></b></a>");
  });

  it("renders PIs inside elements without separators, collapsing target/data whitespace", () => {
    expect(canon("<doc><?pi   data  ?>x<?empty   ?></doc>")).toBe("<doc><?pi data  ?>x<?empty?></doc>");
  });

  it("renders a default namespace declared on a prefixed element", () => {
    expect(canon('<a:x xmlns:a="urn:a" xmlns="urn:d"/>')).toBe('<a:x xmlns="urn:d" xmlns:a="urn:a"></a:x>');
  });

  it("re-renders a prefix bound to a new URI, elides an unchanged re-declaration", () => {
    expect(canon('<r xmlns:p="urn:1"><p:a xmlns:p="urn:1"/><p:b xmlns:p="urn:2"/></r>')).toBe(
      '<r xmlns:p="urn:1"><p:a></p:a><p:b xmlns:p="urn:2"></p:b></r>',
    );
  });

  it("emits xmlns=\"\" only when the nearest ancestor has a non-empty default namespace", () => {
    expect(canon('<r xmlns=""><a xmlns="urn:x"><b xmlns=""/></a><c xmlns=""/></r>')).toBe(
      '<r><a xmlns="urn:x"><b xmlns=""></b></a><c></c></r>',
    );
  });

  it("sorts namespace nodes by prefix and attributes by (namespace URI, local name), code-point order", () => {
    expect(canon('<r xmlns:b="urn:b" xmlns:A="urn:A" xmlns:a="urn:a" b:z="1" a:z="2" z="3" A:a="4" y="5"/>')).toBe(
      '<r xmlns:A="urn:A" xmlns:a="urn:a" xmlns:b="urn:b" y="5" z="3" A:a="4" a:z="2" b:z="1"></r>',
    );
  });

  it("never emits the xml namespace declaration but keeps xml:* attributes as ordinary attributes", () => {
    expect(canon('<r xmlns:xml="http://www.w3.org/XML/1998/namespace" xml:lang="en" xml:space="preserve" a="1"/>')).toBe(
      '<r a="1" xml:lang="en" xml:space="preserve"></r>',
    );
  });

  it("normalises CRLF and lone CR line endings before parsing; character references survive", () => {
    expect(canon("<a>x\r\ny\rz&#13;</a>")).toBe("<a>x\ny\nz&#xD;</a>");
    expect(canon('<a b="x\r\ny\tz"/>')).toBe('<a b="x y z"></a>');
  });

  it("escapes text and attribute values as C14N specifies", () => {
    expect(canon("<a>&lt;&amp;&gt;\"'</a>")).toBe("<a>&lt;&amp;&gt;\"'</a>");
    expect(canon(`<a v="&lt;&amp;&gt;&quot;'&#9;&#10;&#13;"/>`)).toBe(`<a v="&lt;&amp;>&quot;'&#x9;&#xA;&#xD;"></a>`);
    expect(canon("<a><![CDATA[ <&]]>]]&gt;</a>")).toBe("<a> &lt;&amp;]]&gt;</a>");
  });

  it("accepts a UTF-8 BOM and UTF-16 input with BOM, producing identical output", () => {
    const expected = "<a>é</a>";
    expect(canon(new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode(expected)]))).toBe(expected);
    const le = new Uint8Array(2 + expected.length * 2);
    le[0] = 0xff;
    le[1] = 0xfe;
    for (let i = 0; i < expected.length; i++) {
      const c = expected.charCodeAt(i);
      le[2 + i * 2] = c & 0xff;
      le[3 + i * 2] = c >> 8;
    }
    expect(canon(le)).toBe(expected);
  });

  it("honours a declared single-byte encoding and rejects unsupported ones", () => {
    expect(canon(new Uint8Array([...enc.encode('<?xml version="1.0" encoding="iso-8859-1"?><a>'), 0xe9, ...enc.encode("</a>")]))).toBe("<a>é</a>");
    expect(() => canon(enc.encode('<?xml version="1.0" encoding="Shift_JIS"?><a/>'))).toThrow(/encoding/);
  });

  it("passes U+FFFD through as an ordinary character", () => {
    expect(canon("<a>\ufffd</a>")).toBe("<a>\ufffd</a>");
  });
});

describe("rejections", () => {
  it.each([
    ["empty input", ""],
    ["whitespace only", "   "],
    ["unclosed tag", "<a>"],
    ["mismatched tags", "<a></b>"],
    ["two root elements", "<a/><b/>"],
    ["text outside root", "<a/>x"],
    ["undeclared prefix on element", "<p:a/>"],
    ["undeclared prefix on attribute", '<a p:x="1"/>'],
    ["undefined entity", "<a>&foo;</a>"],
    ["duplicate attribute", '<a x="1" x="2"/>'],
    ["unquoted attribute", "<a x=1/>"],
    ["raw < in attribute", '<a x="<"/>'],
    ["invalid UTF-8", new Uint8Array([0x3c, 0x61, 0x3e, 0xff, 0x3c, 0x2f, 0x61, 0x3e])],
    ["DOCTYPE without subset", "<!DOCTYPE a><a/>"],
    ["xml prefix bound to another URI", '<a xmlns:xml="urn:x"/>'],
    ["prefix undeclaration (XML Namespaces 1.1 only)", '<a xmlns:p="urn:p"><b xmlns:p=""/></a>'],
  ])("%s", (_, input) => {
    expect(() => canon(input)).toThrow();
  });
});
