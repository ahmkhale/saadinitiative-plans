import { COLORS, COURSE_CARD_LAYOUT } from "../layout/page-layout.mjs";
import { measureText } from "../../infrastructure/export/font-metrics.mjs";
import { courseNameFit, prerequisiteFit } from "./text-fit.mjs";
import { compositeHexColor } from "./color.mjs";
import { displayNumber, clipped, esc, roundedRectPath, text } from "./primitives.mjs";

export function renderCourseCard(context, course, x, y, options = {}) {
  const scale = options.scale ?? 1;
  const layout = COURSE_CARD_LAYOUT;
  const label = course.requirementLabel ?? "";
  const color = course.color || COLORS.gray;
  const insetColor = compositeHexColor(color, COLORS.white, 0.5);
  const insetTextColor = compositeHexColor(insetColor, COLORS.black, 0.9);
  const groupId = context.nextId("course-card");
  const nameClipId = context.nextId("course-name-clip");
  const parts = [`<g id="${groupId}" data-component="course-card" data-course-code="${esc(course.code)}" transform="translate(${x} ${y}) scale(${scale})">`];

  parts.push(`<defs><clipPath id="${nameClipId}"><rect x="4" y="30.5" width="68" height="9.5"/></clipPath></defs>`);
  parts.push(`<rect data-part="course-body" x="${layout.body.x}" y="${layout.body.y}" width="${layout.body.width}" height="${layout.body.height}" rx="${layout.body.radius}" fill="${esc(color)}"/>`);
  parts.push(`<path data-part="academic-badge" d="${roundedRectPath(
    layout.academicBadge.x,
    layout.academicBadge.y,
    layout.academicBadge.width,
    layout.academicBadge.height,
    layout.academicBadge.radii,
  )}" fill="${insetColor}"/>`);

  for (let index = 0; index < 3; index += 1) {
    const metricX = layout.metrics.startX + index * (layout.metrics.width + layout.metrics.gap);
    parts.push(`<path data-part="metric-box" d="${roundedRectPath(
      metricX,
      layout.metrics.y,
      layout.metrics.width,
      layout.metrics.height,
      [layout.metrics.topRadius, layout.metrics.topRadius, 0, 0],
    )}" fill="${insetColor}"/>`);
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

  const unknownHours = course.hoursDisplay === "unknown";
  parts.push(text({ x: 68.5, y: 12.5, value: displayNumber(course.academicHours, unknownHours ? "—" : "0"), size: 10, weight: 700, direction: "ltr", fill: insetTextColor }));
  parts.push(text({ x: 38, y: 23.5, value: clipped(course.code, 18), size: 12, weight: 700, fill: COLORS.white }));
  const fittedName = courseNameFit(course.name);
  parts.push(`<g data-part="course-name-clip" clip-path="url(#${nameClipId})">`);
  parts.push(text({
    x: 38,
    y: 35,
    value: course.name,
    size: fittedName.size,
    dataPart: "course-name",
    weight: 600,
    fill: COLORS.white,
  }));
  parts.push("</g>");

  const metricValues = [course.exerciseHours, course.practicalHours, course.lectureHours];
  metricValues.forEach((value, index) => {
    const metricX = layout.metrics.startX + index * (layout.metrics.width + layout.metrics.gap);
    parts.push(text({
      x: metricX + layout.metrics.width / 2,
      y: 46,
      value: displayNumber(value, unknownHours ? "—" : "0"),
      size: 5,
      weight: 700,
      direction: "ltr",
      fill: insetTextColor,
    }));
  });

  parts.push("</g>");
  return parts.join("");
}
