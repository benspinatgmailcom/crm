"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import {
  getAccessToken,
  getStoredUser,
  getStoredTenant,
  setTokens,
  setStoredTenant,
  clearTokens,
  updateStoredUser,
  type StoredUser,
  type TenantBranding,
} from "@/lib/auth-store";

interface AuthContextValue {
  user: StoredUser | null;
  tenant: TenantBranding | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<StoredUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [tenant, setTenant] = useState<TenantBranding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchMe = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return null;
    try {
      const data = await apiFetch<{ user: StoredUser; tenant: TenantBranding | null }>("/auth/me");
      setUser(data.user);
      setTenant(data.tenant ?? null);
      updateStoredUser(data.user);
      if (data.tenant) setStoredTenant(data.tenant);
      else setStoredTenant(null);
      return data;
    } catch {
      return null;
    }
  }, []);

  const loadStoredAuth = useCallback(async () => {
    const token = getAccessToken();
    const storedUser = getStoredUser();
    const storedTenant = getStoredTenant();
    if (token && storedUser) {
      setUser(storedUser);
      setTenant(storedTenant ?? null);
      await fetchMe();
    }
    setIsLoading(false);
  }, [fetchMe]);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: StoredUser;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setTokens(data.accessToken, data.refreshToken, data.user);
      setUser(data.user);

      // Redirect immediately so we don't get stuck if /auth/me is slow or fails
      if (data.user.mustChangePassword) {
        router.replace("/change-password");
      } else if (data.user.role === "GLOBAL_ADMIN") {
        router.replace("/platform");
      } else {
        router.replace("/accounts");
      }

      // Sync tenant from /auth/me in background (optional; avoids blocking redirect)
      try {
        const meData = await apiFetch<{ user: StoredUser; tenant: TenantBranding | null }>("/auth/me");
        if (meData) {
          setUser(meData.user);
          setTenant(meData.tenant ?? null);
          if (meData.tenant) setStoredTenant(meData.tenant);
          else setStoredTenant(null);
        }
      } catch {
        // Non-fatal: user already set from login response; tenant may stay null
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    const refreshToken = typeof window !== "undefined" 
      ? localStorage.getItem("crm_refresh_token") 
      : null;
    try {
      if (refreshToken) {
        await apiFetch("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Ignore logout API errors
    } finally {
      clearTokens();
      setUser(null);
      setTenant(null);
      router.push("/login");
    }
  }, [router]);

  const updateUser = useCallback((updates: Partial<StoredUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
    updateStoredUser(updates);
  }, []);

  const value: AuthContextValue = {
    user,
    tenant,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
