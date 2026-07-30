import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createCatalogService } from "../src/catalog-service.mjs";

test("catalog service prefers male rows and falls back to female-only courses", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saad-plan-catalog-"));
  try {
    const malePath = path.join(root, "male.json");
    const femalePath = path.join(root, "female.json");
    const colorsPath = path.join(root, "colors.json");
    fs.writeFileSync(malePath, JSON.stringify([
      { code: "101 عال", name: "برمجة للطلاب", academicHours: 3, lectureHours: 3, exerciseHours: 0, practicalHours: 0 },
    ]));
    fs.writeFileSync(femalePath, JSON.stringify([
      { code: "101 عال", name: "برمجة للطالبات", academicHours: 4, lectureHours: 4, exerciseHours: 0, practicalHours: 0 },
      { code: "102 عال", name: "هياكل البيانات", academicHours: 3, lectureHours: 3, exerciseHours: 0, practicalHours: 0 },
    ]));
    fs.writeFileSync(colorsPath, JSON.stringify({ عال: "#008899", عام: "#616161" }));
    const service = createCatalogService({ malePath, femalePath, colorsPath });

    assert.equal(service.resolve("101 عال").name, "برمجة للطلاب");
    assert.equal(service.resolve("101 عال").catalogSource, "male");
    assert.equal(service.resolve("101 عال").sourceBadge, "دليل الطلاب");
    assert.deepEqual(service.resolve("101 عال").qualityBadges, ["بيانات متعارضة"]);
    assert.equal(service.resolve("102 عال").name, "هياكل البيانات");
    assert.equal(service.resolve("102 عال").catalogSource, "female");
    assert.equal(service.resolve("102 عال").sourceBadge, "دليل الطالبات");
    assert.deepEqual(service.resolve("102 عال").qualityBadges, []);
    assert.equal(service.resolve("102 عال").color, "#008899");
    assert.equal(service.summary().conflictCount, 1);
    assert.equal(service.search("هياكل").length, 1);
    assert.equal(service.resolve("999 عال").found, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("catalog service follows the institution active term", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saad-term-catalog-"));
  try {
    const institutionRoot = path.join(root, "ksu");
    const termRoot = path.join(institutionRoot, "472");
    fs.mkdirSync(termRoot, { recursive: true });
    fs.writeFileSync(path.join(institutionRoot, "active.json"), JSON.stringify({ termId: "472" }));
    fs.writeFileSync(path.join(termRoot, "male.json"), JSON.stringify([
      {
        code: "101 عال",
        name: "برمجة",
        academicHours: 3,
        lectureHours: 3,
        exerciseHours: 0,
        practicalHours: 0,
      },
    ]));
    fs.writeFileSync(path.join(termRoot, "female.json"), "[]");
    const service = createCatalogService({ catalogRoot: root, institutionId: "ksu" });
    assert.equal(service.termId, "472");
    assert.equal(service.summary().termId, "472");
    assert.equal(service.resolve("101 عال").found, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("catalog service completes missing male facts from female without reporting a conflict", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saad-plan-catalog-completion-"));
  try {
    const malePath = path.join(root, "male.json");
    const femalePath = path.join(root, "female.json");
    const colorsPath = path.join(root, "colors.json");
    fs.writeFileSync(malePath, JSON.stringify([
      { code: "497 كيم", name: "تدريب كيميائي", academicHours: 2 },
    ]));
    fs.writeFileSync(femalePath, JSON.stringify([
      {
        code: "497 كيم",
        name: "تدريب كيميائي",
        academicHours: 2,
        lectureHours: 0,
        exerciseHours: 0,
        practicalHours: 4,
      },
    ]));
    fs.writeFileSync(colorsPath, JSON.stringify({ عام: "#616161" }));

    const service = createCatalogService({ malePath, femalePath, colorsPath });
    const course = service.resolve("497 كيم");

    assert.equal(course.catalogSource, "male");
    assert.equal(course.sourceBadge, "دليل الطلاب · استكمال من دليل الطالبات");
    assert.deepEqual(course.completedFromFemaleFields, ["lectureHours", "practicalHours", "exerciseHours"]);
    assert.deepEqual(course.catalogFieldSources, {
      name: "male",
      academicHours: "male",
      lectureHours: "female",
      practicalHours: "female",
      exerciseHours: "female",
    });
    assert.equal(course.lectureHours, 0);
    assert.equal(course.practicalHours, 4);
    assert.equal(course.exerciseHours, 0);
    assert.deepEqual(course.qualityBadges, []);
    assert.equal(service.summary().conflictCount, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("catalog service searches terms newest-to-oldest and male-before-female within each term", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saad-history-catalog-"));
  try {
    const institutionRoot = path.join(root, "ksu");
    const writeTerm = (termId, male, female) => {
      const termRoot = path.join(institutionRoot, termId);
      fs.mkdirSync(termRoot, { recursive: true });
      fs.writeFileSync(path.join(termRoot, "male.json"), JSON.stringify(male));
      fs.writeFileSync(path.join(termRoot, "female.json"), JSON.stringify(female));
    };
    const course = (code, name) => ({
      code,
      name,
      academicHours: 3,
      lectureHours: 3,
      exerciseHours: 0,
      practicalHours: 0,
    });

    fs.mkdirSync(institutionRoot, { recursive: true });
    fs.writeFileSync(path.join(institutionRoot, "active.json"), JSON.stringify({ termId: "472" }));
    writeTerm("472", [
      course("101 عال", "نشط طلاب"),
    ], [
      course("101 عال", "نشط طالبات"),
      course("102 عال", "نشط طالبات فقط"),
    ]);
    writeTerm("471", [
      course("102 عال", "قديم طلاب"),
      course("103 عال", "471 طلاب"),
    ], [
      course("103 عال", "471 طالبات"),
      course("104 عال", "471 طالبات فقط"),
    ]);
    writeTerm("462", [
      course("103 عال", "462 طلاب"),
      course("104 عال", "462 طلاب"),
      course("105 عال", "462 طلاب فقط"),
    ], []);
    writeTerm("temp 461 data", [course("106 عال", "يجب تجاهله")], []);

    const service = createCatalogService({ catalogRoot: root, institutionId: "ksu" });

    assert.equal(service.resolve("101 عال").name, "نشط طلاب");
    assert.equal(service.resolve("102 عال").name, "نشط طالبات فقط");
    assert.equal(service.resolve("103 عال").name, "471 طلاب");
    assert.equal(service.resolve("104 عال").name, "471 طالبات فقط");
    assert.equal(service.resolve("105 عال").name, "462 طلاب فقط");
    assert.equal(service.resolve("105 عال").catalogTermId, "462");
    assert.equal(service.resolve("105 عال").sourceBadge, "دليل الطلاب · 462");
    assert.equal(service.resolve("106 عال").found, false);
    assert.deepEqual(service.summary().termIds, ["472", "471", "462"]);
    assert.deepEqual(
      service.summary().sources.map((source) => [source.termId, source.role]),
      [
        ["472", "primary"],
        ["472", "fallback"],
        ["471", "historical-primary"],
        ["471", "historical-fallback"],
        ["462", "historical-primary"],
        ["462", "historical-fallback"],
      ],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("catalog service rejects active term folders outside the YY1 or YY2 convention", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saad-invalid-term-catalog-"));
  try {
    const institutionRoot = path.join(root, "ksu");
    fs.mkdirSync(institutionRoot, { recursive: true });
    fs.writeFileSync(path.join(institutionRoot, "active.json"), JSON.stringify({ termId: "2026-1" }));

    const service = createCatalogService({ catalogRoot: root, institutionId: "ksu" });
    assert.throws(() => service.snapshot(), /YY1 or YY2/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
