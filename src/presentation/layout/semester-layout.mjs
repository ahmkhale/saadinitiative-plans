import { COURSE_CARD_LAYOUT, PAGE_LAYOUT } from "./tokens.mjs";

export const SEMESTER_LAYOUT = Object.freeze({
  height: 57,
  summaryHeight: 57,
  gap: 4,
  courseAreaPaddingTop: 4,
  courseAreaPaddingBottom: 4,
  courseRowGap: 4,
  courseAreaX: 28,
  courseAreaWidth: 471.75701904296875,
  summaryX: 499.75701904296875,
  summaryWidth: 65.24298858642578,
  yearRailX: 567,
  yearRailWidth: 12,
  phaseRailX: 15,
  phaseRailWidth: 10,
  cornerRadius: 4,
  strokeWidth: 0.5,
});

export function semesterBodyHeight(courseCount = 0) {
  const rowCount = Math.max(1, Math.ceil(Number(courseCount) / 6));
  return SEMESTER_LAYOUT.courseAreaPaddingTop
    + rowCount * COURSE_CARD_LAYOUT.height
    + (rowCount - 1) * SEMESTER_LAYOUT.courseRowGap
    + SEMESTER_LAYOUT.courseAreaPaddingBottom;
}

export function calculateSemesterLayouts(semesters = [], startY = PAGE_LAYOUT.contentTop) {
  let y = startY;
  return semesters.map((semester, semesterIndex) => {
    const courseCount = semester.courses?.length ?? 0;
    const rowCount = Math.max(1, Math.ceil(courseCount / 6));
    const courseBodyHeight = semesterBodyHeight(courseCount);
    const entry = Object.freeze({
      semesterIndex,
      y,
      rowCount,
      courseBodyHeight,
      summaryHeight: SEMESTER_LAYOUT.summaryHeight,
      bottom: y + courseBodyHeight,
    });
    y = entry.bottom + SEMESTER_LAYOUT.gap;
    return entry;
  });
}

export function semesterCompositionBottom(semesterLayouts = []) {
  if (!semesterLayouts.length) return PAGE_LAYOUT.innerY + PAGE_LAYOUT.headerHeight;
  return semesterLayouts.at(-1).bottom;
}
