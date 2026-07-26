import {
  COLORS,
  COURSE_CARD_LAYOUT,
  ELECTIVE_LAYOUT,
  GUIDE_LAYOUT,
  PAGE_LAYOUT,
  SEMESTER_LAYOUT,
  calculateProposalPageLayout,
  calculatePublishedPageLayout,
  electiveGroupHeight,
  electiveGroupsHeight,
  electiveTop,
} from "./render-layout.mjs";
import { courseNameFit, measureText, prerequisiteFit } from "./text-measure.mjs";

function createRenderContext(prefix) {
  let sequence = 0;
  return Object.freeze({
    nextId(kind) {
      sequence += 1;
      return `${prefix}-${kind}-${sequence}`;
    },
  });
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

function displayNumber(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function clipped(value, max) {
  const characters = Array.from(String(value ?? ""));
  return characters.length <= max
    ? characters.join("")
    : `${characters.slice(0, Math.max(1, max - 1)).join("")}…`;
}

function text({
  x,
  y,
  value,
  size,
  weight = 400,
  anchor = "middle",
  fill = COLORS.black,
  direction = "rtl",
  opacity,
  transform,
  dominantBaseline = "middle",
  letterSpacing = 0,
  dataPart,
}) {
  const attributes = [
    `x="${x}"`,
    `y="${y}"`,
    `text-anchor="${anchor}"`,
    `fill="${fill}"`,
    `font-size="${size}"`,
    `font-weight="${weight}"`,
    `font-family="IBM Plex Sans Arabic, Noto Sans Arabic, Noto Sans, sans-serif"`,
    `direction="${direction}"`,
    `unicode-bidi="plaintext"`,
    `dominant-baseline="${dominantBaseline}"`,
    `letter-spacing="${letterSpacing}"`,
    `font-kerning="normal"`,
  ];
  if (dataPart) attributes.push(`data-part="${dataPart}"`);
  if (opacity !== undefined) attributes.push(`opacity="${opacity}"`);
  if (transform) attributes.push(`transform="${transform}"`);
  return `<text ${attributes.join(" ")}>${esc(value)}</text>`;
}

function textLines({
  x,
  y,
  lines,
  lineHeight,
  size,
  weight = 400,
  anchor = "middle",
  fill = COLORS.black,
  direction = "rtl",
}) {
  return lines.map((value, index) => text({
    x,
    y: y + index * lineHeight,
    value,
    size,
    weight,
    anchor,
    fill,
    direction,
  })).join("");
}

function roundedRectPath(x, y, width, height, radii) {
  const [topLeft, topRight, bottomRight, bottomLeft] = radii;
  return [
    `M${x + topLeft} ${y}`,
    `H${x + width - topRight}`,
    topRight ? `A${topRight} ${topRight} 0 0 1 ${x + width} ${y + topRight}` : "",
    `V${y + height - bottomRight}`,
    bottomRight ? `A${bottomRight} ${bottomRight} 0 0 1 ${x + width - bottomRight} ${y + height}` : "",
    `H${x + bottomLeft}`,
    bottomLeft ? `A${bottomLeft} ${bottomLeft} 0 0 1 ${x} ${y + height - bottomLeft}` : "",
    `V${y + topLeft}`,
    topLeft ? `A${topLeft} ${topLeft} 0 0 1 ${x + topLeft} ${y}` : "",
    "Z",
  ].filter(Boolean).join(" ");
}

function prerequisiteLabel(course) {
  const parts = [
    ...(course.prerequisites ?? []),
    ...(course.corequisites ?? []).map((value) => `${value} مرافق`),
    ...(course.prerequisiteConditions ?? []),
  ];
  if (course.minimumCompletedCredits !== null && course.minimumCompletedCredits !== undefined) {
    parts.push(`${course.minimumCompletedCredits} ساعة`);
  }
  return parts.join(" | ");
}

function renderCourseCard(context, course, x, y, options = {}) {
  const scale = options.scale ?? 1;
  const layout = COURSE_CARD_LAYOUT;
  const label = prerequisiteLabel(course);
  const color = course.color || COLORS.gray;
  const groupId = context.nextId("course-card");
  const parts = [`<g id="${groupId}" data-component="course-card" data-course-code="${esc(course.code)}" transform="translate(${x} ${y}) scale(${scale})">`];

  parts.push(`<rect data-part="course-body" x="${layout.body.x}" y="${layout.body.y}" width="${layout.body.width}" height="${layout.body.height}" rx="${layout.body.radius}" fill="${esc(color)}"/>`);
  parts.push(`<path data-part="academic-badge" d="${roundedRectPath(
    layout.academicBadge.x,
    layout.academicBadge.y,
    layout.academicBadge.width,
    layout.academicBadge.height,
    layout.academicBadge.radii,
  )}" fill="${COLORS.white}" opacity="0.5"/>`);

  for (let index = 0; index < 3; index += 1) {
    const metricX = layout.metrics.startX + index * (layout.metrics.width + layout.metrics.gap);
    parts.push(`<path data-part="metric-box" d="${roundedRectPath(
      metricX,
      layout.metrics.y,
      layout.metrics.width,
      layout.metrics.height,
      [layout.metrics.topRadius, layout.metrics.topRadius, 0, 0],
    )}" fill="${COLORS.white}" opacity="0.5"/>`);
  }

  if (course.isParentCourse) {
    parts.push(`<circle data-part="parent-marker" cx="${layout.parentMarker.cx}" cy="${layout.parentMarker.cy}" r="${layout.parentMarker.radius}" fill="${COLORS.parent}" stroke="${COLORS.white}" stroke-width="${layout.parentMarker.strokeWidth}"/>`);
  }
  if (course.isTrackSpecific) {
    parts.push(`<circle data-part="track-marker" cx="${layout.trackMarker.cx}" cy="${layout.trackMarker.cy}" r="${layout.trackMarker.radius}" fill="${COLORS.track}" stroke="${COLORS.trackStroke}" stroke-width="${layout.trackMarker.strokeWidth}"/>`);
  }
  if (course.isExtinct) {
    parts.push(`<circle data-part="extinct-marker" cx="${layout.extinctMarker.cx}" cy="${layout.extinctMarker.cy}" r="${layout.extinctMarker.radius}" fill="${COLORS.white}" stroke="${COLORS.black}" stroke-width="${layout.extinctMarker.strokeWidth}"/>`);
    parts.push(`<circle cx="${layout.extinctMarker.cx}" cy="${layout.extinctMarker.cy}" r="${layout.extinctMarker.innerRadius}" fill="${COLORS.black}"/>`);
  }

  if (label) {
    const labelValue = label;
    const desiredWidth = measureText(labelValue, 4.5, "bold") + layout.prerequisite.paddingX * 2;
    const labelWidth = Math.min(layout.prerequisite.maxWidth, Math.max(20, desiredWidth));
    const labelX = (layout.width - labelWidth) / 2;
    const fittedLabel = prerequisiteFit(labelValue, labelWidth - layout.prerequisite.paddingX * 2);
    parts.push(`<rect data-part="prerequisite-pill" x="${labelX}" y="${layout.prerequisite.y + 0.5}" width="${labelWidth}" height="${layout.prerequisite.height - 1}" rx="${layout.prerequisite.radius}" fill="${COLORS.white}" stroke="${esc(color)}" stroke-width="1"/>`);
    parts.push(text({
      x: layout.width / 2,
      y: 6,
      value: labelValue,
      size: fittedLabel.size,
      dataPart: "prerequisite-label",
      weight: 700,
    }));
  }

  parts.push(text({ x: 68.5, y: 12.5, value: displayNumber(course.academicHours, "0"), size: 10, weight: 700, direction: "ltr", opacity: 0.9 }));
  parts.push(text({ x: 38, y: 23.5, value: clipped(course.code, 18), size: 12, weight: 700, fill: COLORS.white }));
  const fittedName = courseNameFit(course.name);
  parts.push(text({
    x: 38,
    y: 35,
    value: course.name,
    size: fittedName.size,
    dataPart: "course-name",
    weight: 600,
    fill: COLORS.white,
  }));

  const metricValues = [course.exerciseHours, course.practicalHours, course.lectureHours];
  metricValues.forEach((value, index) => {
    const metricX = layout.metrics.startX + index * (layout.metrics.width + layout.metrics.gap);
    parts.push(text({
      x: metricX + layout.metrics.width / 2,
      y: 46,
      value: displayNumber(value),
      size: 5,
      weight: 700,
      direction: "ltr",
      opacity: 0.9,
    }));
  });

  parts.push("</g>");
  return parts.join("");
}

function renderSemesterSummary(semester, y) {
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

function courseRowBorder(y, height = SEMESTER_LAYOUT.height) {
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

function renderSemesterRow(context, semester, layoutEntry) {
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

function renderYearRails(semesterLayouts) {
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

function inferredPhases(plan) {
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

function renderVerticalRail({ x, y, width, height, label, fontSize = 5 }) {
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

function renderPhaseRails(plan, semesterLayouts) {
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

function renderLogo() {
  return [
    `<g data-component="saad-logo" transform="translate(545 25.9)">`,
    `<path fill="${COLORS.saad}" d="M12.2704 13.9335C12.2704 9.63227 15.7698 6.13294 20.071 6.13294C24.3723 6.13294 27.8716 9.63227 27.8716 13.9335H12.2704ZM20.071 0C12.3843 0 6.13294 6.2514 6.13294 13.9335H0V20.0665H6.13294C6.13294 21.7614 6.82096 23.2924 7.92817 24.4042C9.03993 25.5159 10.5709 26.1994 12.2659 26.1994V20.0665H34V13.9335C34.0045 6.2514 27.7531 0 20.071 0Z"/>`,
    text({ x: 17, y: 33, value: "مبادرة صاد", size: 8, weight: 600 }),
    "</g>",
  ].join("");
}

function renderHeader(plan, options = {}) {
  const proposal = options.proposal === true;
  const edition = plan.edition || "الطبعة الرابعة";
  const release = plan.release || (plan.version ? `إصدار ${plan.version}` : "إصدار 1.0");
  const title = proposal ? "الخطة المقترحة" : plan.major;
  const subtitle = proposal
    ? (options.parentMajor ?? plan.headerSubtitle ?? "")
    : (plan.headerSubtitle || (plan.degree ? `درجة ${plan.degree}` : "درجة البكالوريوس"));
  return [
    `<g data-component="header">`,
    `<rect x="15" y="26" width="80" height="40" rx="6" fill="${COLORS.white}" stroke="${COLORS.black}" stroke-width="0.8"/>`,
    text({ x: 55, y: 40.5, value: edition, size: 12, weight: 700 }),
    text({ x: 55, y: 56, value: release, size: 9, weight: 500 }),
    text({ x: 517, y: 40, value: title, size: 16, weight: 600, anchor: "start" }),
    text({ x: 517, y: 56.5, value: subtitle, size: 14, weight: 400, anchor: "start" }),
    renderLogo(),
    "</g>",
  ].join("");
}

function electiveCardsHeight(group) {
  return electiveGroupHeight(group);
}

function renderElectiveGroup(context, group, y) {
  const height = electiveCardsHeight(group);
  const summaryX = SEMESTER_LAYOUT.summaryX;
  const summaryWidth = ELECTIVE_LAYOUT.summaryWidth;
  const parts = [
    `<g data-component="elective-group">`,
    `<rect x="${SEMESTER_LAYOUT.courseAreaX}" y="${y}" width="${SEMESTER_LAYOUT.courseAreaWidth}" height="${height}" rx="4" fill="none" stroke="${COLORS.line}" stroke-width="0.5"/>`,
    `<path d="${roundedRectPath(summaryX, y, summaryWidth, ELECTIVE_LAYOUT.summaryHeaderHeight, [0, 4, 0, 0])}" fill="${COLORS.saadTint}"/>`,
    `<path d="${roundedRectPath(summaryX, y + ELECTIVE_LAYOUT.summaryHeaderHeight, summaryWidth, ELECTIVE_LAYOUT.summaryBodyHeight, [0, 0, 0, 4])}" fill="none" stroke="${COLORS.saadTint}" stroke-width="1"/>`,
    text({ x: summaryX + summaryWidth / 2, y: y + 15, value: group.name, size: 7, weight: 700, fill: COLORS.saad }),
    text({ x: summaryX + summaryWidth / 2, y: y + 39.5, value: group.requirementText ?? `إتمام ${group.requiredHours ?? 0} ساعات`, size: 6, weight: 700 }),
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

function renderElectiveGroups(context, groups, semesterLayouts) {
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

function telegramIcon(x, y) {
  return `<g transform="translate(${x} ${y}) scale(1)"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8.287 5.906q-1.168.486-4.666 2.01-.567.225-.595.442c-.03.243.275.339.69.47l.175.055c.408.133.958.288 1.243.294q.39.01.868-.32 3.269-2.206 3.374-2.23c.05-.012.12-.026.166.016s.042.12.037.141c-.03.129-1.227 1.241-1.846 1.817-.193.18-.33.307-.358.336a8 8 0 0 1-.188.186c-.38.366-.664.64.015 1.088.327.216.589.393.85.571.284.194.568.387.936.629q.14.092.27.187c.331.236.63.448.997.414.214-.02.435-.22.547-.82.265-1.417.786-4.486.906-5.751a1.4 1.4 0 0 0-.013-.315.34.34 0 0 0-.114-.217.53.53 0 0 0-.31-.093c-.3.005-.763.166-2.984 1.09" fill="${COLORS.black}"/></g>`;
}

function globeIcon(x, y) {
  return `<g transform="translate(${x} ${y}) scale(.6667)" fill="none" stroke="${COLORS.black}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></g>`;
}

function xIcon(x, y) {
  return `<g transform="translate(${x} ${y}) scale(.0533)"><path d="m236 0h46l-101 115 118 156h-92.6l-72.5-94.8-83 94.8h-46l107-123-113-148h94.9l65.5 86.6zm-16.1 244h25.5l-165-218h-27.4z" fill="${COLORS.black}"/></g>`;
}

function helpIcon(x, y) {
  return `<g transform="translate(${x} ${y}) scale(.6667)" fill="none" stroke="${COLORS.black}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></g>`;
}

function footerItem({ x, width, icon, title, value, href }) {
  const iconX = x + width - 16;
  return [
    `<a href="${esc(href)}" xlink:href="${esc(href)}" target="_blank">`,
    `<rect data-part="footer-hit-area" x="${x}" y="-5" width="${width}" height="27" fill="${COLORS.white}" fill-opacity="0"/>`,
    icon(iconX, 1.5),
    text({ x: iconX - 4, y: 4.2, value: title, size: 8.457, weight: 700, anchor: "start" }),
    text({ x: iconX - 4, y: 14.1, value, size: 8.457, weight: 400, anchor: "end", direction: "ltr" }),
    "</a>",
  ].join("");
}

function renderFooter(plan, y) {
  const copyright = plan.footer?.copyright || "مبادرة صاد. جميع الحقوق محفوظة للتصميم والهوية البصرية.";
  return [
    `<g data-component="footer">`,
    `<g transform="translate(0 ${y + 16})">`,
    footerItem({ x: 62.5, width: 119, icon: helpIcon, title: "للاستفسارات", value: "t.me/SaadInitiative?direct", href: "https://t.me/SaadInitiative?direct" }),
    footerItem({ x: 205.5, width: 97, icon: xIcon, title: "حساب مبادرة صاد", value: "x.com/saadinitiative", href: "https://x.com/saadinitiative" }),
    footerItem({ x: 326.5, width: 89, icon: globeIcon, title: "موقع مبادرة صاد", value: "saadinitiative.com", href: "https://saadinitiative.com" }),
    footerItem({ x: 439.5, width: 92, icon: telegramIcon, title: "قناة مبادرة صاد", value: "t.me/saadinitiative", href: "https://t.me/saadinitiative" }),
    "</g>",
    text({ x: PAGE_LAYOUT.width / 2, y: y + 56, value: copyright, size: 8.457, weight: 400, fill: COLORS.copyright }),
    `<rect x="0" y="${y + 78}" width="${PAGE_LAYOUT.width}" height="6" fill="${COLORS.saad}"/>`,
    "</g>",
  ].join("");
}

function line(x1, y1, x2, y2, stroke = COLORS.line, width = 0.8) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"/>`;
}

function renderGuide(context, y) {
  const demo = {
    code: "رمز المقرر",
    name: "اسم المقرر",
    academicHours: "س",
    lectureHours: "م",
    practicalHours: "ع",
    exerciseHours: "ت",
    prerequisites: ["متطلب سابق"],
    corequisites: [],
    prerequisiteConditions: [],
    minimumCompletedCredits: null,
    color: COLORS.black,
    isParentCourse: true,
    isTrackSpecific: true,
    isExtinct: true,
  };
  const rootX = GUIDE_LAYOUT.x;
  const cardX = 228.871826171875;
  const cardY = y;
  const scale = GUIDE_LAYOUT.cardScale;
  const parts = [renderCourseCard(context, demo, cardX, cardY, { scale })];

  parts.push(text({ x: 207.887, y: cardY + 17.156, value: "مقرر أب", size: 8.457286834716797, weight: 700, anchor: "start" }));
  parts.push(textLines({ x: 208.1985, y: cardY + 29.6, lines: ["يعد هذا المقرر متطلبًا سابقًا لمقررات في مستويات", "قادمة."], lineHeight: 10.5716, size: 8.457286834716797, anchor: "start" }));

  parts.push(text({ x: 208.6357, y: cardY + 87.633, value: "مقرر تابع للمسار", size: 8.457286834716797, weight: 700, anchor: "start" }));
  parts.push(textLines({ x: 208.1985, y: cardY + 100.08, lines: ["علامة تبين أن المقرر تابع للمسار الحالي، وتنطبق", "فقط على التخصصات التي تحوي مسارات."], lineHeight: 10.5716, size: 8.457286834716797, anchor: "start" }));

  parts.push(text({ x: 539.4849, y: cardY + 17.156, value: "الساعات الأكاديمية", size: 8.457286834716797, weight: 700, anchor: "start" }));
  parts.push(textLines({ x: 539.912, y: cardY + 29.6, lines: ["الساعات التي يتم اعتمادها في حساب", "المعدلات الدراسية والساعات التراكمية."], lineHeight: 10.5716, size: 8.457286834716797, anchor: "start" }));

  parts.push(text({ x: 539.6256, y: cardY + 87.633, value: "مقرر منقرض", size: 8.457286834716797, weight: 700, anchor: "start" }));
  parts.push(textLines({ x: 539.4146, y: cardY + 100.08, lines: ["لم يظهر المقرر خلال السنين الماضية ضمن", "المقررات المطروحة."], lineHeight: 10.5716, size: 8.457286834716797, anchor: "start" }));

  const headingY = cardY + 151;
  const details = [
    { x: 144.676, heading: "ساعات التمارين", lines: ["عدد ساعات التمارين أسبوعيًا."] },
    { x: 259.078, heading: "ساعات العملي", lines: ["عدد ساعات العملي أسبوعيًا."] },
    { x: 381.781, heading: "ساعات المحاضرة", lines: ["عدد ساعات المحاضرة أسبوعيًا."] },
    { x: 539.4095, heading: "الساعات الفعلية", lines: ["الساعات التي يتم تدريس المقرر فيها بشكل", "أسبوعي، وهي الساعات التي يتم اعتمادها", "في حساب الحرمان."] },
  ];
  details.forEach((item) => {
    parts.push(text({ x: item.x, y: headingY + 0.532, value: item.heading, size: 8.457286834716797, weight: 700, anchor: "start" }));
    parts.push(textLines({ x: item.x, y: cardY + 164.035, lines: item.lines, lineHeight: 10.5716, size: 8.457286834716797, anchor: "start" }));
  });

  const connectors = [
    [184.180908203125, 19.7333984375, 157.8693504333496, 19.7333984375, COLORS.line],
    [184.180908203125, 88.3310546875, 157.8693504333496, 88.3310546875, COLORS.line],
    [379.63812255859375, 19.7333984375, 314.7989273071289, 19.7333984375, COLORS.line],
    [440.71856689453125, 88.3310546875, 313.85926818847656, 88.3310546875, COLORS.line],
    [298.8240966796875, 142.833984375, 268.9120469375828, 97.99975489888675, COLORS.line],
    [460.45220947265625, 142.833984375, 280.9120404425703, 89.99975197172535, COLORS.saad],
    [180.422119140625, 142.833984375, 249.02011030747963, 98.66815537826915, COLORS.line],
    [64.83917236328125, 142.833984375, 229.28640100762095, 98.66815760134887, COLORS.line],
  ];
  connectors.forEach(([x1, y1, x2, y2, color]) => {
    parts.push(line(rootX + x1, cardY + y1, rootX + x2, cardY + y2, color, 0.9396985173225403));
  });
  return `<g data-component="course-guide">${parts.join("")}</g>`;
}

function pageSvg(parts, layout) {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${layout.width}pt" height="${layout.height}pt" viewBox="0 0 ${layout.width} ${layout.height}" data-page-width="${layout.width}" data-page-height="${layout.height}">`,
    ...parts,
    "</svg>",
  ].join("\n");
}

export function calculatePage(plan, options = {}) {
  return options.proposal
    ? calculateProposalPageLayout(plan)
    : calculatePublishedPageLayout(plan);
}

export function renderPlanSvg(plan) {
  const context = createRenderContext("published");
  const semesters = plan.semesters;
  const renderPlan = { ...plan, semesters };
  const layout = calculatePublishedPageLayout(renderPlan);
  const parts = [
    `<rect width="${layout.width}" height="${layout.height}" fill="${COLORS.white}"/>`,
    renderHeader(renderPlan),
  ];
  semesters.forEach((semester, index) => parts.push(renderSemesterRow(context, semester, layout.semesterLayouts[index])));
  parts.push(renderYearRails(layout.semesterLayouts), renderPhaseRails(renderPlan, layout.semesterLayouts));
  if (Array.isArray(plan.electiveGroups) && plan.electiveGroups.length) {
    parts.push(renderElectiveGroups(context, plan.electiveGroups, layout.semesterLayouts));
  }
  parts.push(renderFooter(plan, layout.footerY));
  return pageSvg(parts, layout);
}

export function renderProposalSvg(plan) {
  const proposal = plan.proposal;
  if (!proposal) throw new Error("The plan has no proposal page.");
  const context = createRenderContext("proposal");
  const renderPlan = { ...proposal, semesters: proposal.semesters };
  const layout = calculateProposalPageLayout(plan);
  const parts = [
    `<rect width="${layout.width}" height="${layout.height}" fill="${COLORS.white}"/>`,
    renderHeader(renderPlan, { proposal: true, parentMajor: plan.major }),
  ];
  proposal.semesters.forEach((semester, index) => parts.push(renderSemesterRow(context, semester, layout.semesterLayouts[index])));
  parts.push(renderYearRails(layout.semesterLayouts));
  parts.push(renderPhaseRails(renderPlan, layout.semesterLayouts));
  if (layout.includesGuide) parts.push(renderGuide(context, layout.guideY));
  parts.push(renderFooter(plan, layout.footerY));
  return pageSvg(parts, layout);
}

function pageInner(svg) {
  const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/u);
  if (!match) throw new Error("Could not combine generated SVG pages.");
  return match[1];
}

export function combineSvgPages(pages) {
  if (pages.length === 1) return pages[0];
  const dimensions = pages.map((svg) => {
    const match = svg.match(/data-page-width="([0-9.]+)" data-page-height="([0-9.]+)"/u);
    if (!match) throw new Error("Could not read generated SVG page dimensions.");
    return { width: Number(match[1]), height: Number(match[2]) };
  });
  const offsets = [];
  let cursor = 0;
  for (const page of dimensions) {
    offsets.push(cursor);
    cursor += page.height + PAGE_LAYOUT.pageGap;
  }
  const namedPages = dimensions.map((page, index) => `<inkscape:page x="0" y="${offsets[index]}" width="${page.width}" height="${page.height}"/>`).join("");
  const contents = pages.map((svg, index) => `<g data-page="${index + 1}" transform="translate(0 ${offsets[index]})">${pageInner(svg)}</g>`).join("\n");
  const firstPage = dimensions[0];
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" width="${firstPage.width}pt" height="${firstPage.height}pt" viewBox="0 0 ${firstPage.width} ${firstPage.height}">`,
    `<sodipodi:namedview pagecolor="#ffffff">${namedPages}</sodipodi:namedview>`,
    contents,
    "</svg>",
  ].join("\n");
}

export function renderPlanDocumentSvg(plan) {
  const pages = [renderPlanSvg(plan)];
  if (plan.proposal) pages.push(renderProposalSvg(plan));
  const pageLayouts = [calculatePublishedPageLayout(plan)];
  if (plan.proposal) pageLayouts.push(calculateProposalPageLayout(plan));
  return { svg: combineSvgPages(pages), pageCount: pages.length, pages, pageLayouts };
}
