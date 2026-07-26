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
  electiveList: $("electiveList"),
  proposalSemesterList: $("proposalSemesterList"),
  publishedPhaseList: $("publishedPhaseList"),
  proposalPhaseList: $("proposalPhaseList"),
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
  if (kind === "proposal") return state.plan.proposal.semesters[index].courses;
  throw new Error("Unknown course collection.");
}

function resolvedCollection(kind, index) {
  if (!state.resolved) return [];
  if (kind === "semester") return state.resolved.semesters?.[index]?.courses ?? [];
  if (kind === "elective") return state.resolved.electiveGroups?.[index]?.courses ?? [];
  if (kind === "proposal") return state.resolved.proposal?.semesters?.[index]?.courses ?? [];
  return [];
}

function courseRow(entry, resolved, kind, groupIndex, courseIndex) {
  const code = entryCode(entry);
  const override = typeof entry === "object" ? entry.override ?? {} : {};
  const unresolved = !resolved || resolved.source === "unresolved";
  const location = kind === "semester" ? `semester-${groupIndex + 1}` : kind === "elective"
    ? `elective-${state.plan.electiveGroups[groupIndex]?.id ?? groupIndex + 1}`
    : `proposal-semester-${groupIndex + 1}`;
  return `
    <div class="course-row ${unresolved ? "unresolved" : ""}" data-kind="${kind}" data-group-index="${groupIndex}" data-course-index="${courseIndex}" data-location="${escapeHtml(location)}">
      <div><div class="course-code">${escapeHtml(resolved?.code ?? code)}</div><div class="course-meta">${escapeHtml(resolved?.subject ?? "")}</div></div>
      <div><div class="course-name">${escapeHtml(resolved?.name ?? (entry?.kind === "placeholder" ? entry?.fallback?.name : "مقرر غير موجود في الدليل"))}</div>
        <div class="course-meta">${resolved ? `${resolved.academicHours ?? "—"} ساعات · محاضرة ${resolved.lectureHours ?? "—"} · عملي ${resolved.practicalHours ?? "—"} · تمارين ${resolved.exerciseHours ?? "—"}` : ""}</div>
      </div>
      <div class="course-meta">${resolved?.prerequisites?.length ? `سابق: ${escapeHtml(resolved.prerequisites.join("، "))}` : "لا متطلب سابق"}</div>
      <div class="course-actions">
        <button class="icon-button course-up" type="button" aria-label="نقل إلى أعلى">↑</button>
        <button class="icon-button course-down" type="button" aria-label="نقل إلى أسفل">↓</button>
        <button class="icon-button course-delete danger" type="button" aria-label="حذف">×</button>
      </div>
      <details class="course-details">
        <summary>${unresolved ? "إضافة بيانات بديلة" : "المتطلبات والتعديل المتقدم"}</summary>
        <div class="dependency-grid">
          <label>المتطلبات السابقة<input data-dependency="prerequisites" value="${escapeHtml((override.prerequisites ?? resolved?.prerequisites ?? []).join("، "))}" placeholder="101 عال، 101 ريض"></label>
          <label>المتطلبات المتزامنة<input data-dependency="corequisites" value="${escapeHtml((override.corequisites ?? resolved?.corequisites ?? []).join("، "))}"></label>
          <label>الحد الأدنى للساعات<input data-dependency="minimumCompletedCredits" type="number" min="0" value="${escapeHtml(override.minimumCompletedCredits ?? resolved?.minimumCompletedCredits ?? "")}"></label>
          ${unresolved ? '<button class="button secondary create-fallback" type="button">تعريف مقرر بديل</button>' : '<button class="button ghost reset-override" type="button">الرجوع إلى الدليل</button>'}
        </div>
      </details>
    </div>
  `;
}

