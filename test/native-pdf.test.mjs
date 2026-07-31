import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument } from "pdf-lib";
import { exportNativePdf } from "../src/exporter.mjs";
import { renderPlanDocumentSvg } from "../src/render-svg.mjs";

function facts(code, name) {
  return {
    code,
    name,
    academicHours: 3,
    lectureHours: 2,
    exerciseHours: 1,
    practicalHours: 0,
    color: "#00AEEF",
    prerequisites: [],
    corequisites: [],
    prerequisiteConditions: [],
    minimumCompletedCredits: null,
    requirementLabel: "",
  };
}

async function extractedItems(pdfPath) {
  const pdf = await getDocument({ url: pdfPath }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).filter(Boolean));
  }
  return pages;
}

test("native PDF keeps Arabic searchable without duplicating visible font programs", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "saad-native-pdf-test-"));
  try {
    const semester = {
      id: "level-1",
      name: "المستوى الأول",
      courses: [
        facts("101 احص", "مدخل الى الاحتمالات والإحصاء"),
        facts("101 ريد", "ريادة الأعمال"),
        facts("101 كيم", "كيمياء عامة (1)"),
      ],
      totalHours: 9,
      cumulativeHours: 9,
    };
    const document = renderPlanDocumentSvg({
      major: "علوم الحاسب المسار العام",
      semesters: [semester],
      proposal: { semesters: [semester], showGuide: true },
    });
    const pdfPath = path.join(temp, "plan.pdf");
    const result = exportNativePdf(document.pages, document.pageLayouts, pdfPath);

    assert.equal(result.renderer, "native-pdfkit");
    assert.ok(result.size < 150_000, `expected a compact PDF, received ${result.size} bytes`);

    const extracted = (await extractedItems(pdfPath)).flat();
    for (const expected of [
      "الخطة المقترحة",
      "علوم الحاسب المسار العام",
      "مدخل الى الاحتمالات والإحصاء",
      "ريادة الأعمال",
      "كيمياء عامة (1)",
      "101 احص",
    ]) {
      assert.ok(extracted.includes(expected), `missing exact searchable text: ${expected}`);
    }
    const allText = extracted.join("\n");
    assert.doesNotMatch(allText, /[\uFB50-\uFDFF\uFE70-\uFEFF\uFFFD]/u);

    const bytes = fs.readFileSync(pdfPath);
    const rawPdf = bytes.toString("latin1");
    assert.equal(rawPdf.match(/\/FontFile2\b/gu)?.length, 4);
    assert.match(rawPdf, /\/BaseFont \/SaadSemantic/u);

    const parsed = await PDFDocument.load(bytes);
    const pages = parsed.getPages();
    assert.equal(pages.length, document.pageLayouts.length);
    for (let index = 0; index < pages.length; index += 1) {
      assert.equal(pages[index].getWidth(), document.pageLayouts[index].width);
      assert.ok(
        Math.abs(pages[index].getHeight() - document.pageLayouts[index].height) < 0.001,
      );
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
