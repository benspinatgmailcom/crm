"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { env } from "@/lib/env";

const logoUrl = env.NEXT_PUBLIC_LOGO_URL || null;
const apiUrl = env.NEXT_PUBLIC_API_URL;

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!token) {
      setError("Invalid or missing reset link");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message || "Failed to reset password");
      }
      router.push("/login?reset=success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full rounded-xl border border-white/10 bg-slate-900/90 p-6 shadow-xl backdrop-blur-sm">
        <p className="text-center text-sm text-white/70">
          Set your password
        </p>
        <p className="mt-4 text-center text-sm text-red-400">
          Invalid or missing reset link. Request a new one from the sign-in page.
        </p>
        <p className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-white/70 hover:text-white hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-white/10 bg-slate-900/90 p-6 shadow-xl backdrop-blur-sm">
      <p className="text-center text-sm text-white/70">
        Set your password
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-white/90"
          >
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••"
            className="mt-1 block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-white/90"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
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

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-accent-1 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
        >
          {loading ? "Setting password..." : "Set password"}
        </button>
      </form>

      <p className="mt-6 text-center">
        <Link
          href="/login"
          className="text-sm text-white/70 hover:text-white hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function SetPasswordPage() {
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
        <Suspense fallback={<p className="text-white/70">Loading...</p>}>
          <SetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
