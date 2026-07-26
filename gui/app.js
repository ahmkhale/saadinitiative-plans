const $ = (id) => document.getElementById(id);
const state = {
  colleges: [],
  selectedCollegeId: "",
  selectedMajorId: "",
  plan: null,
  resolved: null,
  diagnostics: null,
  pageLayouts: [],
  dirty: false,
  previewTimer: null,
  searchTimer: null,
  previewUrls: [],
  settings: null,
  sharedSemesterSets: [],
  sharedSetDraft: null,
  sharedSetResolved: null,
  sharedPreviewTimer: null,
  sharedSetDirty: false,
  sharedElectiveGroups: [],
  sharedElectiveDraft: null,
  sharedElectiveResolved: null,
  sharedElectiveDirty: false,
};

const els = {
  welcome: $("welcome"),
  editorContent: $("editorContent"),
  collegeList: $("collegeList"),
  majorList: $("majorList"),
  catalogCount: $("catalogCount"),
  catalogPath: $("catalogPath"),
  catalogModified: $("catalogModified"),
  catalogConflicts: $("catalogConflicts"),
  unresolvedCount: $("unresolvedCount"),
  saveState: $("saveState"),
  globalStatus: $("globalStatus"),
  planHeading: $("planHeading"),
  semesterList: $("semesterList"),
  inheritedSemesterList: $("inheritedSemesterList"),
  electiveList: $("electiveList"),
  proposalSemesterList: $("proposalSemesterList"),
  proposalEnabled: $("proposalEnabled"),
  proposalEditor: $("proposalEditor"),
  guideEnabled: $("guideEnabled"),
  previewHost: $("previewHost"),
  previewDimensions: $("previewDimensions"),
  diagnosticList: $("diagnosticList"),
  diagnosticCount: $("diagnosticCount"),
  courseSuggestions: $("courseSuggestions"),
  zoom: $("zoom"),
  formDialog: $("formDialog"),
  dialogForm: $("dialogForm"),
  dialogTitle: $("dialogTitle"),
  dialogMessage: $("dialogMessage"),
  dialogFields: $("dialogFields"),
  dialogSubmit: $("dialogSubmit"),
  generateButton: $("generateButton"),
  generateDraftButton: $("generateDraftButton"),
  sharedSetChoices: $("sharedSetChoices"),
  sharedSetList: $("sharedSetList"),
  sharedSetEditor: $("sharedSetEditor"),
  sharedSetEditorTitle: $("sharedSetEditorTitle"),
  sharedSetName: $("sharedSetName"),
  sharedSetId: $("sharedSetId"),
  sharedSetPhase: $("sharedSetPhase"),
  sharedSemesterList: $("sharedSemesterList"),
  sharedElectiveSourceList: $("sharedElectiveSourceList"),
  sharedElectiveSourceEditor: $("sharedElectiveSourceEditor"),
  sharedElectiveSourceEditorTitle: $("sharedElectiveSourceEditorTitle"),
  sharedElectiveSourceName: $("sharedElectiveSourceName"),
  sharedElectiveSourceId: $("sharedElectiveSourceId"),
  sharedElectiveSourceHours: $("sharedElectiveSourceHours"),
  sharedElectiveCourseList: $("sharedElectiveCourseList"),
};
let dialogResolver = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json", ...(options.headers ?? {}) } : options.headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `تعذر إتمام الطلب (${response.status}).`);
  return body;
}

function askForm({ title, message = "", submit = "حفظ", danger = false, fields = [] }) {
  els.dialogTitle.textContent = title;
  $("dialogMessage").textContent = message;
  els.dialogSubmit.textContent = submit;
  els.dialogSubmit.className = `button ${danger ? "danger-ghost" : "primary"}`;
  els.dialogFields.innerHTML = fields.map((field) => `
    <label>${escapeHtml(field.label)}
      <input name="${escapeHtml(field.name)}" value="${escapeHtml(field.value ?? "")}" ${field.type ? `type="${escapeHtml(field.type)}"` : ""} ${field.required === false ? "" : "required"} ${field.min !== undefined ? `min="${field.min}"` : ""} ${field.dir ? `dir="${field.dir}"` : ""}>
    </label>
  `).join("");
  els.dialogFields.hidden = fields.length === 0;
  els.formDialog.showModal();
  els.dialogFields.querySelector("input")?.focus();
  return new Promise((resolve) => {
    dialogResolver = resolve;
  });
}

function setStatus(message = "", type = "") {
  els.globalStatus.textContent = message;
  els.globalStatus.className = `status ${type}`.trim();
}

function setDirty(dirty = true) {
  state.dirty = dirty;
  els.saveState.textContent = dirty ? "تغييرات غير محفوظة" : "محفوظ";
  els.saveState.style.color = dirty ? "var(--warning)" : "var(--success)";
}

function activeCollege() {
  return state.colleges.find((college) => college.id === state.selectedCollegeId) ?? null;
}

function renderNavigation() {
  if (!state.colleges.length) {
    els.collegeList.className = "nav-list empty-list";
    els.collegeList.textContent = "لم تُضف كلية بعد.";
  } else {
    els.collegeList.className = "nav-list";
    els.collegeList.innerHTML = state.colleges.map((college) => `
      <button class="nav-item ${college.id === state.selectedCollegeId ? "active" : ""}" data-college="${escapeHtml(college.id)}" type="button">
        ${escapeHtml(college.name)}<small>${escapeHtml(college.id)} · ${college.majors.length} تخصص</small>
      </button>
    `).join("");
  }
  const college = activeCollege();
  if (!college) {
    els.majorList.className = "nav-list empty-list";
    els.majorList.textContent = "اختر كلية أولًا.";
  } else if (!college.majors.length) {
    els.majorList.className = "nav-list empty-list";
    els.majorList.textContent = "لم يُضف تخصص بعد.";
  } else {
    els.majorList.className = "nav-list";
    els.majorList.innerHTML = college.majors.map((major) => `
      <button class="nav-item ${major.id === state.selectedMajorId ? "active" : ""}" data-major="${escapeHtml(major.id)}" type="button">
        ${escapeHtml(major.major)}<small>${major.semesterCount} فصول${major.hasProposal ? " · له خطة مقترحة" : ""}</small>
      </button>
    `).join("");
  }
}

async function loadState() {
  const result = await request("/api/state");
  state.colleges = result.colleges;
  state.settings = result.settings;
  state.sharedSemesterSets = result.sharedSemesterSets ?? [];
  state.sharedElectiveGroups = result.sharedElectiveGroups ?? [];
  $("globalEdition").value = state.settings.edition;
  $("globalRelease").value = state.settings.release;
  const source = result.catalog.sources?.[0];
  els.catalogCount.textContent = result.catalog.resolvedCourseCount.toLocaleString("ar-SA");
  els.catalogConflicts.textContent = result.catalog.conflictCount.toLocaleString("ar-SA");
  els.catalogPath.textContent = source?.path ?? "لم يُحمّل دليل المقررات.";
  els.catalogModified.textContent = source?.modifiedAt
    ? `آخر تعديل: ${new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(source.modifiedAt))}`
    : "وقت التعديل غير متاح.";
  if (state.selectedCollegeId && !state.colleges.some((college) => college.id === state.selectedCollegeId)) {
    state.selectedCollegeId = "";
    state.selectedMajorId = "";
  }
  renderNavigation();
  renderSharedSets();
  renderSharedSetEditor();
}

async function selectCollege(id) {
  if (state.dirty && !await confirmDiscard()) return;
  state.selectedCollegeId = id;
  state.selectedMajorId = "";
  state.plan = null;
  showEditor(false);
  renderNavigation();
}

async function selectMajor(id) {
  if (state.dirty && !await confirmDiscard()) return;
  const result = await request(`/api/colleges/${encodeURIComponent(state.selectedCollegeId)}/majors/${encodeURIComponent(id)}`);
  state.selectedMajorId = id;
  state.plan = result.plan;
  state.resolved = null;
  setDirty(false);
  showEditor(true);
  renderNavigation();
  renderEditor();
  schedulePreview(0);
}

function showEditor(show) {
  els.welcome.hidden = show;
  els.editorContent.hidden = !show;
}

function normalizedEntry(entry) {
  return typeof entry === "string" ? { code: entry } : structuredClone(entry);
}

function entryCode(entry) {
  return typeof entry === "string" ? entry : entry?.code ?? "";
}

