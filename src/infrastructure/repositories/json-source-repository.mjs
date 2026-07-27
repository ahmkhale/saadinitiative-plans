import fs from "node:fs";
import path from "node:path";
import { assertSafeId, atomicWriteJson } from "./plan-repository.mjs";

export function createJsonSourceRepository(options) {
  const root = path.resolve(options.root);
  const idField = options.idField ?? "sourceId";
  const entityName = options.entityName ?? "Source";
  const clean = options.clean;
  const usages = options.usages ?? (() => []);
  const beforeSave = options.beforeSave ?? ((value) => value);
  const duplicateValue = options.duplicateValue ?? ((source, input) => ({ ...source, ...input }));
  const sort = options.sort ?? ((a, b) => String(a.name ?? a.id).localeCompare(String(b.name ?? b.id), "ar"));

  if (typeof clean !== "function") throw new Error("createJsonSourceRepository requires a clean function.");

  const fileFor = (id) => path.join(root, `${assertSafeId(id, idField)}.json`);
  const readFile = (filePath, forcedId = null) => clean(JSON.parse(fs.readFileSync(filePath, "utf8")), forcedId);

  function load() {
    const map = new Map();
    if (!fs.existsSync(root)) return map;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".json") continue;
      const value = readFile(path.join(root, entry.name));
      map.set(value.id, value);
    }
    return map;
  }

  function list() {
    return [...load().values()]
      .map((value) => ({ ...value, usages: usages(value.id) }))
      .sort(sort);
  }

  function get(id) {
    const normalizedId = assertSafeId(id, idField);
    const filePath = fileFor(normalizedId);
    if (!fs.existsSync(filePath)) throw new Error(`${entityName} not found: ${normalizedId}`);
    return { ...readFile(filePath, normalizedId), usages: usages(normalizedId) };
  }

  function save(input, previousId = null) {
    let value = clean(input);
    value = beforeSave(value);
    const target = fileFor(value.id);
    if (previousId && previousId !== value.id) {
      const previous = fileFor(previousId);
      if (fs.existsSync(target)) throw new Error(`${entityName} already exists: ${value.id}`);
      if (fs.existsSync(previous)) fs.renameSync(previous, target);
    }
    atomicWriteJson(target, value);
    return get(value.id);
  }

  function create(input) {
    const normalizedId = assertSafeId(input?.id, idField);
    if (fs.existsSync(fileFor(normalizedId))) throw new Error(`${entityName} already exists: ${normalizedId}`);
    return save(input);
  }

  function duplicate(id, input) {
    const source = get(id);
    return create(duplicateValue(source, input));
  }

  function remove(id) {
    const normalizedId = assertSafeId(id, idField);
    const usedBy = usages(normalizedId);
    if (usedBy.length) throw new Error(`${entityName} '${normalizedId}' is used by ${usedBy.length} major(s).`);
    const filePath = fileFor(normalizedId);
    if (!fs.existsSync(filePath)) throw new Error(`${entityName} not found: ${normalizedId}`);
    fs.rmSync(filePath);
  }

  return Object.freeze({ root, fileFor, load, list, get, save, create, duplicate, remove, usages });
}
