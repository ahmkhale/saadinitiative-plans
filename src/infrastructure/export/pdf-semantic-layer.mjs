function utf16Hex(value) {
  let result = "";
  for (const character of String(value)) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0xffff) {
      result += codePoint.toString(16).padStart(4, "0");
    } else {
      const adjusted = codePoint - 0x10000;
      result += (0xd800 + (adjusted >> 10)).toString(16).padStart(4, "0");
      result += (0xdc00 + (adjusted & 0x3ff)).toString(16).padStart(4, "0");
    }
  }
  return result.toUpperCase();
}

function toCidHex(cid) {
  return cid.toString(16).padStart(4, "0").toUpperCase();
}

function createToUnicodeCmap(entries) {
  const mappings = entries.map(
    ({ cid, text }) => `<${toCidHex(cid)}> <${utf16Hex(text)}>`,
  );
  const chunks = [];
  for (let index = 0; index < mappings.length; index += 100) {
    const chunk = mappings.slice(index, index + 100);
    chunks.push(`${chunk.length} beginbfchar\n${chunk.join("\n")}\nendbfchar`);
  }
  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Saad) /Ordering (Semantic) /Supplement 0 >> def",
    "/CMapName /SaadSemantic def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <FFFF>",
    "endcodespacerange",
    ...chunks,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
}

/**
 * Adds searchable text without embedding another copy of IBM Plex Sans Arabic.
 * Each invisible CID maps to one original SVG text run through ToUnicode.
 */
export function createPdfSemanticLayer(document, {
  encodeText = (value) => String(value),
} = {}) {
  const entries = [];
  const cidByText = new Map();
  const toUnicode = document.ref();
  const descriptor = document.ref({
    Type: "FontDescriptor",
    FontName: "SaadSemantic",
    Flags: 4,
    FontBBox: [0, -200, 1000, 800],
    ItalicAngle: 0,
    Ascent: 800,
    Descent: -200,
    CapHeight: 700,
    StemV: 80,
  });
  descriptor.end();
  const descendant = document.ref({
    Type: "Font",
    Subtype: "CIDFontType2",
    BaseFont: "SaadSemantic",
    CIDSystemInfo: {
      Registry: new String("Saad"),
      Ordering: new String("Semantic"),
      Supplement: 0,
    },
    FontDescriptor: descriptor,
    DW: 1000,
    CIDToGIDMap: "Identity",
  });
  descendant.end();
  const font = document.ref({
    Type: "Font",
    Subtype: "Type0",
    BaseFont: "SaadSemantic",
    Encoding: "Identity-H",
    DescendantFonts: [descendant],
    ToUnicode: toUnicode,
  });
  font.end();

  return {
    write(text, matrixLine, writeLine = (line) => document.addContent(line)) {
      if (!text) return;
      const encodedText = encodeText(text);
      let cid = cidByText.get(encodedText);
      if (cid == null) {
        cid = entries.length + 1;
        if (cid > 0xffff) throw new Error("Native PDF semantic text limit exceeded.");
        entries.push({ cid, text: encodedText });
        cidByText.set(encodedText, cid);
      }
      document.page.fonts.SaadSemantic = font;
      writeLine("BT");
      writeLine("/SaadSemantic 1 Tf");
      writeLine("3 Tr");
      writeLine(matrixLine);
      writeLine(`<${toCidHex(cid)}> Tj`);
      writeLine("ET");
    },
    finish() {
      toUnicode.end(createToUnicodeCmap(entries));
    },
  };
}
