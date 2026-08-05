import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { defaultPlanOutputName } from "../src/application/plan-output-naming.mjs";
import { outputPaths } from "../src/application/generate-plan.mjs";

test("names a plan file with the Saad plan prefix", () => {
  assert.equal(defaultPlanOutputName({ major: "علوم الحاسب" }), "خطة صاد - علوم الحاسب");
});

test("appends the track name once for track plans", () => {
  assert.equal(
    defaultPlanOutputName({
      major: "علوم الحاسب المسار العام",
      baseMajor: "علوم الحاسب",
      track: { name: "المسار العام" },
    }),
    "خطة صاد - علوم الحاسب - المسار العام",
  );
  assert.equal(
    defaultPlanOutputName({ major: "علوم الحاسب", track: { name: "المسار العام" } }),
    "خطة صاد - علوم الحاسب - المسار العام",
  );
});

test("uses the new name for every default output artifact and keeps overrides", () => {
  const paths = outputPaths({ major: "علوم الحاسب", track: { name: "المسار العام" } });
  assert.equal(path.basename(paths.pdfPath), "خطة صاد - علوم الحاسب - المسار العام.pdf");
  assert.equal(path.basename(paths.svgPath), "خطة صاد - علوم الحاسب - المسار العام.svg");
  assert.equal(path.basename(paths.resolvedPath), "خطة صاد - علوم الحاسب - المسار العام.resolved.json");

  const overridden = outputPaths({ major: "علوم الحاسب" }, { outputName: "custom-plan" });
  assert.equal(path.basename(overridden.pdfPath), "custom-plan.pdf");
});

