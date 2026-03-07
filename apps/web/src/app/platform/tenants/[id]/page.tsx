"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { usePlatformTenant } from "@/hooks/use-platform-tenant";
import { TenantForm } from "@/components/platform/tenant-form";
import { CreateAdminModal } from "@/components/platform/create-admin-modal";
import { PlatformConfirmDialog } from "@/components/platform/platform-confirm-dialog";
import { PlatformToast } from "@/components/platform/platform-toast";
import type { TenantDetail, TenantFormValues } from "@/lib/platform-types";
import { ArrowLeft, UserPlus } from "lucide-react";

const STATUSES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;

const STATUS_MESSAGES: Record<string, string> = {
  SUSPENDED:
    "Suspending this tenant will prevent all users from logging in.",
  DELETED:
    "Marking this tenant as deleted will prevent all users from logging in and may hide the tenant from normal operations.",
};

export default function PlatformTenantDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { tenant, loading, error, refetch } = usePlatformTenant(id);

  const [formValues, setFormValues] = useState<TenantFormValues>({
    name: "",
    slug: "",
    displayName: "",
    logoUrl: "",
    faviconUrl: "",
    primaryColor: "",
    accentColor: "",
    themeMode: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<{
    status: string;
    message: string;
  } | null>(null);
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    const created = searchParams.get("created");
    const message = searchParams.get("message");
    if (created === "1" && message) {
      showToast(decodeURIComponent(message), "success");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams, showToast]);

  useEffect(() => {
    if (tenant) {
      setFormValues({
        name: tenant.name,
        slug: tenant.slug,
        displayName: tenant.displayName ?? "",
        logoUrl: tenant.logoUrl ?? "",
        faviconUrl: tenant.faviconUrl ?? "",
        primaryColor: tenant.primaryColor ?? "",
        accentColor: tenant.accentColor ?? "",
        themeMode: tenant.themeMode ?? "",
      });
    }
  }, [tenant]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      const payload = {
        name: formValues.name,
        slug: formValues.slug,
        displayName: formValues.displayName || undefined,
        logoUrl: formValues.logoUrl || undefined,
        faviconUrl: formValues.faviconUrl || undefined,
        primaryColor: formValues.primaryColor || undefined,
        accentColor: formValues.accentColor || undefined,
        themeMode: formValues.themeMode || undefined,
      };
      const updated = await apiFetch<TenantDetail>(`/platform/tenants/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      refetch();
      showToast("Tenant updated.", "success");
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      showToast(e.body?.message ?? e.message ?? "Failed to update tenant.", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleSetStatus = async (status: string) => {
    setStatusConfirm(null);
    setStatusSaving(true);
    try {
      await apiFetch<TenantDetail>(`/platform/tenants/${id}/set-status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      refetch();
      showToast(`Status set to ${status}.`, "success");
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      showToast(e.body?.message ?? e.message ?? "Failed to set status.", "error");
    } finally {
      setStatusSaving(false);
    }
  };

  const handleStatusClick = (status: string) => {
    if (tenant?.status === status) return;
    const message = STATUS_MESSAGES[status];
    if (message) {
      setStatusConfirm({ status, message });
    } else {
      handleSetStatus(status);
    }
  };

  const handleCreateAdminSuccess = useCallback(() => {
    showToast("Admin user created. Set-password email sent.", "success");
  }, [showToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-white/80">Loading...</p>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="space-y-4">
        <Link
          href="/platform/tenants"
          className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to tenants
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          {error ?? "Tenant not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/platform/tenants"
          className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to tenants
        </Link>
      </div>

      {toast && (
        <div className="fixed right-6 top-20 z-40">
          <PlatformToast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        </div>
      )}

      <TenantForm
        values={formValues}
        onChange={setFormValues}
        onSubmit={handleSaveEdit}
        saving={editSaving}
        submitLabel="Save changes"
        showPreview
        slugReadOnly
      />

      {/* Status */}
      <section className="rounded-lg border border-white/10 bg-slate-900/50 p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-white">Status</h3>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStatusClick(s)}
              disabled={statusSaving || tenant.status === s}
              className={
                tenant.status === s
                  ? "rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white"
                  : "rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/15 disabled:opacity-50"
              }
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Tenant admin users */}
      <section className="rounded-lg border border-white/10 bg-slate-900/50 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Tenant admin users</h3>
          <button
            type="button"
            onClick={() => setCreateAdminOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            <UserPlus className="h-4 w-4" />
            Create admin user
          </button>
        </div>
        <p className="mt-2 text-sm text-white/60">
          Create a user with ADMIN (or other) role. A set-password email will be sent.
        </p>
      </section>

      <PlatformConfirmDialog
        isOpen={!!statusConfirm}
        onClose={() => setStatusConfirm(null)}
        onConfirm={() => statusConfirm && handleSetStatus(statusConfirm.status)}
        title="Change tenant status?"
        message={statusConfirm?.message ?? ""}
        confirmLabel="Continue"
        variant="danger"
      />

      <CreateAdminModal
        isOpen={createAdminOpen}
        onClose={() => setCreateAdminOpen(false)}
        tenant={tenant}
        onSuccess={handleCreateAdminSuccess}
      />
    </div>
  );
}
