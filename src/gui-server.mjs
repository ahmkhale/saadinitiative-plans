import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defaultCatalogService } from "./catalog-service.mjs";
import { exportDraft, renderDraftPreview, resolveDraft } from "./preview.mjs";
import {
  atomicWriteJson,
  defaultInstitutionRepository,
  projectRoot,
} from "./store.mjs";
import { createSharedSemesterSetStore } from "./shared-semester-sets.mjs";
import { createSharedElectiveGroupStore } from "./shared-elective-groups.mjs";
import { refreshFallbackFromCatalog } from "./fallback-hydration.mjs";
import { readSettings, saveSettings } from "./settings.mjs";
import { preparePlanForEditor } from "./plan-input.mjs";

const thisFile = fileURLToPath(import.meta.url);
const guiDir = path.join(projectRoot, "gui");
const distDir = path.join(projectRoot, "dist");
const fontDir = path.resolve(process.env.SAAD_FONT_DIR ?? path.join(projectRoot, "font"));
const defaultPort = Number(process.env.PORT || 4174);

function openDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const command = process.platform === "win32"
    ? "explorer.exe"
    : process.platform === "darwin" ? "open" : "xdg-open";
  const child = spawn(command, [directory], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
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

function serveFile(res, filePath, type) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return text(res, 404, "Not found");
  }
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
  fs.createReadStream(filePath).pipe(res);
}

function safeFile(root, relative) {
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  return target;
}

function distUrl(filePath, root = distDir) {
  const relative = path.relative(root, filePath).split(path.sep).map(encodeURIComponent).join("/");
  return `/dist/${relative}`;
}

