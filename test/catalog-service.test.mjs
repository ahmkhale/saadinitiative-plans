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
      { code: "101 عال", name: "برمجة للطلاب", academicHours: 3, lectureHours: 3 },
    ]));
    fs.writeFileSync(femalePath, JSON.stringify([
      { code: "101 عال", name: "برمجة للطالبات", academicHours: 4, lectureHours: 4 },
      { code: "102 عال", name: "هياكل البيانات", academicHours: 3, lectureHours: 3 },
    ]));
    fs.writeFileSync(colorsPath, JSON.stringify({ عال: "#008899", عام: "#616161" }));
    const service = createCatalogService({ malePath, femalePath, colorsPath });

    assert.equal(service.resolve("101 عال").name, "برمجة للطلاب");
    assert.equal(service.resolve("102 عال").name, "هياكل البيانات");
    assert.equal(service.resolve("102 عال").color, "#008899");
    assert.equal(service.summary().conflictCount, 1);
    assert.equal(service.search("هياكل").length, 1);
    assert.equal(service.resolve("999 عال").found, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