function parseCodes(value) {
  const text = String(value ?? "").trim();
  if (!text) return [];
  if (/[\n,،;]/u.test(text)) return text.split(/[\n,،;]+/u).map((item) => item.trim()).filter(Boolean);
  const matches = [...text.matchAll(/\d+[A-Za-z]?\s+[\p{L}]+/gu)].map((match) => match[0].trim());
  return matches.length > 1 && matches.join(" ") === text.replace(/\s+/gu, " ") ? matches : [text];
}

function collection(kind, index) {
  if (kind === "semester") return state.plan.semesters[index].courses;
  if (kind === "elective") return state.plan.electiveGroups[index].courses;
  if (kind === "shared") return state.sharedSetDraft.semesters[index].courses;
  if (kind === "sharedElective") return state.sharedElectiveDraft.courses;
  if (kind === "proposal") return proposalEntries(index);
  throw new Error("Unknown course collection.");
}

function proposalEntries(index) {
  const semester = state.plan.proposal?.semesters?.[index] ?? { placeholders: [] };
  const parentEntries = new Map(publishedDecisionSemesters().flatMap((item) => (
    item.courses.map((entry) => [entryCode(entry), normalizedEntry(entry)])
  )));
  return [
    ...(semester.courseOrder ?? []).map((code) => ({
      ...(parentEntries.get(code) ?? { code }),
      proposalRealCourse: true,
    })),
    ...(semester.placeholders ?? []).map((placeholder) => ({
      kind: "placeholder",
      code: "مقرر",
      fallback: placeholder,
      placeholderId: placeholder.id,
    })),
  ];
}

const courseCollator = new Intl.Collator("ar", { sensitivity: "base", numeric: true });
const semesterOrdinals = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون"];
function semesterLabel(level) {
  return `المستوى ${semesterOrdinals[level - 1] ?? "غير المدعوم"}`;
}

function compareCodes(left, right) {
  const a = entryCode(left);
  const b = entryCode(right);
  const an = Number.parseInt(a, 10);
  const bn = Number.parseInt(b, 10);
  if (an !== bn) return an - bn;
  return courseCollator.compare(a, b);
}

function sortPublishedCollections() {
  state.plan.semesters.forEach((semester) => semester.courses.sort(compareCodes));
  (state.plan.electiveGroups ?? []).forEach((group) => group.courses?.sort(compareCodes));
  state.sharedSetDraft?.semesters?.forEach((semester) => semester.courses.sort(compareCodes));
}

function publishedDecisionSemesters() {
  const inherited = (state.plan.sharedSemesterSets ?? []).flatMap((id) => {
    const set = state.sharedSemesterSets.find((item) => item.id === id);
    return (set?.semesters ?? []).map((semester, index) => ({
      ...semester,
      id: `shared-${id}-${semester.id ?? `level-${index + 1}`}`,
    }));
  });
  return [...inherited, ...state.plan.semesters].map((semester, index) => ({
    ...semester,
    id: semester.id ?? `published-level-${index + 1}`,
    number: index + 1,
    name: semesterLabel(index + 1),
    courses: [...(semester.courses ?? [])].sort(compareCodes),
  }));
}

function syncProposalWithPublished() {
  if (!state.plan?.proposal) return;
  const published = publishedDecisionSemesters();
  const parent = new Map(published.flatMap((semester) => (
    semester.courses.map((entry) => [entryCode(entry), semester.id])
  )));
  const semesters = (state.plan.proposal.semesters ?? []).map((semester, index) => ({
    id: semester.id ?? `proposal-semester-${index + 1}`,
    sourceSemesterId: semester.sourceSemesterId ?? null,
    type: semester.type === "summer" ? "summer" : "regular",
    courseOrder: semester.courseOrder ?? [],
    placeholders: semester.placeholders ?? [],
  }));
  published.forEach((semester) => {
    if (!semesters.some((item) => item.sourceSemesterId === semester.id)) {
      semesters.push({ id: semester.id, sourceSemesterId: semester.id, type: "regular", courseOrder: [], placeholders: [] });
    }
  });
  const placed = new Set();
  semesters.forEach((semester) => {
    semester.courseOrder = semester.courseOrder.filter((code) => parent.has(code) && !placed.has(code) && placed.add(code));
  });
  for (let index = semesters.length - 1; index >= 0; index -= 1) {
    const semester = semesters[index];
    if (!semester.sourceSemesterId || published.some((item) => item.id === semester.sourceSemesterId)) continue;
    if (semester.placeholders.length) continue;
    if (semester.courseOrder.length) semester.sourceSemesterId = null;
    else semesters.splice(index, 1);
  }
  for (const [code, semesterId] of parent) {
    if (placed.has(code)) continue;
    const target = semesters.find((semester) => semester.sourceSemesterId === semesterId) ?? semesters[0];
    target?.courseOrder.push(code);
    placed.add(code);
  }
  state.plan.proposal.semesters = semesters;
  delete state.plan.proposal.phases;
  delete state.plan.proposal.expectedCredits;
}

function resolvedCollection(kind, index) {
  if (kind === "shared") return state.sharedSetResolved?.semesters?.[index]?.courses ?? [];
  if (kind === "sharedElective") return state.sharedElectiveResolved?.electiveGroups?.[0]?.courses ?? [];
  if (!state.resolved) return [];
  if (kind === "semester") {
    const inheritedCount = publishedDecisionSemesters().length - state.plan.semesters.length;
    return state.resolved.semesters?.[inheritedCount + index]?.courses ?? [];
  }
  if (kind === "elective") return state.resolved.electiveGroups?.[index]?.courses ?? [];
  if (kind === "proposal") return state.resolved.proposal?.semesters?.[index]?.courses ?? [];
  return [];
}

function fallbackCoursesFor(kind) {
  if (kind === "shared") {
    state.sharedSetDraft.fallbackCourses ??= {};
    return state.sharedSetDraft.fallbackCourses;
  }
  if (kind === "sharedElective") {
    state.sharedElectiveDraft.fallbackCourses ??= {};
    return state.sharedElectiveDraft.fallbackCourses;
  }
  state.plan.fallbackCourses ??= {};
  return state.plan.fallbackCourses;
}

function badgeClass(label, source) {
  if (source === "male") return "male";
  if (source === "female") return "female";
  if (source === "manual") return "manual";
  if (label === "بيانات متعارضة") return "conflict";
  if (label === "بيانات ناقصة" || label === "غير موجود في الدليل") return "missing";
  return "";
}

function courseBadges(resolved, isPlaceholder = false) {
  if (isPlaceholder) return '<span class="source-badge manual">مقرر نائب</span>';
  const sourceLabel = resolved?.sourceBadge ?? "غير موجود في الدليل";
  const quality = resolved?.qualityBadges ?? [];
  return [sourceLabel, ...quality]
    .map((label, index) => `<span class="source-badge ${badgeClass(label, index === 0 ? resolved?.catalogSource : null)}">${escapeHtml(label)}</span>`)
    .join("");
}