function configureSemesterCard(card, item, index, kind) {
  card.dataset.kind = kind;
  card.dataset.groupIndex = index;
  card.dataset.location = kind === "semester" ? `semester-${index + 1}` : kind === "elective"
    ? `elective-${item.id ?? index + 1}` : `proposal-semester-${index + 1}`;
  const name = card.querySelector(".semester-name");
  const secondary = card.querySelector(".semester-year");
  name.value = item.name ?? "";
  if (kind === "elective") {
    secondary.type = "number";
    secondary.min = "0";
    secondary.placeholder = "الساعات المطلوبة";
    secondary.value = item.requiredHours ?? 0;
  } else {
    secondary.value = item.yearLabel ?? "";
    secondary.placeholder = kind === "proposal" ? "المرحلة أو السنة" : "السنة أو المرحلة";
  }
  card.querySelector(".add-placeholder").hidden = kind !== "proposal";
  const resolved = resolvedCollection(kind, index);
  card.querySelector(".course-list").innerHTML = item.courses.map((entry, courseIndex) => (
    courseRow(entry, resolved[courseIndex], kind, index, courseIndex)
  )).join("");
}

function renderCollection(host, items, kind) {
  host.innerHTML = "";
  items.forEach((item, index) => {
    const fragment = $("semesterTemplate").content.cloneNode(true);
    const card = fragment.querySelector(".semester-card");
    configureSemesterCard(card, item, index, kind);
    host.append(fragment);
  });
  if (!items.length) host.innerHTML = '<div class="card muted">لا عناصر هنا بعد.</div>';
}

function renderEditor() {
  if (!state.plan) return;
  els.planHeading.textContent = state.plan.major;
  document.querySelectorAll("[data-field]").forEach((input) => {
    input.value = state.plan[input.dataset.field] ?? "";
  });
  renderCollection(els.semesterList, state.plan.semesters, "semester");
  renderPhases(els.publishedPhaseList, state.plan.phases ?? [], "published");
  renderCollection(els.electiveList, state.plan.electiveGroups ?? [], "elective");
  els.proposalEnabled.checked = Boolean(state.plan.proposal);
  els.proposalEditor.hidden = !state.plan.proposal;
  els.guideEnabled.checked = state.plan.proposal?.showGuide !== false;
  renderCollection(els.proposalSemesterList, state.plan.proposal?.semesters ?? [], "proposal");
  renderPhases(els.proposalPhaseList, state.plan.proposal?.phases ?? [], "proposal");
}

function renderPhases(host, phases, kind) {
  if (!phases.length) {
    host.innerHTML = '<p class="muted">ستُشتق المراحل تلقائيًا ما لم تضف تقسيمًا صريحًا.</p>';
    return;
  }
  host.innerHTML = phases.map((phase, index) => `
    <div class="phase-row" data-phase-kind="${kind}" data-phase-index="${index}">
      <label>اسم المرحلة<input data-phase-field="label" value="${escapeHtml(phase.label)}"></label>
      <label>من فصل<input data-phase-field="start" type="number" min="1" value="${phase.start}"></label>
      <label>إلى فصل<input data-phase-field="end" type="number" min="1" value="${phase.end}"></label>
      <button class="icon-button delete-phase danger" type="button" aria-label="حذف المرحلة">×</button>
    </div>
  `).join("");
}

function phaseCollection(kind) {
  if (kind === "proposal") {
    state.plan.proposal.phases ??= [];
    return state.plan.proposal.phases;
  }
  state.plan.phases ??= [];
  return state.plan.phases;
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
  changed(true);
}

function changed(render = false) {
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
    row.classList.toggle("unresolved", unresolved);
    row.querySelector(".course-code").textContent = resolved?.code
      ?? entryCode(collection(row.dataset.kind, groupIndex)[courseIndex]);
    row.querySelector(".course-name").textContent = resolved?.name ?? "مقرر غير موجود في الدليل";
    const metadata = row.querySelectorAll(".course-meta");
    if (metadata[0]) metadata[0].textContent = resolved?.subject ?? "";
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
    title: "إضافة مقرر خاص",
    message: "هذا مقرر صريح في الخطة المقترحة، وليس مقررًا وهميًا في الدليل.",
    fields: [
      { name: "name", label: "وصف المقرر", value: "من متطلبات المسار" },
      { name: "academicHours", label: "الساعات الأكاديمية", type: "number", min: 0, value: 3 },
    ],
  });
  if (!values) return;
  collection(card.dataset.kind, Number(card.dataset.groupIndex)).push({
    kind: "placeholder",
    code: "مقرر",
    fallback: { name: values.name, academicHours: Number(values.academicHours), lectureHours: 0, practicalHours: 0, exerciseHours: 0, color: "#000000" },
  });
  changed(true);
}

