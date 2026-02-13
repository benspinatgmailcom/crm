/**
 * API client with Bearer auth and 401 refresh retry.
 */

import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "./auth-store";

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
