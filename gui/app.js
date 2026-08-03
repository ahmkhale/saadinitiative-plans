import { state } from "./gui/state/store.mjs";
import { selectedCollege } from "./gui/state/selectors.mjs";
import { request } from "./gui/api-client.mjs";
import { courseBadges, renderCourseRow } from "./gui/course-view.mjs";
import { createEntityActions } from "./gui/entity-actions.mjs";
import { createSharedSourceEditors } from "./gui/shared-source-editors.mjs";
import { createPlanEditorView } from "./gui/plan-editor-view.mjs";
import { createDialogController } from "./gui/dialog.mjs";
import { escapeHtml } from "./gui/html.mjs";
import { renderNavigation as renderNavigationView } from "./gui/navigation-view.mjs";
import { createPreviewController } from "./gui/preview-controller.mjs";
import { createExportController } from "./gui/export-controller.mjs";
import { createColorEditor } from "./gui/color-editor.mjs";
import { createProposalPlaceholderActions } from "./gui/proposal-placeholder-actions.mjs";
import { classifyRequirementCourses } from "./src/domain/course-requirements.mjs";
import {
  createProposalFromPublished,
  createProposalSemester,
  dropProposalCourse,
  moveItem,
  moveProposalCourse as applyProposalCourseMove,
  resetProposalToPublished,
} from "./gui/proposal-actions.mjs";
import {
  buildPublishedDecisionSemesters,
  compareCourseEntries,
  composeParentTrackPlan,
  createCourseEntry,
  entryCode,
  entryId,
  normalizedEntry,
  parseCodes,
  reconcileProposalDraft,
  removeCourseEntry,
  scopeFromFields as buildScopeFromFields,
  scopeTarget,
  semesterLabel,
  sortPublishedCollections,
  sourceAppliesToSelection as appliesToSelection,
} from "./gui/plan-model.mjs";

const $ = (id) => document.getElementById(id);

const els = {
  welcome: $("welcome"),
  editorContent: $("editorContent"),
  institutionList: $("institutionList"),
  collegeList: $("collegeList"),
  majorList: $("majorList"),
  catalogCount: $("catalogCount"),
  catalogPath: $("catalogPath"),
  catalogModified: $("catalogModified"),
  catalogConflicts: $("catalogConflicts"),
  unresolvedCount: $("unresolvedCount"),
  saveState: $("saveState"),
  contextTrail: $("contextTrail"),
  globalStatus: $("globalStatus"),
  planHeading: $("planHeading"),
  semesterList: $("semesterList"),
  inheritedSemesterList: $("inheritedSemesterList"),
  electiveList: $("electiveList"),
  proposalSemesterList: $("proposalSemesterList"),
  proposalEnabled: $("proposalEnabled"),
  proposalEditor: $("proposalEditor"),
  previewHost: $("previewHost"),
  previewDimensions: $("previewDimensions"),
  diagnosticList: $("diagnosticList"),
  diagnosticCount: $("diagnosticCount"),
  diagnosticLabel: $("diagnosticLabel"),
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
  generateInstitutionButton: $("generateInstitutionButton"),
  sharedSetChoices: $("sharedSetChoices"),
  sharedSetList: $("sharedSetList"),
  sharedSetEditor: $("sharedSetEditor"),
  sharedSetEditorTitle: $("sharedSetEditorTitle"),
  sharedSetName: $("sharedSetName"),
  sharedSetId: $("sharedSetId"),
  sharedSetPhase: $("sharedSetPhase"),
  sharedSetScopeType: $("sharedSetScopeType"),
  sharedSetScopeTarget: $("sharedSetScopeTarget"),
  sharedSemesterList: $("sharedSemesterList"),
  sharedElectiveSourceList: $("sharedElectiveSourceList"),
  sharedElectiveSourceEditor: $("sharedElectiveSourceEditor"),
  sharedElectiveSourceEditorTitle: $("sharedElectiveSourceEditorTitle"),
  saveSharedElectiveSourceButton: $("saveSharedElectiveSourceButton"),
  sharedElectiveSourceName: $("sharedElectiveSourceName"),
  sharedElectiveSourceId: $("sharedElectiveSourceId"),
  sharedElectiveSourceHours: $("sharedElectiveSourceHours"),
  sharedElectiveScopeType: $("sharedElectiveScopeType"),
  sharedElectiveScopeTarget: $("sharedElectiveScopeTarget"),
  sharedElectiveExcludePublished: $("sharedElectiveExcludePublished"),
  sharedElectiveValidation: $("sharedElectiveValidation"),
  sharedElectiveCourseList: $("sharedElectiveCourseList"),
  colorList: $("colorList"),
  colorForm: $("colorForm"),
  colorSubject: $("colorSubject"),
  colorValue: $("colorValue"),
};

