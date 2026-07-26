import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
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
  };
}

test("Inkscape preserves four footer URL annotations on published and proposal pages", {
  skip: !hasTools || !pdfinfo,
}, () => {
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
      proposal: { semesters: [semester], showGuide: false },
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
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
