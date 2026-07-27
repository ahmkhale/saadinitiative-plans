export function assertStableId(value, field = "id") {
  const id = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62})$/u.test(id)) {
    throw new Error(`${field} must use lowercase letters, numbers, and single hyphens only.`);
  }
  return id;
}