const { askForm, bind: bindDialog } = createDialogController({ els, escapeHtml });

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
  return selectedCollege(state);
}

function institutionApi(suffix = "") {
  if (!state.selectedInstitutionId) throw new Error("اختر جامعة أولًا.");
  return `/api/institutions/${encodeURIComponent(state.selectedInstitutionId)}${suffix}`;
}

function renderNavigation() {
  renderNavigationView({ state, els, activeCollege, escapeHtml });
}

async function loadState() {
  const query = state.selectedInstitutionId
    ? `?institutionId=${encodeURIComponent(state.selectedInstitutionId)}`
    : "";
  const result = await request(`/api/state${query}`);
  state.institutions = result.institutions ?? [];
  state.selectedInstitutionId = result.selectedInstitutionId ?? "";
  state.colleges = result.colleges;
  state.settings = result.settings;
  state.courseColors = result.colors ?? {};
  state.sharedSemesterSets = result.sharedSemesterSets ?? [];
  state.sharedElectiveGroups = result.sharedElectiveGroups ?? [];
  $("globalEdition").value = state.settings.edition;
  $("globalRelease").value = state.settings.release;
  $("globalCourseGuidePages").value = state.settings.courseGuidePages;
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
    state.selectedTrackId = "";
    state.parentPlan = null;
  }
  renderNavigation();
  renderSharedSets();
  renderSharedSetEditor();
  renderCourseColors();
}

async function selectInstitution(id) {
  if (state.dirty && !await confirmDiscard()) return;
  state.selectedInstitutionId = id;
  state.selectedCollegeId = "";
  state.selectedMajorId = "";
  state.selectedTrackId = "";
  state.plan = null;
  state.parentPlan = null;
  showEditor(false);
  await loadState();
}

async function selectCollege(id) {
  if (state.dirty && !await confirmDiscard()) return;
  state.selectedCollegeId = id;
  state.selectedMajorId = "";
  state.selectedTrackId = "";
  state.plan = null;
  state.parentPlan = null;
  showEditor(false);
  renderNavigation();
}

