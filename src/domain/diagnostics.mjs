import { GENERATOR_VERSION } from "../version.mjs";

export function createDiagnostics(planPath = null, catalogPath = null) {
  return {
    generatorVersion: GENERATOR_VERSION,
    planPath,
    catalogPath,
    generatedAt: new Date().toISOString(),
    summary: { errors: 0, warnings: 0, info: 0 },
    items: [],
  };
}

export function addDiagnostic(diagnostics, severity, code, message, context = {}) {
  diagnostics.items.push({ severity, code, message, ...context });
  diagnostics.summary[severity] += 1;
}

export function hasErrors(diagnostics) {
  return diagnostics.summary.errors > 0;
}
