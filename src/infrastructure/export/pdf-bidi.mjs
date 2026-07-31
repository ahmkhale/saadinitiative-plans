import bidiFactory from "bidi-js";

const bidi = bidiFactory();
const segmenter = new Intl.Segmenter("ar", { granularity: "word" });
const RTL_TEXT = /[\u0590-\u08ff]/u;
const ARABIC_CODE_POINT = /[\u0600-\u08ff]/u;

function visualIndexMap(text, embedding) {
  const indices = Array.from({ length: text.length }, (_, index) => index);
  for (const [start, end] of bidi.getReorderSegments(text, embedding)) {
    for (let left = start, right = end; left < right; left += 1, right -= 1) {
      [indices[left], indices[right]] = [indices[right], indices[left]];
    }
  }
  return new Map(indices.map((logical, visual) => [logical, visual]));
}

function mirroredSegment(segment, start, mirrored) {
  return Array.from(segment)
    .map((character, offset) => mirrored.get(start + offset) ?? character)
    .join("");
}

/**
 * PDFKit/fontkit shapes Arabic letters correctly but does not perform the
 * Unicode bidi reordering needed between separate words and mixed-direction
 * runs. Shape word-like logical tokens independently, then emit those tokens
 * in visual order. PDFKit's ToUnicode map remains tied to the original basic
 * Unicode values carried by each shaped glyph.
 */
function correctLigatureUnicode(font, glyphs) {
  if (!font?.unicode) return;
  for (const glyph of glyphs) {
    const cid = Number.parseInt(glyph, 16);
    const unicode = font.unicode[cid];
    if (
      !Array.isArray(unicode)
      || unicode.length < 2
      || font.saadBidiCorrectedLigatures?.has(cid)
      || !unicode.every((codePoint) => ARABIC_CODE_POINT.test(String.fromCodePoint(codePoint)))
    ) {
      continue;
    }
    // The content stream is deliberately emitted in visual RTL order. PDF
    // readers apply the Unicode bidi algorithm to ToUnicode values during
    // extraction, so a ligature cluster must use visual (not HarfBuzz's
    // logical) component order here. The glyph outline itself is untouched.
    font.unicode[cid] = [...unicode].reverse();
    font.saadBidiCorrectedLigatures.add(cid);
  }
}

export function encodeBidiText(originalEncode, value, font) {
  const text = String(value ?? "");
  if (!RTL_TEXT.test(text)) return originalEncode(text);

  const embedding = bidi.getEmbeddingLevels(text);
  const visualAt = visualIndexMap(text, embedding);
  const mirrored = bidi.getMirroredCharactersMap(text, embedding.levels);
  const tokens = [...segmenter.segment(text)].map((item) => {
    const start = item.index;
    const end = start + item.segment.length;
    const positions = Array.from(
      { length: end - start },
      (_, offset) => visualAt.get(start + offset),
    );
    return {
      start,
      visualStart: Math.min(...positions),
      text: mirroredSegment(item.segment, start, mirrored),
    };
  });
  tokens.sort((left, right) => left.visualStart - right.visualStart || left.start - right.start);

  const glyphs = [];
  const positions = [];
  for (const token of tokens) {
    const [tokenGlyphs, tokenPositions] = originalEncode(token.text);
    correctLigatureUnicode(font, tokenGlyphs);
    glyphs.push(...tokenGlyphs);
    positions.push(...tokenPositions);
  }
  return [glyphs, positions];
}

export function patchPdfKitFontBidi(font) {
  if (!font || font.saadBidiPatched) return font;
  const originalEncode = font.encode.bind(font);
  Object.defineProperty(font, "saadBidiCorrectedLigatures", { value: new Set() });
  font.encode = (value) => encodeBidiText(originalEncode, value, font);
  Object.defineProperty(font, "saadBidiPatched", { value: true });
  return font;
}
