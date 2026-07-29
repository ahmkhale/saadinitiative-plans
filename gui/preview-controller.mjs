export function courseDetailsOpenState({ currentOpen, unresolved, wasPending, placeholder }) {
  return unresolved && wasPending && !placeholder ? true : currentOpen;
}

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
        majorId: state.selectedMajorId,
        trackId: state.selectedTrackId,
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
    const actionable = items.filter((item) => item.severity !== "info");
    const informational = items.filter((item) => item.severity === "info");
    els.diagnosticCount.textContent = String(actionable.length);
    els.diagnosticLabel.textContent = actionable.length ? "التنبيهات التي تحتاج مراجعة" : "لا تنبيهات مانعة";
    if (!items.length) {
      els.diagnosticList.innerHTML = '<p class="muted">لا تنبيهات.</p>';
      return;
    }
    const renderItems = (values) => values.map((item) => `
      <button class="diagnostic ${item.severity === "errors" ? "error" : item.severity === "warnings" ? "warning" : "info"}" type="button" data-focus="${escapeHtml(item.location ?? (item.semester ? `semester-${item.semester}` : ""))}">
        <strong>${escapeHtml(item.code)}</strong><br>${escapeHtml(item.message)}
      </button>
    `).join("");
    els.diagnosticList.innerHTML = [
      renderItems(actionable),
      informational.length ? `
        <details class="diagnostic-info-group">
          <summary>${informational.length.toLocaleString("ar-SA")} ملاحظات معلوماتية غير مانعة</summary>
          <div class="diagnostic-info-list">${renderItems(informational)}</div>
        </details>` : "",
    ].join("");
  }

  function refreshResolvedRows() {
    document.querySelectorAll(".course-row").forEach((row) => {
      const groupIndex = Number(row.dataset.groupIndex);
      const courseIndex = Number(row.dataset.courseIndex);
      const resolved = resolvedCollection(row.dataset.kind, groupIndex)[courseIndex];
      const wasPending = row.classList.contains("pending");
      const pending = !resolved;
      const unresolved = resolved?.source === "unresolved";
      const placeholder = row.dataset.placeholderId !== "";
      row.classList.toggle("pending", pending);
      row.classList.toggle("unresolved", unresolved);
      row.querySelector(".course-code").textContent = placeholder ? "مقرر" : resolved?.code
        ?? entryCode(collection(row.dataset.kind, groupIndex)[courseIndex]);
      row.querySelector(".course-name").textContent = resolved?.name ?? "مقرر غير موجود في الدليل";
      const badges = row.querySelector(".badge-list");
      if (badges) badges.innerHTML = courseBadges(resolved, placeholder);
      const metadata = row.querySelectorAll(".course-meta");
      if (metadata[0]) metadata[0].textContent = placeholder ? "" : resolved?.subject ?? "";
      if (metadata[1]) metadata[1].textContent = resolved?.hoursDisplay === "unknown"
        ? `${resolved.academicHours ?? "—"} ساعات · محاضرة — · عملي — · تمارين —`
        : resolved
          ? `${resolved.academicHours ?? "—"} ساعات · محاضرة ${resolved.lectureHours ?? 0} · عملي ${resolved.practicalHours ?? 0} · تمارين ${resolved.exerciseHours ?? 0}`
          : "";
      if (metadata[2]) metadata[2].textContent = resolved?.prerequisites?.length
        ? `سابق: ${resolved.prerequisites.join("، ")}`
        : "لا متطلب سابق";
      const details = row.querySelector(".course-details");
      if (details) {
        const summary = details.querySelector("summary");
        if (summary) summary.textContent = unresolved ? "أكمل بيانات المقرر" : "تفاصيل المقرر وقواعد الخطة";
        const optionalActivityHours = row.dataset.optionalActivityHours === "true";
        details.querySelectorAll("[data-manual-fact]").forEach((input) => {
          const isActivity = ["lectureHours", "exerciseHours", "practicalHours"]
            .includes(input.dataset.manualFact);
          input.toggleAttribute("required", unresolved && !(optionalActivityHours && isActivity));
        });
        details.open = courseDetailsOpenState({
          currentOpen: details.open,
          unresolved,
          wasPending,
          placeholder,
        });
      }
    });
    document.querySelectorAll("[data-shared-elective-reference]").forEach((card) => {
      const sourceId = card.dataset.sharedElectiveReference;
      const source = state.sharedElectiveGroups.find((item) => item.id === sourceId);
      const resolved = state.resolved?.electiveGroups?.find((group) => group.sourceId === sourceId);
      if (!resolved) return;
      const summary = card.querySelector("[data-shared-elective-summary]");
      const excluded = card.querySelector("[data-shared-elective-excluded]");
      const candidates = card.querySelector("[data-shared-elective-candidates]");
      if (summary) summary.textContent = `المتطلب الأصلي: ${source?.requiredHours ?? "—"} ساعات · المتبقي: ${resolved.requiredHours ?? "—"} ساعات`;
      if (excluded) excluded.textContent = `المستبعدة لوجودها في الفصول: ${resolved.excludedCourses?.map((course) => course.code).join("، ") || "لا يوجد"}`;
      if (candidates) candidates.textContent = `المرشحات المتبقية: ${resolved.courses?.map((course) => course.code).join("، ") || "لا يوجد"}`;
    });
  }

  return { changed, refreshPreview, releasePreviewUrls, renderDiagnostics, schedulePreview };
}
