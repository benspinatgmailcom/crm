/**
 * Auth token storage.
 * accessToken: memory + localStorage for persistence across refresh.
 * refreshToken: localStorage only (MVP - consider httpOnly cookie in production).
 */

const ACCESS_TOKEN_KEY = "crm_access_token";
const REFRESH_TOKEN_KEY = "crm_refresh_token";
const USER_KEY = "crm_user";

let accessTokenMemory: string | null = null;

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  if (accessTokenMemory) return accessTokenMemory;
  accessTokenMemory = localStorage.getItem(ACCESS_TOKEN_KEY);
  return accessTokenMemory;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(
  accessToken: string,
  refreshToken: string,
  user: { id: string; email: string; role: string }
): void {
  if (typeof window === "undefined") return;
  accessTokenMemory = accessToken;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  accessTokenMemory = null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): { id: string; email: string; role: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { id: string; email: string; role: string };
  } catch {
    return null;
  }
}
