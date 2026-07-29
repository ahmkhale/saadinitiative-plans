export const UNIVERSITY_REQUIREMENTS_NAME = "متطلبات الجامعة";

export function allowsUnknownActivityHours(groupName) {
  return String(groupName ?? "").trim() !== UNIVERSITY_REQUIREMENTS_NAME;
}
