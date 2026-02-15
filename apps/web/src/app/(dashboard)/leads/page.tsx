"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { leadSchema, type LeadFormData } from "@/lib/validation";
import { useAuth } from "@/context/auth-context";
import { canWrite } from "@/lib/roles";

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  status: string | null;
  source: string | null;
}

interface PaginatedResponse {
  data: Lead[];
  page: number;
  pageSize: number;
  total: number;
}

const STATUS_OPTIONS = ["new", "contacted", "qualified", "disqualified"];

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const canEdit = canWrite(user?.role);
  const viewId = searchParams.get("viewId");
  const createParam = searchParams.get("create");
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [qFilter, setQFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<LeadFormData>({
    name: "",
    email: "",
    company: "",
    status: "new",
    source: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (viewId) router.replace(`/leads/${viewId}`);
  }, [viewId, router]);

  useEffect(() => {
    if (createParam === "1" && canEdit) {
      openCreate();
      router.replace("/leads", { scroll: false });
    }
  }, [createParam, canEdit]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(qFilter), 300);
    return () => clearTimeout(t);
  }, [qFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (debouncedQ) params.set("q", debouncedQ);
    if (statusFilter) params.set("status", statusFilter);
    try {
      const res = await apiFetch<PaginatedResponse>(`/leads?${params}`);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedQ, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setFormData({
      name: "",
      email: "",
      company: "",
      status: "new",
      source: "",
    });
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingId(lead.id);
    setFormData({
      name: lead.name,
      email: lead.email,
      company: lead.company || "",
      status: lead.status || "new",
      source: lead.source || "",
    });
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitError(null);
    const parsed = leadSchema.safeParse({
      ...formData,
      company: formData.company || undefined,
      status: formData.status || undefined,
      source: formData.source || undefined,
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
        await apiFetch(`/leads/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(parsed.data),
        });
        setModalOpen(false);
        fetchData();
      } else {
        const created = await apiFetch<{ id: string }>("/leads", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        setModalOpen(false);
        router.push(`/leads/${created.id}`);
      }
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
      await apiFetch(`/leads/${deleteId}`, { method: "DELETE" });
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
        <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
        {canEdit && (
        <button
          onClick={openCreate}
          className="rounded-md bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90"
        >
          New
        </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search name, email, company..."
          value={qFilter}
          onChange={(e) => setQFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
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
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Company</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(data?.data ?? []).map((lead) => (
                  <tr
                    key={lead.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/leads/${lead.id}`)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-accent-1 hover:underline">{lead.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{lead.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{lead.company ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{lead.status ?? "—"}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => router.push(`/leads/${lead.id}`)}
                          className="text-sm text-accent-1 hover:underline"
                        >
                          View
                        </button>
                        {canEdit && (
                        <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(lead);
                          }}
                          className="text-sm text-accent-1 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(lead.id);
                          }}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                        </>
                        )}
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
        title={editingId ? "Edit Lead" : "New Lead"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
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
            <label className="block text-sm font-medium text-gray-700">Company</label>
            <input
              value={formData.company}
              onChange={(e) => setFormData((d) => ({ ...d, company: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData((d) => ({ ...d, status: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Source</label>
            <input
              value={formData.source}
              onChange={(e) => setFormData((d) => ({ ...d, source: e.target.value }))}
              placeholder="e.g. website, referral"
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
              className="rounded bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 disabled:opacity-50"
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
        title="Delete Lead"
        message="Are you sure you want to delete this lead?"
        confirmLabel="Delete"
      />
    </div>
  );
}
