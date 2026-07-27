import { COLORS, COURSE_CARD_LAYOUT, SEMESTER_LAYOUT } from "../layout/page-layout.mjs";
import { renderCourseCard } from "./course-card.mjs";
import { roundedRectPath, text } from "./primitives.mjs";

export function renderSemesterSummary(semester, y) {
  const { summaryX: x, summaryWidth: width } = SEMESTER_LAYOUT;
  const headerHeight = 17;
  const labelX = x + 50.18690490722656;
  const labelWidth = width - 50.18690490722656;
  const statX = x + 1.24298095703125;
  const parts = [
    `<g data-component="semester-summary">`,
    `<path data-part="summary-title" d="${roundedRectPath(x, y, width, headerHeight, [0, 4, 0, 0])}" fill="${COLORS.saad}"/>`,
    `<path data-part="summary-hours-label" d="${roundedRectPath(labelX, y + 17.1, labelWidth, 39.9, [0, 0, 4, 0])}" fill="${COLORS.saadTint}"/>`,
    `<rect x="${x}" y="${y + 56.43}" width="50.186916373174" height="0.57" fill="${COLORS.line}"/>`,
    `<line x1="${statX + 24.5}" y1="${y + 24}" x2="${statX + 24.5}" y2="${y + 50}" stroke="${COLORS.saadTint}" stroke-width="1"/>`,
    text({ x: x + width / 2, y: y + 8.5, value: semester.name, size: 8, weight: 700, fill: COLORS.white }),
    text({ x: statX + 12.25, y: y + 28, value: "تراكمية", size: 5, weight: 700 }),
    text({ x: statX + 12.25, y: y + 42, value: semester.cumulativeHours, size: 10, weight: 700, direction: "ltr" }),
    text({ x: statX + 36.75, y: y + 28, value: "فصلية", size: 5, weight: 700 }),
    text({ x: statX + 36.75, y: y + 42, value: semester.academicHours, size: 10, weight: 700, direction: "ltr" }),
    text({
      x: 0,
      y: 0,
      value: "الساعات",
      size: 5,
      weight: 700,
      transform: `translate(${labelX + labelWidth / 2} ${y + 37}) rotate(-90)`,
    }),
    "</g>",
  ];
  return parts.join("");
}

export function courseRowBorder(y, height = SEMESTER_LAYOUT.height) {
  const x = SEMESTER_LAYOUT.courseAreaX;
  const width = SEMESTER_LAYOUT.courseAreaWidth;
  const radius = SEMESTER_LAYOUT.cornerRadius;
  const path = [
    `M${x + radius} ${y}`,
    `H${x + width}`,
    `V${y + height}`,
    `H${x + radius}`,
    `A${radius} ${radius} 0 0 1 ${x} ${y + height - radius}`,
    `V${y + radius}`,
    `A${radius} ${radius} 0 0 1 ${x + radius} ${y}`,
    "Z",
  ].join(" ");
  return `<path data-part="course-row-border" d="${path}" fill="none" stroke="${COLORS.line}" stroke-width="${SEMESTER_LAYOUT.strokeWidth}"/>`;
}

export function renderSemesterRow(context, semester, layoutEntry) {
  const { y, courseBodyHeight } = layoutEntry;
  const courses = semester.courses;
  const parts = [
    `<g data-component="semester-row" data-row="${layoutEntry.semesterIndex + 1}" data-row-count="${layoutEntry.rowCount}" data-body-height="${courseBodyHeight}">`,
    courseRowBorder(y, courseBodyHeight),
  ];
  courses.forEach((course, courseIndex) => {
    const row = Math.floor(courseIndex / 6);
    const rowCourses = courses.slice(row * 6, row * 6 + 6);
    const indexInRow = courseIndex % 6;
    const rowWidth = rowCourses.length * COURSE_CARD_LAYOUT.width
      + Math.max(0, rowCourses.length - 1) * COURSE_CARD_LAYOUT.gap;
    const startX = COURSE_CARD_LAYOUT.rowRight - rowWidth;
    const column = semester.courseDisplayOrder !== "ltr"
      ? rowCourses.length - 1 - indexInRow
      : indexInRow;
    parts.push(renderCourseCard(
      context,
      course,
      startX + column * (COURSE_CARD_LAYOUT.width + COURSE_CARD_LAYOUT.gap),
      y + SEMESTER_LAYOUT.courseAreaPaddingTop
        + row * (COURSE_CARD_LAYOUT.height + SEMESTER_LAYOUT.courseRowGap),
    ));
  });
  parts.push(renderSemesterSummary(semester, y), "</g>");
  return parts.join("");
}

