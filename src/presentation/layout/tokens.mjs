export const PAGE_LAYOUT = Object.freeze({
  width: 594,
  innerX: 15,
  innerY: 24,
  innerWidth: 564,
  headerHeight: 42,
  contentTop: 98,
  sectionGap: 32,
  footerGap: 32,
  footerHeight: 84,
  pageGap: 10,
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

export const COURSE_CARD_LAYOUT = Object.freeze({
  width: 76,
  height: 49,
  gap: 1,
  rowRight: 494.75701904296875,
  body: Object.freeze({ x: 1, y: 6, width: 74, height: 43, radius: 6 }),
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
