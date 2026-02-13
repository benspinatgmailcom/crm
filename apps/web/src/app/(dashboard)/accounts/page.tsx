"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { accountSchema, type AccountFormData } from "@/lib/validation";

interface Account {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
}

interface PaginatedResponse {
  data: Account[];
  page: number;
  pageSize: number;
  total: number;
}

export default function AccountsPage() {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [nameFilter, setNameFilter] = useState("");
  const [debouncedName, setDebouncedName] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AccountFormData>({
    name: "",
    industry: "",
    website: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Account | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(nameFilter), 300);
    return () => clearTimeout(t);
  }, [nameFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (debouncedName) params.set("name", debouncedName);
    try {
      const res = await apiFetch<PaginatedResponse>(`/accounts?${params}`);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setFormData({ name: "", industry: "", website: "" });
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditingId(account.id);
    setFormData({
      name: account.name,
      industry: account.industry || "",
      website: account.website || "",
    });
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitError(null);
    const parsed = accountSchema.safeParse({
      name: formData.name,
      industry: formData.industry || undefined,
      website: formData.website || undefined,
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
        await apiFetch(`/accounts/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(parsed.data),
        });
      } else {
        await apiFetch("/accounts", {
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
      await apiFetch(`/accounts/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      fetchData();
    } catch {
      setDeleteId(null);
      fetchData();
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Accounts</h1>
        <button
          onClick={openCreate}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          placeholder="Filter by name..."
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <p className="mt-4 text-gray-500">Loading...</p>
      ) : (
        <>
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Industry</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Website</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(data?.data ?? []).map((account) => (
                  <tr key={account.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{account.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{account.industry ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{account.website ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setViewing(account)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          View
                        </button>
                        <button
                          onClick={() => openEdit(account)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(account.id)}
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

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Account" : "New Account"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input
              value={formData.name}
              onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            {formErrors.name && <p className="mt-0.5 text-sm text-red-600">{formErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Industry</label>
            <input
              value={formData.industry}
              onChange={(e) => setFormData((d) => ({ ...d, industry: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData((d) => ({ ...d, website: e.target.value }))}
              placeholder="https://"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            {formErrors.website && <p className="mt-0.5 text-sm text-red-600">{formErrors.website}</p>}
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

      {/* View Modal */}
      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title="Account Details"
      >
        {viewing && (
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Name</dt>
              <dd className="text-sm font-medium">{viewing.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Industry</dt>
              <dd className="text-sm">{viewing.industry ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Website</dt>
              <dd className="text-sm">{viewing.website ?? "—"}</dd>
            </div>
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Account"
        message="Are you sure you want to delete this account? This will also delete related contacts and opportunities."
        confirmLabel="Delete"
      />
    </div>
  );
}
