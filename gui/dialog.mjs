export function createDialogController({ els, escapeHtml }) {
  let resolver = null;

  function askForm({ title, message = "", submit = "حفظ", danger = false, fields = [] }) {
    els.dialogTitle.textContent = title;
    els.dialogMessage.textContent = message;
    els.dialogSubmit.textContent = submit;
    els.dialogSubmit.className = `button ${danger ? "danger-ghost" : "primary"}`;
    els.dialogFields.innerHTML = fields.map((field) => `
      <label>${escapeHtml(field.label)}
        ${field.options
          ? `<select name="${escapeHtml(field.name)}" ${field.required === false ? "" : "required"}>
              ${field.options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === field.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
            </select>`
          : `<input name="${escapeHtml(field.name)}" value="${escapeHtml(field.value ?? "")}" ${field.type ? `type="${escapeHtml(field.type)}"` : ""} ${field.required === false ? "" : "required"} ${field.min !== undefined ? `min="${field.min}"` : ""} ${field.dir ? `dir="${field.dir}"` : ""}>`}
      </label>
    `).join("");
    els.dialogFields.hidden = fields.length === 0;
    els.formDialog.showModal();
    els.dialogFields.querySelector("input, select")?.focus();
    return new Promise((resolve) => { resolver = resolve; });
  }

  function bind() {
    els.dialogForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = event.submitter?.value === "confirm"
        ? Object.fromEntries(new FormData(els.dialogForm).entries())
        : null;
      els.formDialog.close();
      const resolve = resolver;
      resolver = null;
      resolve?.(values);
    });
    els.formDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      els.formDialog.close();
      const resolve = resolver;
      resolver = null;
      resolve?.(null);
    });
  }

  return { askForm, bind };
}
