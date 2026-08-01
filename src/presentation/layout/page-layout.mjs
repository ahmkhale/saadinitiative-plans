import { PAGE_LAYOUT } from "./tokens.mjs";
import { calculateSemesterLayouts, semesterCompositionBottom } from "./semester-layout.mjs";
import { electiveGroupsHeight, electiveTop } from "./elective-layout.mjs";
import { courseGuideAppearsOn } from "../../domain/course-guide.mjs";
import { GUIDE_LAYOUT } from "./proposal-layout.mjs";

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
  const sectionBottom = electivesY === null ? semesterBottom : electivesY + electivesHeight;
  const includesGuide = courseGuideAppearsOn(plan.courseGuidePages, "published");
  const guideY = includesGuide ? sectionBottom + PAGE_LAYOUT.sectionGap : null;
  const contentBottom = guideY === null ? sectionBottom : guideY + GUIDE_LAYOUT.height;
  const footerY = contentBottom + PAGE_LAYOUT.footerGap;
  return Object.freeze({
    width: PAGE_LAYOUT.width,
    height: footerY + PAGE_LAYOUT.footerHeight,
    footerY,
    contentBottom,
    semesterBottom,
    electivesY,
    electivesHeight,
    guideY,
    guideHeight: includesGuide ? GUIDE_LAYOUT.height : 0,
    includesGuide,
    semesterCount: semesters.length,
    semesterLayouts,
  });
}
