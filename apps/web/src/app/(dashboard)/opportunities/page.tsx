"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { opportunitySchema, type OpportunityFormData } from "@/lib/validation";

interface Opportunity {
  id: string;
  accountId: string;
  name: string;
  amount: { toString(): string } | null;
  stage: string | null;
  probability: number | null;
  closeDate: string | null;
}

interface Account {
  id: string;
  name: string;
}

interface PaginatedResponse {
  data: Opportunity[];
  page: number;
  pageSize: number;
  total: number;
}

const STAGE_OPTIONS = ["prospecting", "discovery", "proposal", "negotiation", "closed-won", "closed-lost"];

export default function OpportunitiesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewId = searchParams.get("viewId");
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [nameFilter, setNameFilter] = useState("");
  const [accountIdFilter, setAccountIdFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [debouncedAccountId, setDebouncedAccountId] = useState("");
  const [debouncedStage, setDebouncedStage] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<OpportunityFormData>({
    accountId: "",
    name: "",
    amount: undefined,
    stage: "prospecting",
    probability: undefined,
    closeDate: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (viewId) router.replace(`/opportunities/${viewId}`);
  }, [viewId, router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(nameFilter), 300);
    return () => clearTimeout(t);
  }, [nameFilter]);
  useEffect(() => {
    setDebouncedAccountId(accountIdFilter);
  }, [accountIdFilter]);
  useEffect(() => {
    setDebouncedStage(stageFilter);
  }, [stageFilter]);

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
    if (debouncedAccountId) params.set("accountId", debouncedAccountId);
    if (debouncedStage) params.set("stage", debouncedStage);
    try {
      const res = await apiFetch<PaginatedResponse>(`/opportunities?${params}`);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to load opportunities");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedName, debouncedAccountId, debouncedStage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setFormData({
      accountId: accountIdFilter || "",
      name: "",
      amount: undefined,
      stage: "prospecting",
      probability: undefined,
      closeDate: "",
    });
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const openEdit = (opp: Opportunity) => {
    setEditingId(opp.id);
    setFormData({
      accountId: opp.accountId,
      name: opp.name,
      amount: opp.amount != null ? Number(opp.amount) : undefined,
      stage: opp.stage || "prospecting",
      probability: opp.probability ?? undefined,
      closeDate: opp.closeDate ? opp.closeDate.slice(0, 10) : "",
    });
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        await apiFetch(`/opportunities/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: parsed.data.name,
            amount: parsed.data.amount,
            stage: parsed.data.stage,
            probability: parsed.data.probability,
            closeDate: parsed.data.closeDate,
          }),
        });
      } else {
        await apiFetch("/opportunities", {
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
      await apiFetch(`/opportunities/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      fetchData();
    } catch {
      setDeleteId(null);
      fetchData();
    }
  };

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;
  const formatAmount = (v: { toString(): string } | null) =>
    v != null ? `$${Number(v).toLocaleString()}` : "—";

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Opportunities</h1>
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
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All stages</option>
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
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
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Account</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Stage</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Close Date</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(data?.data ?? []).map((opp) => (
                  <tr
                    key={opp.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/opportunities/${opp.id}`)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{opp.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{accountName(opp.accountId)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatAmount(opp.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{opp.stage ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {opp.closeDate ? new Date(opp.closeDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => router.push(`/opportunities/${opp.id}`)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          View
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(opp);
                          }}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(opp.id);
                          }}
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
        title={editingId ? "Edit Opportunity" : "New Opportunity"}
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
              {formErrors.amount && (
                <p className="mt-0.5 text-sm text-red-600">{formErrors.amount}</p>
              )}
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

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Opportunity"
        message="Are you sure you want to delete this opportunity?"
        confirmLabel="Delete"
      />
    </div>
  );
}
