import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFString,
} from "pdf-lib";
import { exportSvg } from "../src/exporter.mjs";
import { renderPlanDocumentSvg } from "../src/render-svg.mjs";

function facts(code) {
  return {
    code,
    name: `مقرر ${code}`,
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

function uriAnnotations(page) {
  const annotations = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (!annotations) return [];
  const links = [];
  for (let index = 0; index < annotations.size(); index += 1) {
    const annotation = annotations.lookup(index, PDFDict);
    const action = annotation?.lookupMaybe(PDFName.of("A"), PDFDict);
    const uri = action?.lookupMaybe(PDFName.of("URI"), PDFString);
    const rect = annotation?.lookupMaybe(PDFName.of("Rect"), PDFArray);
    if (!uri || !rect) continue;
    links.push({
      uri: uri.decodeText(),
      rectangle: Array.from(
        { length: 4 },
        (_, item) => rect.lookup(item, PDFNumber).asNumber(),
      ),
    });
  }
  return links;
}

test("native PDF preserves four on-page footer URL annotations on unequal-height pages", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "saad-pdf-links-"));
  try {
    const semester = {
      id: "level-1",
      name: "المستوى الأول",
      courses: [facts("101 عال")],
      totalHours: 3,
      cumulativeHours: 3,
    };
    const document = renderPlanDocumentSvg({
      major: "اختبار الروابط",
      semesters: [semester],
      proposal: { semesters: [semester] },
    });
    const paths = {
      svgPath: path.join(temp, "plan.svg"),
      pdfPath: path.join(temp, "plan.pdf"),
      pngPath: path.join(temp, "plan.png"),
    };
    exportSvg(document.svg, paths, {
      keepSvg: true,
      pdf: true,
      pageCount: document.pages.length,
      pages: document.pages,
      pageLayouts: document.pageLayouts,
    });

    const pdf = await PDFDocument.load(fs.readFileSync(paths.pdfPath));
    const pages = pdf.getPages();
    assert.notEqual(pages[0].getHeight(), pages[1].getHeight());
    const expectedUrls = [
      "https://t.me/SaadInitiative?direct",
      "https://x.com/saadinitiative",
      "https://saadinitiative.com",
      "https://t.me/saadinitiative",
    ];
    const pageLinks = pages.map(uriAnnotations);
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      assert.deepEqual(pageLinks[pageIndex].map(({ uri }) => uri), expectedUrls);
      for (const { rectangle: [, y1, , y2] } of pageLinks[pageIndex]) {
        assert.ok(y1 >= 0, `page ${pageIndex + 1} link must start inside its page`);
        assert.ok(y2 <= pages[pageIndex].getHeight(), `page ${pageIndex + 1} link must end inside its page`);
        assert.ok(Math.abs(y1 - 46) <= 1, `page ${pageIndex + 1} link must align with the footer`);
      }
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
