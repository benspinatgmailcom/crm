"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PlatformModal } from "./platform-modal";
import type { TenantListItem } from "@/lib/platform-types";

interface CreateAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: TenantListItem | null;
  onSuccess: () => void;
}

const ROLES = ["ADMIN", "USER", "VIEWER"] as const;

export function CreateAdminModal({
  isOpen,
  onClose,
  tenant,
  onSuccess,
}: CreateAdminModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER" | "VIEWER">("ADMIN");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !email.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/platform/tenants/${tenant.id}/create-admin`, {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), role }),
      });
      setEmail("");
      setName("");
      setRole("ADMIN");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      setError(e.body?.message ?? e.message ?? "Failed to create admin user.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20";
  const labelClass = "mb-1 block text-sm font-medium text-white/80";

  return (
    <PlatformModal
      isOpen={isOpen}
      onClose={onClose}
      title={tenant ? `Create admin for ${tenant.name}` : "Create tenant admin"}
    >
      {tenant && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          <div>
            <label className={labelClass}>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "USER" | "VIEWER")}
              className={inputClass}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create admin"}
            </button>
          </div>
        </form>
      )}
    </PlatformModal>
  );
}