function courseRow(entry, resolved, kind, groupIndex, courseIndex) {
  const code = entryCode(entry);
  const rules = typeof entry === "object" ? entry : {};
  const unresolved = !resolved || resolved.source === "unresolved";
  const isPlaceholder = entry?.kind === "placeholder" || Boolean(entry?.placeholderId);
  const displayCode = isPlaceholder ? "مقرر" : resolved?.code ?? code;
  const displaySubject = isPlaceholder ? "" : resolved?.subject ?? "";
  const location = kind === "semester" ? `semester-${groupIndex + 1}` : kind === "elective"
    ? `elective-${state.plan.electiveGroups[groupIndex]?.id ?? groupIndex + 1}` : kind === "shared"
      ? `shared-semester-${groupIndex + 1}` : kind === "sharedElective"
        ? "shared-elective-source" : `proposal-semester-${groupIndex + 1}`;
  return `
    <div class="course-row ${unresolved ? "unresolved" : ""}" data-kind="${kind}" data-group-index="${groupIndex}" data-course-index="${courseIndex}" data-course-code="${escapeHtml(code)}" data-placeholder-id="${escapeHtml(entry?.placeholderId ?? "")}" data-location="${escapeHtml(location)}" ${kind === "proposal" && !isPlaceholder ? 'draggable="true"' : ""}>
      <div><div class="course-code">${escapeHtml(displayCode)}</div><div class="course-meta">${escapeHtml(displaySubject)}</div><div class="badge-list">${courseBadges(resolved, isPlaceholder)}</div></div>
      <div><div class="course-name">${escapeHtml(resolved?.name ?? (entry?.kind === "placeholder" ? entry?.fallback?.name : "مقرر غير موجود في الدليل"))}</div>
        <div class="course-meta">${resolved ? `${resolved.academicHours ?? "—"} ساعات · محاضرة ${resolved.lectureHours ?? "—"} · عملي ${resolved.practicalHours ?? "—"} · تمارين ${resolved.exerciseHours ?? "—"}` : ""}</div>
      </div>
      <div class="course-meta">${resolved?.prerequisites?.length ? `سابق: ${escapeHtml(resolved.prerequisites.join("، "))}` : "لا متطلب سابق"}</div>
      <div class="course-actions">
        ${kind === "proposal" && !isPlaceholder ? `
          <button class="icon-button proposal-course-up" type="button" aria-label="نقل المقرر إلى أعلى">↑</button>
          <button class="icon-button proposal-course-down" type="button" aria-label="نقل المقرر إلى أسفل">↓</button>
          <button class="button ghost proposal-course-previous" type="button">الفصل السابق</button>
          <button class="button ghost proposal-course-next" type="button">الفصل التالي</button>
          <button class="button ghost proposal-course-home" type="button">إعادة إلى المستوى المنشور</button>` : ""}
        ${kind === "proposal" && isPlaceholder ? '<button class="icon-button edit-placeholder" type="button" aria-label="تعديل المقرر النائب">✎</button>' : ""}
        ${kind !== "proposal" || isPlaceholder ? '<button class="icon-button course-delete danger" type="button" aria-label="حذف">×</button>' : ""}
      </div>
      <details class="course-details" ${kind === "proposal" ? "hidden" : unresolved && !isPlaceholder ? "open" : ""}>
        <summary>${unresolved ? "أكمل بيانات المقرر" : "تفاصيل المقرر وقواعد الخطة"}</summary>
        ${!isPlaceholder ? `<p class="concept-heading">بيانات المقرر</p>
        <div class="facts-grid">
          <label class="wide">اسم المقرر<input data-manual-fact="name" value="${escapeHtml(fallbackCoursesFor(kind)?.[code]?.name ?? "")}" ${unresolved ? "required" : ""}></label>
          <label>الساعات الأكاديمية<input data-manual-fact="academicHours" type="number" min="0" value="${escapeHtml(fallbackCoursesFor(kind)?.[code]?.academicHours ?? "")}" ${unresolved ? "required" : ""}></label>
          <label>ساعات المحاضرة<input data-manual-fact="lectureHours" type="number" min="0" value="${escapeHtml(fallbackCoursesFor(kind)?.[code]?.lectureHours ?? "")}" ${unresolved ? "required" : ""}></label>
          <label>ساعات التمارين<input data-manual-fact="exerciseHours" type="number" min="0" value="${escapeHtml(fallbackCoursesFor(kind)?.[code]?.exerciseHours ?? "")}" ${unresolved ? "required" : ""}></label>
          <label>ساعات العملي<input data-manual-fact="practicalHours" type="number" min="0" value="${escapeHtml(fallbackCoursesFor(kind)?.[code]?.practicalHours ?? "")}" ${unresolved ? "required" : ""}></label>
          ${["male", "female"].includes(resolved?.catalogSource) && fallbackCoursesFor(kind)?.[code] ? '<button class="button ghost refresh-catalog-facts" type="button">تحديث البيانات من الدليل</button>' : ""}
          ${fallbackCoursesFor(kind)?.[code]?._provenance ? `<span class="source-badge">${Object.values(fallbackCoursesFor(kind)[code]._provenance).includes("manual") ? "بيانات معدلة يدويًا" : "لقطة من الدليل"}</span>` : ""}
        </div>
        <p class="concept-heading">قواعد الخطة</p>` : ""}
        <div class="dependency-grid">
          ${!isPlaceholder ? `<label>المتطلبات السابقة<input data-dependency="prerequisites" value="${escapeHtml((rules.prerequisites ?? rules.override?.prerequisites ?? []).join("، "))}" placeholder="101 عال، 101 ريض"></label>
          <label>المتطلبات المرافقة<input data-dependency="corequisites" value="${escapeHtml((rules.corequisites ?? rules.override?.corequisites ?? []).join("، "))}"></label>
          <label>الحد الأدنى للساعات المجتازة<input data-dependency="minimumCompletedCredits" type="number" min="0" value="${escapeHtml(rules.minimumCompletedCredits ?? rules.override?.minimumCompletedCredits ?? "")}"></label>
          <label class="check"><input data-track-specific type="checkbox" ${rules.trackSpecific ? "checked" : ""}> مقرر خاص بالمسار</label>` : ""}
        </div>
      </details>
    </div>
  `;
}

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
    card.querySelector(".card-heading").insertAdjacentHTML("afterend", `
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
        derivedName = summerNumber === 1 ? "الفصل الصيفي" : `الفصل الصيفي ${summerNumber}`;
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
            <button class="icon-button move-up" type="button" aria-label="نقل إلى أعلى">↑</button>
            <button class="icon-button move-down" type="button" aria-label="نقل إلى أسفل">↓</button>
            <button class="button ghost open-shared-elective-source" type="button">فتح المصدر</button>
            <button class="icon-button remove-shared-elective-reference danger" type="button" aria-label="إزالة المصدر">×</button>
          </div>
        </div>
        <div class="badge-list"><span class="source-badge">مشترك</span></div>
        <p class="muted">المتطلب الأصلي: ${source?.requiredHours ?? "—"} ساعات · المتبقي: ${resolved?.requiredHours ?? source?.requiredHours ?? "—"} ساعات</p>
        <p class="muted">المستبعدة لوجودها في الفصول: ${escapeHtml(resolved?.excludedCourses?.map((course) => course.code).join("، ") || "لا يوجد")}</p>
        <p class="muted">المرشحات المتبقية: ${escapeHtml(resolved?.courses?.map((course) => course.code).join("، ") || source?.courses?.map(entryCode).join("، ") || "لا يوجد")}</p>`;
      host.append(article);
      return;
    }
    const fragment = $("semesterTemplate").content.cloneNode(true);
    const card = fragment.querySelector(".semester-card");
    configureSemesterCard(card, item, index, kind);
    host.append(fragment);
  });
  if (!items.length) host.innerHTML = '<div class="card muted">لا عناصر هنا بعد.</div>';
}

function renderEditor() {
  if (!state.plan) return;
  sortPublishedCollections();
  syncProposalWithPublished();
  els.planHeading.textContent = state.plan.major;
  document.querySelectorAll("[data-field]").forEach((input) => {
    input.value = state.plan[input.dataset.field] ?? "";
  });
  renderCollection(els.semesterList, state.plan.semesters, "semester");
  renderInheritedSemesters();
  renderCollection(els.electiveList, state.plan.electiveGroups ?? [], "elective");
  els.proposalEnabled.checked = Boolean(state.plan.proposal);
  els.proposalEditor.hidden = !state.plan.proposal;
  els.guideEnabled.checked = state.plan.proposal?.showGuide !== false;
  renderCollection(els.proposalSemesterList, state.plan.proposal?.semesters ?? [], "proposal");
  renderSharedSets();
  renderSharedElectiveSources();
}

function renderInheritedSemesters() {
  const selected = new Set(state.plan.sharedSemesterSets ?? []);
  const sets = state.sharedSemesterSets.filter((set) => selected.has(set.id));
  let level = 0;
  els.inheritedSemesterList.innerHTML = sets.flatMap((set) => set.semesters.map((semester) => {
    level += 1;
    return `
    <article class="card inherited-semester" data-shared-set="${escapeHtml(set.id)}">
      <div class="card-heading"><div><p class="eyebrow">مستوى مشترك من ${escapeHtml(set.name)}</p><h2>${escapeHtml(semesterLabel(level))}</h2></div>
        <button class="button ghost edit-shared-set" type="button">فتح المصدر المشترك</button></div>
      <p class="muted">${[...(semester.courses ?? [])].sort(compareCodes).map(entryCode).map(escapeHtml).join("، ") || "لا مقررات في هذا المستوى."}</p>
    </article>`;
  })).join("");
}

