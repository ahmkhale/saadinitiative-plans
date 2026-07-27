import { COLORS } from "../layout/page-layout.mjs";
import { text } from "./primitives.mjs";

export function renderLogo() {
  return [
    `<g data-component="saad-logo" transform="translate(545 25.9)">`,
    `<path fill="${COLORS.saad}" d="M12.2704 13.9335C12.2704 9.63227 15.7698 6.13294 20.071 6.13294C24.3723 6.13294 27.8716 9.63227 27.8716 13.9335H12.2704ZM20.071 0C12.3843 0 6.13294 6.2514 6.13294 13.9335H0V20.0665H6.13294C6.13294 21.7614 6.82096 23.2924 7.92817 24.4042C9.03993 25.5159 10.5709 26.1994 12.2659 26.1994V20.0665H34V13.9335C34.0045 6.2514 27.7531 0 20.071 0Z"/>`,
    text({ x: 17, y: 33, value: "مبادرة صاد", size: 8, weight: 600 }),
    "</g>",
  ].join("");
}

export function renderHeader(plan, options = {}) {
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
