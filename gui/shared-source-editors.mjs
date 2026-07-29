import { scopeTarget } from "./plan-model.mjs";

export function createSharedSourceEditors({
  state,
  els,
  request,
  askForm,
  escapeHtml,
  setStatus,
  institutionApi,
  loadState,
  renderCollection,
  renderEditor,
  schedulePreview,
  changed,
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
      const selectedIds = state.plan?.sharedSemesterSets ?? [];
      const selected = new Set(selectedIds);
      const eligible = state.sharedSemesterSets.filter(sourceAppliesToSelection);
      const eligibleById = new Map(eligible.map((set) => [set.id, set]));
      const ordered = [
        ...selectedIds.map((id) => eligibleById.get(id)).filter(Boolean),
        ...eligible.filter((set) => !selected.has(set.id)),
      ];
      els.sharedSetChoices.innerHTML = eligible.length
        ? `<p class="muted shared-selection-help">اختر خطة مشتركة واحدة أو أكثر، ثم رتّب المحدد منها بحسب أسبقية ظهورها.</p>
          <label class="choice-item shared-set-choice ${selected.size === 0 ? "selected" : ""}">
            <span><strong>دون خطة مشتركة</strong><small>تبدأ مستويات التخصص مباشرة.</small></span>
            <input data-shared-set-choice="" type="checkbox" ${selected.size === 0 ? "checked" : ""}>
          </label>`
          + ordered.map((set) => {
            const selectedIndex = selectedIds.indexOf(set.id);
            const isSelected = selectedIndex >= 0;
            return `
          <div class="choice-item shared-set-choice ${isSelected ? "selected" : ""}" data-shared-set-choice-row="${escapeHtml(set.id)}">
            <label>
              <span><strong>${escapeHtml(set.name)}</strong><small>${set.semesters.length} مستويات · ${escapeHtml(set.phaseLabel)}</small></span>
              <input data-shared-set-choice="${escapeHtml(set.id)}" type="checkbox" ${isSelected ? "checked" : ""}>
            </label>
            ${isSelected ? `<span class="menu-actions shared-set-order-actions">
              <button class="icon-button shared-set-order-up" type="button" aria-label="تقديم ${escapeHtml(set.name)}" ${selectedIndex === 0 ? "disabled" : ""}>↑</button>
              <button class="icon-button shared-set-order-down" type="button" aria-label="تأخير ${escapeHtml(set.name)}" ${selectedIndex === selectedIds.length - 1 ? "disabled" : ""}>↓</button>
            </span>` : ""}
          </div>`;
          }).join("")
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
    els.sharedElectiveExcludePublished.checked = draft.excludePublishedCourses !== false;
    els.sharedElectiveValidation.textContent = "جارٍ التحقق من بيانات المصدر…";
    els.sharedElectiveValidation.className = "muted";
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
    const errors = result.diagnostics.items.filter((item) => item.severity === "errors");
    els.saveSharedElectiveSourceButton.disabled = errors.length > 0;
    els.sharedElectiveValidation.textContent = errors.length
      ? `لا يمكن الحفظ: ${errors.map((item) => `${item.course ?? item.code}: ${item.message}`).join(" · ")}`
      : "المصدر مكتمل وجاهز للحفظ.";
    els.sharedElectiveValidation.className = errors.length ? "status error" : "status success";
  }

  async function addSharedElectiveReference() {
    const selected = new Set((state.plan.electiveGroups ?? []).map((group) => group.sourceId).filter(Boolean));
    const eligible = state.sharedElectiveGroups
      .filter(sourceAppliesToSelection)
      .filter((source) => !selected.has(source.id));
    if (!eligible.length) {
      setStatus("لا يوجد مصدر اختياري مشترك متاح لهذا التخصص.", "error");
      return;
    }
    const values = await askForm({
      title: "إضافة مصدر اختياري مشترك",
      message: "اختر مصدرًا من المصادر المتاحة لنطاق هذا التخصص.",
      fields: [{
        name: "sourceId",
        label: "المصدر المشترك",
        value: eligible[0].id,
        options: eligible.map((source) => ({
          value: source.id,
          label: `${source.name} — ${source.requiredHours} ساعات`,
        })),
      }],
    });
    if (!values) return;
    if (!eligible.some((source) => source.id === values.sourceId)) {
      setStatus("معرّف المصدر غير متاح لهذا التخصص.", "error");
      return;
    }
    state.plan.electiveGroups.push({ sourceId: values.sourceId });
    changed(true);
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
      excludePublishedCourses: true,
      courses: [],
      fallbackCourses: {},
      scope: { type: "institution", institutionId: state.selectedInstitutionId },
    });
    state.sharedElectiveDraft._originalId = source?.id ?? null;
    state.sharedElectiveResolved = null;
    state.sharedElectiveDirty = false;
    els.saveSharedElectiveSourceButton.disabled = false;
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
    addSharedElectiveReference,
    renderSharedElectiveSources,
    renderSharedElectiveSourceEditor,
    scheduleSharedElectiveResolution,
    sharedElectiveChanged,
    openSharedElectiveSourceEditor,
    saveSharedElectiveSourceEditor,
  };
}
