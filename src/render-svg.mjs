const PAGE_WIDTH = 594;
const PAGE_HEIGHT = 1045;

const COLORS = Object.freeze({
  saad: "#00AEEF",
  saadTint: "#E6F7FD",
  line: "#B6CFE8",
  black: "#000000",
  gray: "#616161",
  white: "#FFFFFF",
  parent: "#FF0000",
  track: "#3BA521",
  trackStroke: "#FFF200",
});

const MAIN_TOP = 98;
const SEMESTER_HEIGHT = 57;
const SEMESTER_GAP = 4;
const SEMESTER_PITCH = SEMESTER_HEIGHT + SEMESTER_GAP;
const COURSE_AREA_X = 28;
const COURSE_AREA_WIDTH = 472;
const SUMMARY_X = COURSE_AREA_X + COURSE_AREA_WIDTH;
const SUMMARY_WIDTH = 66;
const YEAR_RAIL_X = 568;
const YEAR_RAIL_WIDTH = 11;
const PHASE_RAIL_X = 15;
const PHASE_RAIL_WIDTH = 10;

const CARD_WIDTH = 74;
const CARD_HEIGHT = 43;
const CARD_GAP = 3;
const CARD_RIGHT = SUMMARY_X - 5;

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function displayNumber(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function clipped(value, max) {
  const chars = Array.from(String(value ?? ""));
  return chars.length <= max ? chars.join("") : `${chars.slice(0, Math.max(1, max - 1)).join("")}…`;
}

function text({
  x,
  y,
  value,
  size,
  weight = 600,
  anchor = "middle",
  fill = COLORS.black,
  direction = "rtl",
  opacity,
  transform,
  letterSpacing,
  textLength,
}) {
  const actualAnchor = direction === "rtl"
    ? anchor === "start" ? "end" : anchor === "end" ? "start" : anchor
    : anchor;
  const fontFamily = weight >= 700
    ? "IBM Plex Sans Arabic"
    : weight >= 500
      ? "IBM Plex Sans Arabic SemiBold"
      : "IBM Plex Sans Arabic";
  const attributes = [
    `x="${x}"`,
    `y="${y}"`,
    `text-anchor="${actualAnchor}"`,
    `fill="${fill}"`,
    `font-size="${size}"`,
    `font-weight="${weight >= 700 ? 700 : 400}"`,
    `font-family="${fontFamily}, Noto Sans Arabic, Noto Sans, sans-serif"`,
    `direction="${direction}"`,
    `unicode-bidi="plaintext"`,
  ];
  if (opacity !== undefined) attributes.push(`opacity="${opacity}"`);
  if (transform) attributes.push(`transform="${transform}"`);
  if (letterSpacing !== undefined) attributes.push(`letter-spacing="${letterSpacing}"`);
  if (textLength !== undefined) {
    attributes.push(`textLength="${textLength}"`);
    attributes.push(`lengthAdjust="spacingAndGlyphs"`);
  }
  return `<text ${attributes.join(" ")}>${esc(value)}</text>`;
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

function courseNameSize(name) {
  const length = Array.from(String(name ?? "")).length;
  if (length <= 17) return 5.2;
  if (length <= 25) return 4.65;
  if (length <= 34) return 4.05;
  return 3.6;
}

function renderCourseCard(course, x, y, options = {}) {
  const scale = options.scale ?? 1;
  const label = prerequisiteLabel(course);
  const color = course.color || COLORS.gray;
  const parts = [`<g transform="translate(${x} ${y}) scale(${scale})">`];

  parts.push(`<rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="6" fill="${esc(color)}"/>`);
  parts.push(`<path d="M61 0h7a6 6 0 0 1 6 6v7H61z" fill="${COLORS.white}" opacity="0.52"/>`);

  const metricY = 37.4;
  const metricW = 7.2;
  const metricH = 5.6;
  const metricStart = 27.2;
  [0, 1, 2].forEach((index) => {
    parts.push(`<rect x="${metricStart + index * 8.5}" y="${metricY}" width="${metricW}" height="${metricH}" rx="0.6" fill="${COLORS.white}" opacity="0.50"/>`);
  });

  if (course.isParentCourse) {
    parts.push(`<circle cx="0.7" cy="4.1" r="4" fill="${COLORS.parent}" stroke="${COLORS.white}" stroke-width="0.85"/>`);
  }
  if (course.isTrackSpecific) {
    parts.push(`<circle cx="0.7" cy="39.1" r="4" fill="${COLORS.track}" stroke="${COLORS.trackStroke}" stroke-width="1.25"/>`);
  }
  if (course.isExtinct) {
    parts.push(`<circle cx="70.4" cy="39.1" r="4" fill="${COLORS.white}" stroke="${COLORS.black}" stroke-width="1"/>`);
    parts.push(`<circle cx="70.4" cy="39.1" r="1.9" fill="${COLORS.black}"/>`);
  }

  if (label) {
    const labelLength = Array.from(label).length;
    const labelWidth = Math.min(55, Math.max(22, labelLength * 2.22 + 7));
    const labelX = (CARD_WIDTH - labelWidth) / 2;
    parts.push(`<rect x="${labelX}" y="-4.8" width="${labelWidth}" height="9.8" rx="4.9" fill="${COLORS.white}" stroke="${esc(color)}" stroke-width="0.8"/>`);
    parts.push(text({ x: CARD_WIDTH / 2, y: 1.8, value: clipped(label, 24), size: labelLength > 18 ? 3.5 : 4, weight: 700, fill: COLORS.black }));
  }

  parts.push(text({ x: 66.1, y: 10.85, value: displayNumber(course.academicHours, "0"), size: 9.2, weight: 700, fill: COLORS.black, direction: "ltr", anchor: "middle" }));
  parts.push(text({ x: CARD_WIDTH / 2, y: 22.7, value: clipped(course.code, 16), size: 13.1, weight: 700, fill: COLORS.white }));
  parts.push(text({ x: CARD_WIDTH / 2, y: 32.2, value: clipped(course.name, 42), size: courseNameSize(course.name), weight: 500, fill: COLORS.white }));

  parts.push(text({ x: metricStart + metricW / 2, y: 42.0, value: displayNumber(course.exerciseHours), size: 4.3, weight: 700, fill: COLORS.black, direction: "ltr" }));
  parts.push(text({ x: metricStart + 8.5 + metricW / 2, y: 42.0, value: displayNumber(course.practicalHours), size: 4.3, weight: 700, fill: COLORS.black, direction: "ltr" }));
  parts.push(text({ x: metricStart + 17 + metricW / 2, y: 42.0, value: displayNumber(course.lectureHours), size: 4.3, weight: 700, fill: COLORS.black, direction: "ltr" }));

  parts.push(`</g>`);
  return parts.join("");
}

function semesterY(index) {
  return MAIN_TOP + index * SEMESTER_PITCH;
}

function renderSemesterSummary(semester, y) {
  const headerHeight = 17;
  const bodyY = y + headerHeight;
  const bodyHeight = SEMESTER_HEIGHT - headerHeight;
  const statWidth = 26;
  const labelWidth = SUMMARY_WIDTH - statWidth * 2;
  const parts = [
    `<g>`,
    `<rect x="${SUMMARY_X}" y="${y}" width="${SUMMARY_WIDTH}" height="${SEMESTER_HEIGHT}" rx="3" fill="${COLORS.white}" stroke="${COLORS.line}" stroke-width="0.65"/>`,
    `<path d="M${SUMMARY_X + 3} ${y}H${SUMMARY_X + SUMMARY_WIDTH - 3}a3 3 0 0 1 3 3v14H${SUMMARY_X}V${y + 3}a3 3 0 0 1 3-3z" fill="${COLORS.saad}"/>`,
    `<rect x="${SUMMARY_X}" y="${bodyY}" width="${statWidth}" height="${bodyHeight}" fill="${COLORS.white}"/>`,
    `<rect x="${SUMMARY_X + statWidth}" y="${bodyY}" width="${statWidth}" height="${bodyHeight}" fill="${COLORS.white}"/>`,
    `<rect x="${SUMMARY_X + statWidth * 2}" y="${bodyY}" width="${labelWidth}" height="${bodyHeight}" fill="${COLORS.saadTint}"/>`,
    `<line x1="${SUMMARY_X + statWidth}" y1="${bodyY}" x2="${SUMMARY_X + statWidth}" y2="${y + SEMESTER_HEIGHT}" stroke="${COLORS.line}" stroke-width="0.55"/>`,
    `<line x1="${SUMMARY_X + statWidth * 2}" y1="${bodyY}" x2="${SUMMARY_X + statWidth * 2}" y2="${y + SEMESTER_HEIGHT}" stroke="${COLORS.line}" stroke-width="0.55"/>`,
  ];

  parts.push(text({ x: SUMMARY_X + SUMMARY_WIDTH / 2 - 0.6, y: y + 10.7, value: semester.name, size: 8, weight: 700, fill: COLORS.white }));
  parts.push(text({ x: SUMMARY_X + statWidth / 2, y: bodyY + 13, value: "تراكمية", size: 4.4, weight: 600, fill: COLORS.black }));
  parts.push(text({ x: SUMMARY_X + statWidth / 2, y: bodyY + 29.2, value: semester.cumulativeHours, size: 9.2, weight: 700, fill: COLORS.black, direction: "ltr" }));
  parts.push(text({ x: SUMMARY_X + statWidth + statWidth / 2, y: bodyY + 13, value: "فصلية", size: 4.4, weight: 600, fill: COLORS.black }));
  parts.push(text({ x: SUMMARY_X + statWidth + statWidth / 2, y: bodyY + 29.2, value: semester.academicHours, size: 9.2, weight: 700, fill: COLORS.black, direction: "ltr" }));
  parts.push(text({
    x: 0,
    y: 0,
    value: "الساعات",
    size: 4.6,
    weight: 600,
    fill: COLORS.black,
    transform: `translate(${SUMMARY_X + statWidth * 2 + labelWidth / 2 + 1.7} ${bodyY + bodyHeight / 2 + 0.5}) rotate(-90)`,
  }));
  parts.push(`</g>`);
  return parts.join("");
}

function renderSemesterRow(semester, index) {
  const y = semesterY(index);
  const parts = [
    `<g>`,
    `<rect x="${COURSE_AREA_X}" y="${y}" width="${COURSE_AREA_WIDTH}" height="${SEMESTER_HEIGHT}" rx="3" fill="${COLORS.white}" stroke="${COLORS.line}" stroke-width="0.65"/>`,
  ];

  const count = Math.min(semester.courses.length, 6);
  const totalWidth = count * CARD_WIDTH + Math.max(0, count - 1) * CARD_GAP;
  const startX = CARD_RIGHT - totalWidth;
  const cardY = y + 9;
  semester.courses.slice(0, 6).forEach((course, courseIndex) => {
    parts.push(renderCourseCard(course, startX + courseIndex * (CARD_WIDTH + CARD_GAP), cardY));
  });

  parts.push(renderSemesterSummary(semester, y));
  parts.push(`</g>`);
  return parts.join("");
}

function renderYearRails(semesterCount) {
  const parts = [];
  const years = Math.ceil(semesterCount / 2);
  for (let year = 0; year < years; year += 1) {
    const startIndex = year * 2;
    const rows = Math.min(2, semesterCount - startIndex);
    const y = semesterY(startIndex);
    const height = rows * SEMESTER_HEIGHT + (rows - 1) * SEMESTER_GAP;
    parts.push(`<rect x="${YEAR_RAIL_X}" y="${y}" width="${YEAR_RAIL_WIDTH}" height="${height}" rx="1.5" fill="${COLORS.white}" stroke="${COLORS.saad}" stroke-width="1"/>`);
    parts.push(text({ x: YEAR_RAIL_X + YEAR_RAIL_WIDTH / 2, y: y + height / 2 - 4, value: year + 1, size: 7, weight: 700, fill: COLORS.saad, direction: "ltr" }));
    parts.push(text({
      x: 0,
      y: 0,
      value: "سنة",
      size: 4.7,
      weight: 600,
      fill: COLORS.saad,
      transform: `translate(${YEAR_RAIL_X + YEAR_RAIL_WIDTH / 2 + 1.3} ${y + height / 2 + 12}) rotate(-90)`,
    }));
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

function renderPhaseRails(plan) {
  return inferredPhases(plan).map((phase) => {
    const start = Math.max(1, Number(phase.start ?? 1));
    const end = Math.min(plan.semesters.length, Number(phase.end ?? plan.semesters.length));
    const y = semesterY(start - 1);
    const rows = Math.max(1, end - start + 1);
    const height = rows * SEMESTER_HEIGHT + (rows - 1) * SEMESTER_GAP;
    return [
      `<rect x="${PHASE_RAIL_X}" y="${y}" width="${PHASE_RAIL_WIDTH}" height="${height}" rx="1.4" fill="${COLORS.white}" stroke="${COLORS.saad}" stroke-width="1"/>`,
      text({
        x: 0,
        y: 0,
        value: phase.label,
        size: 4.5,
        weight: 600,
        fill: COLORS.saad,
        transform: `translate(${PHASE_RAIL_X + PHASE_RAIL_WIDTH / 2 + 1.3} ${y + height / 2}) rotate(-90)`,
      }),
    ].join("");
  }).join("");
}

function renderLogo() {
  return [
    `<g transform="translate(547 25)">`,
    `<path fill="${COLORS.saad}" transform="scale(0.0475)" d="M423.1,0C261.11,0,129.32,131.79,129.32,293.78H0V423.1h129.32c0,35.7,14.47,68.04,37.87,91.45,23.4,23.4,55.75,37.87,91.45,37.87V423.1h458.24V293.78C716.88,131.79,585.06,0,423.1,0Zm-164.46,293.78c0-90.66,73.77-164.44,164.46-164.44s164.44,73.77,164.44,164.44Z"/>`,
    text({ x: 15, y: 35.2, value: "مبادرة صاد", size: 7.5, weight: 700, fill: COLORS.black }),
    `</g>`,
  ].join("");
}

function renderHeader(plan) {
  const titleLength = Array.from(String(plan.major ?? "")).length;
  const titleSize = titleLength > 42 ? 14.5 : titleLength > 31 ? 15.7 : 16;
  const estimatedTitleWidth = Math.max(60, titleLength * titleSize * 0.43);
  const titleCenterX = 518 - estimatedTitleWidth / 2;
  const subtitleSize = 13.5;
  const subtitleLength = Array.from(String(plan.headerSubtitle || (plan.degree ? `درجة ${plan.degree}` : ""))).length;
  const estimatedSubtitleWidth = Math.max(50, subtitleLength * subtitleSize * 0.43);
  const subtitleCenterX = 518 - estimatedSubtitleWidth / 2;
  const edition = plan.edition || "الطبعة الأولى";
  const release = plan.release || (plan.version ? `إصدار ${plan.version}` : "إصدار 1.0");
  const subtitle = plan.headerSubtitle || (plan.degree ? `درجة ${plan.degree}` : "");
  return [
    renderLogo(),
    text({ x: titleCenterX, y: 41.5, value: plan.major, size: titleSize, weight: 700, anchor: "middle", fill: COLORS.black }),
    text({ x: subtitleCenterX, y: 60.3, value: subtitle, size: subtitleSize, weight: 500, anchor: "middle", fill: COLORS.black }),
    `<rect x="15" y="26" width="80" height="39" rx="6" fill="${COLORS.white}" stroke="${COLORS.black}" stroke-width="0.9"/>`,
    text({ x: 55, y: 43, value: edition, size: 12, weight: 700, fill: COLORS.black }),
    `<g transform="translate(55 0) scale(1.45 1) translate(-55 0)">${text({ x: 55, y: 56.05, value: release, size: 6.4, weight: 600, fill: COLORS.black })}</g>`,
  ].join("");
}

function renderGenericLegendCard(x, y, scale = 1.75) {
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
  return renderCourseCard(demo, x, y, { scale });
}

function line(x1, y1, x2, y2, stroke = COLORS.line, width = 0.8) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"/>`;
}

function renderLegendPanel(y = 625) {
  const parts = [
    `<rect x="${PHASE_RAIL_X}" y="${y}" width="${PHASE_RAIL_WIDTH}" height="303" rx="1.4" fill="${COLORS.white}" stroke="${COLORS.saad}" stroke-width="1"/>`,
    text({ x: 0, y: 0, value: "دليل الخطة", size: 4.8, weight: 600, fill: COLORS.saad, transform: `translate(${PHASE_RAIL_X + PHASE_RAIL_WIDTH / 2 + 1.2} ${y + 151.5}) rotate(-90)` }),
    text({ x: 297, y: y + 24, value: "دليل بطاقة المقرر", size: 12.2, weight: 700, fill: COLORS.black }),
    text({ x: 297, y: y + 40, value: "كل ما يظهر في البطاقة يُستخرج آليًّا من بيانات المقرر والخطة", size: 6.2, weight: 500, fill: COLORS.gray }),
  ];

  const cardX = 232;
  const cardY = y + 91;
  const scale = 1.75;
  const cardW = CARD_WIDTH * scale;
  const cardH = CARD_HEIGHT * scale;
  parts.push(renderGenericLegendCard(cardX, cardY, scale));

  // Right-side callouts.
  parts.push(line(cardX + cardW, cardY + 11, 446, cardY + 11));
  parts.push(text({ x: 452, y: cardY + 7, value: "الساعات الأكاديمية", size: 7, weight: 700, anchor: "start", fill: COLORS.black }));
  parts.push(text({ x: 452, y: cardY + 18, value: "الساعات المعتمدة في المعدل والتراكمي", size: 5.3, weight: 400, anchor: "start", fill: COLORS.black }));

  parts.push(line(cardX + cardW - 7, cardY + cardH - 7, 446, cardY + cardH - 7));
  parts.push(text({ x: 452, y: cardY + cardH - 11, value: "مقرر منقرض", size: 7, weight: 700, anchor: "start", fill: COLORS.black }));
  parts.push(text({ x: 452, y: cardY + cardH + 1, value: "لم يظهر ضمن المقررات المطروحة حديثًا", size: 5.3, weight: 400, anchor: "start", fill: COLORS.black }));

  // Left-side callouts.
  parts.push(line(cardX + 2, cardY + 7, 155, cardY + 7));
  parts.push(text({ x: 149, y: cardY + 3, value: "مقرر أب", size: 7, weight: 700, anchor: "end", fill: COLORS.black }));
  parts.push(text({ x: 149, y: cardY + 14, value: "متطلب سابق لمقررات في مستويات قادمة", size: 5.3, weight: 400, anchor: "end", fill: COLORS.black }));

  parts.push(line(cardX + 2, cardY + cardH - 7, 155, cardY + cardH - 7));
  parts.push(text({ x: 149, y: cardY + cardH - 11, value: "مقرر تابع للمسار", size: 7, weight: 700, anchor: "end", fill: COLORS.black }));
  parts.push(text({ x: 149, y: cardY + cardH + 1, value: "علامة تظهر في التخصصات ذات المسارات", size: 5.3, weight: 400, anchor: "end", fill: COLORS.black }));

  const metricY = cardY + cardH + 72;
  const metricXs = [120, 238, 356, 474];
  const headings = ["ساعات التمارين", "ساعات العملي", "ساعات المحاضرة", "الساعات الفعلية"];
  const descriptions = [
    "عدد ساعات التمارين أسبوعيًّا.",
    "عدد ساعات العملي أسبوعيًّا.",
    "عدد ساعات المحاضرة أسبوعيًّا.",
    "الساعات الأسبوعية المعتمدة في حساب الحرمان.",
  ];
  const targetXs = [cardX + 54, cardX + 68, cardX + 83, cardX + 104];
  metricXs.forEach((x, index) => {
    parts.push(line(targetXs[index], cardY + cardH - 3, x, metricY - 18));
    parts.push(text({ x, y: metricY, value: headings[index], size: 6.7, weight: 700, fill: COLORS.black }));
    parts.push(text({ x, y: metricY + 12, value: descriptions[index], size: 4.9, weight: 400, fill: COLORS.black }));
  });

  return parts.join("");
}

function electiveGroupHeight(group) {
  const rows = Math.max(1, Math.ceil(group.courses.length / 6));
  return rows * 50 + 12;
}

function renderElectiveGroup(group, y) {
  const rows = Math.max(1, Math.ceil(group.courses.length / 6));
  const height = electiveGroupHeight(group);
  const parts = [
    `<rect x="${COURSE_AREA_X}" y="${y}" width="${COURSE_AREA_WIDTH}" height="${height}" rx="3" fill="${COLORS.white}" stroke="${COLORS.line}" stroke-width="0.65"/>`,
    `<rect x="${SUMMARY_X}" y="${y}" width="${SUMMARY_WIDTH}" height="${height}" rx="3" fill="${COLORS.white}" stroke="${COLORS.line}" stroke-width="0.65"/>`,
    `<path d="M${SUMMARY_X + 3} ${y}H${SUMMARY_X + SUMMARY_WIDTH - 3}a3 3 0 0 1 3 3v${Math.min(31, height - 3)}H${SUMMARY_X}V${y + 3}a3 3 0 0 1 3-3z" fill="${COLORS.saadTint}"/>`,
    text({ x: SUMMARY_X + SUMMARY_WIDTH / 2, y: y + 18.5, value: group.name, size: 6.2, weight: 700, fill: COLORS.saad }),
    text({ x: SUMMARY_X + SUMMARY_WIDTH / 2, y: y + Math.min(height - 11, 47), value: `إتمام ${group.requiredHours ?? 0} ساعات`, size: 5.1, weight: 700, fill: COLORS.black }),
  ];

  group.courses.forEach((course, index) => {
    const row = Math.floor(index / 6);
    const rowCourses = group.courses.slice(row * 6, row * 6 + 6);
    const rowCount = rowCourses.length;
    const rowStart = CARD_RIGHT - (rowCount * CARD_WIDTH + Math.max(0, rowCount - 1) * CARD_GAP);
    const col = index % 6;
    parts.push(renderCourseCard(course, rowStart + col * (CARD_WIDTH + CARD_GAP), y + 8 + row * 50));
  });
  return { svg: parts.join(""), height };
}

function renderElectiveGroups(groups, y = 615) {
  const gap = 15;
  const totalHeight = groups.reduce((sum, group) => sum + electiveGroupHeight(group), 0) + Math.max(0, groups.length - 1) * gap;
  const parts = [
    `<rect x="${PHASE_RAIL_X}" y="${y}" width="${PHASE_RAIL_WIDTH}" height="${totalHeight}" rx="1.4" fill="${COLORS.white}" stroke="${COLORS.saad}" stroke-width="1"/>`,
    text({ x: 0, y: 0, value: "المقررات الاختيارية", size: 4.7, weight: 600, fill: COLORS.saad, transform: `translate(${PHASE_RAIL_X + PHASE_RAIL_WIDTH / 2 + 1.2} ${y + totalHeight / 2}) rotate(-90)` }),
  ];
  let cursor = y;
  groups.forEach((group, index) => {
    const rendered = renderElectiveGroup(group, cursor);
    parts.push(rendered.svg);
    cursor += rendered.height + (index < groups.length - 1 ? gap : 0);
  });
  return parts.join("");
}

function telegramIcon(x, y) {
  return `<g transform="translate(${x} ${y})"><circle cx="0" cy="0" r="7" fill="${COLORS.black}"/><path d="M-4-1 4-4 1.5 4-.2 1.5-2.2 3-1.4.2z" fill="${COLORS.white}"/></g>`;
}

function globeIcon(x, y) {
  return `<g transform="translate(${x} ${y})" fill="none" stroke="${COLORS.black}" stroke-width="1.4"><circle r="7"/><ellipse rx="3.2" ry="7"/><path d="M-6 0h12M-5-3.6h10M-5 3.6h10"/></g>`;
}

function xIcon(x, y) {
  return `<g transform="translate(${x} ${y})" stroke="${COLORS.black}" stroke-width="2.1" stroke-linecap="round"><path d="M-5-7 5 7M4-7-5 7"/></g>`;
}

function helpIcon(x, y) {
  return `<g transform="translate(${x} ${y})"><circle r="7" fill="none" stroke="${COLORS.black}" stroke-width="1.4"/>${text({ x: 0, y: 3.3, value: "؟", size: 8, weight: 700, fill: COLORS.black })}</g>`;
}

function footerItem({ x, icon, title, value }) {
  return [
    icon(x + 42, 0),
    text({ x: x + 30, y: -2, value: title, size: 6.2, weight: 700, anchor: "end", fill: COLORS.black }),
    text({ x: x + 30, y: 8, value, size: 5.5, weight: 400, anchor: "end", fill: COLORS.black, direction: "ltr" }),
  ].join("");
}

function renderFooter(plan) {
  const itemsY = 978;
  const copyright = plan.footer?.copyright || "مبادرة صاد. جميع الحقوق محفوظة للتصميم والهوية البصرية.";
  return [
    `<g transform="translate(0 ${itemsY})">`,
    footerItem({ x: 448, icon: telegramIcon, title: "قناة مبادرة صاد", value: "t.me/saadinitiative" }),
    footerItem({ x: 326, icon: globeIcon, title: "موقع مبادرة صاد", value: "saadinitiative.com" }),
    footerItem({ x: 205, icon: xIcon, title: "حساب مبادرة صاد", value: "x.com/saadinitiative" }),
    footerItem({ x: 84, icon: helpIcon, title: "للاستفسارات", value: "t.me/SaadInitiative?direct" }),
    `</g>`,
    text({ x: PAGE_WIDTH / 2, y: 1017, value: copyright, size: 5.4, weight: 400, fill: "#9A9A9A" }),
    `<rect x="0" y="1040" width="${PAGE_WIDTH}" height="5" fill="${COLORS.saad}"/>`,
  ].join("");
}

function textLines({ x, y, lines, lineHeight, size, weight = 400, anchor = "middle", fill = COLORS.black, direction = "rtl" }) {
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

function renderSummerRail(y) {
  return [
    `<rect x="${YEAR_RAIL_X}" y="${y}" width="${YEAR_RAIL_WIDTH}" height="${SEMESTER_HEIGHT}" rx="1.5" fill="${COLORS.white}" stroke="${COLORS.saad}" stroke-width="1"/>`,
    text({
      x: 0,
      y: 0,
      value: "فصل صيفي",
      size: 4.2,
      weight: 600,
      fill: COLORS.saad,
      transform: `translate(${YEAR_RAIL_X + YEAR_RAIL_WIDTH / 2 + 1.2} ${y + SEMESTER_HEIGHT / 2}) rotate(-90)`,
    }),
  ].join("");
}

function renderProposalLegend(y = 704) {
  const cardX = 232;
  const cardY = y;
  const scale = 1.75;
  const cardW = CARD_WIDTH * scale;
  const cardH = CARD_HEIGHT * scale;
  const parts = [renderGenericLegendCard(cardX, cardY, scale)];

  // The four badges around the card.
  parts.push(line(cardX + 2, cardY + 7, 151, cardY + 7));
  parts.push(text({ x: 145, y: cardY + 4, value: "مقرر أب", size: 7, weight: 700, anchor: "end" }));
  parts.push(textLines({
    x: 145,
    y: cardY + 16,
    lines: ["يعد هذا المقرر متطلبًا سابقًا لمقررات في مستويات", "قادمة."],
    lineHeight: 8,
    size: 5.2,
    anchor: "end",
  }));

  parts.push(line(cardX + 2, cardY + cardH - 7, 151, cardY + cardH - 7));
  parts.push(text({ x: 145, y: cardY + cardH - 11, value: "مقرر تابع للمسار", size: 7, weight: 700, anchor: "end" }));
  parts.push(textLines({
    x: 145,
    y: cardY + cardH + 1,
    lines: ["علامة تبين أن المقرر تابع للمسار الحالي، وتنطبق", "فقط على التخصصات التي تحوي مسارات."],
    lineHeight: 8,
    size: 5.2,
    anchor: "end",
  }));

  parts.push(line(cardX + cardW, cardY + 11, 446, cardY + 11));
  parts.push(text({ x: 452, y: cardY + 7, value: "الساعات الأكاديمية", size: 7, weight: 700, anchor: "start" }));
  parts.push(textLines({
    x: 452,
    y: cardY + 19,
    lines: ["الساعات التي يتم اعتمادها في حساب", "المعدلات الدراسية والساعات التراكمية."],
    lineHeight: 8,
    size: 5.2,
    anchor: "start",
  }));

  parts.push(line(cardX + cardW - 7, cardY + cardH - 7, 446, cardY + cardH - 7));
  parts.push(text({ x: 452, y: cardY + cardH - 11, value: "مقرر منقرض", size: 7, weight: 700, anchor: "start" }));
  parts.push(textLines({
    x: 452,
    y: cardY + cardH + 1,
    lines: ["لم يظهر المقرر خلال السنين الماضية ضمن", "المقررات المطروحة."],
    lineHeight: 8,
    size: 5.2,
    anchor: "start",
  }));

  const headingY = cardY + cardH + 72;
  const details = [
    { x: 105, targetX: cardX + 53, heading: "ساعات التمارين", lines: ["عدد ساعات التمارين أسبوعيًّا."] },
    { x: 226, targetX: cardX + 68, heading: "ساعات العملي", lines: ["عدد ساعات العملي أسبوعيًّا."] },
    { x: 347, targetX: cardX + 83, heading: "ساعات المحاضرة", lines: ["عدد ساعات المحاضرة أسبوعيًّا."] },
    { x: 477, targetX: cardX + 104, heading: "الساعات الفعلية", lines: ["الساعات التي يتم تدريس المقرر فيها بشكل", "أسبوعي، وهي الساعات التي يتم اعتمادها", "في حساب الحرمان."] },
  ];
  details.forEach((item) => {
    parts.push(line(item.targetX, cardY + cardH - 3, item.x, headingY - 18, item.x === 477 ? COLORS.saad : COLORS.line, item.x === 477 ? 1 : 0.8));
    parts.push(text({ x: item.x, y: headingY, value: item.heading, size: 6.7, weight: 700 }));
    parts.push(textLines({ x: item.x, y: headingY + 12, lines: item.lines, lineHeight: 7.4, size: 4.9 }));
  });

  return parts.join("");
}

function pageSvg(parts) {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}pt" height="${PAGE_HEIGHT}pt" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">`,
    `<style>text{font-kerning:normal}</style>`,
    ...parts,
    `</svg>`,
  ].join("\n");
}

export function calculatePage() {
  return { width: PAGE_WIDTH, height: PAGE_HEIGHT, rows: 8, panelHeight: SEMESTER_HEIGHT };
}

export function renderPlanSvg(plan) {
  const semesters = plan.semesters.slice(0, 8);
  const renderPlan = { ...plan, semesters };
  const parts = [
    `<rect width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" fill="${COLORS.white}"/>`,
    renderHeader(renderPlan),
  ];

  semesters.forEach((semester, index) => parts.push(renderSemesterRow(semester, index)));
  parts.push(renderYearRails(semesters.length));
  parts.push(renderPhaseRails(renderPlan));

  if (Array.isArray(plan.electiveGroups) && plan.electiveGroups.length) {
    parts.push(renderElectiveGroups(plan.electiveGroups));
  } else {
    parts.push(renderLegendPanel());
  }

  parts.push(renderFooter(plan));
  return pageSvg(parts);
}

export function renderProposalSvg(plan) {
  const proposal = plan.proposal;
  if (!proposal) throw new Error("The plan has no proposal page.");
  const regularSemesters = proposal.semesters.slice(0, 8);
  const summerSemester = proposal.semesters[8] ?? null;
  const renderPlan = {
    ...proposal,
    major: proposal.title ?? "الخطة المقترحة",
    headerSubtitle: plan.major,
    footer: plan.footer,
  };
  const parts = [
    `<rect width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" fill="${COLORS.white}"/>`,
    renderHeader(renderPlan),
  ];

  regularSemesters.forEach((semester, index) => parts.push(renderSemesterRow(semester, index)));
  if (summerSemester) parts.push(renderSemesterRow(summerSemester, 8));
  parts.push(renderYearRails(regularSemesters.length));
  if (summerSemester) parts.push(renderSummerRail(semesterY(8)));
  parts.push(renderPhaseRails({ ...renderPlan, semesters: proposal.semesters }));
  parts.push(renderProposalLegend());
  parts.push(renderFooter(plan));
  return pageSvg(parts);
}

function pageInner(svg) {
  const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/u);
  if (!match) throw new Error("Could not combine generated SVG pages.");
  return match[1];
}

export function combineSvgPages(pages) {
  if (pages.length === 1) return pages[0];
  const pageGap = 10;
  const pagePitch = PAGE_HEIGHT + pageGap;
  const namedPages = pages.map((_, index) => `<inkscape:page x="0" y="${index * pagePitch}" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}"/>`).join("");
  const contents = pages.map((svg, index) => `<g transform="translate(0 ${index * pagePitch})">${pageInner(svg)}</g>`).join("\n");
  // Inkscape rounds a 1045pt multipage document to 1046pt. The 1044.5pt
  // physical height preserves the exact 594 x 1045 pt page size while the
  // viewBox and all design coordinates remain the Figma-authored 594 x 1045.
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" width="${PAGE_WIDTH}pt" height="1044.5pt" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">`,
    `<sodipodi:namedview pagecolor="#ffffff">${namedPages}</sodipodi:namedview>`,
    contents,
    `</svg>`,
  ].join("\n");
}

export function renderPlanDocumentSvg(plan) {
  const pages = [renderPlanSvg(plan)];
  if (plan.proposal) pages.push(renderProposalSvg(plan));
  return { svg: combineSvgPages(pages), pageCount: pages.length, pages };
}
