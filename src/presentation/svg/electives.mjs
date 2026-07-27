import { COLORS, COURSE_CARD_LAYOUT, ELECTIVE_LAYOUT, SEMESTER_LAYOUT, electiveGroupHeight, electiveGroupsHeight, electiveTop } from "../layout/page-layout.mjs";
import { renderCourseCard } from "./course-card.mjs";
import { renderVerticalRail } from "./semester.mjs";
import { roundedRectPath, text } from "./primitives.mjs";

export function electiveCardsHeight(group) {
  return electiveGroupHeight(group);
}

export function renderElectiveGroup(context, group, y) {
  const height = electiveCardsHeight(group);
  const summaryX = SEMESTER_LAYOUT.summaryX;
  const summaryWidth = ELECTIVE_LAYOUT.summaryWidth;
  const parts = [
    `<g data-component="elective-group">`,
    `<rect x="${SEMESTER_LAYOUT.courseAreaX}" y="${y}" width="${SEMESTER_LAYOUT.courseAreaWidth}" height="${height}" rx="4" fill="none" stroke="${COLORS.line}" stroke-width="0.5"/>`,
    `<path d="${roundedRectPath(summaryX, y, summaryWidth, ELECTIVE_LAYOUT.summaryHeaderHeight, [0, 4, 0, 0])}" fill="${COLORS.saadTint}"/>`,
    `<path d="${roundedRectPath(summaryX, y + ELECTIVE_LAYOUT.summaryHeaderHeight, summaryWidth, ELECTIVE_LAYOUT.summaryBodyHeight, [0, 0, 0, 4])}" fill="none" stroke="${COLORS.saadTint}" stroke-width="1"/>`,
    text({ x: summaryX + summaryWidth / 2, y: y + 15, value: group.name, size: 7, weight: 700, fill: COLORS.saad }),
    text({ x: summaryX + summaryWidth / 2, y: y + 39.5, value: group.displayRequirement ?? group.requirementText ?? "", size: 6, weight: 700 }),
  ];

  group.courses.forEach((course, index) => {
    const row = Math.floor(index / 6);
    const rowCourses = group.courses.slice(row * 6, row * 6 + 6);
    const rowWidth = rowCourses.length * COURSE_CARD_LAYOUT.width
      + Math.max(0, rowCourses.length - 1) * COURSE_CARD_LAYOUT.gap;
    const startX = COURSE_CARD_LAYOUT.rowRight - rowWidth;
    const indexInRow = index % 6;
    const column = group.courseDisplayOrder !== "ltr"
      ? rowCourses.length - 1 - indexInRow
      : indexInRow;
    parts.push(renderCourseCard(
      context,
      course,
      startX + column * (COURSE_CARD_LAYOUT.width + COURSE_CARD_LAYOUT.gap),
      y + ELECTIVE_LAYOUT.padding + row * (COURSE_CARD_LAYOUT.height + ELECTIVE_LAYOUT.rowGap),
    ));
  });
  parts.push("</g>");
  return { svg: parts.join(""), height };
}

export function renderElectiveGroups(context, groups, semesterLayouts) {
  const y = electiveTop(semesterLayouts);
  const totalHeight = electiveGroupsHeight(groups);
  const parts = [renderVerticalRail({
    x: SEMESTER_LAYOUT.phaseRailX,
    y,
    width: SEMESTER_LAYOUT.phaseRailWidth,
    height: totalHeight,
    label: "مقررات اختيارية",
  })];
  let cursor = y;
  groups.forEach((group, index) => {
    const rendered = renderElectiveGroup(context, group, cursor);
    parts.push(rendered.svg);
    cursor += rendered.height + (index < groups.length - 1 ? ELECTIVE_LAYOUT.groupGap : 0);
  });
  return parts.join("");
}
