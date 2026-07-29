import { escapeHtml } from "./html.mjs";

export function parseColorKeywords(value) {
  return Array.from(new Set(
    String(value ?? "")
      .split(/[&,،\n]+/u)
      .map((keyword) => keyword.trim())
      .filter(Boolean),
  ));
}

function keywordFamily(keyword) {
  return keyword
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/gu, "")
    .replace(/[إأآٱ]/gu, "ا")
    .replace(/ى/gu, "ي");
}

export function groupCourseColors(colors = {}) {
  const groups = new Map();
  for (const [subject, color] of Object.entries(colors)) {
    const key = `${keywordFamily(subject)}:${color.toUpperCase()}`;
    const group = groups.get(key) ?? { subjects: [], color: color.toUpperCase() };
    group.subjects.push(subject);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => left.subjects[0].localeCompare(right.subjects[0], "ar"));
}

export function renderColorRows(container, colors) {
  container.innerHTML = groupCourseColors(colors).map(({ subjects, color }) => {
    const keywords = subjects.join(" & ");
    return `
      <form class="color-row" data-previous-subjects="${escapeHtml(keywords)}">
        <label>رموز القسم<input data-color-subjects value="${escapeHtml(keywords)}" required></label>
        <label>اللون<input data-color-value type="color" value="${escapeHtml(color)}"></label>
        <code>${escapeHtml(color)}</code>
        <button class="button ghost" type="submit">حفظ</button>
      </form>
    `;
  }).join("");
}

export function createColorEditor({
  container,
  form,
  subjectInput,
  colorInput,
  state,
  request,
  setStatus,
  schedulePreview,
}) {
  const render = () => renderColorRows(container, state.courseColors);

  async function save(subjects, color, previousSubjects) {
    const result = await request("/api/colors", {
      method: "PUT",
      body: JSON.stringify({ subjects, previousSubjects, color }),
    });
    state.courseColors = result.colors;
    render();
    schedulePreview(0);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await save(parseColorKeywords(subjectInput.value), colorInput.value);
    subjectInput.value = "";
    setStatus("حُفظ اللون العام.", "success");
  });

  container.addEventListener("submit", async (event) => {
    const row = event.target.closest(".color-row");
    if (!row) return;
    event.preventDefault();
    await save(
      parseColorKeywords(row.querySelector("[data-color-subjects]").value),
      row.querySelector("[data-color-value]").value,
      parseColorKeywords(row.dataset.previousSubjects),
    );
    setStatus("حُدّث لون رموز المقرر.", "success");
  });

  return { render };
}
