import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { exportPagesToPdf, findChromium } from "../src/exporter.mjs";

const projectRoot = path.resolve(".");
const fontDir = path.join(projectRoot, "font");
const requiredFonts = [
  "IBMPlexSansArabic-Regular.ttf",
  "IBMPlexSansArabic-Medium.ttf",
  "IBMPlexSansArabic-SemiBold.ttf",
  "IBMPlexSansArabic-Bold.ttf",
];

function pythonWithPypdf() {
  const candidates = [
    process.env.PYTHON_PATH,
    process.platform === "win32"
      ? path.join(
          process.env.USERPROFILE ?? "",
          ".cache",
          "codex-runtimes",
          "codex-primary-runtime",
          "dependencies",
          "python",
          "python.exe",
        )
      : null,
    "python",
    "python3",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["-c", "import pypdf"], {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    });
    if (!result.error && result.status === 0) return candidate;
  }
  return null;
}

const chromium = findChromium();
const python = pythonWithPypdf();
const hasFonts = requiredFonts.every((file) => fs.existsSync(path.join(fontDir, file)));

test("browser PDF export preserves logical Arabic text for copy and search", {
  skip: !(chromium && python && hasFonts),
}, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "saad-pdf-text-"));
  try {
    const expected = [
      "علوم الحاسب مسار الذكاء الاصطناعي",
      "مهارات الحاسب الآلي والذكاء الاصطناعي",
      "لا لآ لأ لإ",
    ];
    const page = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="594pt" height="150pt" viewBox="0 0 594 150" data-page-width="594" data-page-height="150">',
      '<rect width="594" height="150" fill="#fff"/>',
      `<text x="560" y="45" text-anchor="start" font-family="IBM Plex Sans Arabic" font-size="16" font-weight="600" direction="rtl" unicode-bidi="plaintext">${expected[0]}</text>`,
      `<text x="560" y="80" text-anchor="start" font-family="IBM Plex Sans Arabic" font-size="16" font-weight="600" direction="rtl" unicode-bidi="plaintext">${expected[1]}</text>`,
      `<text x="560" y="115" text-anchor="start" font-family="IBM Plex Sans Arabic" font-size="16" font-weight="600" direction="rtl" unicode-bidi="plaintext">${expected[2]}</text>`,
      "</svg>",
    ].join("");
    const pdfPath = path.join(temp, "plan.pdf");
    exportPagesToPdf([page], pdfPath, { chromium, fontDir });
    const script = [
      "import sys, unicodedata, json",
      "from pypdf import PdfReader",
      "reader=PdfReader(sys.argv[1])",
      "text='\\n'.join((page.extract_text() or '') for page in reader.pages)",
      "content=b''.join(page['/Contents'].get_object().get_data() for page in reader.pages)",
      "print(json.dumps({'text':unicodedata.normalize('NFKC',text),'tagged':bool(reader.trailer['/Root'].get('/StructTreeRoot')),'lam_alef':content.count(b'<FEFF06440627>'),'lam_alef_madda':content.count(b'<FEFF06440622>'),'lam_alef_above':content.count(b'<FEFF06440623>'),'lam_alef_below':content.count(b'<FEFF06440625>')},ensure_ascii=False))",
    ].join(";");
    const extracted = spawnSync(python, ["-c", script, pdfPath], {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    });
    assert.equal(extracted.status, 0, extracted.stderr);
    const result = JSON.parse(extracted.stdout);
    const normalized = result.text.replace(/\s+/gu, " ");
    for (const value of expected) assert.match(normalized, new RegExp(value, "u"));
    assert.equal(result.tagged, true);
    assert.ok(result.lam_alef > 0, "lam–alef must retain logical /ActualText");
    assert.ok(result.lam_alef_madda > 0, "lam–alef-with-madda must retain logical /ActualText");
    assert.ok(result.lam_alef_above > 0, "lam–alef-with-hamza-above must retain logical /ActualText");
    assert.ok(result.lam_alef_below > 0, "lam–alef-with-hamza-below must retain logical /ActualText");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
