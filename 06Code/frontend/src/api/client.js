export async function apiRequest(path, options = {}) {
  const response = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'No se pudo completar la solicitud.');
  return payload;
}

export function postJson(path, body) {
  return apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
}

export function patchJson(path, body) {
  return apiRequest(path, { method: 'PATCH', body: JSON.stringify(body) });
}