async function createFallback(row) {
  const target = collection(row.dataset.kind, Number(row.dataset.groupIndex));
  const code = entryCode(target[Number(row.dataset.courseIndex)]);
  const values = await askForm({
    title: "تعريف مقرر بديل",
    message: `لم يُعثر على ${code} في دليل المقررات. أدخل أقل قدر لازم لإتمام الخطة.`,
    fields: [
      { name: "name", label: "اسم المقرر" },
      { name: "academicHours", label: "الساعات الأكاديمية", type: "number", min: 0, value: 3 },
      { name: "lectureHours", label: "ساعات المحاضرة", type: "number", min: 0, value: 3 },
    ],
  });
  if (!values) return;
  state.plan.fallbackCourses ??= {};
  state.plan.fallbackCourses[code] = {
    name: values.name,
    academicHours: Number(values.academicHours),
    lectureHours: Number(values.lectureHours),
    practicalHours: 0,
    exerciseHours: 0,
    prerequisites: [],
    corequisites: [],
  };
  changed(true);
}

function updateDependency(row, input) {
  const target = collection(row.dataset.kind, Number(row.dataset.groupIndex));
  const index = Number(row.dataset.courseIndex);
  const entry = normalizedEntry(target[index]);
  entry.override = { ...(entry.override ?? {}) };
  if (input.dataset.dependency === "minimumCompletedCredits") {
    if (input.value === "") delete entry.override.minimumCompletedCredits;
    else entry.override.minimumCompletedCredits = Number(input.value);
  } else {
    const values = parseCodes(input.value);
    if (values.length) entry.override[input.dataset.dependency] = values;
    else delete entry.override[input.dataset.dependency];
  }
  if (!Object.keys(entry.override).length) delete entry.override;
  target[index] = Object.keys(entry).length === 1 ? entry.code : entry;
  changed();
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
  const phaseRow = event.target.closest("[data-phase-kind]");
  if (phaseRow && event.target.closest(".delete-phase")) {
    phaseCollection(phaseRow.dataset.phaseKind).splice(Number(phaseRow.dataset.phaseIndex), 1);
    changed(true);
  }

  const card = event.target.closest(".semester-card");
  if (card && event.target.closest(".add-course")) {
    const input = card.querySelector(".course-code-input");
    addCodes(card.dataset.kind, Number(card.dataset.groupIndex), input.value);
  }
  if (card && event.target.closest(".add-placeholder")) {
    addPlaceholder(card).catch((error) => setStatus(error.message, "error"));
  }
  if (card && event.target.closest(".delete-item")) {
    const source = card.dataset.kind === "semester" ? state.plan.semesters : card.dataset.kind === "elective" ? state.plan.electiveGroups : state.plan.proposal.semesters;
    source.splice(Number(card.dataset.groupIndex), 1);
    changed(true);
  }
  if (card && (event.target.closest(".move-up") || event.target.closest(".move-down"))) {
    const source = card.dataset.kind === "semester" ? state.plan.semesters : card.dataset.kind === "elective" ? state.plan.electiveGroups : state.plan.proposal.semesters;
    move(source, Number(card.dataset.groupIndex), event.target.closest(".move-up") ? -1 : 1);
    changed(true);
  }

  const row = event.target.closest(".course-row");
  if (row && (event.target.closest(".course-up") || event.target.closest(".course-down"))) {
    move(collection(row.dataset.kind, Number(row.dataset.groupIndex)), Number(row.dataset.courseIndex), event.target.closest(".course-up") ? -1 : 1);
    changed(true);
  }
  if (row && event.target.closest(".course-delete")) {
    collection(row.dataset.kind, Number(row.dataset.groupIndex)).splice(Number(row.dataset.courseIndex), 1);
    changed(true);
  }
  if (row && event.target.closest(".reset-override")) {
    const target = collection(row.dataset.kind, Number(row.dataset.groupIndex));
    target[Number(row.dataset.courseIndex)] = entryCode(target[Number(row.dataset.courseIndex)]);
    changed(true);
  }
  if (row && event.target.closest(".create-fallback")) {
    createFallback(row).catch((error) => setStatus(error.message, "error"));
  }
});

