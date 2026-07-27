export function createPreviewController(options) {
  const {
    state,
    els,
    request,
    setDirty,
    setStatus,
    syncProposalWithPublished,
    renderEditor,
    escapeHtml,
    resolvedCollection,
    collection,
    entryCode,
    courseBadges,
  } = options;

  function changed(render = false) {
    syncProposalWithPublished();
    setDirty(true);
    if (render) renderEditor();
    schedulePreview();
  }

  function schedulePreview(delay = 350) {
    clearTimeout(state.previewTimer);
    state.previewTimer = setTimeout(() => refreshPreview().catch((error) => setStatus(error.message, "error")), delay);
  }

  function releasePreviewUrls() {
    els.previewHost.replaceChildren();
  }

  async function refreshPreview() {
    if (!state.plan) return;
    const result = await request("/api/preview", {
      method: "POST",
      body: JSON.stringify({
        institutionId: state.selectedInstitutionId,
        collegeId: state.selectedCollegeId,
        plan: state.plan,
      }),
    });
    state.resolved = result.plan;
    state.diagnostics = result.diagnostics;
    state.pageLayouts = result.pageLayouts;
    const hasBlockingErrors = result.diagnostics.summary.errors > 0;
    els.generateButton.disabled = hasBlockingErrors;
    els.generateDraftButton.disabled = hasBlockingErrors;
    const exportReason = hasBlockingErrors ? "عالج الأخطاء قبل إنشاء ملف PDF." : "";
    els.generateButton.title = exportReason;
    els.generateDraftButton.title = exportReason;
    renderDiagnostics();
    els.unresolvedCount.textContent = String(result.diagnostics.items.filter((item) => item.code === "UNRESOLVED_COURSE").length);
    releasePreviewUrls();
    if (!result.pages.length) {
      els.previewHost.innerHTML = '<p>تعذر إنشاء المعاينة. راجع الأخطاء أدناه.</p>';
      els.previewDimensions.textContent = "—";
    } else {
      await document.fonts.ready;
      result.pages.forEach((svg, index) => {
        const page = document.createElement("div");
        page.className = "preview-page";
        page.innerHTML = svg;
        page.setAttribute("aria-label", `معاينة الصفحة ${index + 1}`);
        els.previewHost.append(page);
      });
      els.previewDimensions.textContent = result.pageLayouts
        .map((page, index) => `${index + 1}: ${page.width} × ${Number(page.height.toFixed(3))} pt`)
        .join(" · ");
    }
    refreshResolvedRows();
  }

  function renderDiagnostics() {
    const items = state.diagnostics?.items ?? [];
    els.diagnosticCount.textContent = String(items.length);
    if (!items.length) {
      els.diagnosticList.innerHTML = '<p class="muted">لا تنبيهات.</p>';
      return;
    }
    els.diagnosticList.innerHTML = items.map((item) => `
      <button class="diagnostic ${item.severity === "errors" ? "error" : item.severity === "warnings" ? "warning" : "info"}" type="button" data-focus="${escapeHtml(item.location ?? (item.semester ? `semester-${item.semester}` : ""))}">
        <strong>${escapeHtml(item.code)}</strong><br>${escapeHtml(item.message)}
      </button>
    `).join("");
  }

  function refreshResolvedRows() {
    document.querySelectorAll(".course-row").forEach((row) => {
      const groupIndex = Number(row.dataset.groupIndex);
      const courseIndex = Number(row.dataset.courseIndex);
      const resolved = resolvedCollection(row.dataset.kind, groupIndex)[courseIndex];
      const unresolved = !resolved || resolved.source === "unresolved";
      const placeholder = row.dataset.placeholderId !== "";
      row.classList.toggle("unresolved", unresolved);
      row.querySelector(".course-code").textContent = placeholder ? "مقرر" : resolved?.code
        ?? entryCode(collection(row.dataset.kind, groupIndex)[courseIndex]);
      row.querySelector(".course-name").textContent = resolved?.name ?? "مقرر غير موجود في الدليل";
      const badges = row.querySelector(".badge-list");
      if (badges) badges.innerHTML = courseBadges(resolved, placeholder);
      const metadata = row.querySelectorAll(".course-meta");
      if (metadata[0]) metadata[0].textContent = placeholder ? "" : resolved?.subject ?? "";
      if (metadata[1]) metadata[1].textContent = resolved
        ? `${resolved.academicHours ?? "—"} ساعات · محاضرة ${resolved.lectureHours ?? "—"} · عملي ${resolved.practicalHours ?? "—"} · تمارين ${resolved.exerciseHours ?? "—"}`
        : "";
      if (metadata[2]) metadata[2].textContent = resolved?.prerequisites?.length
        ? `سابق: ${resolved.prerequisites.join("، ")}`
        : "لا متطلب سابق";
    });
  }

  return { changed, refreshPreview, releasePreviewUrls, renderDiagnostics, schedulePreview };
}
