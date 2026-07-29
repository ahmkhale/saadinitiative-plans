import { entryCode, entryId } from "./plan-model.mjs";
import { escapeHtml } from "./html.mjs";

function icon(name) {
  return `<img src="/assets/icon-${name}.svg" alt="">`;
}

function badgeClass(label, source) {
  if (source === "male") return "male";
  if (source === "female") return "female";
  if (source === "manual") return "manual";
  if (label === "بيانات متعارضة") return "conflict";
  if (label === "بيانات ناقصة" || label === "غير موجود في الدليل") return "missing";
  return "";
}

export function courseBadges(resolved, isPlaceholder) {
  if (isPlaceholder) return '<span class="source-badge manual">مقرر نائب</span>';
  if (!resolved) return '<span class="source-badge pending">جارٍ التحقق من الدليل</span>';
  const sourceLabel = resolved?.sourceBadge ?? "غير موجود في الدليل";
  const quality = resolved?.qualityBadges ?? [];
  return [sourceLabel, ...quality]
    .map((label, index) => `<span class="source-badge ${badgeClass(label, index === 0 ? resolved?.catalogSource : null)}">${escapeHtml(label)}</span>`)
    .join("");
}

export function renderCourseRow({
  entry,
  resolved,
  kind,
  groupIndex,
  courseIndex,
  plan,
  fallbackCourses,
  escapeHtml,
}) {
  const code = entryCode(entry);
  const rules = typeof entry === "object" ? entry : {};
  const pending = !resolved;
  const unresolved = resolved?.source === "unresolved";
  const isPlaceholder = entry?.kind === "placeholder" || Boolean(entry?.placeholderId);
  const displayCode = isPlaceholder ? "مقرر" : resolved?.code ?? code;
  const displaySubject = isPlaceholder ? "" : resolved?.subject ?? "";
  const displayHours = resolved?.hoursDisplay === "unknown"
    ? `${resolved.academicHours ?? "—"} ساعات · محاضرة — · عملي — · تمارين —`
    : resolved
      ? `${resolved.academicHours ?? "—"} ساعات · محاضرة ${resolved.lectureHours ?? 0} · عملي ${resolved.practicalHours ?? 0} · تمارين ${resolved.exerciseHours ?? 0}`
      : "";
  const location = kind === "semester" ? `semester-${groupIndex + 1}` : kind === "elective"
    ? `elective-${plan.electiveGroups[groupIndex]?.id ?? groupIndex + 1}` : kind === "shared"
      ? `shared-semester-${groupIndex + 1}` : kind === "sharedElective"
        ? "shared-elective-source" : `proposal-semester-${groupIndex + 1}`;
  const fallback = fallbackCourses?.[code];
  return `
    <div class="course-row ${pending ? "pending" : unresolved ? "unresolved" : ""}" data-kind="${kind}" data-group-index="${groupIndex}" data-course-index="${courseIndex}" data-course-code="${escapeHtml(kind === "proposal" && !isPlaceholder ? entryId(entry) : code)}" data-placeholder-id="${escapeHtml(entry?.placeholderId ?? "")}" data-location="${escapeHtml(location)}" ${kind === "proposal" && !isPlaceholder ? 'draggable="true"' : ""}>
      <div class="course-identity"><div class="course-code">${escapeHtml(displayCode)}</div><div class="course-meta">${escapeHtml(displaySubject)}</div><div class="badge-list">${courseBadges(resolved, isPlaceholder)}</div></div>
      <div class="course-summary"><div class="course-name">${escapeHtml(resolved?.name ?? entry?.fallback?.name ?? fallback?.name ?? (pending ? "جارٍ قراءة بيانات المقرر…" : "مقرر غير موجود في الدليل"))}</div>
        <div class="course-meta">${displayHours}</div>
      </div>
      <div class="course-meta">${resolved?.prerequisites?.length ? `سابق: ${escapeHtml(resolved.prerequisites.join("، "))}` : "لا متطلب سابق"}</div>
      <div class="course-actions">
        ${kind === "proposal" && !isPlaceholder ? `
          <button class="icon-button proposal-course-up" type="button" aria-label="نقل المقرر إلى أعلى">${icon("chevron-up")}</button>
          <button class="icon-button proposal-course-down" type="button" aria-label="نقل المقرر إلى أسفل">${icon("chevron-down")}</button>
          <button class="button ghost proposal-course-previous" type="button">الفصل السابق</button>
          <button class="button ghost proposal-course-next" type="button">الفصل التالي</button>
          <button class="button ghost proposal-course-home" type="button">إعادة إلى المستوى المنشور</button>` : ""}
        ${kind === "proposal" && isPlaceholder ? `<button class="icon-button edit-placeholder" type="button" aria-label="تعديل المقرر النائب">${icon("edit")}</button>` : ""}
        ${kind !== "proposal" || isPlaceholder ? `<button class="icon-button course-delete danger" type="button" aria-label="حذف">${icon("trash")}</button>` : ""}
      </div>
      <details class="course-details" ${kind === "proposal" ? "hidden" : unresolved && !isPlaceholder ? "open" : ""}>
        <summary>${unresolved ? "أكمل بيانات المقرر" : "تفاصيل المقرر وقواعد الخطة"}</summary>
        ${!isPlaceholder ? `<p class="concept-heading">بيانات المقرر</p>
        <div class="facts-grid">
          <label class="wide">اسم المقرر<input data-manual-fact="name" value="${escapeHtml(fallback?.name ?? "")}" ${unresolved ? "required" : ""}></label>
          <label>الساعات الأكاديمية<input data-manual-fact="academicHours" type="number" min="0" value="${escapeHtml(fallback?.academicHours ?? "")}" ${unresolved ? "required" : ""}></label>
          <label>ساعات المحاضرة<input data-manual-fact="lectureHours" type="number" min="0" value="${escapeHtml(fallback?.lectureHours ?? "")}" ${unresolved ? "required" : ""}></label>
          <label>ساعات التمارين<input data-manual-fact="exerciseHours" type="number" min="0" value="${escapeHtml(fallback?.exerciseHours ?? "")}" ${unresolved ? "required" : ""}></label>
          <label>ساعات العملي<input data-manual-fact="practicalHours" type="number" min="0" value="${escapeHtml(fallback?.practicalHours ?? "")}" ${unresolved ? "required" : ""}></label>
          ${["male", "female"].includes(resolved?.catalogSource) && fallback ? '<button class="button ghost refresh-catalog-facts" type="button">تحديث البيانات من الدليل</button>' : ""}
          ${fallback?.source ? `<span class="source-badge">${fallback.manuallyEditedFields?.length ? "بيانات معدلة يدويًا" : "لقطة من الدليل"}</span>` : ""}
        </div>
        <p class="concept-heading">قواعد الخطة</p>` : ""}
        <div class="dependency-grid">
          ${!isPlaceholder ? `<label>المتطلبات السابقة<input data-dependency="prerequisites" value="${escapeHtml((rules.prerequisites ?? rules.override?.prerequisites ?? []).join("، "))}" placeholder="101 عال، 101 ريض"></label>
          <label>المتطلبات المرافقة<input data-dependency="corequisites" value="${escapeHtml((rules.corequisites ?? rules.override?.corequisites ?? []).join("، "))}"></label>
          <label>شروط المتطلب النصية<input data-dependency="prerequisiteConditions" value="${escapeHtml((rules.prerequisiteConditions ?? []).join("، "))}" placeholder="مستوى 7"></label>
          <label>الحد الأدنى للساعات المجتازة<input data-dependency="minimumCompletedCredits" type="number" min="0" value="${escapeHtml(rules.minimumCompletedCredits ?? rules.override?.minimumCompletedCredits ?? "")}"></label>
          <label class="check"><input data-track-specific type="checkbox" ${rules.trackSpecific ? "checked" : ""}> مقرر خاص بالمسار</label>` : ""}
        </div>
      </details>
    </div>
  `;
}
