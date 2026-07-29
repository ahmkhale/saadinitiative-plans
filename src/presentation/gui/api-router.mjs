import { refreshFallbackFromCatalog } from "../../application/hydrate-fallbacks.mjs";
import { exportInstitutionPlans } from "../../application/export-institution.mjs";
import { renderDraftPreview, resolveDraft } from "../../application/preview-plan.mjs";
import { readSettings, saveSettings } from "../../infrastructure/repositories/settings-repository.mjs";
import { saveCourseColorAliases } from "../../infrastructure/repositories/course-color-repository.mjs";
import { distUrl, json, readBody } from "./http.mjs";

export function createGuiApiRouter(options) {
  const {
    institutions,
    catalogService,
    contextService,
    outputRoot,
    exportDraftFn,
    openOutputFn,
  } = options;

  return async function routeGuiApi(req, res, url) {
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const { institutionContext, selectedContext, pipelineOptions } = contextService;

    if (req.method === "GET" && url.pathname === "/api/state") {
      const context = selectedContext(url);
      return json(res, 200, {
        ok: true,
        institutions: institutions.list(),
        selectedInstitutionId: context.institution.id,
        colleges: context.store.listColleges(),
        catalog: catalogService.summary(),
        colors: catalogService.snapshot().colors,
        settings: readSettings(context.settingsFile),
        sharedSemesterSets: context.sharedSetStore.list(),
        sharedElectiveGroups: context.sharedElectiveStore.list(),
      });
    }
    if (req.method === "GET" && url.pathname === "/api/catalog/search") {
      return json(res, 200, { ok: true, courses: catalogService.search(url.searchParams.get("q") ?? "") });
    }
    if (req.method === "GET" && url.pathname === "/api/catalog/course") {
      return json(res, 200, { ok: true, course: catalogService.resolve(url.searchParams.get("code") ?? "") });
    }
    if (req.method === "POST" && ["/api/validate", "/api/preview"].includes(url.pathname)) {
      const body = await readBody(req);
      const context = selectedContext(url, body);
      const operation = url.pathname === "/api/preview" ? renderDraftPreview : resolveDraft;
      const plan = body.majorId
        ? context.store.getComposedPlan(body.collegeId, body.majorId, body.trackId, body.plan)
        : body.plan;
      const result = operation(plan, pipelineOptions(context, body.collegeId));
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
      const savedPlan = body.save
        ? context.store.savePlan(body.collegeId, body.majorId, body.plan, body.trackId)
        : body.plan;
      const planToExport = body.majorId
        ? context.store.getComposedPlan(body.collegeId, body.majorId, body.trackId, savedPlan)
        : savedPlan;
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
        pdfOptimization: result.exportResult?.pdfOptimization ?? null,
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
    if (req.method === "POST" && url.pathname === "/api/fallback/refresh") {
      const body = await readBody(req);
      const refreshed = refreshFallbackFromCatalog(body.owner, body.code, catalogService.snapshot().catalog);
      return json(res, 200, { ok: true, owner: refreshed });
    }
    if (req.method === "PUT" && segments[1] === "colors" && [2, 3].includes(segments.length)) {
      const body = await readBody(req);
      const state = catalogService.snapshot();
      const subjects = body.subjects ?? (segments[2] ? [segments[2]] : []);
      const colors = saveCourseColorAliases({
        colors: state.colors,
        subjects,
        previousSubjects: body.previousSubjects,
        color: body.color,
      }, catalogService.colorsPath);
      return json(res, 200, { ok: true, subjects, color: String(body.color).toUpperCase(), colors });
    }

    if (segments[1] !== "institutions") {
      return json(res, 404, { ok: false, error: "API route not found." });
    }

    if (segments.length === 2 && req.method === "POST") {
      return json(res, 201, { ok: true, institution: institutions.create(await readBody(req)) });
    }
    const institutionId = segments[2];
    if (segments[3] === "generate" && segments.length === 4 && req.method === "POST") {
      const body = await readBody(req);
      const context = institutionContext(institutionId);
      const result = exportInstitutionPlans({
        store: context.store,
        exportPlan: exportDraftFn,
        optionsForCollege: (collegeId) => pipelineOptions(context, collegeId),
        outputRoot,
        keepSvg: Boolean(body.keepSvg),
        png: Boolean(body.png),
      });
      return json(res, 200, {
        ok: result.failed.length === 0,
        total: result.total,
        exported: result.exported.map((item) => ({
          ...item,
          pdf: `${distUrl(item.pdfPath, outputRoot)}?v=${Date.now()}`,
        })),
        failed: result.failed,
      });
    }
    if (segments.length === 3 && req.method === "PUT") {
      return json(res, 200, { ok: true, institution: institutions.update(institutionId, await readBody(req)) });
    }
    if (segments.length === 3 && req.method === "DELETE") {
      institutions.remove(institutionId);
      return json(res, 200, { ok: true });
    }

    const context = institutionContext(institutionId);
    if (segments[3] === "settings" && segments.length === 4 && req.method === "PUT") {
      return json(res, 200, { ok: true, settings: saveSettings(await readBody(req), context.settingsFile) });
    }
    if (segments[3] === "shared-semester-sources") {
      return routeSharedSource({ req, res, segments, store: context.sharedSetStore, responseKey: "sharedSemesterSet" });
    }
    if (segments[3] === "shared-elective-sources") {
      return routeSharedSource({ req, res, segments, store: context.sharedElectiveStore, responseKey: "sharedElectiveGroup" });
    }
    if (segments[3] === "colleges") {
      return routeColleges({ req, res, segments, context, institutions, institutionId });
    }
    return json(res, 404, { ok: false, error: "API route not found." });
  };
}

async function routeSharedSource({ req, res, segments, store, responseKey }) {
  const sourceId = segments[4];
  if (segments.length === 4 && req.method === "POST") {
    return json(res, 201, { ok: true, [responseKey]: store.create(await readBody(req)) });
  }
  if (segments.length === 5 && req.method === "GET") {
    return json(res, 200, { ok: true, [responseKey]: store.get(sourceId) });
  }
  if (segments.length === 5 && req.method === "PUT") {
    return json(res, 200, { ok: true, [responseKey]: store.save(await readBody(req), sourceId) });
  }
  if (segments.length === 5 && req.method === "DELETE") {
    store.remove(sourceId);
    return json(res, 200, { ok: true });
  }
  if (segments[5] === "duplicate" && req.method === "POST") {
    return json(res, 201, { ok: true, [responseKey]: store.duplicate(sourceId, await readBody(req)) });
  }
  return json(res, 404, { ok: false, error: "Shared-source route not found." });
}

async function routeColleges({ req, res, segments, context, institutions, institutionId }) {
  if (segments.length === 4 && req.method === "POST") {
    return json(res, 201, { ok: true, college: context.store.createCollege(await readBody(req)) });
  }
  const collegeId = segments[4];
  if (segments.length === 5 && req.method === "PUT") {
    return json(res, 200, { ok: true, college: context.store.updateCollege(collegeId, await readBody(req)) });
  }
  if (segments.length === 5 && req.method === "DELETE") {
    context.store.deleteCollege(collegeId);
    return json(res, 200, { ok: true });
  }
  if (segments[5] !== "majors") return json(res, 404, { ok: false, error: "College route not found." });
  if (segments.length === 6 && req.method === "POST") {
    return json(res, 201, { ok: true, plan: context.store.createMajor(collegeId, await readBody(req)) });
  }
  const majorId = segments[6];
  const metadata = institutions.metadata(institutionId, collegeId);
  if (segments.length === 7 && req.method === "GET") {
    return json(res, 200, {
      ok: true,
      plan: { ...context.store.getPlanForEditor(collegeId, majorId), ...metadata },
    });
  }
  if (segments.length === 7 && req.method === "PUT") {
    const plan = context.store.savePlan(collegeId, majorId, await readBody(req));
    return json(res, 200, {
      ok: true,
      plan: { ...context.store.getPlanForEditor(collegeId, plan.id), ...metadata },
    });
  }
  if (segments.length === 7 && req.method === "DELETE") {
    context.store.deleteMajor(collegeId, majorId);
    return json(res, 200, { ok: true });
  }
  if (segments[7] === "duplicate" && req.method === "POST") {
    return json(res, 201, { ok: true, plan: context.store.duplicateMajor(collegeId, majorId, await readBody(req)) });
  }
  if (segments[7] === "tracks" && segments.length === 8 && req.method === "POST") {
    return json(res, 201, {
      ok: true,
      plan: context.store.createTrack(collegeId, majorId, await readBody(req)),
    });
  }
  if (segments[7] === "tracks" && segments.length === 9) {
    const trackId = segments[8];
    if (req.method === "GET") {
      return json(res, 200, {
        ok: true,
        plan: {
          ...context.store.getPlanForEditor(collegeId, majorId, trackId),
          ...metadata,
        },
        parentPlan: {
          ...context.store.getPlanForEditor(collegeId, majorId),
          ...metadata,
        },
      });
    }
    if (req.method === "PUT") {
      const plan = context.store.savePlan(collegeId, majorId, await readBody(req), trackId);
      return json(res, 200, {
        ok: true,
        plan: {
          ...context.store.getPlanForEditor(collegeId, plan.id, trackId),
          ...metadata,
        },
        parentPlan: {
          ...context.store.getPlanForEditor(collegeId, plan.id),
          ...metadata,
        },
      });
    }
    if (req.method === "DELETE") {
      context.store.deleteTrack(collegeId, majorId, trackId);
      return json(res, 200, { ok: true });
    }
  }
  return json(res, 404, { ok: false, error: "Major route not found." });
}
