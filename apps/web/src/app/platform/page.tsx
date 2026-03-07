"use client";

import { usePlatformTenants } from "@/hooks/use-platform-tenants";

function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/50 p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wider text-white/50">
        {title}
      </p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-white/50">{subtitle}</p>}
    </div>
  );
}

export default function PlatformDashboardPage() {
  const { tenants, loading, error } = usePlatformTenants();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-white/80">Loading dashboard...</p>
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

  const activeCount = tenants.filter((t) => t.status === "ACTIVE").length;
  const suspendedCount = tenants.filter((t) => t.status === "SUSPENDED").length;
  const deletedCount = tenants.filter((t) => t.status === "DELETED").length;

  // TODO: Total Users - no platform-level users count API yet; add GET /platform/stats or similar when available.
  const totalUsers = 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-white/60">
          Overview of platform tenants and usage.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total tenants" value={tenants.length} />
        <MetricCard title="Active tenants" value={activeCount} />
        <MetricCard title="Suspended tenants" value={suspendedCount} />
        <MetricCard
          title="Total users"
          value={totalUsers}
          subtitle="TODO: add platform stats API"
        />
      </div>

      {deletedCount > 0 && (
        <MetricCard
          title="Deleted tenants"
          value={deletedCount}
          subtitle="Soft-deleted; excluded from active counts"
        />
      )}
    </div>
  );
}
