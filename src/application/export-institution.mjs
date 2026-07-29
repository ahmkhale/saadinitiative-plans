export function institutionPlanSelections(store) {
  return store.listColleges().flatMap((college) => (
    college.majors.flatMap((major) => [
      {
        collegeId: college.id,
        collegeName: college.name,
        majorId: major.id,
        majorName: major.major,
        trackId: null,
        trackName: null,
      },
      ...(major.tracks ?? []).map((track) => ({
        collegeId: college.id,
        collegeName: college.name,
        majorId: major.id,
        majorName: major.major,
        trackId: track.id,
        trackName: track.name,
      })),
    ])
  ));
}

export function exportInstitutionPlans(options) {
  const {
    store,
    exportPlan,
    optionsForCollege,
    outputRoot,
    keepSvg = false,
    png = false,
  } = options;
  const selections = institutionPlanSelections(store);
  const exported = [];
  const failed = [];

  for (const selection of selections) {
    try {
      const plan = store.getComposedPlan(
        selection.collegeId,
        selection.majorId,
        selection.trackId,
      );
      const result = exportPlan(plan, {
        ...optionsForCollege(selection.collegeId),
        outputRoot,
        keepSvg,
        png,
      });
      exported.push({
        ...selection,
        folder: result.paths.folder,
        pdfPath: result.paths.pdfPath,
        pdfOptimization: result.exportResult?.pdfOptimization ?? null,
      });
    } catch (error) {
      failed.push({
        ...selection,
        error: error.message,
        diagnostics: error.diagnostics ?? null,
      });
    }
  }

  return {
    total: selections.length,
    exported,
    failed,
  };
}
