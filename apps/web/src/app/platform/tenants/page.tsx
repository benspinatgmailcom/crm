"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePlatformTenants } from "@/hooks/use-platform-tenants";
import { TenantTable } from "@/components/platform/tenant-table";
import { CreateAdminModal } from "@/components/platform/create-admin-modal";
import { PlatformToast } from "@/components/platform/platform-toast";
import type { TenantListItem } from "@/lib/platform-types";
import { Plus } from "lucide-react";

export default function PlatformTenantsPage() {
  const { tenants, loading, error, refetch } = usePlatformTenants();
  const [createAdminTenant, setCreateAdminTenant] = useState<TenantListItem | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const handleCreateAdminSuccess = useCallback(() => {
    showToast("Admin user created. Set-password email sent.", "success");
  }, [showToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-white/80">Loading tenants...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Tenants</h1>
        <Link
          href="/platform/tenants/new"
          className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-white/20"
        >
          <Plus className="h-4 w-4" />
          Create tenant
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

      <TenantTable
        tenants={tenants}
        onCreateAdmin={(tenant) => setCreateAdminTenant(tenant)}
      />

      <CreateAdminModal
        isOpen={!!createAdminTenant}
        onClose={() => setCreateAdminTenant(null)}
        tenant={createAdminTenant}
        onSuccess={handleCreateAdminSuccess}
      />
    </div>
  );
}
