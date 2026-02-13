"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  status: string | null;
}

export default function LeadsPage() {
  const [data, setData] = useState<{ data: Lead[]; meta: { total: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: Lead[]; meta: { total: number } }>("/leads")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading leads...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
      <p className="mt-1 text-sm text-gray-500">
        {data?.meta.total ?? 0} leads
      </p>
      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                Name
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                Email
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                Company
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {(data?.data ?? []).map((lead) => (
              <tr key={lead.id}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {lead.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {lead.email}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {lead.company ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {lead.status ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
