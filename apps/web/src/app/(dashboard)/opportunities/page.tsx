"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface Opportunity {
  id: string;
  name: string;
  amount: number | null;
  stage: string | null;
  closeDate: string | null;
}

export default function OpportunitiesPage() {
  const [data, setData] = useState<{ data: Opportunity[]; meta: { total: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: Opportunity[]; meta: { total: number } }>("/opportunities")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading opportunities...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Opportunities</h1>
      <p className="mt-1 text-sm text-gray-500">
        {data?.meta.total ?? 0} opportunities
      </p>
      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                Name
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                Amount
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                Stage
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                Close Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {(data?.data ?? []).map((opp) => (
              <tr key={opp.id}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {opp.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {opp.amount != null ? `$${Number(opp.amount).toLocaleString()}` : "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {opp.stage ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {opp.closeDate ? new Date(opp.closeDate).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
