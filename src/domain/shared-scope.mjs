const TYPES = new Set(["institution", "college", "majors"]);

export function normalizeSharedScope(scope) {
  const value = structuredClone(scope ?? {});
  if (!TYPES.has(value.type)) {
    throw new Error("Shared source scope must be institution, college, or majors.");
  }
  value.institutionId = String(value.institutionId ?? "").trim();
  if (!value.institutionId) throw new Error("Shared source scope requires institutionId.");
  if (value.type === "college") {
    value.collegeId = String(value.collegeId ?? "").trim();
    if (!value.collegeId) throw new Error("College-scoped source requires collegeId.");
  }
  if (value.type === "majors") {
    value.majorIds = Array.from(new Set(
      (value.majorIds ?? []).map((id) => String(id).trim()).filter(Boolean),
    ));
    if (!value.majorIds.length) throw new Error("Major-scoped source requires majorIds.");
  }
  return value;
}

export function scopeAllows(scope, context) {
  if (scope.institutionId !== context.institutionId) return false;
  if (scope.type === "institution") return true;
  if (scope.type === "college") return scope.collegeId === context.collegeId;
  return scope.majorIds.includes(context.majorId);
}
