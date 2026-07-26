export const PAGE_LAYOUT = Object.freeze({
  width: 594,
  height: 1045,
  innerX: 15,
  innerY: 24,
  innerWidth: 564,
  headerHeight: 42,
  contentTop: 98,
  footerY: 961,
  footerHeight: 84,
});

export const COLORS = Object.freeze({
  saad: "#00AEEF",
  saadTint: "#E6F7FD",
  line: "#B6CFE8",
  black: "#000000",
  gray: "#616161",
  copyright: "#616161",
  white: "#FFFFFF",
  parent: "#FF0000",
  track: "#3BA521",
  trackStroke: "#FFF200",
});

export const SEMESTER_LAYOUT = Object.freeze({
  height: 57,
  gap: 4,
  pitch: 61,
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

export const COURSE_CARD_LAYOUT = Object.freeze({
  width: 76,
  height: 49,
  gap: 1,
  rowRight: 494.75701904296875,
  body: Object.freeze({
    x: 1,
    y: 6,
    width: 74,
    height: 43,
    radius: 6,
  }),
  academicBadge: Object.freeze({
    x: 62,
    y: 6,
    width: 13,
    height: 13,
    radii: Object.freeze([1, 6, 1, 6]),
  }),
  metrics: Object.freeze({
    y: 43,
    width: 8,
    height: 6,
    gap: 2,
    startX: 24,
    topRadius: 1.5,
  }),
  parentMarker: Object.freeze({ cx: 5, cy: 10, radius: 4, strokeWidth: 0.75 }),
  trackMarker: Object.freeze({ cx: 5, cy: 45, radius: 4, strokeWidth: 1 }),
  extinctMarker: Object.freeze({ cx: 71, cy: 45, radius: 4, strokeWidth: 1, innerRadius: 2 }),
  prerequisite: Object.freeze({ y: 0, height: 12, maxWidth: 51, radius: 6, paddingX: 4 }),
  title: Object.freeze({ x: 0, y: 15, width: 76, height: 24 }),
});

export const ELECTIVE_LAYOUT = Object.freeze({
  topGap: 32,
  groupGap: 16,
  padding: 5,
  rowGap: 4,
  summaryWidth: 79.24298095703125,
  summaryHeaderHeight: 31,
  summaryBodyHeight: 17,
});

export const GUIDE_LAYOUT = Object.freeze({
  x: 54.08795166015625,
  y: 675,
  width: 485.8240966796875,
  height: 192.748779296875,
  cardX: 174.8,
  cardY: 0,
  cardScale: 1.9561052631578947,
});

export function semesterY(index) {
  return PAGE_LAYOUT.contentTop + index * SEMESTER_LAYOUT.pitch;
}

export function electiveGroupHeight(group) {
  const rows = Math.max(1, Math.ceil(group.courses.length / 6));
  return ELECTIVE_LAYOUT.padding * 2
    + rows * COURSE_CARD_LAYOUT.height
    + Math.max(0, rows - 1) * ELECTIVE_LAYOUT.rowGap;
}

export function electiveTop(semesterCount) {
  return PAGE_LAYOUT.contentTop
    + semesterCount * SEMESTER_LAYOUT.pitch
    + ELECTIVE_LAYOUT.topGap
    - SEMESTER_LAYOUT.gap;
}