function contentType(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".pdf": "application/pdf",
    ".json": "application/json; charset=utf-8",
    ".ttf": "font/ttf",
  }[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export function createGuiServer(options = {}) {
  const institutions = options.institutionRepository ?? defaultInstitutionRepository;
  const catalogService = options.catalogService ?? defaultCatalogService;
  const outputRoot = path.resolve(options.outputRoot ?? distDir);
  const exportDraftFn = options.exportDraftFn ?? exportDraft;
  const openOutputFn = options.openOutputFn ?? openDirectory;

  function institutionContext(institutionId) {
    const institution = institutions.get(institutionId);
    const store = institutions.planStore(institution.id);
    const settingsFile = institutions.settingsPath(institution.id);
    const sharedSetStore = createSharedSemesterSetStore({
      root: institutions.sharedSemesterSourcesRoot(institution.id),
      planStore: store,
      catalogService,
    });
    const sharedElectiveStore = createSharedElectiveGroupStore({
      root: institutions.sharedElectiveSourcesRoot(institution.id),
      planStore: store,
      catalogService,
    });
    return {
      institution,
      store,
      settingsFile,
      sharedSetStore,
      sharedElectiveStore,
    };
  }

  function selectedContext(url, body = {}) {
    const institutionId = body.institutionId
      ?? url.searchParams.get("institutionId")
      ?? institutions.list()[0]?.id;
    if (!institutionId) throw new Error("Create an institution first.");
    return institutionContext(institutionId);
  }

  function pipelineOptions(context, collegeId = null) {
    const college = collegeId ? context.store.getCollege(collegeId) : null;
    return {
      catalogService,
      metadata: {
        institutionId: context.institution.id,
        collegeId: college?.id ?? null,
        university: context.institution.name,
        college: college?.name ?? "",
      },
      settings: readSettings(context.settingsFile),
      sharedSemesterSets: context.sharedSetStore.load(),
      sharedElectiveGroups: context.sharedElectiveStore.load(),
    };
  }

  async function api(req, res, url) {
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

    if (req.method === "GET" && url.pathname === "/api/state") {
      const context = selectedContext(url);
      return json(res, 200, {
        ok: true,
        institutions: institutions.list(),
        selectedInstitutionId: context.institution.id,
        colleges: context.store.listColleges(),
        catalog: catalogService.summary(),
        settings: readSettings(context.settingsFile),
        sharedSemesterSets: context.sharedSetStore.list(),
        sharedElectiveGroups: context.sharedElectiveStore.list(),
      });
    }
    if (req.method === "GET" && url.pathname === "/api/catalog/search") {
      return json(res, 200, {
        ok: true,
        courses: catalogService.search(url.searchParams.get("q") ?? ""),
      });
    }
    if (req.method === "GET" && url.pathname === "/api/catalog/course") {
      return json(res, 200, {
        ok: true,
        course: catalogService.resolve(url.searchParams.get("code") ?? ""),
      });
    }
    if (req.method === "POST" && ["/api/validate", "/api/preview"].includes(url.pathname)) {
      const body = await readBody(req);
      const context = selectedContext(url, body);
      const operation = url.pathname === "/api/preview" ? renderDraftPreview : resolveDraft;
      const result = operation(body.plan, pipelineOptions(context, body.collegeId));
      return json(res, 200, url.pathname === "/api/validate" ? {
        ok: result.ok,
        plan: result.plan,
        diagnostics: result.diagnostics,
        pageLayouts: result.document?.pageLayouts ?? [],
      } : result);
    }
    if (req.method === "POST" && url.pathname === "/api/generate") {
      const body = await readBody(req);
      const context = selectedContext(url, body);
      const planToExport = body.save
        ? context.store.savePlan(body.collegeId, body.majorId, body.plan)
        : body.plan;
      const result = exportDraftFn(planToExport, {
        ...pipelineOptions(context, body.collegeId),
        outputRoot,
        keepSvg: Boolean(body.keepSvg),
        png: Boolean(body.png),
      });
      return json(res, 200, {
        ok: true,
        diagnostics: result.diagnostics,
        pageLayouts: result.document.pageLayouts,
        files: {
          pdf: result.paths.pdfPath
            ? `${distUrl(result.paths.pdfPath, outputRoot)}?v=${Date.now()}`
            : null,
          svg: body.keepSvg
            ? `${distUrl(result.paths.svgPath, outputRoot)}?v=${Date.now()}`
            : null,
          png: body.png
            ? `${distUrl(result.paths.pngPath, outputRoot)}?v=${Date.now()}`
            : null,
          folder: result.paths.folder,
        },
      });
    }
    if (req.method === "POST" && url.pathname === "/api/open-output") {
      openOutputFn(outputRoot);
      return json(res, 200, { ok: true, folder: outputRoot });
    }
    if (req.method === "POST" && url.pathname === "/api/fallback/refresh") {
      const body = await readBody(req);
      const refreshed = refreshFallbackFromCatalog(
        body.owner,
        body.code,
        catalogService.snapshot().catalog,
      );
      return json(res, 200, { ok: true, owner: refreshed });
    }
    if (req.method === "PUT" && segments[1] === "colors" && segments.length === 3) {
      const body = await readBody(req);
      const color = String(body.color ?? "").toUpperCase();
      if (!/^#[0-9A-F]{6}$/u.test(color)) {
        throw new Error("Color must be a six-digit hex value.");
      }
      const state = catalogService.snapshot();
      atomicWriteJson(catalogService.colorsPath, { ...state.colors, [segments[2]]: color });
      return json(res, 200, { ok: true, subject: segments[2], color });
    }

    if (segments[1] === "institutions") {
      if (segments.length === 2 && req.method === "POST") {
        return json(res, 201, { ok: true, institution: institutions.create(await readBody(req)) });
      }
      const institutionId = segments[2];
      if (segments.length === 3 && req.method === "PUT") {
        return json(res, 200, {
          ok: true,
          institution: institutions.update(institutionId, await readBody(req)),
        });
      }
      if (segments.length === 3 && req.method === "DELETE") {
        institutions.remove(institutionId);
        return json(res, 200, { ok: true });
      }
      const context = institutionContext(institutionId);
      if (segments[3] === "settings" && segments.length === 4 && req.method === "PUT") {
        return json(res, 200, {
          ok: true,
          settings: saveSettings(await readBody(req), context.settingsFile),
        });
      }
      if (segments[3] === "shared-semester-sources") {
        const sourceId = segments[4];
        if (segments.length === 4 && req.method === "POST") {
          return json(res, 201, {
            ok: true,
            sharedSemesterSet: context.sharedSetStore.create(await readBody(req)),
          });
        }
        if (segments.length === 5 && req.method === "GET") {
          return json(res, 200, {
            ok: true,
            sharedSemesterSet: context.sharedSetStore.get(sourceId),
          });
        }
        if (segments.length === 5 && req.method === "PUT") {
          return json(res, 200, {
            ok: true,
            sharedSemesterSet: context.sharedSetStore.save(await readBody(req), sourceId),
          });
        }
        if (segments.length === 5 && req.method === "DELETE") {
          context.sharedSetStore.remove(sourceId);
          return json(res, 200, { ok: true });
        }
        if (segments[5] === "duplicate" && req.method === "POST") {
          return json(res, 201, {
            ok: true,
            sharedSemesterSet: context.sharedSetStore.duplicate(sourceId, await readBody(req)),
          });
        }
      }
      if (segments[3] === "shared-elective-sources") {
        const sourceId = segments[4];
        if (segments.length === 4 && req.method === "POST") {
          return json(res, 201, {
            ok: true,
            sharedElectiveGroup: context.sharedElectiveStore.create(await readBody(req)),
          });
        }
        if (segments.length === 5 && req.method === "GET") {
          return json(res, 200, {
            ok: true,
            sharedElectiveGroup: context.sharedElectiveStore.get(sourceId),
          });
        }
        if (segments.length === 5 && req.method === "PUT") {
          return json(res, 200, {
            ok: true,
            sharedElectiveGroup: context.sharedElectiveStore.save(await readBody(req), sourceId),
          });
        }
        if (segments.length === 5 && req.method === "DELETE") {
          context.sharedElectiveStore.remove(sourceId);
          return json(res, 200, { ok: true });
        }
        if (segments[5] === "duplicate" && req.method === "POST") {
          return json(res, 201, {
            ok: true,
            sharedElectiveGroup: context.sharedElectiveStore.duplicate(
              sourceId,
              await readBody(req),
            ),
          });
        }
      }
      if (segments[3] === "colleges") {
        if (segments.length === 4 && req.method === "POST") {
          return json(res, 201, {
            ok: true,
            college: context.store.createCollege(await readBody(req)),
          });
        }
        const collegeId = segments[4];
        if (segments.length === 5 && req.method === "PUT") {
          return json(res, 200, {
            ok: true,
            college: context.store.updateCollege(collegeId, await readBody(req)),
          });
        }
        if (segments.length === 5 && req.method === "DELETE") {
          context.store.deleteCollege(collegeId);
          return json(res, 200, { ok: true });
        }
        if (segments[5] === "majors") {
          if (segments.length === 6 && req.method === "POST") {
            return json(res, 201, {
              ok: true,
              plan: context.store.createMajor(collegeId, await readBody(req)),
            });
          }
          const majorId = segments[6];
          const metadata = institutions.metadata(institutionId, collegeId);
          if (segments.length === 7 && req.method === "GET") {
            return json(res, 200, {
              ok: true,
              plan: {
                ...preparePlanForEditor(context.store.getPlan(collegeId, majorId)),
                ...metadata,
              },
            });
          }
          if (segments.length === 7 && req.method === "PUT") {
            const plan = context.store.savePlan(collegeId, majorId, await readBody(req));
            return json(res, 200, {
              ok: true,
              plan: { ...preparePlanForEditor(plan), ...metadata },
            });
          }
          if (segments.length === 7 && req.method === "DELETE") {
            context.store.deleteMajor(collegeId, majorId);
            return json(res, 200, { ok: true });
          }
          if (segments[7] === "duplicate" && req.method === "POST") {
            return json(res, 201, {
              ok: true,
              plan: context.store.duplicateMajor(collegeId, majorId, await readBody(req)),
            });
          }
        }
      }
    }
    return json(res, 404, { ok: false, error: "API route not found." });
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      if (req.method === "GET" && url.pathname === "/") {
        return serveFile(res, path.join(guiDir, "index.html"), contentType("index.html"));
      }
      if (req.method === "GET" && url.pathname.startsWith("/gui/")) {
        const target = safeFile(guiDir, decodeURIComponent(url.pathname.slice("/gui/".length)));
        return target ? serveFile(res, target, contentType(target)) : text(res, 403, "Forbidden");
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
        return serveFile(
          res,
          path.join(projectRoot, "assets", path.basename(url.pathname)),
          contentType(url.pathname),
        );
      }
      if (req.method === "GET" && url.pathname.startsWith("/dist/")) {
        const target = safeFile(outputRoot, decodeURIComponent(url.pathname.slice("/dist/".length)));
        return target ? serveFile(res, target, contentType(target)) : text(res, 403, "Forbidden");
      }
      return text(res, 404, "Not found");
    } catch (error) {
      const status = /not found/iu.test(error.message) ? 404 : 400;
      return json(res, status, {
        ok: false,
        error: error.message,
        diagnostics: error.diagnostics,
      });
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