export function renderYearRails(semesterLayouts) {
  const parts = [];
  const semesterCount = semesterLayouts.length;
  const yearCount = Math.ceil(semesterCount / 2);
  for (let year = 0; year < yearCount; year += 1) {
    const startIndex = year * 2;
    const rowCount = Math.min(2, semesterCount - startIndex);
    const first = semesterLayouts[startIndex];
    const last = semesterLayouts[startIndex + rowCount - 1];
    const y = first.y;
    const height = last.bottom - first.y;
    const centerY = y + height / 2;
    parts.push(`<g data-component="year-rail">`);
    parts.push(`<rect x="${SEMESTER_LAYOUT.yearRailX}" y="${y}" width="${SEMESTER_LAYOUT.yearRailWidth}" height="${height}" rx="2" fill="${COLORS.saadTint}" stroke="${COLORS.saad}" stroke-width="1"/>`);
    if (rowCount === 1) {
      parts.push(text({ x: 0, y: 0, value: "نصف سنة", size: 5, weight: 700, fill: COLORS.saad, transform: `translate(${SEMESTER_LAYOUT.yearRailX + 6} ${centerY}) rotate(-90)` }));
    } else {
      parts.push(text({ x: SEMESTER_LAYOUT.yearRailX + 6, y: centerY - 4.5, value: year + 1, size: 8, weight: 700, fill: COLORS.saad, direction: "ltr" }));
      parts.push(text({ x: SEMESTER_LAYOUT.yearRailX + 6, y: centerY + 5, value: "سنة", size: 5, weight: 700, fill: COLORS.saad }));
    }
    parts.push("</g>");
  }
  return parts.join("");
}

export function inferredPhases(plan) {
  if (Array.isArray(plan.phases) && plan.phases.length) return plan.phases;
  const preparatory = plan.semesters.slice(0, 2).every((semester) => /تحضير/u.test(semester.yearLabel ?? ""));
  if (preparatory && plan.semesters.length > 2) {
    return [
      { label: "السنة التحضيرية", start: 1, end: 2 },
      { label: "التخصص", start: 3, end: plan.semesters.length },
    ];
  }
  return [{ label: "الخطة الدراسية", start: 1, end: plan.semesters.length }];
}

export function renderVerticalRail({ x, y, width, height, label, fontSize = 5 }) {
  return [
    `<g data-component="vertical-rail">`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2" fill="${COLORS.saadTint}" stroke="${COLORS.saad}" stroke-width="1"/>`,
    text({
      x: 0,
      y: 0,
      value: label,
      size: fontSize,
      weight: 700,
      fill: COLORS.saad,
      transform: `translate(${x + width / 2} ${y + height / 2}) rotate(-90)`,
    }),
    "</g>",
  ].join("");
}

export function renderPhaseRails(plan, semesterLayouts) {
  return inferredPhases(plan).map((phase) => {
    const start = Math.max(1, Number(phase.start ?? 1));
    const end = Math.min(plan.semesters.length, Number(phase.end ?? plan.semesters.length));
    const first = semesterLayouts[start - 1];
    const last = semesterLayouts[Math.max(start - 1, end - 1)];
    if (!first || !last) return "";
    return renderVerticalRail({
      x: SEMESTER_LAYOUT.phaseRailX,
      y: first.y,
      width: SEMESTER_LAYOUT.phaseRailWidth,
      height: last.bottom - first.y,
      label: phase.label,
    });
  }).join("");
}
