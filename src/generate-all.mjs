import fs from "node:fs";
import path from "node:path";
import { flagValue } from "./args.mjs";
import { generatePlan } from "./pipeline.mjs";

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (entry.isFile() && entry.name === "plan.json") results.push(full);
  }
  return results;
}

const args = process.argv.slice(2);
const root = path.resolve(args.find((arg) => !arg.startsWith("--")) ?? "colleges");
const catalogPath = flagValue(args, "--catalog");
if (!fs.existsSync(root)) {
  console.error(`Directory not found: ${root}`);
  process.exit(1);
}
const plans = walk(root);
if (!plans.length) {
  console.error(`No plan.json files found under ${root}`);
  process.exit(1);
}
let failures = 0;
for (const planPath of plans) {
  try {
    const relative = path.relative(root, path.dirname(planPath));
    const outputDir = path.resolve(flagValue(args, "--output-dir") ?? "dist", relative);
    const result = generatePlan({
      planPath,
      catalogPath,
      outputDir,
      keepSvg: args.includes("--svg"),
      png: args.includes("--png"),
      allowErrors: args.includes("--allow-errors"),
    });
    console.log(`OK  ${planPath} -> ${result.paths.pdfPath}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${planPath}: ${error.message}`);
  }
}
if (failures) process.exitCode = 1;
