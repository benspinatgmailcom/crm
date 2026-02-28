"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { env } from "@/lib/env";

const logoUrl = env.NEXT_PUBLIC_LOGO_URL || null;
const apiUrl = env.NEXT_PUBLIC_API_URL;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSubmitted(false);
    setNetworkError(false);
    try {
      const res = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      setNetworkError(true);
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
            Reset your password
          </p>

          {submitted ? (
            <p className="mt-6 text-center text-sm text-white/90">
              If an account exists, you will receive an email.
            </p>
          ) : networkError ? (
            <p className="mt-6 text-center text-sm text-red-400">
              Something went wrong. Please try again.
            </p>
          ) : null}

          {!submitted && (
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

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-accent-1 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-white/70 hover:text-white hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
