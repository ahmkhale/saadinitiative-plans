import bidiFactory from "bidi-js";

const bidi = bidiFactory();
const segmenter = new Intl.Segmenter("ar", { granularity: "word" });
const RTL_TEXT = /[\u0590-\u08ff]/u;

export function pdfSemanticText(value) {
  const text = String(value ?? "");
  if (!RTL_TEXT.test(text)) return text;
  const embedding = bidi.getEmbeddingLevels(text);
  const mirrored = bidi.getMirroredCharactersMap(text, embedding);
  return bidi
    .getReorderedIndices(text, embedding)
    .map((index) => mirrored.get(index) ?? text[index])
    .join("");
}

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
export function encodeBidiText(originalEncode, value, onEncoded = undefined) {
  const text = String(value ?? "");
  if (!RTL_TEXT.test(text)) {
    const encoded = originalEncode(text);
    onEncoded?.({
      text,
      logicalOrder: encoded[1]
        .map((position, index) => ({ position, index }))
        .filter(({ position }) => position.advanceWidth !== 0)
        .map(({ index }) => index),
    });
    return encoded;
  }

  const embedding = bidi.getEmbeddingLevels(text);
  const visualAt = visualIndexMap(text, embedding);
  const mirrored = bidi.getMirroredCharactersMap(text, embedding);
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
  const encodedTokens = [];
  for (const token of tokens) {
    const [tokenGlyphs, tokenPositions] = originalEncode(token.text);
    const offset = glyphs.length;
    glyphs.push(...tokenGlyphs);
    positions.push(...tokenPositions);
    encodedTokens.push({
      ...token,
      indices: tokenGlyphs.map((_, index) => offset + index),
    });
  }
  const drawable = new Set(
    positions
      .map((position, index) => ({ position, index }))
      .filter(({ position }) => position.advanceWidth !== 0)
      .map(({ index }) => index),
  );
  const logicalOrder = encodedTokens
    .sort((left, right) => left.start - right.start)
    // Fontkit already emits the shaped glyphs inside an Arabic token in the
    // order PDF text extractors expect. Only the surrounding bidi tokens must
    // return to logical order.
    .flatMap((token) => token.indices)
    .filter((index) => drawable.has(index));
  onEncoded?.({ text, logicalOrder });
  return [glyphs, positions];
}

export function patchPdfKitFontBidi(font, onEncoded = undefined) {
  if (!font || font.saadBidiPatched) return font;
  const originalEncode = font.encode.bind(font);
  font.encode = (value) => encodeBidiText(originalEncode, value, onEncoded);
  Object.defineProperty(font, "saadBidiPatched", { value: true });
  return font;
}

/**
 * SVG-to-PDFKit positions every glyph with an absolute text matrix. Reordering
 * those matrix/glyph pairs changes the PDF's semantic content order without
 * moving a single visible glyph.
 */
export function installLogicalTextOrder(document, encodingQueue, semanticLayer = undefined) {
  const originalAddContent = document.addContent;
  let textBlock = null;

  function writeBlock(lines) {
    for (const line of lines) originalAddContent.call(document, line);
  }

  document.addContent = function addContentWithLogicalTextOrder(content) {
    const line = String(content);
    if (textBlock) {
      textBlock.push(line);
      if (line === "ET") {
        const encoding = encodingQueue.shift();
        const pairs = [];
        const prefix = [];
        const suffix = [];
        let index = 0;
        while (index < textBlock.length && !textBlock[index].endsWith(" Tm")) {
          prefix.push(textBlock[index]);
          index += 1;
        }
        while (
          index + 1 < textBlock.length
          && textBlock[index].endsWith(" Tm")
          && textBlock[index + 1].endsWith(" Tj")
        ) {
          pairs.push([textBlock[index], textBlock[index + 1]]);
          index += 2;
        }
        suffix.push(...textBlock.slice(index));
        if (encoding && encoding.logicalOrder.length === pairs.length) {
          writeBlock([
            ...prefix,
            ...encoding.logicalOrder.flatMap((pairIndex) => pairs[pairIndex]),
            ...suffix,
          ]);
        } else {
          writeBlock(textBlock);
        }
        if (encoding) {
          semanticLayer?.write(
            encoding.text,
            pairs[0]?.[0] ?? "1 0 0 -1 0 0 Tm",
            (semanticLine) => originalAddContent.call(document, semanticLine),
          );
        }
        textBlock = null;
      }
      return document;
    }
    if (line === "BT") {
      textBlock = [line];
      return document;
    }
    originalAddContent.call(document, content);
    return document;
  };

  return () => {
    if (textBlock) writeBlock(textBlock);
    document.addContent = originalAddContent;
  };
}
