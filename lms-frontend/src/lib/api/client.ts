export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

function baseUrl(serverBase?: string): string {
  if (serverBase) return serverBase;
  // Browser: same-origin relative base (e.g. /api/v1) → goes through the Next proxy.
  if (typeof window !== 'undefined') return process.env.NEXT_PUBLIC_API_URL!;
  // Server (SSR): call the backend directly. Prefer an explicit internal URL; otherwise
  // derive it from BACKEND_ORIGIN (which may be a full origin or a bare host, e.g. on Render).
  if (process.env.API_URL_INTERNAL) return process.env.API_URL_INTERNAL;
  const bo = process.env.BACKEND_ORIGIN;
  if (bo) return `${/^https?:\/\//.test(bo) ? bo : `https://${bo}`}/api/v1`;
  return process.env.NEXT_PUBLIC_API_URL!;
}

async function raw(path: string, init: RequestInit, cookieHeader?: string, serverBase?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as object) };
  if (cookieHeader) headers['cookie'] = cookieHeader;
  return fetch(`${baseUrl(serverBase)}${path}`, { ...init, headers, credentials: 'include' });
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  opts: { cookieHeader?: string; serverBase?: string } = {},
): Promise<T> {
  let res = await raw(path, init, opts.cookieHeader, opts.serverBase);

  // transparent refresh-on-401 (browser only; server passes through)
  if (res.status === 401 && typeof window !== 'undefined' && path !== '/auth/refresh') {
    const refresh = await raw('/auth/refresh', { method: 'POST' });
    if (refresh.ok) {
      res = await raw(path, init, opts.cookieHeader, opts.serverBase);
    } else {
      // Refresh failed → the session is expired OR was superseded by a login elsewhere
      // (single-session). Send the (now logged-out) session to the login page.
      const p = window.location.pathname;
      if (!p.startsWith('/login') && !p.startsWith('/signup')) {
        window.location.href = `/login?next=${encodeURIComponent(p)}`;
      }
    }
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (body as { error?: { code: string; message: string; details?: unknown } }).error;
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? res.statusText, err?.details);
  }
  return body as T;
}
