export async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...(options.headers ?? {}) }
      : options.headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `تعذر إتمام الطلب (${response.status}).`);
  }
  return body;
}
