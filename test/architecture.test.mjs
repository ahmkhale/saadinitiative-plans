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
  const generate = fs.readFileSync(path.join(root, "src", "application", "generate-plan.mjs"), "utf8");
  const preview = fs.readFileSync(path.join(root, "src", "application", "preview-plan.mjs"), "utf8");
  const pipelineFacade = fs.readFileSync(path.join(root, "src", "pipeline.mjs"), "utf8");
  const previewFacade = fs.readFileSync(path.join(root, "src", "preview.mjs"), "utf8");
  assert.match(generate, /executePlanPipeline/u);
  assert.match(preview, /executePlanPipeline/u);
  assert.match(pipelineFacade, /application\/generate-plan/u);
  assert.match(previewFacade, /application\/preview-plan/u);
});

test("renderer consumes resolved requirement labels instead of deriving academic rules", () => {
  const renderer = fs.readFileSync(path.join(root, "src", "presentation", "svg", "course-card.mjs"), "utf8");
  assert.doesNotMatch(renderer, /derivePublishedParentKeys|formatCourseRequirementLabel/u);
  assert.match(renderer, /requirementLabel/u);
});

test("legacy renderer and plan-input files are thin compatibility facades", () => {
  const rendererFacade = fs.readFileSync(path.join(root, "src", "render-svg.mjs"), "utf8");
  const inputFacade = fs.readFileSync(path.join(root, "src", "plan-input.mjs"), "utf8");
  assert.ok(rendererFacade.split("\n").length < 20, "render-svg.mjs should remain a thin facade");
  assert.ok(inputFacade.split("\n").length < 20, "plan-input.mjs should remain a thin facade");
});

test("shared source stores use focused infrastructure repositories and the common JSON repository", () => {
  const semesterFacade = fs.readFileSync(path.join(root, "src", "shared-semester-sets.mjs"), "utf8");
  const electiveFacade = fs.readFileSync(path.join(root, "src", "shared-elective-groups.mjs"), "utf8");
  const semesterRepository = fs.readFileSync(path.join(root, "src", "infrastructure", "repositories", "shared-semester-repository.mjs"), "utf8");
  const electiveRepository = fs.readFileSync(path.join(root, "src", "infrastructure", "repositories", "shared-elective-repository.mjs"), "utf8");
  assert.match(semesterFacade, /shared-semester-repository/u);
  assert.match(electiveFacade, /shared-elective-repository/u);
  assert.match(semesterRepository, /createJsonSourceRepository/u);
  assert.match(electiveRepository, /createJsonSourceRepository/u);
  assert.ok(semesterFacade.split("\n").length < 12);
  assert.ok(electiveFacade.split("\n").length < 12);
});


test("GUI app delegates entity and proposal behavior to focused modules", () => {
  const app = fs.readFileSync(path.join(root, "gui", "app.js"), "utf8");
  assert.match(app, /createEntityActions/u);
  assert.match(app, /createProposalFromPublished/u);
  assert.match(app, /dropProposalCourse/u);
  assert.ok(app.split("\n").length < 1000, "gui/app.js should remain a browser composition root");
});

test("legacy semantic entry points are facades over domain and application modules", () => {
  const facades = [
    ["normalize.mjs", /domain\/course-code/u, 20],
    ["course-facts.mjs", /domain\/course-facts/u, 12],
    ["diagnostics.mjs", /domain\/diagnostics/u, 6],
    ["semester-labels.mjs", /domain\/semester/u, 6],
    ["proposal-reconciliation.mjs", /application\/reconcile-proposal/u, 6],
    ["fallback-hydration.mjs", /application\/hydrate-fallbacks/u, 10],
    ["resolve.mjs", /application\/resolve-plan/u, 6],
  ];
  for (const [file, target, limit] of facades) {
    const source = fs.readFileSync(path.join(root, "src", file), "utf8");
    assert.match(source, target, file);
    assert.ok(source.split("\n").length < limit, `${file} should remain a thin facade`);
  }
});

test("GUI server delegates API routing, context composition, and HTTP primitives", () => {
  const server = fs.readFileSync(path.join(root, "src", "gui-server.mjs"), "utf8");
  assert.match(server, /createGuiApiRouter/u);
  assert.match(server, /createGuiContextService/u);
  assert.match(server, /presentation\/gui\/http/u);
  assert.ok(server.split("\n").length < 120, "gui-server.mjs should remain a transport composition root");
});

test("application pipeline imports focused shared composition and repositories", () => {
  const pipeline = fs.readFileSync(path.join(root, "src", "application", "plan-pipeline.mjs"), "utf8");
  assert.match(pipeline, /\.\/compose-published-plan\.mjs/u);
  assert.match(pipeline, /shared-semester-repository\.mjs/u);
  assert.match(pipeline, /shared-elective-repository\.mjs/u);
  assert.doesNotMatch(pipeline, /\.\.\/shared-(?:semester-sets|elective-groups)\.mjs/u);
});


test("catalog and export implementation live under infrastructure", () => {
  const catalogFacade = fs.readFileSync(path.join(root, "src", "catalog.mjs"), "utf8");
  const catalogServiceFacade = fs.readFileSync(path.join(root, "src", "catalog-service.mjs"), "utf8");
  const exporterFacade = fs.readFileSync(path.join(root, "src", "exporter.mjs"), "utf8");
  assert.match(catalogFacade, /infrastructure\/catalog\/catalog-aggregator/u);
  assert.match(catalogServiceFacade, /infrastructure\/catalog\/catalog-service/u);
  assert.match(exporterFacade, /infrastructure\/export\/inkscape-exporter/u);
  assert.ok(catalogFacade.split("\n").length < 6);
  assert.ok(catalogServiceFacade.split("\n").length < 6);
  assert.ok(exporterFacade.split("\n").length < 6);
});

test("layout is split by page, semester, elective, and proposal responsibility", () => {
  const page = fs.readFileSync(path.join(root, "src", "presentation", "layout", "page-layout.mjs"), "utf8");
  assert.match(page, /semester-layout/u);
  assert.match(page, /elective-layout/u);
  assert.match(page, /proposal-layout/u);
  for (const name of ["tokens.mjs", "semester-layout.mjs", "elective-layout.mjs", "proposal-layout.mjs"]) {
    assert.ok(fs.existsSync(path.join(root, "src", "presentation", "layout", name)), name);
  }
});

test("academic course resolution does not depend on text measurement or SVG", () => {
  const resolver = fs.readFileSync(path.join(root, "src", "application", "course-resolver.mjs"), "utf8");
  assert.doesNotMatch(resolver, /text-measure|text-fit|presentation\/svg|render-svg/u);
  const validation = fs.readFileSync(path.join(root, "src", "presentation", "layout", "text-validation.mjs"), "utf8");
  assert.match(validation, /courseNameFit/u);
});


test("default generation output stays at repository-level dist", async () => {
  const { outputPaths } = await import("../src/application/generate-plan.mjs");
  const paths = outputPaths({ id: "sample-plan", major: "عينة" });
  assert.match(paths.folder.replaceAll("\\", "/"), /\/dist\/sample-plan$/u);
  assert.equal(paths.folder.replaceAll("\\", "/").includes("/src/dist/"), false);
});
