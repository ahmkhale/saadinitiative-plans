import { COLORS, PAGE_LAYOUT, calculateProposalPageLayout, calculatePublishedPageLayout } from "../layout/page-layout.mjs";
import { createRenderContext, pageInner, pageSvg } from "./primitives.mjs";
import { renderHeader } from "./header.mjs";
import { renderElectiveGroups } from "./electives.mjs";
import { renderFooter } from "./footer.mjs";
import { renderGuide } from "./guide.mjs";
import { renderPhaseRails, renderSemesterRow, renderYearRails } from "./semester.mjs";

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
  if (layout.includesGuide) parts.push(renderGuide(context, layout.guideY, plan.activityTypes));
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
  if (layout.includesGuide) parts.push(renderGuide(context, layout.guideY, plan.activityTypes));
  parts.push(renderFooter(plan, layout.footerY));
  return pageSvg(parts, layout);
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
