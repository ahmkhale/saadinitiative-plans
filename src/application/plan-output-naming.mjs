function cleanFilenamePart(value) {
  return String(value ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[. ]+$/u, "");
}

function trackName(plan) {
  return cleanFilenamePart(
    plan?.track?.name
      || plan?.trackName
      || (typeof plan?.track === "string" ? plan.track : ""),
  );
}

export function defaultPlanOutputName(plan = {}) {
  const planName = cleanFilenamePart(
    plan.baseMajor || plan.major || plan.program || "",
  );
  const track = trackName(plan);
  const includeTrack = Boolean(track && !planName.includes(track));
  return ["خطة صاد", planName, includeTrack ? track : ""]
    .filter(Boolean)
    .join(" - ") || "خطة صاد";
}
