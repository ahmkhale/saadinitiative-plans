import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { buildPlanPdfMetadata, exportNativePdf, exportSvg, findInkscape } from "../src/exporter.mjs";
import { renderPlanDocumentSvg } from "../src/render-svg.mjs";

function semester() {
  return {
    id: "level-1",
    name: "المستوى الأول",
    courses: [],
    totalHours: 0,
    cumulativeHours: 0,
  };
}

test("builds complete public Arabic metadata from plan data", () => {
  const metadata = buildPlanPdfMetadata({
    major: "هندسة البرمجيات",
    college: "كلية علوم الحاسب والمعلومات",
    university: "جامعة الملك سعود",
  });

  assert.equal(metadata.title, "هندسة البرمجيات");
  assert.equal(metadata.author, "مبادرة صاد");
  assert.equal(metadata.creator, "مبادرة صاد");
  assert.equal(metadata.producer, "مبادرة صاد");
  assert.equal(
    metadata.subject,
    "الخطة الدراسية لبرنامج هندسة البرمجيات، كلية علوم الحاسب والمعلومات، جامعة الملك سعود",
  );
  assert.equal(metadata.language, "ar-SA");
  assert.deepEqual(metadata.keywords, [
    "مبادرة صاد",
    "خطة دراسية",
    "الخطة الدراسية",
    "هندسة البرمجيات",
    "كلية علوم الحاسب والمعلومات",
    "جامعة الملك سعود",
  ]);
});

test("omits unavailable optional values from the subject", () => {
  const metadata = buildPlanPdfMetadata({ major: "هندسة البرمجيات" });

  assert.equal(metadata.title, "هندسة البرمجيات");
  assert.equal(metadata.subject, "الخطة الدراسية لبرنامج هندسة البرمجيات");
  assert.doesNotMatch(metadata.subject, /،\s*$/u);
  assert.deepEqual(metadata.keywords, [
    "مبادرة صاد",
    "خطة دراسية",
    "الخطة الدراسية",
    "هندسة البرمجيات",
  ]);
});

test("preserves the displayed title and keyword for a track", () => {
  const metadata = buildPlanPdfMetadata({
    major: "علوم الحاسب",
    track: { id: "general", name: "المسار العام" },
  });

  assert.equal(metadata.title, "علوم الحاسب المسار العام");
  assert.equal(metadata.subject, "الخطة الدراسية لبرنامج علوم الحاسب المسار العام");
  assert.ok(metadata.keywords.includes("علوم الحاسب"));
  assert.ok(metadata.keywords.includes("المسار العام"));
});

test("normalizes whitespace and removes duplicate keyword values", () => {
  const metadata = buildPlanPdfMetadata({
    major: "  هندسة   البرمجيات ",
    college: " كلية الهندسة، ",
    university: " كلية الهندسة، ",
    track: { name: "  " },
  });

  assert.equal(metadata.title, "هندسة البرمجيات");
  assert.equal(metadata.subject, "الخطة الدراسية لبرنامج هندسة البرمجيات، كلية الهندسة، كلية الهندسة");
  assert.equal(new Set(metadata.keywords).size, metadata.keywords.length);
  assert.ok(metadata.keywords.includes("كلية الهندسة"));
});

test("public metadata contains no generator or PDF-library disclosure", () => {
  const metadata = buildPlanPdfMetadata({ major: "هندسة البرمجيات" });
  const serialized = JSON.stringify(metadata);

  for (const forbidden of [
    "generator",
    "Saad Plan Generator",
    "saad-plan-generator",
    "PDFKit",
    "pdf-lib",
    "Cairo",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, "iu"));
  }
});

test("writes public metadata to the generated PDF and language catalog", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "saad-pdf-metadata-"));
  try {
    const plan = {
      major: "هندسة البرمجيات",
      college: "كلية علوم الحاسب والمعلومات",
      university: "جامعة الملك سعود",
      semesters: [semester()],
    };
    const document = renderPlanDocumentSvg(plan);
    const metadata = buildPlanPdfMetadata(plan);
    const pdfPath = path.join(temp, "plan.pdf");
    exportNativePdf(document.pages, document.pageLayouts, pdfPath, { metadata });

    const bytes = fs.readFileSync(pdfPath);
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    assert.equal(pdf.getTitle(), metadata.title);
    assert.equal(pdf.getAuthor(), metadata.author);
    assert.equal(pdf.getCreator(), metadata.creator);
    assert.equal(pdf.getProducer(), metadata.producer);
    assert.equal(pdf.getSubject(), metadata.subject);
    assert.equal(pdf.getKeywords(), metadata.keywords.join(", "));
    assert.equal(pdf.catalog.lookup(PDFName.of("Lang"), PDFString).decodeText(), "ar-SA");

    const rawPdf = bytes.toString("latin1");
    for (const forbidden of [
      "PDFKit",
      "pdf-lib",
      "Cairo",
      "saad-plan-generator",
      "Saad Plan Generator",
    ]) {
      assert.doesNotMatch(rawPdf, new RegExp(forbidden, "iu"));
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("replaces backend metadata on the alternate Inkscape export path", {
  skip: !fs.existsSync(findInkscape()),
}, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "saad-inkscape-metadata-"));
  try {
    const plan = { major: "هندسة البرمجيات", semesters: [semester()] };
    const document = renderPlanDocumentSvg(plan);
    const metadata = buildPlanPdfMetadata(plan);
    const paths = {
      svgPath: path.join(temp, "plan.svg"),
      pdfPath: path.join(temp, "plan.pdf"),
      pngPath: path.join(temp, "plan.png"),
    };
    exportSvg(document.svg, paths, {
      pdf: true,
      pageCount: document.pageCount,
      inkscape: findInkscape(),
      optimizePdf: false,
      metadata,
    });

    const bytes = fs.readFileSync(paths.pdfPath);
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    assert.equal(pdf.getTitle(), metadata.title);
    assert.equal(pdf.getAuthor(), metadata.author);
    assert.equal(pdf.getCreator(), metadata.creator);
    assert.equal(pdf.getProducer(), metadata.producer);
    assert.equal(pdf.getSubject(), metadata.subject);
    assert.equal(pdf.getKeywords(), metadata.keywords.join(" "));
    assert.equal(pdf.catalog.lookup(PDFName.of("Lang"), PDFString).decodeText(), "ar-SA");

    const rawPdf = bytes.toString("latin1");
    for (const forbidden of ["Inkscape", "cairo", "pdf-lib"]) {
      assert.doesNotMatch(rawPdf, new RegExp(forbidden, "iu"));
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
