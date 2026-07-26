import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createInstitutionRepository,
  metadataForPlanPath,
} from "../src/infrastructure/repositories/institution-repository.mjs";

test("institution repository owns nested colleges and resolves plan metadata from location", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saad-institutions-"));
  try {
    const repository = createInstitutionRepository(root);
    repository.create({ id: "ksu", name: "جامعة الملك سعود" });
    const plans = repository.planStore("ksu");
    plans.createCollege({ id: "engineering", name: "كلية الهندسة" });
    plans.createMajor("engineering", {
      id: "electrical-engineering",
      major: "الهندسة الكهربائية",
    });

    const planPath = plans.planPath("engineering", "electrical-engineering");
    assert.equal(
      planPath,
      path.join(
        root,
        "ksu",
        "colleges",
        "engineering",
        "majors",
        "electrical-engineering",
        "plan.json",
      ),
    );
    assert.deepEqual(
      repository.metadata("ksu", "engineering"),
      { university: "جامعة الملك سعود", college: "كلية الهندسة" },
    );
    assert.deepEqual(
      metadataForPlanPath(planPath, root),
      {
        institutionId: "ksu",
        collegeId: "engineering",
        university: "جامعة الملك سعود",
        college: "كلية الهندسة",
        settingsPath: path.join(root, "ksu", "settings.json"),
        sharedSetsRoot: path.join(root, "ksu", "shared-semester-sources"),
        sharedElectivesRoot: path.join(root, "ksu", "shared-elective-sources"),
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
