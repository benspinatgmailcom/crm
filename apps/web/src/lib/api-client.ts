/**
 * API client with Bearer auth and 401 refresh retry.
 */

import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "./auth-store";
import { env } from "./env";

const getBaseUrl = () => env.NEXT_PUBLIC_API_URL;

export interface ApiError extends Error {
  status?: number;
  body?: unknown;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;

  const doFetch = async (retryAfterRefresh = false): Promise<Response> => {
    const token = getAccessToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 && !retryAfterRefresh) {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          return doFetch(true);
        }
      }
      // Had a session that expired, or no refresh token - clear and redirect
      clearTokens();
      if (typeof window !== "undefined") {
        const isLoginPage = window.location.pathname === "/login";
        if (!isLoginPage) {
          window.location.href = "/login";
        }
      }
    }

    return res;
  };

  const res = await doFetch();

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json().catch(() => null);
    } catch {
      body = await res.text();
    }
    const err = new Error(res.statusText || "API Error") as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Upload file for an entity. Uses FormData (multipart). */
export async function apiUpload(
  path: string,
  formData: FormData,
  options: RequestInit = {}
): Promise<unknown> {
  const baseUrl = getBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const token = getAccessToken();
  const headers: HeadersInit = { ...options.headers };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  // Do NOT set Content-Type - browser sets it with boundary for FormData
  const res = await fetch(url, { ...options, method: "POST", body: formData, headers });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json().catch(() => null);
    } catch {
      body = await res.text();
    }
    const err = new Error(res.statusText || "Upload failed") as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }
  const text = await res.text();
  if (!text) return undefined;
  return JSON.parse(text);
}

/** DELETE request. Handles 204 No Content. Throws on error. */
export async function apiDelete(path: string): Promise<void> {
  const baseUrl = getBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const token = getAccessToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, { method: "DELETE", headers });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json().catch(() => null);
    } catch {
      body = await res.text();
    }
    const err = new Error(res.statusText || "Delete failed") as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }
}

/** Download file with auth (retries once after refresh on 401). Triggers browser download. */
export async function apiDownloadFile(
  path: string,
  filename: string
): Promise<void> {
  const baseUrl = getBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;

  const doFetch = async (retryAfterRefresh = false): Promise<Response> => {
    const token = getAccessToken();
    const headers: HeadersInit = {};
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(url, { headers });

    if (res.status === 401 && !retryAfterRefresh) {
      const refreshed = await tryRefresh();
      if (refreshed) return doFetch(true);
      clearTokens();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      throw new Error("Download failed");
    }
    return res;
  };

  const res = await doFetch();
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const data = await fetch(getBaseUrl() + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("Refresh failed"))));

    const { accessToken, refreshToken: newRefreshToken, user } = data;
    if (accessToken && newRefreshToken && user) {
      setTokens(accessToken, newRefreshToken, user);
      return true;
    }
  } catch {
    // Refresh failed
  }
  return false;
}
