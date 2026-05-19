const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";
const ENV_API_KEY = import.meta.env.VITE_API_KEY ?? "";
const API_KEY_STORAGE_KEY = "mf-api-key";
const AUTH_TOKEN_STORAGE_KEY = "mf-auth-token";

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getStoredApiKey() {
  if (typeof window === "undefined") return ENV_API_KEY;
  return window.localStorage.getItem(API_KEY_STORAGE_KEY) || ENV_API_KEY;
}

export function setStoredApiKey(value: string) {
  if (typeof window === "undefined") return;
  if (value.trim()) {
    window.localStorage.setItem(API_KEY_STORAGE_KEY, value.trim());
    return;
  }
  window.localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export function getStoredAuthToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "";
}

export function setStoredAuthToken(value: string) {
  if (typeof window === "undefined") return;
  if (value.trim()) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, value.trim());
    return;
  }
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

function buildHeaders(options?: RequestInit) {
  const headers = new Headers(options?.headers);
  const authToken = getStoredAuthToken();
  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  const apiKey = getStoredApiKey();
  if (apiKey && !headers.has("X-API-Key")) {
    headers.set("X-API-Key", apiKey);
  }
  if (!headers.has("Content-Type") && !(options?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(options),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `API error ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
