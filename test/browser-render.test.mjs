import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderPlanSvg } from "../src/render-svg.mjs";
import { formatCourseRequirementLabel } from "../src/domain/course-requirements.mjs";

const execFileAsync = promisify(execFile);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontRoot = path.resolve(process.env.SAAD_FONT_DIR ?? path.join(projectRoot, "font"));
const chromium = ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]
  .find((candidate) => fs.existsSync(candidate));
const semiboldPath = path.join(fontRoot, "IBMPlexSansArabic-SemiBold.ttf");
const boldPath = path.join(fontRoot, "IBMPlexSansArabic-Bold.ttf");

function course(overrides = {}) {
  const value = {
    code: "400 كهر",
    name: "الدوائر الإلكترونية الرقمية والتماثلية",
    academicHours: 3,
    lectureHours: 3,
    practicalHours: 0,
    exerciseHours: 1,
    prerequisites: [],
    corequisites: [],
    prerequisiteConditions: [],
    minimumCompletedCredits: null,
    color: "#17529B",
    isParentCourse: false,
    isTrackSpecific: false,
    isExtinct: false,
    ...overrides,
  };
  return { ...value, requirementLabel: formatCourseRequirementLabel(value) };
}

function page() {
  return renderPlanSvg({
    major: "اختبار الخط",
    degree: "البكالوريوس",
    semesters: [{
      name: "المستوى الأول",
      academicHours: 6,
      cumulativeHours: 6,
      courseDisplayOrder: "rtl",
      courses: [
        course(),
        course({
          code: "412 كهر",
          name: "تصميم الدوائر المتكاملة ذات النطاق العالي جدًا منخفضة القدرة",
          prerequisites: ["405 كهر"],
        }),
      ],
    }],
    electiveGroups: [],
  });
}

function html(svg) {
  const semiboldData = fs.readFileSync(semiboldPath).toString("base64");
  const boldData = fs.readFileSync(boldPath).toString("base64");
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face{font-family:"IBM Plex Sans Arabic";src:url(data:font/ttf;base64,${semiboldData}) format('truetype');font-weight:600}
@font-face{font-family:"IBM Plex Sans Arabic";src:url(data:font/ttf;base64,${boldData}) format('truetype');font-weight:700}
body{margin:0}svg{width:594px;height:auto}
</style></head><body>${svg}<output id="result"></output><script>
(async()=>{
  await document.fonts.load('600 5px "IBM Plex Sans Arabic"');
  await document.fonts.load('700 5px "IBM Plex Sans Arabic"');
  await document.fonts.ready;
  const names=[...document.querySelectorAll('[data-part="course-name"]')];
  const clips=[...document.querySelectorAll('[data-part="course-name-clip"]')];
  const result={
    font:getComputedStyle(names[0]).fontFamily,
    widths:names.map((node)=>node.getComputedTextLength()),
    sizes:names.map((node)=>Number(node.getAttribute('font-size'))),
    clipRefs:clips.map((node)=>node.getAttribute('clip-path')),
    clipWidths:[...document.querySelectorAll('clipPath rect')].map((node)=>Number(node.getAttribute('width'))),
  };
  document.querySelector('#result').textContent=JSON.stringify(result);
  document.documentElement.dataset.renderReady='true';
})();
</script></body></html>`;
}

const canRender = process.env.RUN_BROWSER_RENDER_TESTS === "1"
  && Boolean(chromium && fs.existsSync(semiboldPath) && fs.existsSync(boldPath));

test("Chromium renders course names with IBM Plex Sans Arabic and card-local clipping", { skip: !canRender }, async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "saad-browser-render-"));
  const htmlPath = path.join(temporaryDirectory, "index.html");
  fs.writeFileSync(htmlPath, html(page()), "utf8");
  try {
    const { stdout: output } = await execFileAsync(chromium, [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--virtual-time-budget=5000",
      "--dump-dom",
      `file://${htmlPath}`,
    ], { encoding: "utf8", timeout: 15000, maxBuffer: 10_000_000 });
    const payload = output.match(/<output id="result">([^<]+)<\/output>/u)?.[1];
    assert.ok(payload, "browser did not publish rendered font metrics");
    const result = JSON.parse(payload.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
    assert.match(result.font, /IBM Plex Sans Arabic/u);
    assert.ok(result.widths[0] <= 68.25, `fitting name rendered at ${result.widths[0]}pt`);
    assert.equal(result.sizes[0], 5);
    assert.ok(result.sizes[1] > 2.8 && result.sizes[1] < 2.9);
    assert.equal(result.clipRefs.length, 2);
    assert.ok(result.clipRefs.every((value) => /^url\(#published-course-name-clip-/u.test(value)));
    assert.deepEqual(result.clipWidths, [68, 68]);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
