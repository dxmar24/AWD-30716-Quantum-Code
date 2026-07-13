export class ApiError extends Error {
  constructor(message, { status = 0, code = '', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function cookieValue(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const match = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!match) return '';
  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return '';
  }
}

export async function apiRequest(path, options = {}) {
  const { timeoutMs = 15000, headers: optionHeaders = {}, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const hasBody = fetchOptions.body !== undefined && fetchOptions.body !== null;
  const method = String(fetchOptions.method || 'GET').toUpperCase();
  const csrfToken = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? cookieValue('alc_csrf') : '';

  try {
    const response = await fetch(`/api/v1${path}`, {
      credentials: 'include',
      ...fetchOptions,
      headers: {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(csrfToken ? { 'X-CSRF-Token':csrfToken } : {}),
        ...optionHeaders,
      },
      signal:fetchOptions.signal || controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(payload?.message || 'No se pudo completar la solicitud.', {
        status:response.status,
        code:payload?.code || payload?.details?.code || '',
        details:payload?.details || null,
      });
    }
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError('La solicitud tardó demasiado. Comprueba tu conexión e intenta nuevamente.', { code:'REQUEST_TIMEOUT' });
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function postJson(path, body) {
  return apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
}

export function patchJson(path, body) {
  return apiRequest(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export function putJson(path, body) {
  return apiRequest(path, { method: 'PUT', body: JSON.stringify(body) });
}
