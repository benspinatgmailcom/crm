"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { EntityAttachments } from "@/components/attachments/entity-attachments";
import { contactSchema, type ContactFormData } from "@/lib/validation";

interface Contact {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  sourceLeadId?: string | null;
}

interface Account {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
}

interface Opportunity {
  id: string;
  accountId: string;
  name: string;
  amount: { toString(): string } | null;
  stage: string | null;
}

function formatAmount(amount: { toString(): string } | null): string {
  if (amount == null) return "—";
  const n = Number(amount.toString());
  return isNaN(n) ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function ContactDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    accountId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchContact = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const c = await apiFetch<Contact>(`/contacts/${id}`);
      setContact(c);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      setError(e.status === 404 ? "Contact not found" : e.message || "Failed to load contact");
      setContact(null);
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

  const fetchOpportunities = useCallback(async (accountId: string) => {
    try {
      const res = await apiFetch<{ data: Opportunity[] }>(`/opportunities?accountId=${accountId}&pageSize=5`);
      setOpportunities(res.data ?? []);
    } catch {
      setOpportunities([]);
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
    fetchContact();
    fetchAccounts();
  }, [fetchContact, fetchAccounts]);

  useEffect(() => {
    if (contact?.accountId) {
      fetchAccount(contact.accountId);
      fetchOpportunities(contact.accountId);
    } else {
      setAccount(null);
      setOpportunities([]);
    }
  }, [contact?.accountId, fetchAccount, fetchOpportunities]);

  const openEdit = () => {
    if (!contact) return;
    setFormData({
      accountId: contact.accountId,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone || "",
    });
    setFormErrors({});
    setSubmitError(null);
    setEditModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact) return;
    setFormErrors({});
    setSubmitError(null);
    const parsed = contactSchema.safeParse({ ...formData, phone: formData.phone || undefined });
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
      await apiFetch(`/contacts/${contact.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          email: parsed.data.email,
          phone: parsed.data.phone,
        }),
      });
      setEditModalOpen(false);
      fetchContact();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string } };
      setSubmitError(e.body?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !contact) {
    return (
      <div>
        <Link href="/contacts" className="text-sm text-blue-600 hover:underline">
          ← Back to Contacts
        </Link>
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div>
        <Link href="/contacts" className="text-sm text-blue-600 hover:underline">
          ← Back to Contacts
        </Link>
        <p className="mt-4 text-red-600">{error || "Contact not found"}</p>
      </div>
    );
  }

  const displayName = `${contact.firstName} ${contact.lastName}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/contacts" className="text-sm text-blue-600 hover:underline">
          ← Back to Contacts
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{displayName}</h1>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-600">
              <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                {contact.email}
              </a>
              {contact.phone && <span>{contact.phone}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openEdit}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit Contact
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Contact details</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">First name</dt>
                <dd className="font-medium text-gray-900">{contact.firstName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Last name</dt>
                <dd className="font-medium text-gray-900">{contact.lastName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-900">
                  <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                    {contact.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Phone</dt>
                <dd className="text-gray-900">{contact.phone ?? "—"}</dd>
              </div>
              {contact.sourceLeadId && (
                <div>
                  <dt className="text-gray-500">Created from Lead</dt>
                  <dd className="text-gray-900">
                    <Link href={`/leads/${contact.sourceLeadId}`} className="text-blue-600 hover:underline">
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
              <Link href={`/accounts/${account.id}`} className="text-blue-600 hover:underline">
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
                <h2 className="text-sm font-semibold text-gray-900">Related Opportunities</h2>
                <Link
                  href={`/accounts/${account.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  View all on account
                </Link>
              </div>
              <div className="divide-y divide-gray-200">
                {opportunities.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">No opportunities yet.</p>
                ) : (
                  opportunities.map((o) => (
                    <div key={o.id} className="flex items-center justify-between px-4 py-3">
                      <Link
                        href={`/opportunities/${o.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {o.name}
                      </Link>
                      <span className="text-sm text-gray-500">
                        {formatAmount(o.amount)} · {o.stage ?? "—"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <EntityAttachments
            entityType="contact"
            entityId={contact.id}
            onUploadSuccess={() => setTimelineRefreshKey((k) => k + 1)}
          />
          <ActivityTimeline
            entityType="contact"
            entityId={contact.id}
            refreshTrigger={timelineRefreshKey}
          />
        </div>
      </div>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Contact">
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">First name *</label>
              <input
                value={formData.firstName}
                onChange={(e) => setFormData((d) => ({ ...d, firstName: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              {formErrors.firstName && <p className="mt-0.5 text-sm text-red-600">{formErrors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last name *</label>
              <input
                value={formData.lastName}
                onChange={(e) => setFormData((d) => ({ ...d, lastName: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              {formErrors.lastName && <p className="mt-0.5 text-sm text-red-600">{formErrors.lastName}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            {formErrors.email && <p className="mt-0.5 text-sm text-red-600">{formErrors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              value={formData.phone}
              onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
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
