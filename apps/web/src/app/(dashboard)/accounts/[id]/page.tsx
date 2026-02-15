"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { EntityAttachments } from "@/components/attachments/entity-attachments";
import { accountSchema, contactSchema, opportunitySchema, type AccountFormData, type ContactFormData, type OpportunityFormData } from "@/lib/validation";

interface Account {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  sourceLeadId?: string | null;
}

interface Contact {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

interface Opportunity {
  id: string;
  accountId: string;
  name: string;
  amount: { toString(): string } | null;
  stage: string | null;
  probability: number | null;
  closeDate: string | null;
}

const STAGE_OPTIONS = ["prospecting", "discovery", "qualification", "proposal", "negotiation", "closed-won", "closed-lost"];

function formatAmount(amount: { toString(): string } | null): string {
  if (amount == null) return "—";
  const n = Number(amount.toString());
  return isNaN(n) ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [accountFormData, setAccountFormData] = useState<AccountFormData>({ name: "", industry: "", website: "" });
  const [accountFormErrors, setAccountFormErrors] = useState<Record<string, string>>({});
  const [accountSubmitting, setAccountSubmitting] = useState(false);

  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactEditingId, setContactEditingId] = useState<string | null>(null);
  const [contactFormData, setContactFormData] = useState<ContactFormData>({ accountId: "", firstName: "", lastName: "", email: "", phone: "" });
  const [contactFormErrors, setContactFormErrors] = useState<Record<string, string>>({});
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactDeleteId, setContactDeleteId] = useState<string | null>(null);

  const [oppModalOpen, setOppModalOpen] = useState(false);
  const [oppEditingId, setOppEditingId] = useState<string | null>(null);
  const [oppFormData, setOppFormData] = useState<OpportunityFormData>({ accountId: "", name: "", stage: "prospecting" });
  const [oppFormErrors, setOppFormErrors] = useState<Record<string, string>>({});
  const [oppSubmitting, setOppSubmitting] = useState(false);
  const [oppDeleteId, setOppDeleteId] = useState<string | null>(null);

  const fetchAccount = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const a = await apiFetch<Account>(`/accounts/${id}`);
      setAccount(a);
      setAccountFormData({ name: a.name, industry: a.industry || "", website: a.website || "" });
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Account not found");
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchContacts = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<{ data: Contact[] }>(`/contacts?accountId=${id}&pageSize=50`);
      setContacts(res.data ?? []);
    } catch {
      setContacts([]);
    }
  }, [id]);

  const fetchOpportunities = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<{ data: Opportunity[] }>(`/opportunities?accountId=${id}&pageSize=50`);
      setOpportunities(res.data ?? []);
    } catch {
      setOpportunities([]);
    }
  }, [id]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  useEffect(() => {
    if (account) {
      fetchContacts();
      fetchOpportunities();
    }
  }, [account, fetchContacts, fetchOpportunities]);

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    setAccountFormErrors({});
    setAccountSubmitting(true);
    const parsed = accountSchema.safeParse({
      name: accountFormData.name,
      industry: accountFormData.industry || undefined,
      website: accountFormData.website || undefined,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const p = err.path[0] as string;
        if (p && !errs[p]) errs[p] = err.message;
      });
      setAccountFormErrors(errs);
      setAccountSubmitting(false);
      return;
    }
    try {
      await apiFetch(`/accounts/${account.id}`, { method: "PATCH", body: JSON.stringify(parsed.data) });
      setEditAccountOpen(false);
      fetchAccount();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string } };
      setAccountFormErrors({ _: e.body?.message || "Failed to save" });
    } finally {
      setAccountSubmitting(false);
    }
  };

  const openAddContact = () => {
    setContactEditingId(null);
    setContactFormData({ accountId: id, firstName: "", lastName: "", email: "", phone: "" });
    setContactFormErrors({});
    setContactModalOpen(true);
  };

  const openEditContact = (c: Contact) => {
    setContactEditingId(c.id);
    setContactFormData({ accountId: c.accountId, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone || "" });
    setContactFormErrors({});
    setContactModalOpen(true);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactFormErrors({});
    setContactSubmitting(true);
    const parsed = contactSchema.safeParse({ ...contactFormData, phone: contactFormData.phone || undefined });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const p = err.path[0] as string;
        if (p && !errs[p]) errs[p] = err.message;
      });
      setContactFormErrors(errs);
      setContactSubmitting(false);
      return;
    }
    try {
      if (contactEditingId) {
        await apiFetch(`/contacts/${contactEditingId}`, {
          method: "PATCH",
          body: JSON.stringify({ firstName: parsed.data.firstName, lastName: parsed.data.lastName, email: parsed.data.email, phone: parsed.data.phone }),
        });
      } else {
        await apiFetch("/contacts", { method: "POST", body: JSON.stringify(parsed.data) });
      }
      setContactModalOpen(false);
      fetchContacts();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string } };
      setContactFormErrors({ _: e.body?.message || "Failed to save" });
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleContactDelete = async () => {
    if (!contactDeleteId) return;
    try {
      await apiFetch(`/contacts/${contactDeleteId}`, { method: "DELETE" });
      setContactDeleteId(null);
      fetchContacts();
    } catch {
      setContactDeleteId(null);
      fetchContacts();
    }
  };

  const openAddOpp = () => {
    setOppEditingId(null);
    setOppFormData({ accountId: id, name: "", stage: "prospecting", amount: undefined, probability: undefined, closeDate: "" });
    setOppFormErrors({});
    setOppModalOpen(true);
  };

  const openEditOpp = (o: Opportunity) => {
    setOppEditingId(o.id);
    setOppFormData({
      accountId: o.accountId,
      name: o.name,
      stage: o.stage || "prospecting",
      amount: o.amount != null ? Number(o.amount.toString()) : undefined,
      probability: o.probability ?? undefined,
      closeDate: o.closeDate ? new Date(o.closeDate).toISOString().slice(0, 10) : "",
    });
    setOppFormErrors({});
    setOppModalOpen(true);
  };

  const handleOppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOppFormErrors({});
    setOppSubmitting(true);
    const parsed = opportunitySchema.safeParse(oppFormData);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const p = err.path[0] as string;
        if (p && !errs[p]) errs[p] = err.message;
      });
      setOppFormErrors(errs);
      setOppSubmitting(false);
      return;
    }
    try {
      const payload = {
        ...parsed.data,
        closeDate: parsed.data.closeDate || undefined,
        amount: parsed.data.amount,
        probability: parsed.data.probability,
      };
      if (oppEditingId) {
        await apiFetch(`/opportunities/${oppEditingId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/opportunities", { method: "POST", body: JSON.stringify(payload) });
      }
      setOppModalOpen(false);
      fetchOpportunities();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string } };
      setOppFormErrors({ _: e.body?.message || "Failed to save" });
    } finally {
      setOppSubmitting(false);
    }
  };

  const handleOppDelete = async () => {
    if (!oppDeleteId) return;
    try {
      await apiFetch(`/opportunities/${oppDeleteId}`, { method: "DELETE" });
      setOppDeleteId(null);
      fetchOpportunities();
    } catch {
      setOppDeleteId(null);
      fetchOpportunities();
    }
  };

  if (loading && !account) {
    return (
      <div>
        <Link href="/accounts" className="text-sm text-accent-1 hover:underline">← Back to Accounts</Link>
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div>
        <Link href="/accounts" className="text-sm text-accent-1 hover:underline">← Back to Accounts</Link>
        <p className="mt-4 text-red-600">{error || "Account not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/accounts" className="text-sm text-accent-1 hover:underline">← Back to Accounts</Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">{account.name}</h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEditAccountOpen(true)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit Account
            </button>
            <button
              onClick={openAddContact}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Add Contact
            </button>
            <button
              onClick={openAddOpp}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Add Opportunity
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Account details</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{account.name}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Industry</dt>
                <dd className="text-gray-900">{account.industry ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Website</dt>
                <dd className="text-gray-900">
                  {account.website ? (
                    <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-accent-1 hover:underline">{account.website}</a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              {account.sourceLeadId && (
                <div>
                  <dt className="text-gray-500">Created from Lead</dt>
                  <dd className="text-gray-900">
                    <Link href={`/leads/${account.sourceLeadId}`} className="text-accent-1 hover:underline">
                      View lead
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Related Contacts</h2>
              <button onClick={openAddContact} className="rounded-md bg-accent-1 px-3 py-1.5 text-sm font-medium text-white hover:brightness-90">
                Add
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {contacts.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">No contacts yet.</td>
                    </tr>
                  ) : (
                    contacts.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          <Link href={`/contacts/${c.id}`} className="text-accent-1 hover:underline">
                            {c.firstName} {c.lastName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{c.email}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openEditContact(c)} className="text-sm text-accent-1 hover:underline mr-2">Edit</button>
                          <button onClick={() => setContactDeleteId(c.id)} className="text-sm text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Related Opportunities</h2>
              <button onClick={openAddOpp} className="rounded-md bg-accent-1 px-3 py-1.5 text-sm font-medium text-white hover:brightness-90">
                Add
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Stage</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {opportunities.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No opportunities yet.</td>
                    </tr>
                  ) : (
                    opportunities.map((o) => (
                      <tr key={o.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          <Link href={`/opportunities/${o.id}`} className="text-accent-1 hover:underline">
                            {o.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatAmount(o.amount)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{o.stage ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openEditOpp(o)} className="text-sm text-accent-1 hover:underline mr-2">Edit</button>
                          <button onClick={() => setOppDeleteId(o.id)} className="text-sm text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <EntityAttachments
            entityType="account"
            entityId={account.id}
            onUploadSuccess={() => setTimelineRefreshKey((k) => k + 1)}
          />
          <ActivityTimeline
            entityType="account"
            entityId={account.id}
            refreshTrigger={timelineRefreshKey}
          />
        </div>
      </div>

      {/* Edit Account Modal */}
      <Modal isOpen={editAccountOpen} onClose={() => setEditAccountOpen(false)} title="Edit Account">
        <form onSubmit={handleAccountSubmit} className="space-y-4">
          {accountFormErrors._ && <p className="text-sm text-red-600">{accountFormErrors._}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input
              value={accountFormData.name}
              onChange={(e) => setAccountFormData((d) => ({ ...d, name: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            {accountFormErrors.name && <p className="mt-0.5 text-sm text-red-600">{accountFormErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Industry</label>
            <input
              value={accountFormData.industry}
              onChange={(e) => setAccountFormData((d) => ({ ...d, industry: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Website</label>
            <input
              type="url"
              value={accountFormData.website}
              onChange={(e) => setAccountFormData((d) => ({ ...d, website: e.target.value }))}
              placeholder="https://"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            {accountFormErrors.website && <p className="mt-0.5 text-sm text-red-600">{accountFormErrors.website}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditAccountOpen(false)} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={accountSubmitting} className="rounded bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 disabled:opacity-50">{accountSubmitting ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </Modal>

      {/* Contact Modal */}
      <Modal isOpen={contactModalOpen} onClose={() => setContactModalOpen(false)} title={contactEditingId ? "Edit Contact" : "New Contact"}>
        <form onSubmit={handleContactSubmit} className="space-y-4">
          {contactFormErrors._ && <p className="text-sm text-red-600">{contactFormErrors._}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700">First name *</label>
            <input value={contactFormData.firstName} onChange={(e) => setContactFormData((d) => ({ ...d, firstName: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            {contactFormErrors.firstName && <p className="mt-0.5 text-sm text-red-600">{contactFormErrors.firstName}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Last name *</label>
            <input value={contactFormData.lastName} onChange={(e) => setContactFormData((d) => ({ ...d, lastName: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            {contactFormErrors.lastName && <p className="mt-0.5 text-sm text-red-600">{contactFormErrors.lastName}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email *</label>
            <input type="email" value={contactFormData.email} onChange={(e) => setContactFormData((d) => ({ ...d, email: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            {contactFormErrors.email && <p className="mt-0.5 text-sm text-red-600">{contactFormErrors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input value={contactFormData.phone} onChange={(e) => setContactFormData((d) => ({ ...d, phone: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setContactModalOpen(false)} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={contactSubmitting} className="rounded bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 disabled:opacity-50">{contactSubmitting ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </Modal>

      {/* Opportunity Modal */}
      <Modal isOpen={oppModalOpen} onClose={() => setOppModalOpen(false)} title={oppEditingId ? "Edit Opportunity" : "New Opportunity"}>
        <form onSubmit={handleOppSubmit} className="space-y-4">
          {oppFormErrors._ && <p className="text-sm text-red-600">{oppFormErrors._}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input value={oppFormData.name} onChange={(e) => setOppFormData((d) => ({ ...d, name: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            {oppFormErrors.name && <p className="mt-0.5 text-sm text-red-600">{oppFormErrors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input type="number" min={0} step={0.01} value={oppFormData.amount ?? ""} onChange={(e) => setOppFormData((d) => ({ ...d, amount: e.target.value ? Number(e.target.value) : undefined }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stage</label>
              <select value={oppFormData.stage} onChange={(e) => setOppFormData((d) => ({ ...d, stage: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">
                {STAGE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Close Date</label>
            <input type="date" value={oppFormData.closeDate} onChange={(e) => setOppFormData((d) => ({ ...d, closeDate: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOppModalOpen(false)} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={oppSubmitting} className="rounded bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 disabled:opacity-50">{oppSubmitting ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!contactDeleteId} onClose={() => setContactDeleteId(null)} onConfirm={handleContactDelete} title="Delete Contact" message="Are you sure you want to delete this contact?" confirmLabel="Delete" />
      <ConfirmDialog isOpen={!!oppDeleteId} onClose={() => setOppDeleteId(null)} onConfirm={handleOppDelete} title="Delete Opportunity" message="Are you sure you want to delete this opportunity?" confirmLabel="Delete" />
    </div>
  );
}
