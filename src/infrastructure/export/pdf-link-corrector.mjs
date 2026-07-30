import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFString,
} from "pdf-lib";

const thisFile = fileURLToPath(import.meta.url);
const name = (value) => PDFName.of(value);

function uriAnnotations(page) {
  const annotations = page.node.lookupMaybe(name("Annots"), PDFArray);
  if (!annotations) return [];
  const result = [];
  for (let index = 0; index < annotations.size(); index += 1) {
    const annotation = annotations.lookup(index, PDFDict);
    const action = annotation?.lookupMaybe(name("A"), PDFDict);
    const uriValue = action?.lookupMaybe(name("URI"), PDFString);
    const rect = annotation?.lookupMaybe(name("Rect"), PDFArray);
    if (!uriValue || !rect || rect.size() !== 4) continue;
    result.push({
      uri: uriValue.decodeText(),
      rect,
      values: Array.from({ length: 4 }, (_, item) => rect.lookup(item, PDFNumber).asNumber()),
    });
  }
  return result;
}

function replaceAtomically(destination, bytes) {
  const temporary = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`,
  );
  const previous = `${destination}.previous-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, bytes);
  try {
    fs.renameSync(destination, previous);
    fs.renameSync(temporary, destination);
    fs.rmSync(previous, { force: true });
  } catch (error) {
    if (fs.existsSync(destination)) fs.rmSync(destination, { force: true });
    if (fs.existsSync(previous)) fs.renameSync(previous, destination);
    throw error;
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    if (fs.existsSync(previous)) fs.rmSync(previous, { force: true });
  }
}

export async function correctRepeatedUriAnnotationPositions(pdfPath) {
  const source = fs.readFileSync(pdfPath);
  const document = await PDFDocument.load(source, { updateMetadata: false });
  const pages = document.getPages();
  if (pages.length < 2) return { corrected: 0 };

  const referenceByUri = new Map(
    uriAnnotations(pages.at(-1)).map((item) => [item.uri, item.values]),
  );
  let corrected = 0;
  for (const page of pages.slice(0, -1)) {
    for (const annotation of uriAnnotations(page)) {
      const reference = referenceByUri.get(annotation.uri);
      if (!reference) continue;
      const offset = reference[1] - annotation.values[1];
      if (Math.abs(offset) < 0.01) continue;
      annotation.rect.set(1, PDFNumber.of(annotation.values[1] + offset));
      annotation.rect.set(3, PDFNumber.of(annotation.values[3] + offset));
      corrected += 1;
    }
  }
  if (!corrected) return { corrected: 0 };

  const bytes = await document.save({
    addDefaultPage: false,
    objectsPerTick: Number.POSITIVE_INFINITY,
    updateFieldAppearances: false,
    useObjectStreams: true,
  });
  replaceAtomically(pdfPath, bytes);
  return { corrected };
}

if (process.argv[1] === thisFile) {
  const pdfPath = process.argv[2];
  if (!pdfPath) throw new Error("PDF path is required.");
  await correctRepeatedUriAnnotationPositions(pdfPath);
}
