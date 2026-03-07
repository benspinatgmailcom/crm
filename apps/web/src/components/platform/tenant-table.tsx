"use client";

import Link from "next/link";
import { Pencil, Eye, UserPlus } from "lucide-react";
import type { TenantListItem } from "@/lib/platform-types";

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "ACTIVE"
      ? "bg-green-500/20 text-green-300"
      : status === "SUSPENDED"
        ? "bg-amber-500/20 text-amber-300"
        : "bg-red-500/20 text-red-300";
  return (
    <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + styles}>
      {status}
    </span>
  );
}

interface TenantTableProps {
  tenants: TenantListItem[];
  onCreateAdmin: (tenant: TenantListItem) => void;
}

export function TenantTable({ tenants, onCreateAdmin }: TenantTableProps) {
  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-900/50 shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="px-4 py-3 font-medium text-white/90">Tenant name</th>
            <th className="px-4 py-3 font-medium text-white/90">Slug</th>
            <th className="px-4 py-3 font-medium text-white/90">Status</th>
            <th className="px-4 py-3 font-medium text-white/90">Primary color</th>
            <th className="px-4 py-3 font-medium text-white/90">Created</th>
            <th className="px-4 py-3 font-medium text-white/90">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
              <td className="px-4 py-3 font-medium text-white">{t.name}</td>
              <td className="px-4 py-3 text-white/80">{t.slug}</td>
              <td className="px-4 py-3">
                <StatusBadge status={t.status} />
              </td>
              <td className="px-4 py-3">
                {(t.primaryColor ?? "").trim() ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-white/20"
                      style={{ backgroundColor: (t.primaryColor ?? "").trim() || undefined }}
                    />
                    <span className="text-white/70">{t.primaryColor}</span>
                  </span>
                ) : (
                  <span className="text-white/50">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-white/70">{formatDate(t.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link
                    href={"/platform/tenants/" + t.id}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-white/90 hover:bg-white/10 hover:text-white"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Link>
                  <Link
                    href={"/platform/tenants/" + t.id}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-white/90 hover:bg-white/10 hover:text-white"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => onCreateAdmin(t)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-white/90 hover:bg-white/10 hover:text-white"
                  >
                    <UserPlus className="h-4 w-4" />
                    Create admin
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
