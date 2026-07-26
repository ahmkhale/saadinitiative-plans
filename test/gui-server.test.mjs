import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createCatalogService } from "../src/catalog-service.mjs";
import { createGuiServer } from "../src/gui-server.mjs";
import { createInstitutionRepository } from "../src/store.mjs";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saad-plan-gui-"));
  const institutionRepository = createInstitutionRepository(path.join(root, "institutions"));
  const malePath = path.join(root, "male.json");
  const femalePath = path.join(root, "female.json");
  const colorsPath = path.join(root, "colors.json");
  fs.writeFileSync(malePath, JSON.stringify([
    {
      code: "101 عال",
      name: "مقدمة في البرمجة",
      academicHours: 3,
      lectureHours: 3,
      practicalHours: 1,
      exerciseHours: 0,
      prerequisites: [],
    },
  ]));
  fs.writeFileSync(femalePath, "[]");
  fs.writeFileSync(colorsPath, JSON.stringify({ عال: "#008899", عام: "#616161" }));
  const catalogService = createCatalogService({ malePath, femalePath, colorsPath });
  institutionRepository.create({ id: "test-university", name: "جامعة الاختبار" });
  const store = institutionRepository.planStore("test-university");
  store.createCollege({ id: "ccis", name: "كلية علوم الحاسب" });
  const plan = store.createMajor("ccis", { id: "cs", major: "علوم الحاسب", expectedCredits: 3 });
  plan.semesters[0].courses = ["101 عال"];
  store.savePlan("ccis", "cs", plan);
  return { root, store, catalogService, plan, institutionRepository };
}