async function selectMajor(id, trackId = null) {
  if (state.dirty && !await confirmDiscard()) return;
  const major = activeCollege()?.majors?.find((item) => item.id === id);
  const selectedTrackId = trackId ?? "";
  const suffix = selectedTrackId
    ? `/colleges/${encodeURIComponent(state.selectedCollegeId)}/majors/${encodeURIComponent(id)}/tracks/${encodeURIComponent(selectedTrackId)}`
    : `/colleges/${encodeURIComponent(state.selectedCollegeId)}/majors/${encodeURIComponent(id)}`;
  const result = await request(institutionApi(suffix));
  state.selectedMajorId = id;
  state.selectedTrackId = result.plan.track?.id ?? "";
  state.plan = result.plan;
  state.parentPlan = result.parentPlan ?? null;
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

function newCourseEntry(kind, index, code) {
  return createCourseEntry({
    kind,
    index,
    code,
    plan: state.plan,
    sharedSetDraft: state.sharedSetDraft,
    sharedElectiveDraft: state.sharedElectiveDraft,
  });
}

function sourceAppliesToSelection(source) {
  return appliesToSelection(source, {
    institutionId: state.selectedInstitutionId,
    collegeId: state.selectedCollegeId,
    majorId: state.selectedMajorId,
  });
}

function scopeFromFields(type, target) {
  return buildScopeFromFields(type, target, state.selectedInstitutionId);
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
    item.courses.map((entry) => [entryId(entry), normalizedEntry(entry)])
  )));
  return [
    ...(semester.courseOrder ?? []).map((courseId) => ({
      ...(parentEntries.get(courseId) ?? { id: courseId, code: courseId }),
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

function compareCodes(left, right) {
  return compareCourseEntries(left, right);
}

function editorPublishedPlan() {
  return composeParentTrackPlan(state.parentPlan, state.plan);
}

function publishedDecisionSemesters() {
  return buildPublishedDecisionSemesters(editorPublishedPlan(), state.sharedSemesterSets);
}

function syncProposalWithPublished() {
  if (!state.parentPlan) {
    reconcileProposalDraft(state.plan, state.sharedSemesterSets);
    return;
  }
  const composed = editorPublishedPlan();
  reconcileProposalDraft(composed, state.sharedSemesterSets);
  state.plan.proposal = composed.proposal;
}

function resolvedCollection(kind, index) {
  if (kind === "shared") return state.sharedSetResolved?.semesters?.[index]?.courses ?? [];
  if (kind === "sharedElective") return state.sharedElectiveResolved?.electiveGroups?.[0]?.courses ?? [];
  if (!state.resolved) return [];
  if (kind === "semester") {
    const inheritedCount = publishedDecisionSemesters().length - state.plan.semesters.length;
    return state.resolved.semesters?.[inheritedCount + index]?.courses ?? [];
  }
  if (kind === "elective") {
    const inheritedElectiveCount = state.parentPlan?.electiveGroups?.length ?? 0;
    return state.resolved.electiveGroups?.[inheritedElectiveCount + index]?.courses ?? [];
  }
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

function courseRow(entry, resolved, kind, groupIndex, courseIndex) {
  const electiveGroupName = kind === "sharedElective"
    ? state.sharedElectiveDraft?.name
    : kind === "elective"
      ? state.resolved?.electiveGroups?.[groupIndex]?.name
        ?? state.plan.electiveGroups?.[groupIndex]?.name
      : null;
  return renderCourseRow({
    entry,
    resolved,
    kind,
    groupIndex,
    courseIndex,
    plan: state.plan,
    fallbackCourses: fallbackCoursesFor(kind),
    electiveGroupName,
    escapeHtml,
  });
}

const {
  renderCollection,
  renderEditorCore,
  renderElectives,
} = createPlanEditorView({
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
  sortPublishedCollections: () => sortPublishedCollections(state.plan),
  syncProposalWithPublished,
});

const {
  changed,
  refreshPreview,
  releasePreviewUrls,
  schedulePreview,
} = createPreviewController({
  state,
  els,
  request,
  setDirty,
  setStatus,
  syncProposalWithPublished,
  renderEditor: () => renderEditor(),
  escapeHtml,
  resolvedCollection,
  collection,
  entryCode,
  courseBadges,
});

const { render: renderCourseColors } = createColorEditor({
  container: els.colorList,
  form: els.colorForm,
  subjectInput: els.colorSubject,
  colorInput: els.colorValue,
  state,
  request,
  setStatus,
  schedulePreview,
});
const {
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
} = createSharedSourceEditors({
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
});

function renderEditor() {
  renderEditorCore();
  renderSharedSets();
  renderSharedElectiveSources();
}
function addCodes(kind, index, value) {
  const target = collection(kind, index);
  const existing = new Set(target.map((entry) => entryCode(entry).replace(/\s+/gu, " ").trim().toLocaleLowerCase("ar")));
  for (const code of parseCodes(value)) {
    const key = code.replace(/\s+/gu, " ").trim().toLocaleLowerCase("ar");
    if (!existing.has(key)) {
      target.push(newCourseEntry(kind, index, code));
      existing.add(key);
    }
  }
  if (kind === "shared") sharedChanged(true);
  else if (kind === "sharedElective") sharedElectiveChanged(true);
  else if (kind === "elective") {
    sortPublishedCollections(state.plan);
    changed();
    renderElectives();
  } else changed(true);
}



const { bind: bindExport, savePlan } = createExportController({
  state,
  els,
  request,
  institutionApi,
  setDirty,
  loadState,
  renderEditor,
  setStatus,
  exportOptions: () => ({ keepSvg: $("keepSvg").checked, png: $("exportPng").checked }),
});

async function confirmDiscard() {
  return Boolean(await askForm({
    title: "تغييرات غير محفوظة",
    message: "ستُفقد التغييرات التي لم تحفظها إذا انتقلت الآن.",
    submit: "ترك التغييرات",
    danger: true,
  }));
}

const {
  addInstitution,
  editInstitution,
  deleteInstitution,
  addCollege,
  editCollege,
  deleteCollege,
  addMajor,
  addTrack,
  duplicateMajor,
  deleteTrack,
  deleteMajor,
} = createEntityActions({
  state,
  request,
  askForm,
  setStatus,
  setDirty,
  loadState,
  selectMajor,
  showEditor,
  institutionApi,
});

const { addPlaceholder, editPlaceholder } = createProposalPlaceholderActions({
  state,
  askForm,
  changed,
  setStatus,
});
bindExport();

function updateManualFact(row, input) {
  const target = collection(row.dataset.kind, Number(row.dataset.groupIndex));
  const code = entryCode(target[Number(row.dataset.courseIndex)]);
  const fallbacks = fallbackCoursesFor(row.dataset.kind);
  const fallback = fallbacks[code] ?? {};
  const manuallyEditedFields = new Set(fallback.manuallyEditedFields ?? []);
  if (input.value === "") {
    delete fallback[input.dataset.manualFact];
    manuallyEditedFields.delete(input.dataset.manualFact);
  } else {
    fallback[input.dataset.manualFact] = input.type === "number" ? Number(input.value) : input.value;
    manuallyEditedFields.add(input.dataset.manualFact);
  }
  fallback.source = manuallyEditedFields.size ? "manual" : fallback.source ?? "catalog";
  fallback.manuallyEditedFields = [...manuallyEditedFields];
  fallbacks[code] = fallback;
  if (row.dataset.kind === "shared") sharedChanged();
  else if (row.dataset.kind === "sharedElective") sharedElectiveChanged();
  else changed();
}
function updateDependency(row, input) {
  const target = collection(row.dataset.kind, Number(row.dataset.groupIndex));
  const index = Number(row.dataset.courseIndex);
  const entry = normalizedEntry(target[index]);
  if (input.dataset.dependency === "requirements") {
    const sameLevelCourses = ["semester", "shared"].includes(row.dataset.kind) ? target : [];
    const classified = classifyRequirementCourses(parseCodes(input.value), sameLevelCourses);
    for (const key of ["prerequisites", "corequisites", "forcedCorequisites", "prerequisiteAlternatives"]) {
      if (classified[key].length) entry[key] = classified[key]; else delete entry[key];
    }
  } else if (input.dataset.dependency === "minimumCompletedCredits") {
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
  const changedPosition = applyProposalCourseMove({
    proposal: state.plan.proposal,
    publishedSemesters: publishedDecisionSemesters(),
    fromIndex: Number(row.dataset.groupIndex),
    courseId: row.dataset.courseCode,
    action,
  });
  if (changedPosition) changed(true);
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
  const institution = event.target.closest("[data-institution]");
  if (institution) {
    selectInstitution(institution.dataset.institution)
      .catch((error) => setStatus(error.message, "error"));
  }
  const college = event.target.closest("[data-college]");
  if (college) selectCollege(college.dataset.college).catch((error) => setStatus(error.message, "error"));
  const track = event.target.closest("[data-major-track]");
  if (track) {
    selectMajor(track.dataset.majorTrack, track.dataset.track).catch((error) => setStatus(error.message, "error"));
  } else {
    const parent = event.target.closest("[data-major-parent]");
    if (parent) {
      selectMajor(parent.dataset.majorParent).catch((error) => setStatus(error.message, "error"));
      return;
    }
    const major = event.target.closest("[data-major]");
    if (major) selectMajor(major.dataset.major).catch((error) => setStatus(error.message, "error"));
  }
  if (event.target.closest(".open-parent-plan")) {
    selectMajor(state.selectedMajorId).catch((error) => setStatus(error.message, "error"));
    return;
  }
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
    moveItem(source, Number(card.dataset.groupIndex), event.target.closest(".move-up") ? -1 : 1);
    if (card.dataset.kind === "shared") sharedChanged(true);
    else changed(true);
  }

  const row = event.target.closest(".course-row");

  if (row?.dataset.kind === "proposal") {
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
      const target = collection(row.dataset.kind, Number(row.dataset.groupIndex));
      removeCourseEntry(target, Number(row.dataset.courseIndex), row.dataset.kind === "sharedElective" ? state.sharedElectiveDraft.fallbackCourses : null);
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
      await request(institutionApi(`/shared-semester-sources/${encodeURIComponent(sharedSet.dataset.sharedSet)}/duplicate`), { method: "POST", body: JSON.stringify(values) });
      await loadState();
    }).catch((error) => setStatus(error.message, "error"));
  }
  if (sharedSet && event.target.closest(".delete-shared-set")) {
    request(institutionApi(`/shared-semester-sources/${encodeURIComponent(sharedSet.dataset.sharedSet)}`), { method: "DELETE" })
      .then(loadState).catch((error) => setStatus(error.message, "error"));
  }
  const sharedSetChoice = event.target.closest("[data-shared-set-choice-row]");
  if (sharedSetChoice && (event.target.closest(".shared-set-order-up") || event.target.closest(".shared-set-order-down"))) {
    if (moveItem(state.plan.sharedSemesterSets, state.plan.sharedSemesterSets.indexOf(sharedSetChoice.dataset.sharedSetChoiceRow), event.target.closest(".shared-set-order-up") ? -1 : 1)) changed(true);
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
        await request(institutionApi(`/shared-elective-sources/${encodeURIComponent(id)}/duplicate`), { method: "POST", body: JSON.stringify(values) });
        await loadState();
        renderSharedElectiveSources();
      }).catch((error) => setStatus(error.message, "error"));
    }
    if (event.target.closest(".delete-shared-elective-source")) {
      request(institutionApi(`/shared-elective-sources/${encodeURIComponent(id)}`), { method: "DELETE" })
        .then(async () => { await loadState(); renderSharedElectiveSources(); })
        .catch((error) => setStatus(error.message, "error"));
    }
  }
});

