import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFString,
} from "pdf-lib";
import { exportSvg, findInkscape } from "../src/exporter.mjs";
import { renderPlanDocumentSvg } from "../src/render-svg.mjs";

function commandWorks(command, args = ["--version"]) {
  if (!command) return false;
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  return !result.error && result.status === 0;
}

function findPdfInfo() {
  if (commandWorks(process.env.PDFINFO_PATH, ["-v"])) return process.env.PDFINFO_PATH;
  if (commandWorks("pdfinfo", ["-v"])) return "pdfinfo";
  if (process.platform !== "win32") return null;
  const bundled = path.join(
    process.env.USERPROFILE ?? "",
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "native",
    "poppler",
    "Library",
    "bin",
    "pdfinfo.exe",
  );
  return commandWorks(bundled, ["-v"]) ? bundled : null;
}

const inkscape = findInkscape();
const pdfinfo = findPdfInfo();
const hasTools = commandWorks(inkscape);

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

function uriRectangles(page) {
  const annotations = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (!annotations) return [];
  const rectangles = [];
  for (let index = 0; index < annotations.size(); index += 1) {
    const annotation = annotations.lookup(index, PDFDict);
    const action = annotation?.lookupMaybe(PDFName.of("A"), PDFDict);
    const uri = action?.lookupMaybe(PDFName.of("URI"), PDFString);
    const rect = annotation?.lookupMaybe(PDFName.of("Rect"), PDFArray);
    if (!uri || !rect) continue;
    rectangles.push(Array.from(
      { length: 4 },
      (_, item) => rect.lookup(item, PDFNumber).asNumber(),
    ));
  }
  return rectangles;
}

test("Inkscape preserves four on-page footer URL annotations on unequal-height pages", {
  skip: !hasTools || !pdfinfo,
}, async () => {
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
      proposal: { semesters: [semester], showGuide: true },
    });
    const paths = {
      svgPath: path.join(temp, "plan.svg"),
      pdfPath: path.join(temp, "plan.pdf"),
      pngPath: path.join(temp, "plan.png"),
    };
    exportSvg(document.svg, paths, {
      inkscape,
      keepSvg: true,
      pdf: true,
      pageCount: document.pages.length,
    });

    const result = spawnSync(pdfinfo, ["-url", paths.pdfPath], { encoding: "utf8", shell: false });
    assert.equal(result.status, 0, result.stderr);
    const urls = [
      "https://t.me/SaadInitiative?direct",
      "https://x.com/saadinitiative",
      "https://saadinitiative.com",
      "https://t.me/saadinitiative",
    ];
    for (const url of urls) {
      assert.equal(result.stdout.split(url).length - 1, 2, `${url} must occur once on each PDF page`);
    }

    const pdf = await PDFDocument.load(fs.readFileSync(paths.pdfPath));
    const pages = pdf.getPages();
    assert.notEqual(pages[0].getHeight(), pages[1].getHeight());
    const pageRectangles = pages.map(uriRectangles);
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      assert.equal(pageRectangles[pageIndex].length, 4);
      for (const [, y1, , y2] of pageRectangles[pageIndex]) {
        assert.ok(y1 >= 0, `page ${pageIndex + 1} link must start inside its page`);
        assert.ok(y2 <= pages[pageIndex].getHeight(), `page ${pageIndex + 1} link must end inside its page`);
        assert.ok(Math.abs(y1 - 46) <= 1, `page ${pageIndex + 1} link must align with the footer`);
      }
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
