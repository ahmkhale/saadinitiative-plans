import { PAGE_LAYOUT } from "./tokens.mjs";
import { calculateSemesterLayouts, semesterCompositionBottom } from "./semester-layout.mjs";
import { electiveGroupsHeight, electiveTop } from "./elective-layout.mjs";

export { COLORS, COURSE_CARD_LAYOUT, PAGE_LAYOUT } from "./tokens.mjs";
export {
  calculateSemesterLayouts,
  semesterBodyHeight,
  semesterCompositionBottom,
  SEMESTER_LAYOUT,
} from "./semester-layout.mjs";
export {
  ELECTIVE_LAYOUT,
  electiveGroupHeight,
  electiveGroupsHeight,
  electiveTop,
} from "./elective-layout.mjs";
export { calculateProposalPageLayout, GUIDE_LAYOUT } from "./proposal-layout.mjs";

export function calculatePublishedPageLayout(plan) {
  const semesters = plan.semesters ?? [];
  const semesterLayouts = calculateSemesterLayouts(semesters);
  const groups = plan.electiveGroups ?? [];
  const semesterBottom = semesterCompositionBottom(semesterLayouts);
  const electivesY = groups.length ? electiveTop(semesterLayouts) : null;
  const electivesHeight = electiveGroupsHeight(groups);
  const contentBottom = electivesY === null ? semesterBottom : electivesY + electivesHeight;
  const footerY = contentBottom + PAGE_LAYOUT.footerGap;
  return Object.freeze({
    width: PAGE_LAYOUT.width,
    height: footerY + PAGE_LAYOUT.footerHeight,
    footerY,
    contentBottom,
    semesterBottom,
    electivesY,
    electivesHeight,
    guideY: null,
    guideHeight: 0,
    semesterCount: semesters.length,
    semesterLayouts,
  });
}
