const PUBLISHER = "مبادرة صاد";
const DEFAULT_TITLE = "الخطة الدراسية";

function clean(value) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/gu, " ").trim();
}

function cleanComponent(value) {
  return clean(value).replace(/^[،,؛;]+|[،,؛;]+$/gu, "").trim();
}

function firstValue(...values) {
  return values.map(clean).find(Boolean) ?? "";
}

function firstComponentValue(...values) {
  return values.map(cleanComponent).find(Boolean) ?? "";
}

function trackName(plan) {
  return firstValue(
    plan?.track?.name,
    plan?.trackName,
    typeof plan?.track === "string" ? plan.track : "",
  );
}

function displayedTitle(plan, context) {
  const explicitTitle = firstValue(context?.title);
  if (explicitTitle) return explicitTitle;

  const major = firstValue(plan?.major, plan?.baseMajor, plan?.program, plan?.programName);
  const track = trackName(plan);
  if (!major) return track || DEFAULT_TITLE;
  if (!track || major.includes(track)) return major;
  return `${major} ${track}`;
}

function uniqueKeywords(values) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = cleanComponent(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

/**
 * Builds the public metadata written to every academic-plan PDF.
 *
 * `sourcePlan` lets callers distinguish explicit plan data from resolved
 * defaults, while `metadata` supplies repository-owned institution details.
 */
export function buildPlanPdfMetadata(plan = {}, context = {}) {
  const sourcePlan = context.sourcePlan ?? plan;
  const resolvedPlan = context.resolvedPlan ?? plan;
  const title = displayedTitle(resolvedPlan, context) || displayedTitle(sourcePlan, context);
  const program = firstValue(
    sourcePlan?.program,
    sourcePlan?.programName,
    sourcePlan?.baseMajor,
    sourcePlan?.major,
    resolvedPlan?.baseMajor,
    resolvedPlan?.major,
  );
  const specialization = firstValue(
    sourcePlan?.specialization,
    sourcePlan?.specializationName,
    resolvedPlan?.specialization,
    resolvedPlan?.specializationName,
  );
  const track = firstValue(trackName(sourcePlan), trackName(resolvedPlan));
  const college = firstComponentValue(
    context.metadata?.college,
    sourcePlan?.college,
    resolvedPlan?.college,
  );
  const university = firstComponentValue(
    context.metadata?.university,
    sourcePlan?.university,
    resolvedPlan?.university,
  );
  const subjectParts = [
    title ? `الخطة الدراسية لبرنامج ${title}` : DEFAULT_TITLE,
    college,
    university,
  ].filter(Boolean);

  return Object.freeze({
    title: title || DEFAULT_TITLE,
    author: PUBLISHER,
    creator: PUBLISHER,
    producer: PUBLISHER,
    subject: subjectParts.join("، "),
    keywords: uniqueKeywords([
      PUBLISHER,
      "خطة دراسية",
      "الخطة الدراسية",
      program,
      specialization,
      track,
      college,
      university,
    ]),
    language: "ar-SA",
  });
}
