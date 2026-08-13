// Detect API URL — prefer env var, fall back to window.location origin.
// Called lazily inside each request so it always runs client-side with the
// correct window.location (avoids SSR returning a relative "/api" string
// that then fails in Electron where there's no proxy to rewrite it).
function getBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl && !envUrl.startsWith("/")) {
    // Already an absolute URL (e.g. https://example.com/api)
    return envUrl;
  }
  if (typeof window !== "undefined") {
    // Use current page origin so the port is always included (:8095, etc.)
    const path = envUrl ?? "/api";
    return `${window.location.origin}${path}`;
  }
  return envUrl ?? "/api";
}

async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// Tokens are only accessed client-side — never read at module level to avoid SSR mismatch
function getStoredToken(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function storeToken(key: string, value: string) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function removeToken(key: string) {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function setTokens(access: string, refresh: string) {
  storeToken("qms_access_token", access);
  storeToken("qms_refresh_token", refresh);
}

export function clearTokens() {
  removeToken("qms_access_token");
  removeToken("qms_refresh_token");
}

export function getAccessToken(): string | null {
  return getStoredToken("qms_access_token");
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getStoredToken("qms_refresh_token");
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${getBaseUrl()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      // Redirect to login — session is fully expired
      redirectToLogin();
      return false;
    }
    const data = await res.json() as { data: { accessToken: string; refreshToken: string } };
    setTokens(data.data.accessToken, data.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  // Only redirect if not already on the login page
  if (!window.location.pathname.startsWith("/login")) {
    // Small delay so any in-flight state updates can complete
    setTimeout(() => { window.location.href = "/login"; }, 100);
  }
}

// Expose refresh helper for callers that want to proactively refresh tokens
export async function refreshTokens(): Promise<boolean> {
  return tryRefresh();
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  meta?: { total: number; page: number; limit?: number };
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const makeRequest = async (token: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetchWithTimeout(`${getBaseUrl()}${path}`, { ...options, headers });
  };

  let res: Response;
  try {
    res = await makeRequest(getAccessToken());
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Backend request timed out. Check that the backend is reachable and that the API proxy is configured correctly.");
    }
    throw err;
  }

  // Auto-refresh on 401
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await makeRequest(getAccessToken());
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const e = await res.json() as { message?: string; error?: string; errors?: unknown };
      msg = e.message ?? e.error ?? msg;
      console.error("[API error]", path, res.status, e);
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  return res.json() as Promise<ApiResponse<T>>;
}

export const api = {
  get:    <T = unknown>(path: string) =>
    apiRequest<T>(path, { method: "GET" }),
  post:   <T = unknown>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "POST",  body: body ? JSON.stringify(body) : undefined }),
  patch:  <T = unknown>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T = unknown>(path: string) =>
    apiRequest<T>(path, { method: "DELETE" }),
};
