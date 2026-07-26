import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defaultCatalogService } from "./catalog-service.mjs";
import { exportDraft, renderDraftPreview, resolveDraft } from "./preview.mjs";
import { atomicWriteJson, defaultPlanStore, projectRoot } from "./store.mjs";
import { createSharedSemesterSetStore } from "./shared-semester-sets.mjs";
import { createSharedElectiveGroupStore } from "./shared-elective-groups.mjs";
import { refreshFallbackFromCatalog } from "./fallback-hydration.mjs";
import { readSettings, saveSettings, settingsPath } from "./settings.mjs";
import { preparePlanForEditor } from "./plan-input.mjs";

const thisFile = fileURLToPath(import.meta.url);
const guiDir = path.join(projectRoot, "gui");
const distDir = path.join(projectRoot, "dist");
const defaultPort = Number(process.env.PORT || 4174);

function openDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const command = process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const child = spawn(command, [directory], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

function json(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}

function text(res, status, value, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(value);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) reject(new Error("Request body is too large."));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function serveFile(res, filePath, contentType) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return text(res, 404, "Not found");
  res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
  fs.createReadStream(filePath).pipe(res);
}

function distUrl(filePath, root = distDir) {
  const relative = path.relative(root, filePath).split(path.sep).map(encodeURIComponent).join("/");
  return `/dist/${relative}`;
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".pdf": "application/pdf",
    ".json": "application/json; charset=utf-8",
  }[extension] ?? "application/octet-stream";
}

