export function createPlanEditorView(options) {
  const {
    state,
    els,
    escapeHtml,
    semesterLabel,
    entryCode,
    publishedDecisionSemesters,
    proposalEntries,
    resolvedCollection,
    courseRow,
    compareCodes,
    sortPublishedCollections,
    syncProposalWithPublished,
  } = options;
  const template = () => document.getElementById("semesterTemplate");
  const icon = (name) => `<img src="/assets/icon-${name}.svg" alt="">`;

  function configureSemesterCard(card, item, index, kind) {
    card.dataset.kind = kind;
    card.dataset.groupIndex = index;
    card.dataset.location = kind === "semester" ? `semester-${index + 1}` : kind === "elective"
      ? `elective-${item.id ?? index + 1}` : kind === "shared" ? `shared-semester-${index + 1}` : `proposal-semester-${index + 1}`;
    const name = card.querySelector(".semester-name");
    const secondary = card.querySelector(".semester-year");
    const inheritedCount = kind === "semester" ? publishedDecisionSemesters().length - state.plan.semesters.length : 0;
    const level = kind === "semester" ? inheritedCount + index + 1 : index + 1;
    if (kind === "elective") {
      name.hidden = false;
      name.value = item.name ?? "";
      secondary.hidden = true;
      card.querySelector(".course-list").insertAdjacentHTML("beforebegin", `
        <div class="requirement-editor">
          <label>نوع المتطلب<select class="requirement-mode"><option value="hours" ${item.requirementText === undefined ? "selected" : ""}>عدد ساعات</option><option value="text" ${item.requirementText !== undefined ? "selected" : ""}>نص مخصص</option></select></label>
          <label class="requirement-value-label">${item.requirementText === undefined ? "الساعات المطلوبة" : "نص المتطلب"}<input class="requirement-value" ${item.requirementText === undefined ? 'type="number" min="0"' : ""} value="${escapeHtml(item.requirementText ?? item.requiredHours ?? 0)}"></label>
        </div>`);
    } else {
      name.hidden = true;
      secondary.hidden = true;
      let derivedName = semesterLabel(level);
      if (kind === "proposal") {
        const preceding = state.plan.proposal.semesters.slice(0, index + 1);
        if (item.type === "summer") {
          const summerNumber = preceding.filter((semester) => semester.type === "summer").length;
          derivedName = summerNumber === 1 ? "فصل صيفي" : `فصل صيفي ${summerNumber}`;
        } else {
          derivedName = semesterLabel(preceding.filter((semester) => semester.type !== "summer").length);
        }
      }
      card.querySelector(".semester-fields").insertAdjacentHTML("afterbegin", `<h3 class="derived-semester-name">${escapeHtml(derivedName)}</h3>`);
    }
    card.querySelector(".add-placeholder").hidden = kind !== "proposal";
    card.querySelector(".course-code-input").hidden = kind === "proposal";
    card.querySelector(".add-course").hidden = kind === "proposal";
    card.querySelectorAll(".move-up,.move-down").forEach((button) => { button.hidden = false; });
    card.querySelector(".delete-item").hidden = kind === "proposal"
      && ((item.courseOrder?.length ?? 0) > 0 || (item.placeholders?.length ?? 0) > 0);
    const resolved = resolvedCollection(kind, index);
    const entries = kind === "proposal" ? proposalEntries(index) : item.courses;
    card.querySelector(".course-list").innerHTML = entries.map((entry, courseIndex) => (
      courseRow(entry, resolved[courseIndex], kind, index, courseIndex)
    )).join("");
  }

  function renderCollection(host, items, kind) {
    host.innerHTML = "";
    items.forEach((item, index) => {
      if (kind === "elective" && item.sourceId) {
        const source = state.sharedElectiveGroups.find((value) => value.id === item.sourceId);
        const resolved = state.resolved?.electiveGroups?.find((group) => group.sourceId === item.sourceId);
        const article = document.createElement("article");
        article.className = "card inherited-semester";
        article.dataset.sharedElectiveReference = item.sourceId;
        article.dataset.groupIndex = index;
        article.innerHTML = `
          <div class="card-heading">
            <div><p class="eyebrow">مصدر مشترك موروث</p><h2>${escapeHtml(source?.name ?? item.sourceId)}</h2></div>
            <div class="menu-actions">
              <button class="icon-button move-up" type="button" aria-label="نقل إلى أعلى">${icon("chevron-up")}</button>
              <button class="icon-button move-down" type="button" aria-label="نقل إلى أسفل">${icon("chevron-down")}</button>
              <button class="button ghost open-shared-elective-source" type="button">فتح المصدر</button>
              <button class="icon-button remove-shared-elective-reference danger" type="button" aria-label="إزالة المصدر">${icon("trash")}</button>
            </div>
          </div>
          <div class="badge-list"><span class="source-badge">مشترك</span></div>
          <p class="muted" data-shared-elective-summary>المتطلب الأصلي: ${source?.requiredHours ?? "—"} ساعات · المتبقي: ${resolved?.requiredHours ?? source?.requiredHours ?? "—"} ساعات</p>
          <p class="muted" data-shared-elective-excluded>المستبعدة لوجودها في الفصول: ${escapeHtml(resolved?.excludedCourses?.map((course) => course.code).join("، ") || "لا يوجد")}</p>
          <p class="muted" data-shared-elective-candidates>المرشحات المتبقية: ${escapeHtml(resolved?.courses?.map((course) => course.code).join("، ") || source?.courses?.map(entryCode).join("، ") || "لا يوجد")}</p>`;
        host.append(article);
        return;
      }
      const fragment = template().content.cloneNode(true);
      const card = fragment.querySelector(".semester-card");
      configureSemesterCard(card, item, index, kind);
      host.append(fragment);
    });
    if (!items.length) host.innerHTML = '<div class="card muted">لا عناصر هنا بعد.</div>';
  }

  function renderInheritedSemesters() {
    const sourcePlan = state.parentPlan ?? state.plan;
    const sets = (sourcePlan.sharedSemesterSets ?? [])
      .map((id) => state.sharedSemesterSets.find((set) => set.id === id))
      .filter(Boolean);
    let level = 0;
    const sharedCards = sets.flatMap((set) => set.semesters.map((semester) => {
      level += 1;
      return `
      <article class="card inherited-semester" data-shared-set="${escapeHtml(set.id)}">
        <div class="card-heading"><div><p class="eyebrow">مستوى مشترك من ${escapeHtml(set.name)}</p><h2>${escapeHtml(semesterLabel(level))}</h2></div>
          <button class="button ghost edit-shared-set" type="button">فتح المصدر المشترك</button></div>
        <p class="muted">${[...(semester.courses ?? [])].sort(compareCodes).map(entryCode).map(escapeHtml).join("، ") || "لا مقررات في هذا المستوى."}</p>
      </article>`;
    }));
    const parentCards = (state.parentPlan?.semesters ?? []).map((semester) => {
      level += 1;
      return `
      <article class="card inherited-semester" data-parent-semester="${escapeHtml(semester.id)}">
        <div class="card-heading">
          <div><p class="eyebrow">موروث من الخطة الأساسية</p><h2>${escapeHtml(semesterLabel(level))}</h2></div>
          <button class="button ghost open-parent-plan" type="button">فتح الخطة الأساسية</button>
        </div>
        <p class="muted">${[...(semester.courses ?? [])].sort(compareCodes).map(entryCode).map(escapeHtml).join("، ") || "لا مقررات في هذا المستوى."}</p>
      </article>`;
    });
    els.inheritedSemesterList.innerHTML = [...sharedCards, ...parentCards].join("");
  }

  function renderElectives() {
    renderCollection(els.electiveList, state.plan.electiveGroups ?? [], "elective");
    if (!state.parentPlan?.electiveGroups?.length) return;
    const inheritedElectives = state.parentPlan.electiveGroups.map((group) => {
      const source = group.sourceId
        ? state.sharedElectiveGroups.find((item) => item.id === group.sourceId)
        : null;
      const name = source?.name ?? group.name ?? group.sourceId ?? "مجموعة اختيارية";
      const codes = source?.courses ?? group.courses ?? [];
      return `<article class="card inherited-semester">
        <div class="card-heading">
          <div><p class="eyebrow">موروث من الخطة الأساسية</p><h2>${escapeHtml(name)}</h2></div>
          <button class="button ghost open-parent-plan" type="button">فتح الخطة الأساسية</button>
        </div>
        <p class="muted">${codes.map(entryCode).map(escapeHtml).join("، ") || "لا مقررات في هذه المجموعة."}</p>
      </article>`;
    }).join("");
    els.electiveList.insertAdjacentHTML("afterbegin", inheritedElectives);
  }

  function renderEditorCore() {
    if (!state.plan) return;
    sortPublishedCollections();
    syncProposalWithPublished();
    els.planHeading.textContent = state.plan.track?.name
      ? `${state.plan.major} — ${state.plan.track.name}`
      : `${state.plan.major} — الخطة الأساسية`;
    const selectedMajor = state.colleges
      .find((college) => college.id === state.selectedCollegeId)
      ?.majors?.find((major) => major.id === state.selectedMajorId);
    const selectedTrack = selectedMajor?.tracks?.find((track) => track.id === state.selectedTrackId);
    const deleteTrackButton = document.getElementById("deleteTrackButton");
    if (deleteTrackButton) deleteTrackButton.hidden = !state.plan.track;
    document.querySelectorAll("[data-field]").forEach((input) => {
      input.value = state.plan[input.dataset.field] ?? "";
      const parentOwned = state.parentPlan && ["major", "id", "degree"].includes(input.dataset.field);
      input.closest("label").hidden = ["university", "college"].includes(input.dataset.field) || Boolean(parentOwned);
    });
    document.querySelector(".shared-selection").hidden = Boolean(state.parentPlan);
    renderCollection(els.semesterList, state.plan.semesters, "semester");
    renderInheritedSemesters();
    renderElectives();
    els.proposalEnabled.checked = Boolean(state.plan.proposal);
    els.proposalEditor.hidden = !state.plan.proposal;
    renderCollection(els.proposalSemesterList, state.plan.proposal?.semesters ?? [], "proposal");
  }

  return { renderCollection, renderEditorCore, renderElectives, renderInheritedSemesters };
}
