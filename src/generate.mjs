import path from "node:path";
import { flagValue } from "./args.mjs";
import { generatePlan } from "./pipeline.mjs";

function fail(message) {
  console.error(`\nError: ${message}\n`);
  process.exitCode = 1;
}

const args = process.argv.slice(2);
const planPath = args.find((arg) => !arg.startsWith("--") && /\.json$/iu.test(arg));
if (!planPath) {
  fail("Usage: npm run generate -- institutions/<institution>/colleges/<college>/majors/<major>/plan.json [--svg] [--png]");
} else {
  try {
    const result = generatePlan({
      planPath: path.resolve(planPath),
      catalogPath: flagValue(args, "--catalog"),
      colorsPath: flagValue(args, "--colors"),
      outputDir: flagValue(args, "--output-dir"),
      outputName: flagValue(args, "--output-name"),
      keepSvg: args.includes("--svg"),
      svgOnly: args.includes("--svg-only"),
      png: args.includes("--png"),
      allowErrors: args.includes("--allow-errors"),
    });
    if (!args.includes("--svg-only")) console.log(`PDF: ${result.paths.pdfPath}`);
    if (args.includes("--svg") || args.includes("--svg-only")) console.log(`SVG: ${result.paths.svgPath}`);
    if (args.includes("--png")) console.log(`PNG: ${result.paths.pngPath}`);
    console.log(`Resolved: ${result.paths.resolvedPath}`);
    console.log(`Diagnostics: ${result.paths.diagnosticsPath}`);
    console.log(`Courses: ${result.plan.courseCount}, hours: ${result.plan.totalHours}`);
    console.log(`Diagnostics: ${result.diagnostics.summary.errors} errors, ${result.diagnostics.summary.warnings} warnings, ${result.diagnostics.summary.info} info`);
  } catch (error) {
    fail(error.message);
  }
}
