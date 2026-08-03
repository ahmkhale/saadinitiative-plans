export const COURSE_GUIDE_PAGES = Object.freeze(["published", "proposal", "both"]);

export function normalizeCourseGuidePages(value = "proposal") {
  if (!COURSE_GUIDE_PAGES.includes(value)) {
    throw new Error("موضع دليل بطاقة المقرر غير صالح.");
  }
  return value;
}

export function courseGuideAppearsOn(value, page) {
  const pages = normalizeCourseGuidePages(value);
  return pages === "both" || pages === page;
}
