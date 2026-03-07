"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { TenantForm } from "@/components/platform/tenant-form";
import type { TenantFormValues, ProvisionTenantResult } from "@/lib/platform-types";
import { ArrowLeft } from "lucide-react";

const initialValues: TenantFormValues = {
  name: "",
  slug: "",
  displayName: "",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "",
  accentColor: "",
  themeMode: "",
};

const initialAdminEmpty = { email: "", name: "", role: "ADMIN" as const };

export default function NewTenantPage() {
  const router = useRouter();
  const [formValues, setFormValues] = useState<TenantFormValues>(initialValues);
  const [initialAdmin, setInitialAdmin] = useState(initialAdminEmpty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formValues.name.trim(),
        slug: formValues.slug.trim().toLowerCase().replace(/\s+/g, "-"),
        displayName: formValues.displayName.trim() || undefined,
        logoUrl: formValues.logoUrl.trim() || undefined,
        faviconUrl: formValues.faviconUrl.trim() || undefined,
        primaryColor: formValues.primaryColor.trim() || undefined,
        accentColor: formValues.accentColor.trim() || undefined,
        themeMode: formValues.themeMode.trim() || undefined,
      };
      if (initialAdmin.email.trim()) {
        payload.initialAdmin = {
          email: initialAdmin.email.trim(),
          ...(initialAdmin.name.trim() && { name: initialAdmin.name.trim() }),
          role: initialAdmin.role,
        };
      }
      const result = await apiFetch<ProvisionTenantResult>("/platform/tenants", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const message = result.initialAdmin
        ? "Tenant and initial admin created. Set-password email sent to admin."
        : "Tenant created.";
      router.push(`/platform/tenants/${result.tenant.id}?created=1&message=${encodeURIComponent(message)}`);
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      setError(e.body?.message ?? e.message ?? "Failed to create tenant.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20";
  const labelClass = "mb-1 block text-sm font-medium text-white/80";

  const initialAdminSection = (
    <section className="rounded-lg border border-white/10 bg-slate-900/50 p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-white">Initial admin (optional)</h3>
      <p className="mb-4 text-sm text-white/60">
        Create the first tenant admin user as part of provisioning. They will receive a set-password email.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={initialAdmin.email}
            onChange={(e) => setInitialAdmin((a) => ({ ...a, email: e.target.value }))}
            placeholder="admin@example.com"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Name (optional)</label>
          <input
            type="text"
            value={initialAdmin.name}
            onChange={(e) => setInitialAdmin((a) => ({ ...a, name: e.target.value }))}
            placeholder="Full name"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Role</label>
          <select
            value={initialAdmin.role}
            onChange={(e) => setInitialAdmin((a) => ({ ...a, role: e.target.value as "ADMIN" }))}
            className={inputClass}
          >
            <option value="ADMIN">ADMIN</option>
            <option value="USER">USER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </div>
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <Link
        href="/platform/tenants"
        className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tenants
      </Link>

      <h1 className="text-2xl font-semibold text-white">Create tenant</h1>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200">
          {error}
        </div>
      )}

      <TenantForm
        values={formValues}
        onChange={setFormValues}
        onSubmit={handleSubmit}
        saving={saving}
        submitLabel="Create tenant"
        showPreview
        slugReadOnly={false}
        extraSection={initialAdminSection}
      />
    </div>
  );
}
