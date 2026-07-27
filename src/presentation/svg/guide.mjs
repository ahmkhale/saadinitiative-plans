import { COLORS, GUIDE_LAYOUT } from "../layout/page-layout.mjs";
import { renderCourseCard } from "./course-card.mjs";
import { line, text, textLines } from "./primitives.mjs";

export function renderGuide(context, y) {
  const demo = {
    code: "رمز المقرر",
    name: "اسم المقرر",
    academicHours: "س",
    lectureHours: "م",
    practicalHours: "ع",
    exerciseHours: "ت",
    prerequisites: ["متطلب سابق"],
    requirementLabel: "متطلب سابق",
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
  const activityOutline = GUIDE_LAYOUT.activityOutline;
  parts.push(`<rect data-part="guide-activity-outline" x="${rootX + activityOutline.x}" y="${cardY + activityOutline.y}" width="${activityOutline.width}" height="${activityOutline.height}" rx="${activityOutline.radius}" fill="none" stroke="${COLORS.saad}" stroke-width="${activityOutline.strokeWidth}"/>`);
  return `<g data-component="course-guide">${parts.join("")}</g>`;
}
