export function createExportController(options) {
  const {
    state,
    els,
    request,
    institutionApi,
    setDirty,
    loadState,
    renderEditor,
    setStatus,
    exportOptions,
  } = options;

  async function savePlan() {
    if (!state.plan) return;
    const oldId = state.selectedMajorId;
    const suffix = state.selectedTrackId
      ? `/colleges/${encodeURIComponent(state.selectedCollegeId)}/majors/${encodeURIComponent(oldId)}/tracks/${encodeURIComponent(state.selectedTrackId)}`
      : `/colleges/${encodeURIComponent(state.selectedCollegeId)}/majors/${encodeURIComponent(oldId)}`;
    const result = await request(institutionApi(suffix), {
      method: "PUT",
      body: JSON.stringify(state.plan),
    });
    state.plan = result.plan;
    state.parentPlan = result.parentPlan ?? null;
    state.selectedMajorId = result.plan.id;
    state.selectedTrackId = result.plan.track?.id ?? state.selectedTrackId;
    setDirty(false);
    await loadState();
    renderEditor();
    setStatus("حُفظت الخطة.", "success");
  }

  async function generatePlan(save = true) {
    if (!state.plan) return;
    setStatus("جارٍ إنشاء الملف…");
    const output = exportOptions();
    const result = await request("/api/generate", {
      method: "POST",
      body: JSON.stringify({
        plan: state.plan,
        institutionId: state.selectedInstitutionId,
        collegeId: state.selectedCollegeId,
        majorId: state.selectedMajorId,
        trackId: state.selectedTrackId,
        save,
        keepSvg: output.keepSvg,
        png: output.png,
      }),
    });
    if (save) {
      setDirty(false);
      await loadState();
    }
    const link = document.createElement("a");
    link.href = result.files.pdf;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "فتح ملف PDF";
    els.globalStatus.className = "status success";
    const optimization = result.pdfOptimization;
    const sizeNote = optimization?.optimized
      ? ` ضُغط ملف PDF من ${(optimization.originalSize / 1024).toFixed(0)} إلى ${(optimization.optimizedSize / 1024).toFixed(0)} كيلوبايت. `
      : optimization?.reason === "ghostscript-not-found"
        ? " اكتمل الضغط الأساسي؛ ثبّت Ghostscript للضغط الأقصى. "
        : " ";
    els.globalStatus.replaceChildren(
      document.createTextNode((save ? "حُفظت الخطة واكتمل الإنشاء." : "اكتمل الإنشاء دون حفظ الخطة.") + sizeNote),
      link,
    );
  }

  return { generatePlan, savePlan };
}
