"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import { env } from "@/lib/env";

const logoUrl = env.NEXT_PUBLIC_LOGO_URL || null;

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showResetSuccess, setShowResetSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/accounts");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (searchParams.get("reset") === "success") {
      setShowResetSuccess(true);
      router.replace("/login", { scroll: false });
    }
  }, [searchParams, router]);

  if (isLoading || isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-white/80">Redirecting...</p>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const apiErr = err as { status?: number; body?: { message?: string } };
      if (apiErr.status === 401) {
        setError("Invalid email or password");
      } else {
        setError(apiErr.body?.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-br before:from-accent-1/5 before:via-transparent before:to-accent-2/5">
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <div className="mb-8 flex items-center justify-center gap-2">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="TechConnect"
              width={200}
              height={48}
              className="h-12 w-auto max-h-12 object-contain"
              unoptimized={logoUrl.startsWith("http")}
            />
          ) : (
            <h1 className="text-2xl font-semibold text-white">TechConnect</h1>
          )}
        </div>
        <div className="w-full rounded-xl border border-white/10 bg-slate-900/90 p-6 shadow-xl backdrop-blur-sm">
          <p className="text-center text-sm text-white/70">
            Sign in to your account
          </p>

          {showResetSuccess && (
            <p className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-center text-sm text-green-300">
              Your password has been set. You can now sign in.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-white/90"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="mt-1 block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-white/90"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-white/70 hover:text-white hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-white/15 bg-white/5 py-2 pl-3 pr-10 text-sm text-white placeholder-white/40 focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/60 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-accent-1"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-accent-1 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
