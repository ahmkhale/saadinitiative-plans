export function renderNavigation({ state, els, activeCollege, escapeHtml }) {
  const selectedInstitution = state.institutions.find((item) => item.id === state.selectedInstitutionId);
  const selectedCollege = state.colleges.find((item) => item.id === state.selectedCollegeId);
  const selectedMajor = selectedCollege?.majors?.find((item) => item.id === state.selectedMajorId);
  const selectedTrack = selectedMajor?.tracks?.find((item) => item.id === state.selectedTrackId);
  els.generateInstitutionButton.disabled = !selectedInstitution;
  const selectedPlanName = selectedMajor
    ? selectedTrack?.name ?? "الخطة الأساسية"
    : null;
  els.contextTrail.textContent = [selectedInstitution?.name, selectedCollege?.name, selectedMajor?.major, selectedPlanName]
    .filter(Boolean)
    .join(" / ") || "اختر جامعة وكلية وتخصصًا";
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
    els.majorList.innerHTML = college.majors.map((major) => {
      const active = major.id === state.selectedMajorId;
      return `<div class="major-nav-group">
        <button class="nav-item ${active ? "active" : ""}" data-major="${escapeHtml(major.id)}" type="button">
          ${escapeHtml(major.major)}<small>${major.tracks?.length ?? 0} مسار · ${major.semesterCount} فصول أساسية</small>
        </button>
        ${active ? `<div class="track-nav-list">
          <button class="track-nav-item ${state.selectedTrackId ? "" : "active"}" data-major-parent="${escapeHtml(major.id)}" type="button">
            الخطة الأساسية<small>${major.parent?.semesterCount ?? major.semesterCount} فصول · تورّث لكل المسارات</small>
          </button>
          ${(major.tracks ?? []).map((track) => `
          <button class="track-nav-item ${track.id === state.selectedTrackId ? "active" : ""}" data-major-track="${escapeHtml(major.id)}" data-track="${escapeHtml(track.id)}" type="button">
            ${escapeHtml(track.name)}<small>${track.semesterCount} فصول${track.hasProposal ? " · له خطة مقترحة" : ""}</small>
          </button>`).join("")}</div>` : ""}
      </div>`;
    }).join("");
  }
}
