import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createFontconfigEnvironment } from "../src/infrastructure/export/font-service.mjs";
import { findInkscape } from "../src/exporter.mjs";
import { renderPlanSvg } from "../src/render-svg.mjs";

function planWithLongName() {
  return {
    major: "اختبار الخط",
    degree: "البكالوريوس",
    semesters: [{
      name: "المستوى الأول",
      academicHours: 3,
      cumulativeHours: 3,
      courseDisplayOrder: "rtl",
      courses: [{
        code: "412 كهر",
        name: "تصميم الدوائر المتكاملة ذات النطاق العالي جدًا منخفضة القدرة",
        academicHours: 3,
        lectureHours: 3,
        exerciseHours: 1,
        practicalHours: 0,
        requirementLabel: "405 كهر",
        color: "#17529B",
      }],
    }],
    electiveGroups: [],
  };
}

test("Inkscape export uses the same local IBM Plex font measured by the renderer", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "saad-font-export-test-"));
  try {
    const fontconfig = createFontconfigEnvironment(tempDir);
    let svg = renderPlanSvg(planWithLongName());
    svg = svg.replace(/<text ([^>]*data-part="course-name"[^>]*)>/u, '<text id="font-width-test" $1>');
    const svgPath = path.join(tempDir, "font-test.svg");
    fs.writeFileSync(svgPath, svg, "utf8");
    const result = spawnSync(findInkscape(), [
      "--query-id=font-width-test",
      "--query-width",
      svgPath,
    ], { encoding: "utf8", env: fontconfig.env });
    assert.equal(result.status, 0, result.stderr);
    const width = Number(String(result.stdout).trim());
    assert.ok(Number.isFinite(width));
    const maxWidthPx = 68.25 * (96 / 72);
    assert.ok(width <= maxWidthPx, `Inkscape rendered the name at ${width}px instead of the measured ${maxWidthPx}px card width`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
