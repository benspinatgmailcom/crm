"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

export default function ContactsPage() {
  const [data, setData] = useState<{ data: Contact[]; meta: { total: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: Contact[]; meta: { total: number } }>("/contacts")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading contacts...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
      <p className="mt-1 text-sm text-gray-500">
        {data?.meta.total ?? 0} contacts
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
                Phone
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {(data?.data ?? []).map((contact) => (
              <tr key={contact.id}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {contact.firstName} {contact.lastName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {contact.email}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {contact.phone ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
