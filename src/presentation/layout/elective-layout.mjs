import { COURSE_CARD_LAYOUT, PAGE_LAYOUT } from "./tokens.mjs";
import { semesterCompositionBottom } from "./semester-layout.mjs";

export const ELECTIVE_LAYOUT = Object.freeze({
  topGap: 32,
  groupGap: 16,
  padding: 5,
  rowGap: 4,
  summaryWidth: 79.24298095703125,
  summaryHeaderHeight: 31,
  summaryBodyHeight: 17,
});

export function electiveGroupHeight(group) {
  const rows = Math.max(1, Math.ceil(group.courses.length / 6));
  return ELECTIVE_LAYOUT.padding * 2
    + rows * COURSE_CARD_LAYOUT.height
    + Math.max(0, rows - 1) * ELECTIVE_LAYOUT.rowGap;
}

export function electiveTop(semesterLayouts = []) {
  return semesterCompositionBottom(semesterLayouts) + ELECTIVE_LAYOUT.topGap;
}

export function electiveGroupsHeight(groups = []) {
  return groups.reduce((sum, group) => sum + electiveGroupHeight(group), 0)
    + Math.max(0, groups.length - 1) * ELECTIVE_LAYOUT.groupGap;
}