document.addEventListener("input", (event) => {
  if (["sharedElectiveSourceName", "sharedElectiveSourceId", "sharedElectiveSourceHours", "sharedElectiveScopeTarget"].includes(event.target.id) && state.sharedElectiveDraft) {
    state.sharedElectiveDraft.name = els.sharedElectiveSourceName.value;
    state.sharedElectiveDraft.id = els.sharedElectiveSourceId.value;
    state.sharedElectiveDraft.requiredHours = Number(els.sharedElectiveSourceHours.value);
    state.sharedElectiveDraft.scope = scopeFromFields(
      els.sharedElectiveScopeType.value,
      els.sharedElectiveScopeTarget.value,
    );
    state.sharedElectiveDirty = true;
    els.sharedElectiveSourceEditorTitle.textContent = state.sharedElectiveDraft.name || "مجموعة اختيارية جديدة";
    scheduleSharedElectiveResolution();
    return;
  }
  if (["sharedSetName", "sharedSetId", "sharedSetPhase", "sharedSetScopeTarget"].includes(event.target.id) && state.sharedSetDraft) {
    state.sharedSetDraft.name = els.sharedSetName.value;
    state.sharedSetDraft.id = els.sharedSetId.value;
    state.sharedSetDraft.phaseLabel = els.sharedSetPhase.value;
    state.sharedSetDraft.scope = scopeFromFields(
      els.sharedSetScopeType.value,
      els.sharedSetScopeTarget.value,
    );
    state.sharedSetDirty = true;
    els.sharedSetEditorTitle.textContent = state.sharedSetDraft.name || "خطة مشتركة جديدة";
    return;
  }
  const field = event.target.closest("[data-field]");
  if (field && state.plan) {
    state.plan[field.dataset.field] = field.type === "number" ? Number(field.value) : field.value;
    els.planHeading.textContent = state.plan.track?.name
      ? `${state.plan.major} — ${state.plan.track.name}`
      : `${state.plan.major} — الخطة الأساسية`;
    changed();
  }
  const card = event.target.closest(".semester-card");
  if (card?.dataset.kind === "elective" && event.target.classList.contains("semester-name")) {
    state.plan.electiveGroups[Number(card.dataset.groupIndex)].name = event.target.value;
    changed();
  }

  if (event.target.classList.contains("course-code-input") || event.target.id === "sharedElectiveCourseInput") courseSearch(event.target.value);
});

