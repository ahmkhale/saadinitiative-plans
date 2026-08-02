export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...(options.headers ?? {}) }
      : options.headers,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || `تعذر إتمام الطلب (${response.status}).`)
  }
  return body as T
}

export function jsonBody(value: unknown): Pick<RequestInit, "body" | "headers"> {
  return {
    body: JSON.stringify(value),
    headers: { "Content-Type": "application/json" },
  }
}