document.addEventListener("input", (event) => {
  const field = event.target.closest("[data-field]");
  if (field && state.plan) {
    state.plan[field.dataset.field] = field.type === "number" ? Number(field.value) : field.value;
    els.planHeading.textContent = state.plan.major;
    changed();
  }
  const card = event.target.closest(".semester-card");
  if (card && event.target.classList.contains("semester-name")) {
    const source = card.dataset.kind === "semester" ? state.plan.semesters : card.dataset.kind === "elective" ? state.plan.electiveGroups : state.plan.proposal.semesters;
    source[Number(card.dataset.groupIndex)].name = event.target.value;
    changed();
  }
  if (card && event.target.classList.contains("semester-year")) {
    const source = card.dataset.kind === "semester" ? state.plan.semesters : card.dataset.kind === "elective" ? state.plan.electiveGroups : state.plan.proposal.semesters;
    if (card.dataset.kind === "elective") source[Number(card.dataset.groupIndex)].requiredHours = Number(event.target.value);
    else source[Number(card.dataset.groupIndex)].yearLabel = event.target.value;
    changed();
  }
  if (event.target.classList.contains("course-code-input")) courseSearch(event.target.value);
  const phaseRow = event.target.closest("[data-phase-kind]");
  if (phaseRow && event.target.matches("[data-phase-field]")) {
    const phase = phaseCollection(phaseRow.dataset.phaseKind)[Number(phaseRow.dataset.phaseIndex)];
    phase[event.target.dataset.phaseField] = event.target.type === "number" ? Number(event.target.value) : event.target.value;
    changed();
  }
});

document.addEventListener("change", (event) => {
  const row = event.target.closest(".course-row");
  if (row && event.target.matches("[data-dependency]")) updateDependency(row, event.target);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.classList.contains("course-code-input")) {
    event.preventDefault();
    const card = event.target.closest(".semester-card");
    addCodes(card.dataset.kind, Number(card.dataset.groupIndex), event.target.value);
  }
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
  state.plan.semesters.push({ number: state.plan.semesters.length + 1, name: `المستوى ${state.plan.semesters.length + 1}`, courses: [] });
  changed(true);
});
$("addPublishedPhaseButton").addEventListener("click", () => {
  phaseCollection("published").push({ label: "مرحلة التخصص", start: 1, end: state.plan.semesters.length });
  changed(true);
});
$("addProposalPhaseButton").addEventListener("click", () => {
  phaseCollection("proposal").push({ label: "مرحلة التخصص", start: 1, end: state.plan.proposal.semesters.length });
  changed(true);
});
$("addElectiveButton").addEventListener("click", () => {
  state.plan.electiveGroups ??= [];
  state.plan.electiveGroups.push({ id: `elective-group-${state.plan.electiveGroups.length + 1}`, name: "مجموعة اختيارية", requiredHours: 0, courses: [] });
  changed(true);
});
els.proposalEnabled.addEventListener("change", () => {
  state.plan.proposal = els.proposalEnabled.checked
    ? { title: "الخطة المقترحة", showGuide: true, semesters: [{ number: 1, name: "المستوى الأول", courses: [] }] }
    : null;
  changed(true);
});
els.guideEnabled.addEventListener("change", () => {
  state.plan.proposal.showGuide = els.guideEnabled.checked;
  changed();
});
$("addProposalSemesterButton").addEventListener("click", () => {
  const semesters = state.plan.proposal.semesters;
  semesters.push({ number: semesters.length + 1, name: `المستوى ${semesters.length + 1}`, courses: [] });
  changed(true);
});
$("addSummerButton").addEventListener("click", () => {
  const semesters = state.plan.proposal.semesters;
  if (semesters.length >= 9) return setStatus("أضيف الفصل الصيفي بالفعل.", "error");
  while (semesters.length < 8) semesters.push({ number: semesters.length + 1, name: `المستوى ${semesters.length + 1}`, courses: [] });
  semesters.push({ number: 9, name: "الفصل الصيفي", yearLabel: "فصل صيفي", courses: [] });
  changed(true);
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
els.zoom.addEventListener("input", () => {
  els.previewHost.style.setProperty("--zoom", String(Number(els.zoom.value) / 100));
});
window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) return;
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
