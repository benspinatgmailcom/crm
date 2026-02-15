"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/roles";
import { apiFetch } from "@/lib/api-client";

interface SeedStoryResult {
  accountsCreated: number;
  contactsCreated: number;
  opportunitiesCreated: number;
  activitiesCreated: number;
  attachmentsCreated: number;
  storyAccountIds: { apexId: string; northwindId: string; globexId: string };
}

export default function DevPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [reset, setReset] = useState(false);

  useEffect(() => {
    if (user && !isAdmin(user.role)) {
      router.replace("/accounts");
    }
  }, [user, router]);
  const [includeFiller, setIncludeFiller] = useState(false);
  const [fillerAccounts, setFillerAccounts] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeedStoryResult | null>(null);

  const handleSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await apiFetch<SeedStoryResult>("/dev/seed-story", {
        method: "POST",
        body: JSON.stringify({
          reset,
          includeFiller,
          fillerAccounts: includeFiller ? fillerAccounts : 0,
        }),
      });
      setResult(res);
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      setError(e.body?.message ?? e.message ?? "Seed failed");
    } finally {
      setLoading(false);
    }
  };

  const openAccount = (id: string) => {
    router.push(`/accounts/${id}`);
  };

  if (user && !isAdmin(user.role)) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-gray-600">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dev Tools</h1>
      <p className="text-sm text-gray-500">
        Story-based demo seed. Only available when not in production and for ADMIN users.
      </p>

      <form onSubmit={handleSeed} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Generate Story Demo Data</h2>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={reset}
            onChange={(e) => setReset(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Reset (wipe CRM data and uploads before seeding)</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeFiller}
            onChange={(e) => setIncludeFiller(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Include filler accounts</span>
        </label>

        {includeFiller && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filler accounts (0–20)</label>
            <input
              type="number"
              min={0}
              max={20}
              value={fillerAccounts}
              onChange={(e) => setFillerAccounts(Number(e.target.value))}
              className="w-24 rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Seeding…" : "Generate Story Demo Data"}
        </button>
      </form>

      {result && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Seed complete</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Accounts created</dt>
            <dd className="font-medium">{result.accountsCreated}</dd>
            <dt className="text-gray-500">Contacts created</dt>
            <dd className="font-medium">{result.contactsCreated}</dd>
            <dt className="text-gray-500">Opportunities created</dt>
            <dd className="font-medium">{result.opportunitiesCreated}</dd>
            <dt className="text-gray-500">Activities created</dt>
            <dd className="font-medium">{result.activitiesCreated}</dd>
            <dt className="text-gray-500">Attachments created</dt>
            <dd className="font-medium">{result.attachmentsCreated}</dd>
          </dl>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Story accounts</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openAccount(result.storyAccountIds.apexId)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Apex Data Centers
              </button>
              <button
                type="button"
                onClick={() => openAccount(result.storyAccountIds.northwindId)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Northwind Telecom
              </button>
              <button
                type="button"
                onClick={() => openAccount(result.storyAccountIds.globexId)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Globex Manufacturing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
