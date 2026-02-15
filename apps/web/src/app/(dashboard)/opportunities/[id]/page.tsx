"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { EntityAttachments } from "@/components/attachments/entity-attachments";
import { opportunitySchema, type OpportunityFormData } from "@/lib/validation";

interface Opportunity {
  id: string;
  accountId: string;
  name: string;
  amount: { toString(): string } | null;
  stage: string | null;
  probability: number | null;
  closeDate: string | null;
  sourceLeadId?: string | null;
}

interface Account {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
}

interface Contact {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
}

const STAGE_OPTIONS = ["prospecting", "discovery", "qualification", "proposal", "negotiation", "closed-won", "closed-lost"];

function formatAmount(amount: { toString(): string } | null): string {
  if (amount == null) return "—";
  const n = Number(amount.toString());
  return isNaN(n) ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function OpportunityDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<OpportunityFormData>({ accountId: "", name: "", stage: "prospecting" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchOpportunity = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const o = await apiFetch<Opportunity>(`/opportunities/${id}`);
      setOpportunity(o);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      setError(e.status === 404 ? "Opportunity not found" : e.message || "Failed to load opportunity");
      setOpportunity(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchAccount = useCallback(async (accountId: string) => {
    try {
      const a = await apiFetch<Account>(`/accounts/${accountId}`);
      setAccount(a);
    } catch {
      setAccount(null);
    }
  }, []);

  const fetchContacts = useCallback(async (accountId: string) => {
    try {
      const res = await apiFetch<{ data: Contact[] }>(`/contacts?accountId=${accountId}&pageSize=5`);
      setContacts(res.data ?? []);
    } catch {
      setContacts([]);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: Account[] }>("/accounts?pageSize=100");
      setAccounts(res.data ?? []);
    } catch {
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    fetchOpportunity();
    fetchAccounts();
  }, [fetchOpportunity, fetchAccounts]);

  useEffect(() => {
    if (opportunity?.accountId) {
      fetchAccount(opportunity.accountId);
      fetchContacts(opportunity.accountId);
    } else {
      setAccount(null);
      setContacts([]);
    }
  }, [opportunity?.accountId, fetchAccount, fetchContacts]);

  const openEdit = () => {
    if (!opportunity) return;
    setFormData({
      accountId: opportunity.accountId,
      name: opportunity.name,
      amount: opportunity.amount != null ? Number(opportunity.amount.toString()) : undefined,
      stage: opportunity.stage || "prospecting",
      probability: opportunity.probability ?? undefined,
      closeDate: opportunity.closeDate ? opportunity.closeDate.slice(0, 10) : "",
    });
    setFormErrors({});
    setSubmitError(null);
    setEditModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunity) return;
    setFormErrors({});
    setSubmitError(null);
    const payload = {
      accountId: formData.accountId,
      name: formData.name,
      amount: formData.amount,
      stage: formData.stage || undefined,
      probability: formData.probability,
      closeDate: formData.closeDate || undefined,
    };
    const parsed = opportunitySchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const p = err.path[0] as string;
        if (p && !errs[p]) errs[p] = err.message;
      });
      setFormErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/opportunities/${opportunity.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: parsed.data.name,
          amount: parsed.data.amount,
          stage: parsed.data.stage,
          probability: parsed.data.probability,
          closeDate: parsed.data.closeDate,
        }),
      });
      setEditModalOpen(false);
      fetchOpportunity();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string } };
      setSubmitError(e.body?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !opportunity) {
    return (
      <div>
        <Link href="/opportunities" className="text-sm text-blue-600 hover:underline">
          ← Back to Opportunities
        </Link>
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div>
        <Link href="/opportunities" className="text-sm text-blue-600 hover:underline">
          ← Back to Opportunities
        </Link>
        <p className="mt-4 text-red-600">{error || "Opportunity not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/opportunities" className="text-sm text-blue-600 hover:underline">
          ← Back to Opportunities
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{opportunity.name}</h1>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-600">
              <span>{opportunity.stage ?? "—"}</span>
              <span>{formatAmount(opportunity.amount)}</span>
              <span>
                {opportunity.closeDate ? new Date(opportunity.closeDate).toLocaleDateString() : "—"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openEdit}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit Opportunity
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Opportunity details</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{opportunity.name}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Stage</dt>
                <dd className="text-gray-900">{opportunity.stage ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Amount</dt>
                <dd className="text-gray-900">{formatAmount(opportunity.amount)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Probability</dt>
                <dd className="text-gray-900">{opportunity.probability != null ? `${opportunity.probability}%` : "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Close Date</dt>
                <dd className="text-gray-900">
                  {opportunity.closeDate ? new Date(opportunity.closeDate).toLocaleDateString() : "—"}
                </dd>
              </div>
              {opportunity.sourceLeadId && (
                <div>
                  <dt className="text-gray-500">Created from Lead</dt>
                  <dd className="text-gray-900">
                    <Link href={`/leads/${opportunity.sourceLeadId}`} className="text-blue-600 hover:underline">
                      View lead
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {account && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Related Account</h2>
              <Link
                href={`/accounts/${account.id}`}
                className="text-blue-600 hover:underline"
              >
                {account.name}
              </Link>
              {account.industry && (
                <p className="mt-1 text-sm text-gray-500">{account.industry}</p>
              )}
              {account.website && (
                <a
                  href={account.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-sm text-blue-600 hover:underline"
                >
                  {account.website}
                </a>
              )}
              <Link
                href={`/accounts/${account.id}`}
                className="mt-2 inline-block text-sm text-blue-600 hover:underline"
              >
                View full account →
              </Link>
            </div>
          )}

          {account && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">Key Contacts</h2>
                <Link
                  href={`/accounts/${account.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  View all on account
                </Link>
              </div>
              <div className="divide-y divide-gray-200">
                {contacts.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">No contacts yet.</p>
                ) : (
                  contacts.map((c) => (
                    <div key={c.id} className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {c.firstName} {c.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{c.email}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <EntityAttachments
            entityType="opportunity"
            entityId={opportunity.id}
            onUploadSuccess={() => setTimelineRefreshKey((k) => k + 1)}
          />
          <ActivityTimeline
            entityType="opportunity"
            entityId={opportunity.id}
            refreshTrigger={timelineRefreshKey}
            draftEmailConfig={{
              suggestedRecipients: contacts.map((c) => ({
                name: `${c.firstName} ${c.lastName}`.trim(),
                email: c.email,
              })),
            }}
          />
        </div>
      </div>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Opportunity">
        <form onSubmit={handleSubmit} className="space-y-4">
          {(submitError || formErrors._) && (
            <p className="text-sm text-red-600">{submitError || formErrors._}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Account *</label>
            <select
              value={formData.accountId}
              onChange={(e) => setFormData((d) => ({ ...d, accountId: e.target.value }))}
              disabled
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            >
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {formErrors.accountId && <p className="mt-0.5 text-sm text-red-600">{formErrors.accountId}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input
              value={formData.name}
              onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            {formErrors.name && <p className="mt-0.5 text-sm text-red-600">{formErrors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={formData.amount ?? ""}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    amount: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              {formErrors.amount && <p className="mt-0.5 text-sm text-red-600">{formErrors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Probability %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={formData.probability ?? ""}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    probability: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Stage</label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData((d) => ({ ...d, stage: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {STAGE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Close Date</label>
              <input
                type="date"
                value={formData.closeDate}
                onChange={(e) => setFormData((d) => ({ ...d, closeDate: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
