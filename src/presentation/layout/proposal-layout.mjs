import { PAGE_LAYOUT } from "./tokens.mjs";
import { calculateSemesterLayouts, semesterCompositionBottom } from "./semester-layout.mjs";

export const GUIDE_LAYOUT = Object.freeze({
  x: 54.08795166015625,
  width: 485.8240966796875,
  height: 192.748779296875,
  cardX: 174.8,
  cardY: 0,
  cardScale: 1.9561071395874023,
  activityOutline: Object.freeze({
    x: 216.13067626953125,
    y: 81.7537841796875,
    width: 64.83919525146484,
    height: 16.914573669433594,
    radius: 3.758794069290161,
    strokeWidth: 0.9396985173225403,
  }),
});

export function calculateProposalPageLayout(plan) {
  const proposal = plan.proposal ?? plan;
  const semesters = proposal.semesters ?? [];
  const semesterLayouts = calculateSemesterLayouts(semesters);
  const semesterBottom = semesterCompositionBottom(semesterLayouts);
  const includesGuide = proposal.showGuide !== false;
  const guideY = includesGuide ? semesterBottom + PAGE_LAYOUT.sectionGap : null;
  const contentBottom = guideY === null ? semesterBottom : guideY + GUIDE_LAYOUT.height;
  const footerY = contentBottom + PAGE_LAYOUT.footerGap;
  return Object.freeze({
    width: PAGE_LAYOUT.width,
    height: footerY + PAGE_LAYOUT.footerHeight,
    footerY,
    contentBottom,
    semesterBottom,
    electivesY: null,
    electivesHeight: 0,
    guideY,
    guideHeight: includesGuide ? GUIDE_LAYOUT.height : 0,
    semesterCount: semesters.length,
    semesterLayouts,
    includesGuide,
  });
}
