import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defaultCatalogService } from "./infrastructure/catalog/catalog-service.mjs";
import { exportDraft } from "./application/preview-plan.mjs";
import { defaultInstitutionRepository } from "./infrastructure/repositories/institution-repository.mjs";
import { projectRoot } from "./infrastructure/repositories/plan-repository.mjs";
import { createGuiApiRouter } from "./presentation/gui/api-router.mjs";
import { createGuiContextService } from "./presentation/gui/context.mjs";
import { contentType, json, safeFile, serveFile, text } from "./presentation/gui/http.mjs";

const thisFile = fileURLToPath(import.meta.url);
const guiDir = path.join(projectRoot, "gui");
const domainDir = path.join(projectRoot, "src", "domain");
const distDir = path.join(projectRoot, "dist");
const fontDir = path.resolve(process.env.SAAD_FONT_DIR ?? path.join(projectRoot, "font"));
const defaultPort = Number(process.env.PORT || 4174);

function openDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const command = process.platform === "win32"
    ? "explorer.exe"
    : process.platform === "darwin" ? "open" : "xdg-open";
  const child = spawn(command, [directory], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

export function createGuiServer(options = {}) {
  const institutions = options.institutionRepository ?? defaultInstitutionRepository;
  const catalogService = options.catalogService ?? defaultCatalogService;
  const outputRoot = path.resolve(options.outputRoot ?? distDir);
  const contextService = createGuiContextService({ institutions, catalogService });
  const routeApi = createGuiApiRouter({
    institutions,
    catalogService,
    contextService,
    outputRoot,
    exportDraftFn: options.exportDraftFn ?? exportDraft,
    openOutputFn: options.openOutputFn ?? openDirectory,
  });

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      if (url.pathname.startsWith("/api/")) return await routeApi(req, res, url);
      if (req.method === "GET" && url.pathname === "/") {
        return serveFile(res, path.join(guiDir, "index.html"), contentType("index.html"));
      }
      if (req.method === "GET" && url.pathname.startsWith("/gui/")) {
        const target = safeFile(guiDir, decodeURIComponent(url.pathname.slice("/gui/".length)));
        return target ? serveFile(res, target, contentType(target)) : text(res, 403, "Forbidden");
      }
      if (req.method === "GET" && url.pathname.startsWith("/src/domain/")) {
        const target = safeFile(domainDir, decodeURIComponent(url.pathname.slice("/src/domain/".length)));
        return target?.endsWith(".mjs") ? serveFile(res, target, contentType(target)) : text(res, 403, "Forbidden");
      }
      if (req.method === "GET" && ["/app.js", "/styles.css"].includes(url.pathname)) {
        return serveFile(res, path.join(guiDir, path.basename(url.pathname)), contentType(url.pathname));
      }
      if (req.method === "GET" && url.pathname.startsWith("/fonts/")) {
        const fileName = path.basename(url.pathname);
        if (!/^IBMPlexSansArabic-(?:Regular|Medium|SemiBold|Bold)\.ttf$/u.test(fileName)) {
          return text(res, 404, "Not found");
        }
        return serveFile(res, path.join(fontDir, fileName), "font/ttf");
      }
      if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
        return serveFile(res, path.join(projectRoot, "assets", path.basename(url.pathname)), contentType(url.pathname));
      }
      if (req.method === "GET" && url.pathname.startsWith("/dist/")) {
        const target = safeFile(outputRoot, decodeURIComponent(url.pathname.slice("/dist/".length)));
        return target ? serveFile(res, target, contentType(target)) : text(res, 403, "Forbidden");
      }
      return text(res, 404, "Not found");
    } catch (error) {
      const status = /not found/iu.test(error.message) ? 404 : 400;
      return json(res, status, { ok: false, error: error.message, diagnostics: error.diagnostics });
    }
  });
}

if (process.argv[1] === thisFile) {
  const server = createGuiServer();
  server.listen(defaultPort, "127.0.0.1", () => {
    console.log(`Saad Plan Generator: http://127.0.0.1:${defaultPort}`);
    console.log(`Local-only editor. Institutions are stored under ${defaultInstitutionRepository.root}`);
  });
}
