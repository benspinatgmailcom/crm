"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { EntityAttachments } from "@/components/attachments/entity-attachments";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { contactSchema, type ContactFormData } from "@/lib/validation";

interface Contact {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

interface Account {
  id: string;
  name: string;
}

interface PaginatedResponse {
  data: Contact[];
  page: number;
  pageSize: number;
  total: number;
}

export default function ContactsPage() {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [nameFilter, setNameFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [accountIdFilter, setAccountIdFilter] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [debouncedAccountId, setDebouncedAccountId] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Contact | null>(null);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(nameFilter), 300);
    return () => clearTimeout(t);
  }, [nameFilter]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedEmail(emailFilter), 300);
    return () => clearTimeout(t);
  }, [emailFilter]);
  useEffect(() => {
    setDebouncedAccountId(accountIdFilter);
  }, [accountIdFilter]);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: Account[] }>("/accounts?pageSize=100");
      setAccounts(res.data);
    } catch {
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (debouncedName) params.set("name", debouncedName);
    if (debouncedEmail) params.set("email", debouncedEmail);
    if (debouncedAccountId) params.set("accountId", debouncedAccountId);
    try {
      const res = await apiFetch<PaginatedResponse>(`/contacts?${params}`);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedName, debouncedEmail, debouncedAccountId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setFormData({
      accountId: accountIdFilter || "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    });
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setFormData({
      accountId: contact.accountId,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone || "",
    });
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitError(null);
    const parsed = contactSchema.safeParse({
      ...formData,
      phone: formData.phone || undefined,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((e) => {
        const p = e.path[0] as string;
        if (p && !errs[p]) errs[p] = e.message;
      });
      setFormErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await apiFetch(`/contacts/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            email: parsed.data.email,
            phone: parsed.data.phone,
          }),
        });
      } else {
        await apiFetch("/contacts", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
      }
      setModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string } };
      setSubmitError(e.body?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/contacts/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      fetchData();
    } catch {
      setDeleteId(null);
      fetchData();
    }
  };

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
        <button
          onClick={openCreate}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Filter by name..."
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Filter by email..."
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={accountIdFilter}
          onChange={(e) => setAccountIdFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-4 text-gray-500">Loading...</p>
      ) : (
        <>
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Account</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(data?.data ?? []).map((contact) => (
                  <tr key={contact.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {contact.firstName} {contact.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{contact.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{accountName(contact.accountId)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setViewing(contact)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          View
                        </button>
                        <button
                          onClick={() => openEdit(contact)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(contact.id)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && (
            <div className="mt-4">
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={setPage}
                onPageSizeChange={(v) => {
                  setPageSize(v);
                  setPage(1);
                }}
              />
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Contact" : "New Contact"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700">Account *</label>
            <select
              value={formData.accountId}
              onChange={(e) => setFormData((d) => ({ ...d, accountId: e.target.value }))}
              disabled={!!editingId}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            >
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {formErrors.accountId && (
              <p className="mt-0.5 text-sm text-red-600">{formErrors.accountId}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">First name *</label>
              <input
                value={formData.firstName}
                onChange={(e) => setFormData((d) => ({ ...d, firstName: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              {formErrors.firstName && (
                <p className="mt-0.5 text-sm text-red-600">{formErrors.firstName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last name *</label>
              <input
                value={formData.lastName}
                onChange={(e) => setFormData((d) => ({ ...d, lastName: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              {formErrors.lastName && (
                <p className="mt-0.5 text-sm text-red-600">{formErrors.lastName}</p>
              )}
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
              onClick={() => setModalOpen(false)}
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

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Contact Details">
        {viewing && (
          <>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="text-sm font-medium">
                  {viewing.firstName} {viewing.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="text-sm">{viewing.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Account</dt>
                <dd className="text-sm">{accountName(viewing.accountId)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="text-sm">{viewing.phone ?? "—"}</dd>
              </div>
            </dl>
            <EntityAttachments
              entityType="contact"
              entityId={viewing.id}
              onUploadSuccess={() => setTimelineRefreshKey((k) => k + 1)}
            />
            <ActivityTimeline
              entityType="contact"
              entityId={viewing.id}
              refreshTrigger={timelineRefreshKey}
            />
          </>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Contact"
        message="Are you sure you want to delete this contact?"
        confirmLabel="Delete"
      />
    </div>
  );
}
