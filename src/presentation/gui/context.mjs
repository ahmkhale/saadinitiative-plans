import { createSharedSemesterSetStore } from "../../infrastructure/repositories/shared-semester-repository.mjs";
import { createSharedElectiveGroupStore } from "../../infrastructure/repositories/shared-elective-repository.mjs";
import { readSettings } from "../../infrastructure/repositories/settings-repository.mjs";

export function createGuiContextService({ institutions, catalogService }) {
  function institutionContext(institutionId) {
    const institution = institutions.get(institutionId);
    const store = institutions.planStore(institution.id);
    const settingsFile = institutions.settingsPath(institution.id);
    const sharedSetStore = createSharedSemesterSetStore({
      root: institutions.sharedSemesterSourcesRoot(institution.id),
      planStore: store,
      catalogService,
    });
    const sharedElectiveStore = createSharedElectiveGroupStore({
      root: institutions.sharedElectiveSourcesRoot(institution.id),
      planStore: store,
      catalogService,
    });
    return { institution, store, settingsFile, sharedSetStore, sharedElectiveStore };
  }

  function selectedContext(url, body = {}) {
    const institutionId = body.institutionId
      ?? url.searchParams.get("institutionId")
      ?? institutions.list()[0]?.id;
    if (!institutionId) throw new Error("Create an institution first.");
    return institutionContext(institutionId);
  }

  function pipelineOptions(context, collegeId = null) {
    const college = collegeId ? context.store.getCollege(collegeId) : null;
    return {
      catalogService,
      metadata: {
        institutionId: context.institution.id,
        collegeId: college?.id ?? null,
        university: context.institution.name,
        college: college?.name ?? "",
      },
      settings: readSettings(context.settingsFile),
      sharedSemesterSets: context.sharedSetStore.load(),
      sharedElectiveGroups: context.sharedElectiveStore.load(),
    };
  }

  return { institutionContext, selectedContext, pipelineOptions };
}
