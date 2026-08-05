import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";

const thisFile = fileURLToPath(import.meta.url);

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

export async function correctPdfMetadata(pdfPath, metadata) {
  const document = await PDFDocument.load(fs.readFileSync(pdfPath), { updateMetadata: false });
  document.setTitle(metadata.title);
  document.setAuthor(metadata.author);
  document.setCreator(metadata.creator);
  document.setProducer(metadata.producer);
  document.setSubject(metadata.subject);
  document.setKeywords(metadata.keywords);
  document.catalog.set(PDFName.of("Lang"), PDFString.of(metadata.language));
  // Remove backend-generated XMP so rendering-engine and PDF-library names
  // cannot survive outside the normalized public Info dictionary.
  document.catalog.delete(PDFName.of("Metadata"));
  const bytes = await document.save({
    addDefaultPage: false,
    objectsPerTick: Number.POSITIVE_INFINITY,
    updateFieldAppearances: false,
    useObjectStreams: true,
  });
  replaceAtomically(pdfPath, bytes);
  return { corrected: true, size: bytes.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  const pdfPath = process.argv[2];
  const serializedMetadata = process.argv[3];
  if (!pdfPath || !serializedMetadata) throw new Error("PDF path and metadata are required.");
  await correctPdfMetadata(pdfPath, JSON.parse(serializedMetadata));
}
