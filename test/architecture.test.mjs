import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("domain modules do not import filesystem, HTTP, SVG, or GUI concerns", () => {
  const domainRoot = path.join(root, "src", "domain");
  for (const name of fs.readdirSync(domainRoot)) {
    if (!name.endsWith(".mjs")) continue;
    const source = fs.readFileSync(path.join(domainRoot, name), "utf8");
    assert.doesNotMatch(source, /node:(?:fs|http|child_process)|render-svg|gui-server|exporter/u, name);
  }
});

test("CLI and GUI preview share the canonical application pipeline", () => {
  const pipeline = fs.readFileSync(path.join(root, "src", "pipeline.mjs"), "utf8");
  const preview = fs.readFileSync(path.join(root, "src", "preview.mjs"), "utf8");
  assert.match(pipeline, /executePlanPipeline/u);
  assert.match(preview, /executePlanPipeline/u);
});

test("renderer consumes resolved requirement labels instead of deriving academic rules", () => {
  const renderer = fs.readFileSync(path.join(root, "src", "render-svg.mjs"), "utf8");
  assert.doesNotMatch(renderer, /derivePublishedParentKeys|formatCourseRequirementLabel/u);
  assert.match(renderer, /requirementLabel/u);
});
