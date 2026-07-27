import { scopeTarget } from "./plan-model.mjs";

export function createSharedSourceEditors({
  state,
  els,
  request,
  escapeHtml,
  setStatus,
  institutionApi,
  loadState,
  renderCollection,
  renderEditor,
  schedulePreview,
  courseRow,
  resolvedCollection,
  sourceAppliesToSelection,
  scopeFromFields,
}) {
  function renderSharedSetEditor() {
    const draft = state.sharedSetDraft;
    els.sharedSetEditor.hidden = !draft;
    if (!draft) return;
    els.sharedSetEditorTitle.textContent = draft.name || "خطة مشتركة جديدة";
    els.sharedSetName.value = draft.name ?? "";
    els.sharedSetId.value = draft.id ?? "";
    els.sharedSetPhase.value = draft.phaseLabel ?? "السنة التحضيرية";
    els.sharedSetScopeType.value = draft.scope?.type ?? "institution";
    els.sharedSetScopeTarget.value = scopeTarget(draft.scope);
    renderCollection(els.sharedSemesterList, draft.semesters ?? [], "shared");
  }

  async function refreshSharedSetResolution() {
    if (!state.sharedSetDraft) return;
    const result = await request("/api/preview", {
      method: "POST",
      body: JSON.stringify({
        institutionId: state.selectedInstitutionId,
        collegeId: state.selectedCollegeId || null,
        plan: {
          schemaVersion: 1,
          id: "shared-preview",
          major: state.sharedSetDraft.name || "الخطة المشتركة",
          semesters: state.sharedSetDraft.semesters,
          fallbackCourses: state.sharedSetDraft.fallbackCourses ?? {},
          electiveGroups: [],
        },
      }),
    });
    state.sharedSetResolved = result.plan;
    renderCollection(els.sharedSemesterList, state.sharedSetDraft.semesters, "shared");
  }

  function scheduleSharedSetResolution(delay = 250) {
    clearTimeout(state.sharedSemesterPreviewTimer);
    state.sharedSemesterPreviewTimer = setTimeout(() => (
      refreshSharedSetResolution().catch((error) => setStatus(error.message, "error"))
    ), delay);
  }

  function sharedChanged(render = false) {
    state.sharedSetDirty = true;
    if (render) renderSharedSetEditor();
    scheduleSharedSetResolution();
  }

  function openSharedSetEditor(set = null) {
    state.sharedSetDraft = structuredClone(set ?? {
      schemaVersion: 1,
      id: "",
      name: "",
      phaseLabel: "السنة التحضيرية",
      semesters: [{ id: `shared-semester-${crypto.randomUUID()}`, courses: [] }, { id: `shared-semester-${crypto.randomUUID()}`, courses: [] }],
      fallbackCourses: {},
      scope: { type: "institution", institutionId: state.selectedInstitutionId },
    });
    state.sharedSetDraft._originalId = set?.id ?? null;
    state.sharedSetResolved = null;
    state.sharedSetDirty = false;
    renderSharedSetEditor();
    document.querySelector('[data-tab="settings"]')?.click();
    els.sharedSetEditor.scrollIntoView({ behavior: "smooth", block: "start" });
    scheduleSharedSetResolution(0);
  }

  async function saveSharedSetEditor() {
    const draft = state.sharedSetDraft;
    if (!draft) return;
    draft.name = els.sharedSetName.value.trim();
    draft.id = els.sharedSetId.value.trim();
    draft.phaseLabel = els.sharedSetPhase.value.trim() || "السنة التحضيرية";
    draft.scope = scopeFromFields(els.sharedSetScopeType.value, els.sharedSetScopeTarget.value);
    const previousId = draft._originalId;
    const payload = structuredClone(draft);
    payload.scope ??= { type: "institution", institutionId: state.selectedInstitutionId };
    delete payload._originalId;
    await request(institutionApi(previousId
      ? `/shared-semester-sources/${encodeURIComponent(previousId)}`
      : "/shared-semester-sources"), {
      method: previousId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    state.sharedSetDraft = null;
    state.sharedSetResolved = null;
    state.sharedSetDirty = false;
    await loadState();
    renderSharedSetEditor();
    if (state.plan) {
      renderEditor();
      schedulePreview(0);
    }
    setStatus("حُفظت الخطة المشتركة، وستظهر في كل تخصص مرتبط بها.", "success");
  }

  function renderSharedSets() {
    if (els.sharedSetChoices) {
      const selected = new Set(state.plan?.sharedSemesterSets ?? []);
      const eligible = state.sharedSemesterSets.filter(sourceAppliesToSelection);
      els.sharedSetChoices.innerHTML = eligible.length
        ? `<label class="choice-item"><span><strong>دون خطة مشتركة</strong><small>تبدأ مستويات التخصص مباشرة.</small></span><input data-shared-set-choice="" name="shared-foundation-choice" type="radio" ${selected.size === 0 ? "checked" : ""}></label>`
          + eligible.map((set) => `
          <label class="choice-item"><span><strong>${escapeHtml(set.name)}</strong><small>${set.semesters.length} مستويات · ${escapeHtml(set.phaseLabel)}</small></span>
            <input data-shared-set-choice="${escapeHtml(set.id)}" name="shared-foundation-choice" type="radio" ${selected.has(set.id) ? "checked" : ""}>
          </label>`).join("")
        : '<p class="muted">لم تُعرّف خطة مشتركة بعد.</p>';
    }
    if (els.sharedSetList) {
      els.sharedSetList.innerHTML = state.sharedSemesterSets.length
        ? state.sharedSemesterSets.map((set) => `
          <div class="shared-set-item" data-shared-set="${escapeHtml(set.id)}">
            <span><strong>${escapeHtml(set.name)}</strong><small>${set.semesters.length} فصول · تستخدمها ${set.usages?.length ?? 0} خطط</small></span>
            <span class="menu-actions">
              <button class="button ghost edit-shared-set" type="button">تعديل</button>
              <button class="button ghost duplicate-shared-set" type="button">نسخ</button>
              <button class="button danger-ghost delete-shared-set" type="button">حذف</button>
            </span>
          </div>`).join("")
        : '<p class="muted">أنشئ خطة مشتركة، مثل التحضيري العلمي، ثم أضف مقرراتها مرة واحدة.</p>';
    }
  }

  async function editSharedSet(id) {
    const current = state.sharedSemesterSets.find((set) => set.id === id);
    if (!current) throw new Error("لم يُعثر على الخطة المشتركة.");
    openSharedSetEditor(current);
  }

  function renderSharedElectiveSources() {
    els.sharedElectiveSourceList.innerHTML = state.sharedElectiveGroups.map((source) => `
      <article class="shared-set-row" data-shared-elective-source="${escapeHtml(source.id)}">
        <div><strong>${escapeHtml(source.name)}</strong>
          <small>${source.courses.length} مقررات · ${source.requiredHours} ساعات · مستخدم في ${source.usages?.length ?? 0} تخصص</small>
          ${source.usages?.length ? `<small>${escapeHtml(source.usages.map((usage) => `${usage.college} — ${usage.major}`).join(" · "))}</small>` : ""}
        </div>
        <div class="menu-actions">
          <button class="button ghost edit-shared-elective-source" type="button">تعديل</button>
          <button class="button ghost duplicate-shared-elective-source" type="button">نسخ</button>
          <button class="button danger-ghost delete-shared-elective-source" type="button">حذف</button>
        </div>
      </article>
    `).join("") || '<p class="muted">لا توجد مصادر اختيارية مشتركة.</p>';
  }

  function renderSharedElectiveSourceEditor() {
    const draft = state.sharedElectiveDraft;
    els.sharedElectiveSourceEditor.hidden = !draft;
    if (!draft) return;
    els.sharedElectiveSourceEditorTitle.textContent = draft.name || "مجموعة اختيارية جديدة";
    els.sharedElectiveSourceName.value = draft.name ?? "";
    els.sharedElectiveSourceId.value = draft.id ?? "";
    els.sharedElectiveSourceHours.value = draft.requiredHours ?? 0;
    els.sharedElectiveScopeType.value = draft.scope?.type ?? "institution";
    els.sharedElectiveScopeTarget.value = scopeTarget(draft.scope);
    const resolved = resolvedCollection("sharedElective", 0);
    els.sharedElectiveCourseList.innerHTML = (draft.courses ?? []).map((entry, index) => (
      courseRow(typeof entry === "string" ? { code: entry } : entry, resolved[index], "sharedElective", 0, index)
    )).join("") || '<p class="muted">لا مقررات في هذا المصدر.</p>';
  }

  async function refreshSharedElectiveResolution() {
    if (!state.sharedElectiveDraft) return;
    const result = await request("/api/preview", {
      method: "POST",
      body: JSON.stringify({
        institutionId: state.selectedInstitutionId,
        collegeId: state.selectedCollegeId || null,
        plan: {
          schemaVersion: 1,
          id: "shared-elective-preview",
          major: state.sharedElectiveDraft.name || "مجموعة اختيارية",
          semesters: [{ id: "preview-level", courses: [] }],
          fallbackCourses: state.sharedElectiveDraft.fallbackCourses ?? {},
          electiveGroups: [{
            id: "preview-elective",
            name: state.sharedElectiveDraft.name || "مجموعة اختيارية",
            requiredHours: Number(state.sharedElectiveDraft.requiredHours ?? 0),
            courses: state.sharedElectiveDraft.courses ?? [],
          }],
        },
      }),
    });
    state.sharedElectiveResolved = result.plan;
    renderSharedElectiveSourceEditor();
  }

  function scheduleSharedElectiveResolution(delay = 250) {
    clearTimeout(state.sharedElectivePreviewTimer);
    state.sharedElectivePreviewTimer = setTimeout(() => (
      refreshSharedElectiveResolution().catch((error) => setStatus(error.message, "error"))
    ), delay);
  }

  function sharedElectiveChanged(render = false) {
    state.sharedElectiveDirty = true;
    if (render) renderSharedElectiveSourceEditor();
    scheduleSharedElectiveResolution();
  }

  function openSharedElectiveSourceEditor(source = null) {
    state.sharedElectiveDraft = structuredClone(source ?? {
      schemaVersion: 1,
      id: "",
      name: "",
      requiredHours: 0,
      courses: [],
      fallbackCourses: {},
      scope: { type: "institution", institutionId: state.selectedInstitutionId },
    });
    state.sharedElectiveDraft._originalId = source?.id ?? null;
    state.sharedElectiveResolved = null;
    state.sharedElectiveDirty = false;
    renderSharedElectiveSourceEditor();
    document.querySelector('[data-tab="settings"]')?.click();
    els.sharedElectiveSourceEditor.scrollIntoView({ behavior: "smooth", block: "start" });
    scheduleSharedElectiveResolution(0);
  }

  async function saveSharedElectiveSourceEditor() {
    const draft = state.sharedElectiveDraft;
    if (!draft) return;
    draft.name = els.sharedElectiveSourceName.value.trim();
    draft.id = els.sharedElectiveSourceId.value.trim();
    draft.requiredHours = Number(els.sharedElectiveSourceHours.value);
    draft.scope = scopeFromFields(els.sharedElectiveScopeType.value, els.sharedElectiveScopeTarget.value);
    const previousId = draft._originalId;
    const payload = structuredClone(draft);
    payload.scope ??= { type: "institution", institutionId: state.selectedInstitutionId };
    delete payload._originalId;
    await request(institutionApi(previousId
      ? `/shared-elective-sources/${encodeURIComponent(previousId)}`
      : "/shared-elective-sources"), {
      method: previousId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    state.sharedElectiveDraft = null;
    state.sharedElectiveResolved = null;
    state.sharedElectiveDirty = false;
    await loadState();
    renderSharedElectiveSourceEditor();
    if (state.plan) renderEditor();
    setStatus("حُفظ المصدر الاختياري المشترك.", "success");
  }

  return {
    renderSharedSetEditor,
    scheduleSharedSetResolution,
    sharedChanged,
    openSharedSetEditor,
    saveSharedSetEditor,
    renderSharedSets,
    editSharedSet,
    renderSharedElectiveSources,
    renderSharedElectiveSourceEditor,
    scheduleSharedElectiveResolution,
    sharedElectiveChanged,
    openSharedElectiveSourceEditor,
    saveSharedElectiveSourceEditor,
  };
}
