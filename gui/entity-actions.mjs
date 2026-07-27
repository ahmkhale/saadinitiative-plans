import { selectedInstitution, selectedCollege } from "./state/selectors.mjs";

export function createEntityActions({
  state,
  request,
  askForm,
  setStatus,
  setDirty,
  loadState,
  selectMajor,
  showEditor,
  institutionApi,
}) {
  async function addInstitution() {
    const values = await askForm({
      title: "إضافة جامعة",
      message: "سيُستخدم المعرّف في مسار ملفات الجامعة وفهارسها.",
      fields: [
        { name: "name", label: "اسم الجامعة" },
        { name: "id", label: "المعرّف الثابت", dir: "ltr" },
      ],
    });
    if (!values) return;
    const result = await request("/api/institutions", {
      method: "POST",
      body: JSON.stringify(values),
    });
    state.selectedInstitutionId = result.institution.id;
    state.selectedCollegeId = "";
    await loadState();
  }

  async function editInstitution() {
    const institution = selectedInstitution(state);
    if (!institution) return setStatus("اختر جامعة أولًا.", "error");
    const values = await askForm({
      title: "تعديل الجامعة",
      fields: [
        { name: "name", label: "اسم الجامعة", value: institution.name },
        { name: "id", label: "المعرّف الثابت", value: institution.id, dir: "ltr" },
      ],
    });
    if (!values) return;
    const result = await request(`/api/institutions/${encodeURIComponent(institution.id)}`, {
      method: "PUT",
      body: JSON.stringify(values),
    });
    state.selectedInstitutionId = result.institution.id;
    await loadState();
  }

  async function deleteInstitution() {
    const institution = selectedInstitution(state);
    if (!institution) return setStatus("اختر جامعة أولًا.", "error");
    const confirmed = await askForm({
      title: "حذف الجامعة",
      message: `ستُحذف جامعة «${institution.name}» وكلياتها وتخصصاتها. لا يمكن التراجع عن ذلك.`,
      submit: "حذف الجامعة",
      danger: true,
    });
    if (!confirmed) return;
    await request(`/api/institutions/${encodeURIComponent(institution.id)}`, { method: "DELETE" });
    state.selectedInstitutionId = "";
    state.selectedCollegeId = "";
    state.selectedMajorId = "";
    state.plan = null;
    setDirty(false);
    showEditor(false);
    await loadState();
  }

  async function addCollege() {
    if (!state.selectedInstitutionId) return setStatus("اختر جامعة أولًا.", "error");
    const values = await askForm({
      title: "إضافة كلية",
      message: "سيُستخدم المعرّف في مسار ملفات الخطط.",
      fields: [
        { name: "name", label: "اسم الكلية" },
        { name: "id", label: "المعرّف الثابت", dir: "ltr" },
      ],
    });
    if (!values) return;
    const result = await request(institutionApi("/colleges"), {
      method: "POST",
      body: JSON.stringify(values),
    });
    state.selectedCollegeId = result.college.id;
    await loadState();
  }

  async function editCollege() {
    const college = selectedCollege(state);
    if (!college) return setStatus("اختر كلية أولًا.", "error");
    const values = await askForm({
      title: "تعديل الكلية",
      fields: [
        { name: "name", label: "اسم الكلية", value: college.name },
        { name: "id", label: "المعرّف الثابت", value: college.id, dir: "ltr" },
      ],
    });
    if (!values) return;
    const result = await request(institutionApi(`/colleges/${encodeURIComponent(college.id)}`), {
      method: "PUT",
      body: JSON.stringify(values),
    });
    state.selectedCollegeId = result.college.id;
    await loadState();
    setStatus("حُدّثت بيانات الكلية.", "success");
  }

  async function deleteCollege() {
    const college = selectedCollege(state);
    if (!college) return setStatus("اختر كلية أولًا.", "error");
    const confirmed = await askForm({
      title: "حذف الكلية",
      message: `ستُحذف كلية «${college.name}» وجميع تخصصاتها وخططها. لا يمكن التراجع عن ذلك.`,
      submit: "حذف الكلية",
      danger: true,
    });
    if (!confirmed) return;
    await request(institutionApi(`/colleges/${encodeURIComponent(college.id)}`), { method: "DELETE" });
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
    const result = await request(institutionApi(`/colleges/${encodeURIComponent(state.selectedCollegeId)}/majors`), {
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
    const result = await request(institutionApi(`/colleges/${encodeURIComponent(state.selectedCollegeId)}/majors/${encodeURIComponent(state.selectedMajorId)}/duplicate`), {
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
    await request(institutionApi(`/colleges/${encodeURIComponent(state.selectedCollegeId)}/majors/${encodeURIComponent(state.selectedMajorId)}`), { method: "DELETE" });
    state.selectedMajorId = "";
    state.plan = null;
    setDirty(false);
    showEditor(false);
    await loadState();
  }

  return {
    addInstitution,
    editInstitution,
    deleteInstitution,
    addCollege,
    editCollege,
    deleteCollege,
    addMajor,
    duplicateMajor,
    deleteMajor,
  };
}
