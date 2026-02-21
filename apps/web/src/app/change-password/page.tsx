"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";
import { env } from "@/lib/env";

const logoUrl = env.NEXT_PUBLIC_LOGO_URL || null;

export default function ChangePasswordPage() {
  const { user, isAuthenticated, isLoading, updateUser } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user && !user.mustChangePassword) {
      router.replace("/accounts");
    }
  }, [isAuthenticated, isLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const updated = await apiFetch<{ id: string; email: string; role: string; mustChangePassword: boolean }>(
        "/auth/change-password",
        {
          method: "POST",
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        }
      );
      updateUser({ mustChangePassword: updated.mustChangePassword });
      router.replace("/accounts");
    } catch (err: unknown) {
      const apiErr = err as { status?: number; body?: { message?: string }; message?: string };
      if (apiErr.status === 401) {
        setError("Current password is incorrect");
      } else {
        setError(apiErr.body?.message ?? apiErr.message ?? "Failed to change password");
      }
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || (user && !user.mustChangePassword)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-white/80">Redirecting...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-br before:from-accent-1/5 before:via-transparent before:to-accent-2/5">
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <div className="mb-8 flex items-center justify-center gap-2">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="Logo"
              width={200}
              height={48}
              className="h-12 w-auto max-h-12 object-contain"
              unoptimized={logoUrl.startsWith("http")}
            />
          ) : (
            <h1 className="text-2xl font-semibold text-white">CRM</h1>
          )}
        </div>
        <div className="w-full rounded-xl border border-white/10 bg-slate-900/90 p-6 shadow-xl backdrop-blur-sm">
          <p className="text-center text-sm text-white/70">
            You must change your temporary password before continuing
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="current" className="block text-sm font-medium text-white/90">
                Current (temporary) password
              </label>
              <input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="mt-1 block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
              />
            </div>

            <div>
              <label htmlFor="new" className="block text-sm font-medium text-white/90">
                New password
              </label>
              <input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                className="mt-1 block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
              />
              <p className="mt-0.5 text-xs text-white/50">At least 8 characters</p>
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-white/90">
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                className="mt-1 block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-accent-1 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
            >
              {loading ? "Changing password…" : "Change password"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
