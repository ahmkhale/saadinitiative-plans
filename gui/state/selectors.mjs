export function selectedInstitution(state) {
  return state.institutions.find(
    (institution) => institution.id === state.selectedInstitutionId,
  ) ?? null;
}

export function selectedCollege(state) {
  return state.colleges.find((college) => college.id === state.selectedCollegeId) ?? null;
}