export function createGuiServer(options = {}) {
  const store = options.store ?? defaultPlanStore;
  const catalogService = options.catalogService ?? defaultCatalogService;
  const outputRoot = path.resolve(options.outputRoot ?? distDir);
  const exportDraftFn = options.exportDraftFn ?? exportDraft;
  const openOutputFn = options.openOutputFn ?? openDirectory;
  const sharedSetStore = options.sharedSetStore ?? createSharedSemesterSetStore({ planStore: store, catalogService });
  const sharedElectiveStore = options.sharedElectiveStore
    ?? createSharedElectiveGroupStore({ planStore: store, catalogService });
  const settingsFile = options.settingsPath ?? settingsPath;

  async function api(req, res, url) {
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

    if (req.method === "GET" && url.pathname === "/api/state") {
      return json(res, 200, {
        ok: true,
        colleges: store.listColleges(),
        catalog: catalogService.summary(),
        settings: readSettings(settingsFile),
        sharedSemesterSets: sharedSetStore.list(),
        sharedElectiveGroups: sharedElectiveStore.list(),
      });
    }
    if (req.method === "GET" && url.pathname === "/api/catalog/search") {
      return json(res, 200, { ok: true, courses: catalogService.search(url.searchParams.get("q") ?? "") });
    }
    if (req.method === "GET" && url.pathname === "/api/catalog/course") {
      return json(res, 200, { ok: true, course: catalogService.resolve(url.searchParams.get("code") ?? "") });
    }
    if (req.method === "POST" && url.pathname === "/api/validate") {
      const body = await readBody(req);
      const result = resolveDraft(body.plan, {
        catalogService,
        settings: readSettings(settingsFile),
        sharedSemesterSets: sharedSetStore.load(),
        sharedElectiveGroups: sharedElectiveStore.load(),
      });
      return json(res, 200, {
        ok: result.ok,
        plan: result.plan,
        diagnostics: result.diagnostics,
        pageLayouts: result.document?.pageLayouts ?? [],
      });
    }
    if (req.method === "POST" && url.pathname === "/api/preview") {
      const body = await readBody(req);
      return json(res, 200, renderDraftPreview(body.plan, {
        catalogService,
        settings: readSettings(settingsFile),
        sharedSemesterSets: sharedSetStore.load(),
        sharedElectiveGroups: sharedElectiveStore.load(),
      }));
    }
    if (req.method === "POST" && url.pathname === "/api/generate") {
      const body = await readBody(req);
      const planToExport = body.save
        ? store.savePlan(body.collegeId, body.majorId, body.plan)
        : body.plan;
      const result = exportDraftFn(planToExport, {
        catalogService,
        settings: readSettings(settingsFile),
        sharedSemesterSets: sharedSetStore.load(),
        sharedElectiveGroups: sharedElectiveStore.load(),
        outputRoot,
        keepSvg: Boolean(body.keepSvg),
        png: Boolean(body.png),
      });
      return json(res, 200, {
        ok: true,
        diagnostics: result.diagnostics,
        pageLayouts: result.document.pageLayouts,
        files: {
          pdf: result.paths.pdfPath ? `${distUrl(result.paths.pdfPath, outputRoot)}?v=${Date.now()}` : null,
          svg: body.keepSvg ? `${distUrl(result.paths.svgPath, outputRoot)}?v=${Date.now()}` : null,
          png: body.png ? `${distUrl(result.paths.pngPath, outputRoot)}?v=${Date.now()}` : null,
          folder: result.paths.folder,
        },
      });
    }
    if (req.method === "POST" && url.pathname === "/api/open-output") {
      openOutputFn(outputRoot);
      return json(res, 200, { ok: true, folder: outputRoot });
    }
    if (req.method === "PUT" && url.pathname === "/api/settings") {
      return json(res, 200, { ok: true, settings: saveSettings(await readBody(req), settingsFile) });
    }
    if (segments[1] === "shared-semester-sets") {
      if (segments.length === 2 && req.method === "POST") {
        return json(res, 201, { ok: true, sharedSemesterSet: sharedSetStore.create(await readBody(req)) });
      }
      const setId = segments[2];
      if (segments.length === 3 && req.method === "GET") {
        return json(res, 200, { ok: true, sharedSemesterSet: sharedSetStore.get(setId) });
      }
      if (segments.length === 3 && req.method === "PUT") {
        return json(res, 200, { ok: true, sharedSemesterSet: sharedSetStore.save(await readBody(req), setId) });
      }
      if (segments.length === 3 && req.method === "DELETE") {
        sharedSetStore.remove(setId);
        return json(res, 200, { ok: true });
      }
      if (segments.length === 4 && segments[3] === "duplicate" && req.method === "POST") {
        return json(res, 201, { ok: true, sharedSemesterSet: sharedSetStore.duplicate(setId, await readBody(req)) });
      }
    }
    if (segments[1] === "shared-elective-groups") {
      if (segments.length === 2 && req.method === "POST") {
        return json(res, 201, { ok: true, sharedElectiveGroup: sharedElectiveStore.create(await readBody(req)) });
      }
      const sourceId = segments[2];
      if (segments.length === 3 && req.method === "GET") {
        return json(res, 200, { ok: true, sharedElectiveGroup: sharedElectiveStore.get(sourceId) });
      }
      if (segments.length === 3 && req.method === "PUT") {
        return json(res, 200, { ok: true, sharedElectiveGroup: sharedElectiveStore.save(await readBody(req), sourceId) });
      }
      if (segments.length === 3 && req.method === "DELETE") {
        sharedElectiveStore.remove(sourceId);
        return json(res, 200, { ok: true });
      }
      if (segments.length === 4 && segments[3] === "duplicate" && req.method === "POST") {
        return json(res, 201, { ok: true, sharedElectiveGroup: sharedElectiveStore.duplicate(sourceId, await readBody(req)) });
      }
    }
    if (req.method === "POST" && url.pathname === "/api/fallback/refresh") {
      const body = await readBody(req);
      const refreshed = refreshFallbackFromCatalog(body.owner, body.code, catalogService.snapshot().catalog);
      return json(res, 200, { ok: true, owner: refreshed });
    }
    if (req.method === "PUT" && segments[1] === "colors" && segments.length === 3) {
      const body = await readBody(req);
      const color = String(body.color ?? "").toUpperCase();
      if (!/^#[0-9A-F]{6}$/u.test(color)) throw new Error("Color must be a six-digit hex value.");
      const state = catalogService.snapshot();
      atomicWriteJson(catalogService.colorsPath, { ...state.colors, [segments[2]]: color });
      return json(res, 200, { ok: true, subject: segments[2], color });
    }

    if (segments[1] === "colleges") {
      if (segments.length === 2 && req.method === "POST") {
        return json(res, 201, { ok: true, college: store.createCollege(await readBody(req)) });
      }
      const collegeId = segments[2];
      if (segments.length === 3 && req.method === "PUT") {
        return json(res, 200, { ok: true, college: store.updateCollege(collegeId, await readBody(req)) });
      }
      if (segments.length === 3 && req.method === "DELETE") {
        store.deleteCollege(collegeId);
        return json(res, 200, { ok: true });
      }
      if (segments[3] === "majors") {
        if (segments.length === 4 && req.method === "POST") {
          return json(res, 201, { ok: true, plan: store.createMajor(collegeId, await readBody(req)) });
        }
        const majorId = segments[4];
        if (segments.length === 5 && req.method === "GET") {
          return json(res, 200, { ok: true, plan: preparePlanForEditor(store.getPlan(collegeId, majorId)) });
        }
        if (segments.length === 5 && req.method === "PUT") {
          const savedPlan = store.savePlan(collegeId, majorId, await readBody(req));
          return json(res, 200, { ok: true, plan: preparePlanForEditor(savedPlan) });
        }
        if (segments.length === 5 && req.method === "DELETE") {
          store.deleteMajor(collegeId, majorId);
          return json(res, 200, { ok: true });
        }
        if (segments.length === 6 && segments[5] === "duplicate" && req.method === "POST") {
          return json(res, 201, { ok: true, plan: store.duplicateMajor(collegeId, majorId, await readBody(req)) });
        }
      }
    }
    return json(res, 404, { ok: false, error: "API route not found." });
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      if (req.method === "GET" && url.pathname === "/") return serveFile(res, path.join(guiDir, "index.html"), contentType("index.html"));
      if (req.method === "GET" && ["/app.js", "/styles.css"].includes(url.pathname)) {
        return serveFile(res, path.join(guiDir, path.basename(url.pathname)), contentType(url.pathname));
      }
      if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
        return serveFile(res, path.join(projectRoot, "assets", path.basename(url.pathname)), contentType(url.pathname));
      }
      if (req.method === "GET" && url.pathname.startsWith("/dist/")) {
        const relative = decodeURIComponent(url.pathname.slice("/dist/".length));
        const filePath = path.resolve(outputRoot, relative);
        if (filePath !== outputRoot && !filePath.startsWith(`${outputRoot}${path.sep}`)) return text(res, 403, "Forbidden");
        return serveFile(res, filePath, contentType(filePath));
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
    console.log(`Local-only editor. Plans are stored under ${defaultPlanStore.root}`);
  });
}
