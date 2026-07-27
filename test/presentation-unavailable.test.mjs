import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

test("catalog resolution survives a missing local presentation font", () => {
  const missingFontDir = fs.mkdtempSync(path.join(os.tmpdir(), "saad-missing-fonts-"));
  fs.rmSync(missingFontDir, { recursive: true, force: true });
  const source = String.raw`
    import { renderDraftPreview } from "./src/application/preview-plan.mjs";
    const plan = {
      schemaVersion: 1,
      id: "font-test",
      major: "خطة اختبار",
      expectedCredits: 3,
      semesters: [{ id: "level-1", courses: ["101 عال"] }],
      electiveGroups: [],
      fallbackCourses: {},
    };
    const rawCatalog = [{
      code: "101 عال",
      name: "مقدمة في البرمجة",
      academicHours: 3,
      lectureHours: 3,
      exerciseHours: 0,
      practicalHours: 1,
      prerequisites: [],
    }];
    const result = renderDraftPreview(plan, { rawCatalog, colors: { "عال": "#008899" } });
    process.stdout.write(JSON.stringify({
      planName: result.plan?.semesters?.[0]?.courses?.[0]?.name,
      source: result.plan?.semesters?.[0]?.courses?.[0]?.source,
      pages: result.pages.length,
      code: result.diagnostics.items.find((item) => item.code === "PRESENTATION_UNAVAILABLE")?.code,
    }));
  `;

  const child = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: projectRoot,
    env: { ...process.env, SAAD_FONT_DIR: missingFontDir },
    encoding: "utf8",
  });

  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.planName, "مقدمة في البرمجة");
  assert.equal(result.source, "catalog");
  assert.equal(result.pages, 0);
  assert.equal(result.code, "PRESENTATION_UNAVAILABLE");
});