test("GUI API lists, reads, validates, and previews unsaved plans", async () => {
  const value = fixture();
  const server = createGuiServer({
    institutionRepository: value.institutionRepository,
    catalogService: value.catalogService,
    outputRoot: path.join(value.root, "dist"),
  });
  const address = await listen(server);
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const state = await fetch(`${base}/api/state`).then((response) => response.json());
    assert.equal(state.colleges[0].majors[0].id, "cs");
    assert.equal(state.catalog.resolvedCourseCount, 1);
    assert.equal(state.settings.edition, "الطبعة الرابعة");

    const savedSettings = await fetch(`${base}/api/institutions/test-university/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edition: "طبعة الاختبار", release: "إصدار 1.0" }),
    }).then((response) => response.json());
    assert.equal(savedSettings.settings.edition, "طبعة الاختبار");

    const createdSet = await fetch(`${base}/api/institutions/test-university/shared-semester-sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "foundation",
        name: "السنة المشتركة",
        phaseLabel: "السنة الأولى",
        semesters: [{ id: "foundation-1", name: "المستوى الأول", courses: ["101 عال"] }],
        scope: { type: "institution", institutionId: "test-university" },
      }),
    }).then((response) => response.json());
    assert.equal(createdSet.sharedSemesterSet.semesters[0].courses[0].code, "101 عال");

    const readSet = await fetch(`${base}/api/institutions/test-university/shared-semester-sources/foundation`)
      .then((response) => response.json());
    assert.equal(readSet.sharedSemesterSet.name, "السنة المشتركة");

    const createdElective = await fetch(`${base}/api/institutions/test-university/shared-elective-sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "university",
        name: "متطلبات الجامعة",
        requiredHours: 2,
        courses: ["101 عال"],
        scope: { type: "institution", institutionId: "test-university" },
      }),
    }).then((response) => response.json());
    assert.equal(createdElective.sharedElectiveGroup.fallbackCourses["101 عال"].name, "مقدمة في البرمجة");

    const duplicatedElective = await fetch(`${base}/api/institutions/test-university/shared-elective-sources/university/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "university-copy", name: "نسخة متطلبات الجامعة" }),
    }).then((response) => response.json());
    assert.equal(duplicatedElective.sharedElectiveGroup.courses[0], "101 عال");
    assert.equal((await fetch(`${base}/api/institutions/test-university/shared-elective-sources/university-copy`, { method: "DELETE" })).status, 200);

    const referencedPlan = value.store.getPlan("ccis", "cs");
    referencedPlan.electiveGroups = [{ sourceId: "university" }];
    value.store.savePlan("ccis", "cs", referencedPlan);
    assert.equal((await fetch(`${base}/api/institutions/test-university/shared-elective-sources/university`, { method: "DELETE" })).status, 400);

    const read = await fetch(`${base}/api/institutions/test-university/colleges/ccis/majors/cs`).then((response) => response.json());
    assert.equal(read.plan.major, "علوم الحاسب");

    const draft = structuredClone(read.plan);
    draft.major = "علوم الحاسب - غير محفوظ";
    const validation = await fetch(`${base}/api/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ institutionId: "test-university", collegeId: "ccis", plan: draft }),
    }).then((response) => response.json());
    assert.equal(validation.ok, true);
    assert.equal(validation.plan.semesters[0].courses[0].name, "مقدمة في البرمجة");
    assert.equal(value.store.getPlan("ccis", "cs").major, "علوم الحاسب");

    const preview = await fetch(`${base}/api/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ institutionId: "test-university", collegeId: "ccis", plan: draft }),
    }).then((response) => response.json());
    assert.equal(preview.ok, true);
    assert.match(preview.pages[0], /غير محفوظ/u);
    assert.equal(preview.pageLayouts[0].width, 594);

    const unresolved = await fetch(`${base}/api/catalog/course?code=${encodeURIComponent("999 عال")}`)
      .then((response) => response.json());
    assert.equal(unresolved.course.found, false);

    draft.semesters[0].courses.push("999 عال");
    const unresolvedPreview = await fetch(`${base}/api/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ institutionId: "test-university", collegeId: "ccis", plan: draft }),
    }).then((response) => response.json());
    assert.equal(unresolvedPreview.ok, false);
    assert.ok(unresolvedPreview.diagnostics.items.some((item) => item.code === "UNRESOLVED_COURSE"));
  } finally {
    await close(server);
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("GUI API saves valid plans, rejects invalid plans, and reports generated files", async () => {
  const value = fixture();
  const outputRoot = path.join(value.root, "dist");
  let exportedPlan = null;
  const fakeExport = (plan) => {
    exportedPlan = structuredClone(plan);
    const folder = path.join(outputRoot, plan.id);
    fs.mkdirSync(folder, { recursive: true });
    const pdfPath = path.join(folder, "plan.pdf");
    fs.writeFileSync(pdfPath, "pdf");
    return {
      diagnostics: { summary: { errors: 0, warnings: 0, info: 0 }, items: [] },
      document: { pageLayouts: [{ width: 594, height: 271 }] },
      paths: { folder, pdfPath, svgPath: path.join(folder, "plan.svg"), pngPath: path.join(folder, "plan.png") },
    };
  };
  let openedFolder = null;
  const server = createGuiServer({
    institutionRepository: value.institutionRepository,
    catalogService: value.catalogService,
    outputRoot,
    exportDraftFn: fakeExport,
    openOutputFn: (folder) => {
      openedFolder = folder;
    },
  });
  const address = await listen(server);
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const changed = { ...value.plan, major: "علوم الحاسب المحدثة" };
    const saved = await fetch(`${base}/api/institutions/test-university/colleges/ccis/majors/cs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changed),
    });
    assert.equal(saved.status, 200);
    assert.equal(value.store.getPlan("ccis", "cs").major, "علوم الحاسب المحدثة");

    const invalid = await fetch(`${base}/api/institutions/test-university/colleges/ccis/majors/cs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...changed, semesters: [] }),
    });
    assert.equal(invalid.status, 400);

    const generated = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ institutionId: "test-university", plan: changed, collegeId: "ccis", majorId: "cs", save: false }),
    }).then((response) => response.json());
    assert.equal(generated.ok, true);
    assert.match(generated.files.pdf, /^\/dist\/cs\/plan\.pdf\?v=\d+$/u);

    const preview = await fetch(`${base}/api/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ institutionId: "test-university", collegeId: "ccis", plan: changed }),
    }).then((response) => response.json());
    assert.deepEqual(
      generated.pageLayouts.map(({ width, height }) => ({ width, height })),
      preview.pageLayouts.map(({ width, height }) => ({ width, height })),
    );

    const unsorted = structuredClone(changed);
    unsorted.semesters[0].courses = ["102 عال", "101 عال"];
    unsorted.fallbackCourses ??= {};
    unsorted.fallbackCourses["102 عال"] = {
      name: "مقرر آخر",
      academicHours: 3,
      lectureHours: 3,
      practicalHours: 0,
      exerciseHours: 0,
      prerequisites: ["101 عال"],
    };
    await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ institutionId: "test-university", plan: unsorted, collegeId: "ccis", majorId: "cs", save: true }),
    }).then((response) => response.json());
    assert.deepEqual(exportedPlan, value.store.getPlan("ccis", "cs"));

    const opened = await fetch(`${base}/api/open-output`, { method: "POST" })
      .then((response) => response.json());
    assert.equal(opened.ok, true);
    assert.equal(openedFolder, outputRoot);
  } finally {
    await close(server);
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("GUI API rejects path traversal", async () => {
  const value = fixture();
  const server = createGuiServer({
    institutionRepository: value.institutionRepository,
    catalogService: value.catalogService,
  });
  const address = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/institutions/test-university/colleges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "../escape", name: "خطر" }),
    });
    assert.equal(response.status, 400);
  } finally {
    await close(server);
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});