function renderSharedSetEditor() {
  const draft = state.sharedSetDraft;
  els.sharedSetEditor.hidden = !draft;
  if (!draft) return;
  els.sharedSetEditorTitle.textContent = draft.name || "خطة مشتركة جديدة";
  els.sharedSetName.value = draft.name ?? "";
  els.sharedSetId.value = draft.id ?? "";
  els.sharedSetPhase.value = draft.phaseLabel ?? "السنة التحضيرية";
  renderCollection(els.sharedSemesterList, draft.semesters ?? [], "shared");
}

function scheduleSharedSetResolution(delay = 250) {
  clearTimeout(state.sharedPreviewTimer);
  state.sharedPreviewTimer = setTimeout(() => refreshSharedSetResolution().catch((error) => setStatus(error.message, "error")), delay);
}

async function refreshSharedSetResolution() {
  if (!state.sharedSetDraft) return;
  const result = await request("/api/preview", {
    method: "POST",
    body: JSON.stringify({
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
    semesters: [{ courses: [] }, { courses: [] }],
    fallbackCourses: {},
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
  const previousId = draft._originalId;
  const payload = structuredClone(draft);
  delete payload._originalId;
  await request(previousId ? `/api/shared-semester-sets/${encodeURIComponent(previousId)}` : "/api/shared-semester-sets", {
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
    els.sharedSetChoices.innerHTML = state.sharedSemesterSets.length
      ? `<label class="choice-item"><span><strong>دون خطة مشتركة</strong><small>تبدأ مستويات التخصص مباشرة.</small></span><input data-shared-set-choice="" name="shared-foundation-choice" type="radio" ${selected.size === 0 ? "checked" : ""}></label>`
        + state.sharedSemesterSets.map((set) => `
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


function addCodes(kind, index, value) {
  const target = collection(kind, index);
  const existing = new Set(target.map((entry) => entryCode(entry).replace(/\s+/gu, " ").trim().toLocaleLowerCase("ar")));
  for (const code of parseCodes(value)) {
    const key = code.replace(/\s+/gu, " ").trim().toLocaleLowerCase("ar");
    if (!existing.has(key)) {
      target.push(code);
      existing.add(key);
    }
  }
  if (kind === "shared") sharedChanged(true);
  else if (kind === "sharedElective") sharedElectiveChanged(true);
  else changed(true);
}

function changed(render = false) {
  syncProposalWithPublished();
  setDirty(true);
  if (render) renderEditor();
  schedulePreview();
}

function schedulePreview(delay = 350) {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(() => refreshPreview().catch((error) => setStatus(error.message, "error")), delay);
}

function releasePreviewUrls() {
  state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
  state.previewUrls = [];
}

async function refreshPreview() {
  if (!state.plan) return;
  const result = await request("/api/preview", {
    method: "POST",
    body: JSON.stringify({ plan: state.plan }),
  });
  state.resolved = result.plan;
  state.diagnostics = result.diagnostics;
  state.pageLayouts = result.pageLayouts;
  const hasBlockingErrors = result.diagnostics.summary.errors > 0;
  els.generateButton.disabled = hasBlockingErrors;
  els.generateDraftButton.disabled = hasBlockingErrors;
  const exportReason = hasBlockingErrors ? "عالج الأخطاء قبل إنشاء ملف PDF." : "";
  els.generateButton.title = exportReason;
  els.generateDraftButton.title = exportReason;
  renderDiagnostics();
  els.unresolvedCount.textContent = String(result.diagnostics.items.filter((item) => item.code === "UNRESOLVED_COURSE").length);
  releasePreviewUrls();
  els.previewHost.innerHTML = "";
  if (!result.pages.length) {
    els.previewHost.innerHTML = '<p>تعذر إنشاء المعاينة. راجع الأخطاء أدناه.</p>';
    els.previewDimensions.textContent = "—";
  } else {
    result.pages.forEach((svg, index) => {
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      state.previewUrls.push(url);
      const image = document.createElement("img");
      image.className = "preview-page";
      image.src = url;
      image.alt = `معاينة الصفحة ${index + 1}`;
      els.previewHost.append(image);
    });
    els.previewDimensions.textContent = result.pageLayouts
      .map((page, index) => `${index + 1}: ${page.width} × ${Number(page.height.toFixed(3))} pt`)
      .join(" · ");
  }
  refreshResolvedRows();
}

function renderDiagnostics() {
  const items = state.diagnostics?.items ?? [];
  els.diagnosticCount.textContent = String(items.length);
  if (!items.length) {
    els.diagnosticList.innerHTML = '<p class="muted">لا تنبيهات.</p>';
    return;
  }
  els.diagnosticList.innerHTML = items.map((item) => `
    <button class="diagnostic ${item.severity === "errors" ? "error" : item.severity === "warnings" ? "warning" : "info"}" type="button" data-focus="${escapeHtml(item.location ?? (item.semester ? `semester-${item.semester}` : ""))}">
      <strong>${escapeHtml(item.code)}</strong><br>${escapeHtml(item.message)}
    </button>
  `).join("");
}

function refreshResolvedRows() {
  document.querySelectorAll(".course-row").forEach((row) => {
    const groupIndex = Number(row.dataset.groupIndex);
    const courseIndex = Number(row.dataset.courseIndex);
    const resolved = resolvedCollection(row.dataset.kind, groupIndex)[courseIndex];
    const unresolved = !resolved || resolved.source === "unresolved";
    const placeholder = row.dataset.placeholderId !== "";
    row.classList.toggle("unresolved", unresolved);
    row.querySelector(".course-code").textContent = placeholder ? "مقرر" : resolved?.code
      ?? entryCode(collection(row.dataset.kind, groupIndex)[courseIndex]);
    row.querySelector(".course-name").textContent = resolved?.name ?? "مقرر غير موجود في الدليل";
    const badges = row.querySelector(".badge-list");
    if (badges) badges.innerHTML = courseBadges(resolved, placeholder);
    const metadata = row.querySelectorAll(".course-meta");
    if (metadata[0]) metadata[0].textContent = placeholder ? "" : resolved?.subject ?? "";
    if (metadata[1]) metadata[1].textContent = resolved
      ? `${resolved.academicHours ?? "—"} ساعات · محاضرة ${resolved.lectureHours ?? "—"} · عملي ${resolved.practicalHours ?? "—"} · تمارين ${resolved.exerciseHours ?? "—"}`
      : "";
    if (metadata[2]) metadata[2].textContent = resolved?.prerequisites?.length
      ? `سابق: ${resolved.prerequisites.join("، ")}`
      : "لا متطلب سابق";
  });
}

async function savePlan() {
  if (!state.plan) return;
  const oldId = state.selectedMajorId;
  const result = await request(`/api/colleges/${encodeURIComponent(state.selectedCollegeId)}/majors/${encodeURIComponent(oldId)}`, {
    method: "PUT",
    body: JSON.stringify(state.plan),
  });
  state.plan = result.plan;
  state.selectedMajorId = result.plan.id;
  setDirty(false);
  await loadState();
  renderEditor();
  setStatus("حُفظت الخطة.", "success");
}

async function generatePlan(save = true) {
  if (!state.plan) return;
  setStatus("جارٍ إنشاء الملف…");
  const result = await request("/api/generate", {
    method: "POST",
    body: JSON.stringify({
      plan: state.plan,
      collegeId: state.selectedCollegeId,
      majorId: state.selectedMajorId,
      save,
      keepSvg: $("keepSvg").checked,
      png: $("exportPng").checked,
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
  els.globalStatus.replaceChildren(document.createTextNode(save ? "حُفظت الخطة واكتمل الإنشاء. " : "اكتمل الإنشاء دون حفظ الخطة. "), link);
}

async function confirmDiscard() {
  return Boolean(await askForm({
    title: "تغييرات غير محفوظة",
    message: "ستُفقد التغييرات التي لم تحفظها إذا انتقلت الآن.",
    submit: "ترك التغييرات",
    danger: true,
  }));
}

async function addCollege() {
  const values = await askForm({
    title: "إضافة كلية",
    message: "سيُستخدم المعرّف في مسار ملفات الخطط.",
    fields: [
      { name: "name", label: "اسم الكلية" },
      { name: "id", label: "المعرّف الثابت", dir: "ltr" },
    ],
  });
  if (!values) return;
  const result = await request("/api/colleges", { method: "POST", body: JSON.stringify(values) });
  state.selectedCollegeId = result.college.id;
  await loadState();
}

async function editCollege() {
  const college = activeCollege();
  if (!college) return setStatus("اختر كلية أولًا.", "error");
  const values = await askForm({
    title: "تعديل الكلية",
    fields: [
      { name: "name", label: "اسم الكلية", value: college.name },
      { name: "id", label: "المعرّف الثابت", value: college.id, dir: "ltr" },
    ],
  });
  if (!values) return;
  const result = await request(`/api/colleges/${encodeURIComponent(college.id)}`, {
    method: "PUT",
    body: JSON.stringify(values),
  });
  state.selectedCollegeId = result.college.id;
  await loadState();
  setStatus("حُدّثت بيانات الكلية.", "success");
}

async function deleteCollege() {
  const college = activeCollege();
  if (!college) return setStatus("اختر كلية أولًا.", "error");
  const confirmed = await askForm({
    title: "حذف الكلية",
    message: `ستُحذف كلية «${college.name}» وجميع تخصصاتها وخططها. لا يمكن التراجع عن ذلك.`,
    submit: "حذف الكلية",
    danger: true,
  });
  if (!confirmed) return;
  await request(`/api/colleges/${encodeURIComponent(college.id)}`, { method: "DELETE" });
  state.selectedCollegeId = "";
  state.selectedMajorId = "";
  state.plan = null;
  setDirty(false);
  showEditor(false);
  await loadState();
}

async function addMajor() {
  if (!state.selectedCollegeId) return setStatus("اختر كلية أولًا.", "error");
  const values = await askForm({
    title: "إضافة تخصص",
    message: "سينشئ المولّد ملف خطة صالحًا بفصل أول فارغ.",
    fields: [
      { name: "major", label: "اسم التخصص" },
      { name: "id", label: "المعرّف الثابت", dir: "ltr" },
    ],
  });
  if (!values) return;
  const result = await request(`/api/colleges/${encodeURIComponent(state.selectedCollegeId)}/majors`, {
    method: "POST",
    body: JSON.stringify(values),
  });
  await loadState();
  await selectMajor(result.plan.id);
}

async function duplicateMajor() {
  if (!state.plan) return;
  const values = await askForm({
    title: "نسخ التخصص",
    fields: [
      { name: "major", label: "اسم النسخة", value: `${state.plan.major} - نسخة` },
      { name: "id", label: "معرّف النسخة", dir: "ltr" },
    ],
  });
  if (!values) return;
  const result = await request(`/api/colleges/${encodeURIComponent(state.selectedCollegeId)}/majors/${encodeURIComponent(state.selectedMajorId)}/duplicate`, {
    method: "POST",
    body: JSON.stringify(values),
  });
  await loadState();
  await selectMajor(result.plan.id);
}

async function deleteMajor() {
  if (!state.plan) return;
  const confirmed = await askForm({
    title: "حذف التخصص",
    message: `سيُحذف تخصص «${state.plan.major}» وملف خطته. لا يمكن التراجع عن ذلك.`,
    submit: "حذف التخصص",
    danger: true,
  });
  if (!confirmed) return;
  await request(`/api/colleges/${encodeURIComponent(state.selectedCollegeId)}/majors/${encodeURIComponent(state.selectedMajorId)}`, { method: "DELETE" });
  state.selectedMajorId = "";
  state.plan = null;
  setDirty(false);
  showEditor(false);
  await loadState();
}

function move(array, index, direction) {
  const next = index + direction;
  if (next < 0 || next >= array.length) return;
  [array[index], array[next]] = [array[next], array[index]];
}

async function addPlaceholder(card) {
  const values = await askForm({
    title: "إضافة مقرر نائب",
    message: "سيظهر بعد جميع مقررات المستوى، ورمزه في البطاقة «مقرر».",
    fields: [
      { name: "name", label: "وصف المقرر", value: "من متطلبات المسار" },
      { name: "academicHours", label: "الساعات الأكاديمية", type: "number", min: 0, value: 3 },
      { name: "lectureHours", label: "ساعات المحاضرة", type: "number", min: 0, value: 0 },
      { name: "exerciseHours", label: "ساعات التمارين", type: "number", min: 0, value: 0 },
      { name: "practicalHours", label: "ساعات العملي", type: "number", min: 0, value: 0 },
    ],
  });
  if (!values) return;
  const semester = state.plan.proposal.semesters[Number(card.dataset.groupIndex)];
  semester.placeholders ??= [];
  semester.placeholders.push({
    id: `placeholder-${Date.now().toString(36)}`,
    name: values.name,
    academicHours: Number(values.academicHours),
    lectureHours: Number(values.lectureHours),
    exerciseHours: Number(values.exerciseHours),
    practicalHours: Number(values.practicalHours),
    color: "#000000",
  });
  changed(true);
}

async function editPlaceholder(row) {
  const semester = state.plan.proposal.semesters[Number(row.dataset.groupIndex)];
  const placeholder = semester.placeholders.find((item) => item.id === row.dataset.placeholderId);
  if (!placeholder) throw new Error("لم يُعثر على المقرر النائب.");
  const values = await askForm({
    title: "تعديل المقرر النائب",
    message: "سيبقى رمز البطاقة «مقرر»، وسيظهر المقرر بعد جميع المقررات الأصلية.",
    fields: [
      { name: "name", label: "وصف المقرر", value: placeholder.name },
      { name: "academicHours", label: "الساعات الأكاديمية", type: "number", min: 0, value: placeholder.academicHours ?? 0 },
      { name: "lectureHours", label: "ساعات المحاضرة", type: "number", min: 0, value: placeholder.lectureHours ?? 0 },
      { name: "exerciseHours", label: "ساعات التمارين", type: "number", min: 0, value: placeholder.exerciseHours ?? 0 },
      { name: "practicalHours", label: "ساعات العملي", type: "number", min: 0, value: placeholder.practicalHours ?? 0 },
    ],
  });
  if (!values) return;
  Object.assign(placeholder, {
    name: values.name,
    academicHours: Number(values.academicHours),
    lectureHours: Number(values.lectureHours),
    exerciseHours: Number(values.exerciseHours),
    practicalHours: Number(values.practicalHours),
    color: "#000000",
  });
  changed(true);
}

function updateManualFact(row, input) {
  const target = collection(row.dataset.kind, Number(row.dataset.groupIndex));
  const code = entryCode(target[Number(row.dataset.courseIndex)]);
  const fallbacks = fallbackCoursesFor(row.dataset.kind);
  const fallback = fallbacks[code] ?? {};
  fallback._provenance ??= {};
  if (input.value === "") {
    delete fallback[input.dataset.manualFact];
    delete fallback._provenance[input.dataset.manualFact];
  } else {
    fallback[input.dataset.manualFact] = input.type === "number" ? Number(input.value) : input.value;
    fallback._provenance[input.dataset.manualFact] = "manual";
  }
  fallbacks[code] = fallback;
  if (row.dataset.kind === "shared") sharedChanged();
  else if (row.dataset.kind === "sharedElective") sharedElectiveChanged();
  else changed();
}

function updateDependency(row, input) {
  const target = collection(row.dataset.kind, Number(row.dataset.groupIndex));
  const index = Number(row.dataset.courseIndex);
  const entry = normalizedEntry(target[index]);
  if (input.dataset.dependency === "minimumCompletedCredits") {
    if (input.value === "") delete entry.minimumCompletedCredits;
    else entry.minimumCompletedCredits = Number(input.value);
  } else {
    const values = parseCodes(input.value);
    if (values.length) entry[input.dataset.dependency] = values;
    else delete entry[input.dataset.dependency];
  }
  target[index] = Object.keys(entry).length === 1 ? entry.code : entry;
  if (row.dataset.kind === "shared") sharedChanged();
  else if (row.dataset.kind === "sharedElective") sharedElectiveChanged();
  else changed();
}

async function addSharedSet() {
  openSharedSetEditor();
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

function openSharedElectiveSourceEditor(source = null) {
  state.sharedElectiveDraft = structuredClone(source ?? {
    schemaVersion: 1,
    id: "",
    name: "",
    requiredHours: 0,
    courses: [],
    fallbackCourses: {},
  });
  state.sharedElectiveDraft._originalId = source?.id ?? null;
  state.sharedElectiveResolved = null;
  state.sharedElectiveDirty = false;
  renderSharedElectiveSourceEditor();
  document.querySelector('[data-tab="settings"]')?.click();
  els.sharedElectiveSourceEditor.scrollIntoView({ behavior: "smooth", block: "start" });
  scheduleSharedElectiveResolution(0);
}

function renderSharedElectiveSourceEditor() {
  const draft = state.sharedElectiveDraft;
  els.sharedElectiveSourceEditor.hidden = !draft;
  if (!draft) return;
  els.sharedElectiveSourceEditorTitle.textContent = draft.name || "مجموعة اختيارية جديدة";
  els.sharedElectiveSourceName.value = draft.name ?? "";
  els.sharedElectiveSourceId.value = draft.id ?? "";
  els.sharedElectiveSourceHours.value = draft.requiredHours ?? 0;
  const resolved = resolvedCollection("sharedElective", 0);
  els.sharedElectiveCourseList.innerHTML = (draft.courses ?? []).map((entry, index) => (
    courseRow(typeof entry === "string" ? { code: entry } : entry, resolved[index], "sharedElective", 0, index)
  )).join("") || '<p class="muted">لا مقررات في هذا المصدر.</p>';
}

function scheduleSharedElectiveResolution(delay = 250) {
  clearTimeout(state.sharedPreviewTimer);
  state.sharedPreviewTimer = setTimeout(async () => {
    if (!state.sharedElectiveDraft) return;
    const result = await request("/api/preview", {
      method: "POST",
      body: JSON.stringify({
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
  }, delay);
}

function sharedElectiveChanged(render = false) {
  state.sharedElectiveDirty = true;
  if (render) renderSharedElectiveSourceEditor();
  scheduleSharedElectiveResolution();
}

async function saveSharedElectiveSourceEditor() {
  const draft = state.sharedElectiveDraft;
  if (!draft) return;
  draft.name = els.sharedElectiveSourceName.value.trim();
  draft.id = els.sharedElectiveSourceId.value.trim();
  draft.requiredHours = Number(els.sharedElectiveSourceHours.value);
  const previousId = draft._originalId;
  const payload = structuredClone(draft);
  delete payload._originalId;
  await request(previousId ? `/api/shared-elective-groups/${encodeURIComponent(previousId)}` : "/api/shared-elective-groups", {
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

async function courseSearch(value) {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(async () => {
    if (!value.trim()) return;
    const result = await request(`/api/catalog/search?q=${encodeURIComponent(value)}`);
    els.courseSuggestions.innerHTML = result.courses.map((course) => (
      `<option value="${escapeHtml(course.code)}">${escapeHtml(course.name)}</option>`
    )).join("");
  }, 180);
}

function moveProposalCourse(row, action) {
  const fromIndex = Number(row.dataset.groupIndex);
  const code = row.dataset.courseCode;
  const semesters = state.plan.proposal.semesters;
  const source = semesters[fromIndex];
  const courseIndex = source.courseOrder.indexOf(code);
  if (courseIndex < 0) return;
  if (action === "up" || action === "down") {
    move(source.courseOrder, courseIndex, action === "up" ? -1 : 1);
  } else {
    let targetIndex = action === "previous" ? fromIndex - 1 : action === "next" ? fromIndex + 1 : -1;
    if (action === "home") {
      const parent = publishedDecisionSemesters().find((semester) => semester.courses.some((entry) => entryCode(entry) === code));
      targetIndex = semesters.findIndex((semester) => semester.sourceSemesterId === parent?.id);
    }
    if (targetIndex < 0 || targetIndex >= semesters.length || targetIndex === fromIndex) return;
    source.courseOrder.splice(courseIndex, 1);
    semesters[targetIndex].courseOrder.push(code);
  }
  changed(true);
}

async function refreshCatalogFallback(row) {
  const kind = row.dataset.kind;
  const target = collection(kind, Number(row.dataset.groupIndex));
  const code = entryCode(target[Number(row.dataset.courseIndex)]);
  if (!window.confirm(`سيستبدل التحديث بيانات ${code} اليدوية بالبيانات الحالية من الدليل. هل تريد المتابعة؟`)) return;
  const owner = kind === "shared" ? state.sharedSetDraft : kind === "sharedElective" ? state.sharedElectiveDraft : state.plan;
  const result = await request("/api/fallback/refresh", {
    method: "POST",
    body: JSON.stringify({ owner, code }),
  });
  if (kind === "shared") {
    state.sharedSetDraft = { ...result.owner, _originalId: state.sharedSetDraft._originalId };
    sharedChanged(true);
  } else if (kind === "sharedElective") {
    state.sharedElectiveDraft = { ...result.owner, _originalId: state.sharedElectiveDraft._originalId };
    sharedElectiveChanged(true);
  } else {
    state.plan = result.owner;
    changed(true);
  }
}

document.addEventListener("click", (event) => {
  const college = event.target.closest("[data-college]");
  if (college) selectCollege(college.dataset.college).catch((error) => setStatus(error.message, "error"));
  const major = event.target.closest("[data-major]");
  if (major) selectMajor(major.dataset.major).catch((error) => setStatus(error.message, "error"));
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    document.querySelectorAll(".tab").forEach((node) => node.classList.toggle("active", node === tab));
    document.querySelectorAll(".tab-panel").forEach((node) => node.classList.toggle("active", node.dataset.panel === tab.dataset.tab));
  }
  const diagnostic = event.target.closest("[data-focus]");
  if (diagnostic?.dataset.focus) document.querySelector(`[data-location="${CSS.escape(diagnostic.dataset.focus)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  const card = event.target.closest(".semester-card");
  if (card && event.target.closest(".add-course")) {
    const input = card.querySelector(".course-code-input");
    addCodes(card.dataset.kind, Number(card.dataset.groupIndex), input.value);
  }
  if (card && event.target.closest(".add-placeholder")) {
    addPlaceholder(card).catch((error) => setStatus(error.message, "error"));
  }
  if (card && event.target.closest(".delete-item")) {
    const source = card.dataset.kind === "semester" ? state.plan.semesters : card.dataset.kind === "elective" ? state.plan.electiveGroups : card.dataset.kind === "shared" ? state.sharedSetDraft.semesters : state.plan.proposal.semesters;
    source.splice(Number(card.dataset.groupIndex), 1);
    if (card.dataset.kind === "shared") sharedChanged(true);
    else changed(true);
  }
  if (card && (event.target.closest(".move-up") || event.target.closest(".move-down"))) {
    const source = card.dataset.kind === "semester" ? state.plan.semesters : card.dataset.kind === "elective" ? state.plan.electiveGroups : card.dataset.kind === "shared" ? state.sharedSetDraft.semesters : state.plan.proposal.semesters;
    move(source, Number(card.dataset.groupIndex), event.target.closest(".move-up") ? -1 : 1);
    if (card.dataset.kind === "shared") sharedChanged(true);
    else changed(true);
  }

  const row = event.target.closest(".course-row");

  if (row?.dataset.kind === "proposal") {
    if (event.target.closest(".proposal-course-up")) moveProposalCourse(row, "up");
    if (event.target.closest(".proposal-course-down")) moveProposalCourse(row, "down");
    if (event.target.closest(".proposal-course-previous")) moveProposalCourse(row, "previous");
    if (event.target.closest(".proposal-course-next")) moveProposalCourse(row, "next");
    if (event.target.closest(".proposal-course-home")) moveProposalCourse(row, "home");
  }

  if (row && event.target.closest(".edit-placeholder")) {
    editPlaceholder(row).catch((error) => setStatus(error.message, "error"));
  }

  if (row && event.target.closest(".course-delete")) {
    if (row.dataset.kind === "proposal") {
      const placeholders = state.plan.proposal.semesters[Number(row.dataset.groupIndex)].placeholders;
      const index = placeholders.findIndex((placeholder) => placeholder.id === row.dataset.placeholderId);
      if (index >= 0) placeholders.splice(index, 1);
    } else {
      collection(row.dataset.kind, Number(row.dataset.groupIndex)).splice(Number(row.dataset.courseIndex), 1);
    }
    if (row.dataset.kind === "shared") sharedChanged(true);
    else if (row.dataset.kind === "sharedElective") sharedElectiveChanged(true);
    else changed(true);
  }
  if (row && event.target.closest(".refresh-catalog-facts")) {
    refreshCatalogFallback(row).catch((error) => setStatus(error.message, "error"));
  }
  const sharedSet = event.target.closest("[data-shared-set]");
  if (sharedSet && event.target.closest(".edit-shared-set")) {
    editSharedSet(sharedSet.dataset.sharedSet).catch((error) => setStatus(error.message, "error"));
  }
  if (sharedSet && event.target.closest(".duplicate-shared-set")) {
    askForm({
      title: "نسخ مجموعة الفصول",
      fields: [
        { name: "name", label: "اسم النسخة" },
        { name: "id", label: "معرّف النسخة", dir: "ltr" },
      ],
    }).then(async (values) => {
      if (!values) return;
      await request(`/api/shared-semester-sets/${encodeURIComponent(sharedSet.dataset.sharedSet)}/duplicate`, { method: "POST", body: JSON.stringify(values) });
      await loadState();
    }).catch((error) => setStatus(error.message, "error"));
  }
  if (sharedSet && event.target.closest(".delete-shared-set")) {
    request(`/api/shared-semester-sets/${encodeURIComponent(sharedSet.dataset.sharedSet)}`, { method: "DELETE" })
      .then(loadState).catch((error) => setStatus(error.message, "error"));
  }
  const sharedReference = event.target.closest("[data-shared-elective-reference]");
  if (sharedReference) {
    const index = Number(sharedReference.dataset.groupIndex);
    if (event.target.closest(".remove-shared-elective-reference")) {
      state.plan.electiveGroups.splice(index, 1);
      changed(true);
    }
    if (event.target.closest(".move-up")) {
      move(state.plan.electiveGroups, index, -1);
      changed(true);
    }
    if (event.target.closest(".move-down")) {
      move(state.plan.electiveGroups, index, 1);
      changed(true);
    }
    if (event.target.closest(".open-shared-elective-source")) {
      const source = state.sharedElectiveGroups.find((item) => item.id === sharedReference.dataset.sharedElectiveReference);
      if (source) openSharedElectiveSourceEditor(source);
    }
  }
  const sharedElectiveSource = event.target.closest("[data-shared-elective-source]");
  if (sharedElectiveSource) {
    const id = sharedElectiveSource.dataset.sharedElectiveSource;
    const source = state.sharedElectiveGroups.find((item) => item.id === id);
    if (event.target.closest(".edit-shared-elective-source")) openSharedElectiveSourceEditor(source);
    if (event.target.closest(".duplicate-shared-elective-source")) {
      askForm({
        title: "نسخ المصدر الاختياري",
        fields: [{ name: "name", label: "اسم النسخة" }, { name: "id", label: "معرّف النسخة", dir: "ltr" }],
      }).then(async (values) => {
        if (!values) return;
        await request(`/api/shared-elective-groups/${encodeURIComponent(id)}/duplicate`, { method: "POST", body: JSON.stringify(values) });
        await loadState();
        renderSharedElectiveSources();
      }).catch((error) => setStatus(error.message, "error"));
    }
    if (event.target.closest(".delete-shared-elective-source")) {
      request(`/api/shared-elective-groups/${encodeURIComponent(id)}`, { method: "DELETE" })
        .then(async () => { await loadState(); renderSharedElectiveSources(); })
        .catch((error) => setStatus(error.message, "error"));
    }
  }
});

document.addEventListener("input", (event) => {
  if (["sharedElectiveSourceName", "sharedElectiveSourceId", "sharedElectiveSourceHours"].includes(event.target.id) && state.sharedElectiveDraft) {
    state.sharedElectiveDraft.name = els.sharedElectiveSourceName.value;
    state.sharedElectiveDraft.id = els.sharedElectiveSourceId.value;
    state.sharedElectiveDraft.requiredHours = Number(els.sharedElectiveSourceHours.value);
    state.sharedElectiveDirty = true;
    els.sharedElectiveSourceEditorTitle.textContent = state.sharedElectiveDraft.name || "مجموعة اختيارية جديدة";
    scheduleSharedElectiveResolution();
    return;
  }
  if (["sharedSetName", "sharedSetId", "sharedSetPhase"].includes(event.target.id) && state.sharedSetDraft) {
    state.sharedSetDraft.name = els.sharedSetName.value;
    state.sharedSetDraft.id = els.sharedSetId.value;
    state.sharedSetDraft.phaseLabel = els.sharedSetPhase.value;
    state.sharedSetDirty = true;
    els.sharedSetEditorTitle.textContent = state.sharedSetDraft.name || "خطة مشتركة جديدة";
    return;
  }
  const field = event.target.closest("[data-field]");
  if (field && state.plan) {
    state.plan[field.dataset.field] = field.type === "number" ? Number(field.value) : field.value;
    els.planHeading.textContent = state.plan.major;
    changed();
  }
  const card = event.target.closest(".semester-card");
  if (card?.dataset.kind === "elective" && event.target.classList.contains("semester-name")) {
    state.plan.electiveGroups[Number(card.dataset.groupIndex)].name = event.target.value;
    changed();
  }

  if (event.target.classList.contains("course-code-input") || event.target.id === "sharedElectiveCourseInput") courseSearch(event.target.value);
  const row = event.target.closest(".course-row");
  if (row && event.target.matches("[data-manual-fact]")) updateManualFact(row, event.target);

});

document.addEventListener("change", (event) => {
  const row = event.target.closest(".course-row");
  if (row && event.target.matches("[data-dependency]")) updateDependency(row, event.target);
  if (row && event.target.matches("[data-track-specific]")) {
    const target = collection(row.dataset.kind, Number(row.dataset.groupIndex));
    const index = Number(row.dataset.courseIndex);
    const entry = normalizedEntry(target[index]);
    if (event.target.checked) entry.trackSpecific = true;
    else delete entry.trackSpecific;
    target[index] = Object.keys(entry).length === 1 ? entry.code : entry;
    if (row.dataset.kind === "shared") sharedChanged();
    else if (row.dataset.kind === "sharedElective") sharedElectiveChanged();
    else changed();
  }
  if (event.target.matches("[data-shared-set-choice]")) {
    state.plan.sharedSemesterSets = event.target.checked && event.target.dataset.sharedSetChoice ? [event.target.dataset.sharedSetChoice] : [];
    renderInheritedSemesters();
    changed(true);
  }
  if (event.target.classList.contains("requirement-mode")) {
    const card = event.target.closest(".semester-card");
    const group = state.plan.electiveGroups[Number(card.dataset.groupIndex)];
    if (event.target.value === "text") {
      delete group.requiredHours;
      group.requirementText = "غير متطلب للتخرج";
    } else {
      delete group.requirementText;
      group.requiredHours = 0;
    }
    changed(true);
  }
});

document.addEventListener("input", (event) => {
  if (!event.target.classList.contains("requirement-value")) return;
  const card = event.target.closest(".semester-card");
  const group = state.plan.electiveGroups[Number(card.dataset.groupIndex)];
  if (group.requirementText !== undefined) group.requirementText = event.target.value;
  else group.requiredHours = Number(event.target.value);
  changed();
});


document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.classList.contains("course-code-input")) {
    event.preventDefault();
    const card = event.target.closest(".semester-card");
    addCodes(card.dataset.kind, Number(card.dataset.groupIndex), event.target.value);
  }
});

document.addEventListener("dragstart", (event) => {
  const row = event.target.closest('.course-row[data-kind="proposal"][draggable="true"]');
  if (!row) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-saad-proposal-course", JSON.stringify({
    code: row.dataset.courseCode,
    semesterIndex: Number(row.dataset.groupIndex),
  }));
});

document.addEventListener("dragover", (event) => {
  if (!event.target.closest('.semester-card[data-kind="proposal"]')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});

document.addEventListener("drop", (event) => {
  const card = event.target.closest('.semester-card[data-kind="proposal"]');
  if (!card) return;
  event.preventDefault();
  const payload = JSON.parse(event.dataTransfer.getData("application/x-saad-proposal-course") || "null");
  if (!payload) return;
  const from = state.plan.proposal.semesters[payload.semesterIndex];
  const targetIndex = Number(card.dataset.groupIndex);
  const target = state.plan.proposal.semesters[targetIndex];
  const index = from.courseOrder.indexOf(payload.code);
  if (index < 0) return;
  const targetRow = event.target.closest('.course-row[data-kind="proposal"][draggable="true"]');
  if (payload.semesterIndex === targetIndex && targetRow?.dataset.courseCode === payload.code) return;
  from.courseOrder.splice(index, 1);
  const insertAt = targetRow ? Math.max(0, target.courseOrder.indexOf(targetRow.dataset.courseCode)) : target.courseOrder.length;
  target.courseOrder.splice(insertAt, 0, payload.code);
  changed(true);
});

$("addCollegeButton").addEventListener("click", () => addCollege().catch((error) => setStatus(error.message, "error")));
$("editCollegeButton").addEventListener("click", () => editCollege().catch((error) => setStatus(error.message, "error")));
$("deleteCollegeButton").addEventListener("click", () => deleteCollege().catch((error) => setStatus(error.message, "error")));
$("addMajorButton").addEventListener("click", () => addMajor().catch((error) => setStatus(error.message, "error")));
$("duplicateMajorButton").addEventListener("click", () => duplicateMajor().catch((error) => setStatus(error.message, "error")));
$("deleteMajorButton").addEventListener("click", () => deleteMajor().catch((error) => setStatus(error.message, "error")));
$("saveButton").addEventListener("click", () => savePlan().catch((error) => setStatus(error.message, "error")));
els.generateButton.addEventListener("click", () => generatePlan(true).catch((error) => setStatus(error.message, "error")));
els.generateDraftButton.addEventListener("click", () => generatePlan(false).catch((error) => setStatus(error.message, "error")));
$("openOutputButton").addEventListener("click", async () => {
  try {
    await request("/api/open-output", { method: "POST" });
    setStatus("فُتح مجلد المخرجات.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});
$("addSemesterButton").addEventListener("click", () => {
  state.plan.semesters.push({ id: `published-${crypto.randomUUID()}`, courses: [] });
  changed(true);
});


$("addElectiveButton").addEventListener("click", () => {
  state.plan.electiveGroups ??= [];
  state.plan.electiveGroups.push({ id: `elective-group-${state.plan.electiveGroups.length + 1}`, name: "مجموعة اختيارية", requiredHours: 0, sortCourses: "code", courses: [] });
  changed(true);
});
$("addSharedElectiveButton").addEventListener("click", async () => {
  if (!state.sharedElectiveGroups.length) return setStatus("أنشئ مصدرًا اختياريًا مشتركًا من الإعدادات أولًا.", "error");
  const values = await askForm({
    title: "إضافة مصدر اختياري مشترك",
    message: state.sharedElectiveGroups.map((source) => `${source.id}: ${source.name}`).join(" · "),
    fields: [{ name: "sourceId", label: "معرّف المصدر", value: state.sharedElectiveGroups[0].id, dir: "ltr" }],
  });
  if (!values) return;
  if (!state.sharedElectiveGroups.some((source) => source.id === values.sourceId)) return setStatus("معرّف المصدر غير موجود.", "error");
  state.plan.electiveGroups.push({ sourceId: values.sourceId });
  changed(true);
});
els.proposalEnabled.addEventListener("change", () => {
  const published = publishedDecisionSemesters();
  state.plan.proposal = els.proposalEnabled.checked
    ? {
        enabled: true,
        title: "الخطة المقترحة",
        showGuide: true,
        semesters: published.map((semester) => ({
          id: semester.id,
          sourceSemesterId: semester.id,
          type: "regular",
          courseOrder: semester.courses.map(entryCode),
          placeholders: [],
        })),
      }
    : null;
  changed(true);
});
$("addProposalSemesterButton").addEventListener("click", () => {
  state.plan.proposal.semesters.push({
    id: `proposal-regular-${Date.now().toString(36)}`,
    sourceSemesterId: null,
    type: "regular",
    courseOrder: [],
    placeholders: [],
  });
  changed(true);
});
$("addProposalSummerButton").addEventListener("click", () => {
  state.plan.proposal.semesters.push({
    id: `proposal-summer-${Date.now().toString(36)}`,
    sourceSemesterId: null,
    type: "summer",
    courseOrder: [],
    placeholders: [],
  });
  changed(true);
});
$("syncProposalButton").addEventListener("click", () => {
  syncProposalWithPublished();
  changed(true);
  setStatus("تمت مزامنة المقررات مع الخطة المنشورة مع الحفاظ على النقل والترتيب الصالح.", "success");
});
$("resetProposalButton").addEventListener("click", async () => {
  const confirmed = await askForm({
    title: "إعادة ضبط الخطة المقترحة",
    message: "ستعود المقررات إلى مستوياتها المنشورة، وستبقى المقررات النائبة في مستوياتها الموروثة.",
    submit: "إعادة الضبط",
    danger: true,
  });
  if (!confirmed) return;
  const placeholders = new Map(state.plan.proposal.semesters.filter((semester) => semester.sourceSemesterId)
    .map((semester) => [semester.sourceSemesterId, semester.placeholders ?? []]));
  state.plan.proposal.semesters = publishedDecisionSemesters().map((semester) => ({
    id: semester.id,
    sourceSemesterId: semester.id,
    type: "regular",
    courseOrder: semester.courses.map(entryCode),
    placeholders: structuredClone(placeholders.get(semester.id) ?? []),
  }));
  changed(true);
});
els.guideEnabled.addEventListener("change", () => {
  state.plan.proposal.showGuide = els.guideEnabled.checked;
  changed();
});


$("colorForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await request(`/api/colors/${encodeURIComponent($("colorSubject").value.trim())}`, {
    method: "PUT",
    body: JSON.stringify({ color: $("colorValue").value }),
  });
  setStatus("حُفظ اللون العام.", "success");
  schedulePreview(0);
});
$("globalSettingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await request("/api/settings", {
    method: "PUT",
    body: JSON.stringify({ edition: $("globalEdition").value, release: $("globalRelease").value }),
  });
  state.settings = result.settings;
  setStatus("حُفظت إعدادات الإصدار.", "success");
  schedulePreview(0);
});
$("resetSettingsButton").addEventListener("click", () => {
  $("globalEdition").value = state.settings.edition;
  $("globalRelease").value = state.settings.release;
});
$("addSharedSetButton").addEventListener("click", () => addSharedSet().catch((error) => setStatus(error.message, "error")));
$("saveSharedSetButton").addEventListener("click", () => saveSharedSetEditor().catch((error) => setStatus(error.message, "error")));
$("closeSharedSetButton").addEventListener("click", () => { state.sharedSetDraft = null; state.sharedSetResolved = null; state.sharedSetDirty = false; renderSharedSetEditor(); });
$("addSharedSemesterButton").addEventListener("click", () => {
  state.sharedSetDraft.semesters.push({ id: `shared-semester-${crypto.randomUUID()}`, courses: [] });
  sharedChanged(true);
});
$("addSharedElectiveSourceButton").addEventListener("click", () => openSharedElectiveSourceEditor());
$("saveSharedElectiveSourceButton").addEventListener("click", () => saveSharedElectiveSourceEditor().catch((error) => setStatus(error.message, "error")));
$("closeSharedElectiveSourceButton").addEventListener("click", () => {
  state.sharedElectiveDraft = null;
  state.sharedElectiveResolved = null;
  state.sharedElectiveDirty = false;
  renderSharedElectiveSourceEditor();
});
$("addSharedElectiveCourseButton").addEventListener("click", () => {
  const input = $("sharedElectiveCourseInput");
  const codes = parseCodes(input.value);
  state.sharedElectiveDraft.courses.push(...codes.map((code) => ({ code })));
  input.value = "";
  sharedElectiveChanged(true);
});
els.zoom.addEventListener("input", () => {
  els.previewHost.style.setProperty("--zoom", String(Number(els.zoom.value) / 100));
});
window.addEventListener("beforeunload", (event) => {
  if (!state.dirty && !state.sharedSetDirty && !state.sharedElectiveDirty) return;
  event.preventDefault();
  event.returnValue = "";
});
window.addEventListener("unload", releasePreviewUrls);

els.dialogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const submitter = event.submitter?.value;
  const values = submitter === "confirm"
    ? Object.fromEntries(new FormData(els.dialogForm).entries())
    : null;
  els.formDialog.close();
  const resolve = dialogResolver;
  dialogResolver = null;
  resolve?.(values);
});
els.formDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  els.formDialog.close();
  const resolve = dialogResolver;
  dialogResolver = null;
  resolve?.(null);
});

loadState().catch((error) => setStatus(error.message, "error"));
