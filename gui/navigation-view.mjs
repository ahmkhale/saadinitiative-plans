export function renderNavigation({ state, els, activeCollege, escapeHtml }) {
  if (!state.institutions.length) {
    els.institutionList.className = "nav-list empty-list";
    els.institutionList.textContent = "لم تُضف جامعة بعد.";
  } else {
    els.institutionList.className = "nav-list";
    els.institutionList.innerHTML = state.institutions.map((institution) => `
      <button class="nav-item ${institution.id === state.selectedInstitutionId ? "active" : ""}" data-institution="${escapeHtml(institution.id)}" type="button">
        ${escapeHtml(institution.name)}<small>${escapeHtml(institution.id)} · ${institution.colleges.length} كلية</small>
      </button>
    `).join("");
  }
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
