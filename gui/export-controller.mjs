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

  async function generateInstitution() {
    if (!state.selectedInstitutionId) throw new Error("اختر جامعة أولًا.");
    if (state.dirty) throw new Error("احفظ تغييرات الخطة الحالية قبل تصدير جميع الخطط.");

    const button = els.generateInstitutionButton;
    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = "جارٍ تصدير جميع الخطط…";
    setStatus("جارٍ تصدير جميع خطط الجامعة. قد يستغرق ذلك بضع دقائق…");
    try {
      const output = exportOptions();
      const result = await request(institutionApi("/generate"), {
        method: "POST",
        body: JSON.stringify({
          keepSvg: output.keepSvg,
          png: output.png,
        }),
      });
      const exportedCount = result.exported.length;
      const failedCount = result.failed.length;
      const message = failedCount
        ? `اكتمل تصدير ${exportedCount} من ${result.total} خطة، وتعذّر تصدير ${failedCount}.`
        : `اكتمل تصدير جميع خطط الجامعة (${exportedCount} خطة).`;
      const firstPdf = result.exported[0]?.pdf;
      const link = document.createElement("a");
      if (firstPdf) {
        link.href = firstPdf;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "فتح أول ملف PDF";
      }
      els.globalStatus.className = `status ${failedCount ? "error" : "success"}`;
      els.globalStatus.replaceChildren(
        document.createTextNode(`${message} `),
        ...(firstPdf ? [link] : []),
      );
    } finally {
      button.disabled = false;
      button.textContent = previousText;
    }
  }

  function bind() {
    els.generateButton.addEventListener("click", () => generatePlan(true).catch((error) => setStatus(error.message, "error")));
    els.generateDraftButton.addEventListener("click", () => generatePlan(false).catch((error) => setStatus(error.message, "error")));
    els.generateInstitutionButton.addEventListener("click", () => generateInstitution().catch((error) => setStatus(error.message, "error")));
  }

  return { bind, generateInstitution, generatePlan, savePlan };
}