document.addEventListener("change", (event) => {
  if (event.target.id === "sharedSetScopeType" && state.sharedSetDraft) {
    state.sharedSetDraft.scope = scopeFromFields(
      els.sharedSetScopeType.value,
      els.sharedSetScopeTarget.value,
    );
    state.sharedSetDirty = true;
  }
  if (event.target.id === "sharedElectiveScopeType" && state.sharedElectiveDraft) {
    state.sharedElectiveDraft.scope = scopeFromFields(
      els.sharedElectiveScopeType.value,
      els.sharedElectiveScopeTarget.value,
    );
    state.sharedElectiveDirty = true;
    scheduleSharedElectiveResolution();
  }
  if (event.target.id === "sharedElectiveExcludePublished" && state.sharedElectiveDraft) {
    state.sharedElectiveDraft.excludePublishedCourses = event.target.checked;
    state.sharedElectiveDirty = true;
    scheduleSharedElectiveResolution();
  }
});

document.addEventListener("change", (event) => {
  const row = event.target.closest(".course-row");
  if (row && event.target.matches("[data-manual-fact]")) updateManualFact(row, event.target);
  if (row && event.target.matches("[data-dependency]")) updateDependency(row, event.target);
  if (event.target.matches("[data-shared-set-choice]")) {
    const id = event.target.dataset.sharedSetChoice;
    if (!id) {
      state.plan.sharedSemesterSets = [];
    } else if (event.target.checked && !state.plan.sharedSemesterSets.includes(id)) {
      state.plan.sharedSemesterSets.push(id);
    } else if (!event.target.checked) {
      state.plan.sharedSemesterSets = state.plan.sharedSemesterSets.filter((selectedId) => selectedId !== id);
    }
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
  const targetIndex = Number(card.dataset.groupIndex);
  const moved = dropProposalCourse({
    proposal: state.plan.proposal,
    publishedSemesters: publishedDecisionSemesters(),
    fromIndex: payload.semesterIndex,
    targetIndex,
    courseId: payload.code,
  });
  if (moved) changed(true);
});

$("addInstitutionButton").addEventListener("click", () => addInstitution().catch((error) => setStatus(error.message, "error")));
$("editInstitutionButton").addEventListener("click", () => editInstitution().catch((error) => setStatus(error.message, "error")));
$("deleteInstitutionButton").addEventListener("click", () => deleteInstitution().catch((error) => setStatus(error.message, "error")));
$("addCollegeButton").addEventListener("click", () => addCollege().catch((error) => setStatus(error.message, "error")));
$("editCollegeButton").addEventListener("click", () => editCollege().catch((error) => setStatus(error.message, "error")));
$("deleteCollegeButton").addEventListener("click", () => deleteCollege().catch((error) => setStatus(error.message, "error")));
$("addMajorButton").addEventListener("click", () => addMajor().catch((error) => setStatus(error.message, "error")));
$("addTrackButton").addEventListener("click", () => addTrack().catch((error) => setStatus(error.message, "error")));
$("duplicateMajorButton").addEventListener("click", () => duplicateMajor().catch((error) => setStatus(error.message, "error")));
$("deleteTrackButton").addEventListener("click", () => deleteTrack().catch((error) => setStatus(error.message, "error")));
$("deleteMajorButton").addEventListener("click", () => deleteMajor().catch((error) => setStatus(error.message, "error")));
$("saveButton").addEventListener("click", () => savePlan().catch((error) => setStatus(error.message, "error")));
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
$("addSharedElectiveButton").addEventListener("click", () => addSharedElectiveReference().catch((error) => setStatus(error.message, "error")));
els.proposalEnabled.addEventListener("change", () => {
  state.plan.proposal = els.proposalEnabled.checked
    ? createProposalFromPublished(publishedDecisionSemesters())
    : null;
  changed(true);
});
$("addProposalSemesterButton").addEventListener("click", () => {
  state.plan.proposal.semesters.push(createProposalSemester("regular"));
  changed(true);
});
$("addProposalSummerButton").addEventListener("click", () => {
  state.plan.proposal.semesters.push(createProposalSemester("summer"));
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
  state.plan.proposal.semesters = resetProposalToPublished(state.plan.proposal, publishedDecisionSemesters());
  changed(true);
});
$("globalSettingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await request(institutionApi("/settings"), {
    method: "PUT",
    body: JSON.stringify({
      edition: $("globalEdition").value,
      release: $("globalRelease").value,
      courseGuidePages: $("globalCourseGuidePages").value,
    }),
  });
  state.settings = result.settings;
  setStatus("حُفظت إعدادات الإصدار.", "success");
  schedulePreview(0);
});
$("resetSettingsButton").addEventListener("click", () => {
  $("globalEdition").value = state.settings.edition;
  $("globalRelease").value = state.settings.release;
  $("globalCourseGuidePages").value = state.settings.courseGuidePages;
});
$("addSharedSetButton").addEventListener("click", () => openSharedSetEditor());
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
  state.sharedElectiveDraft.courses.push(...codes.map((code) => newCourseEntry("sharedElective", 0, code)));
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

bindDialog();

loadState().catch((error) => setStatus(error.message, "error"));
