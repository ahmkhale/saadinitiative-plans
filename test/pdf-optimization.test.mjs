import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { exportSvg, findChromium, findGhostscript, optimizePdf } from "../src/exporter.mjs";
import { renderPlanDocumentSvg } from "../src/render-svg.mjs";

function commandExists(command) {
  if (!command) return false;
  try {
    return fs.existsSync(command) || Boolean(command);
  } catch {
    return false;
  }
}

function course(index) {
  return {
    code: `${100 + index} عال`,
    name: `مقرر تجريبي ${index}`,
    academicHours: 3,
    lectureHours: 3,
    exerciseHours: 0,
    practicalHours: 0,
    color: index % 2 ? "#17529B" : "#6A4691",
    prerequisites: [],
    corequisites: [],
    prerequisiteConditions: [],
    minimumCompletedCredits: null,
    requirementLabel: "",
  };
}

const ghostscript = findGhostscript();
const chromium = findChromium();

const hasTools = Boolean(ghostscript && commandExists(chromium));

test("pre-composed card artwork avoids per-card transparency groups", () => {
  const document = renderPlanDocumentSvg({
    major: "اختبار الضغط",
    degree: "البكالوريوس",
    semesters: [{
      id: "level-1",
      name: "المستوى الأول",
      courses: Array.from({ length: 12 }, (_, index) => course(index)),
      totalHours: 36,
      cumulativeHours: 36,
    }],
  });
  assert.doesNotMatch(document.svg, /data-part="(?:academic-badge|metric-box)"[^>]+opacity=/u);
  assert.doesNotMatch(document.svg, /<text[^>]+opacity="0\.9"/u);
});

test("Ghostscript compacts a browser PDF while preserving a valid document", {
  skip: !hasTools,
}, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "saad-pdf-optimize-"));
  try {
    const semesters = Array.from({ length: 8 }, (_, semesterIndex) => ({
      id: `level-${semesterIndex + 1}`,
      name: `المستوى ${semesterIndex + 1}`,
      courses: Array.from({ length: 6 }, (_, courseIndex) => course(semesterIndex * 6 + courseIndex)),
      totalHours: 18,
      cumulativeHours: (semesterIndex + 1) * 18,
    }));
    const document = renderPlanDocumentSvg({
      major: "اختبار ضغط ملف PDF",
      degree: "البكالوريوس",
      semesters,
      proposal: { enabled: true, showGuide: true, semesters },
    });
    const paths = {
      svgPath: path.join(temp, "plan.svg"),
      pdfPath: path.join(temp, "plan.pdf"),
      pngPath: path.join(temp, "plan.png"),
    };
    exportSvg(document.svg, paths, {
      chromium,
      keepSvg: false,
      pdf: true,
      optimizePdf: false,
      pageCount: document.pageCount,
      pages: document.pages,
    });
    const unoptimizedSize = fs.statSync(paths.pdfPath).size;
    const result = optimizePdf(paths.pdfPath, { ghostscript, required: true });
    const optimizedSize = fs.statSync(paths.pdfPath).size;

    assert.equal(result.optimized, true);
    assert.ok(optimizedSize < unoptimizedSize * 0.8, `${optimizedSize} should be at least 20% smaller than ${unoptimizedSize}`);
    const signature = fs.readFileSync(paths.pdfPath).subarray(0, 5).toString("ascii");
    assert.equal(signature, "%PDF-");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
