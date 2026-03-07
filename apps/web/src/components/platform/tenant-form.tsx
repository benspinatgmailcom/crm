"use client";

import type { TenantFormValues } from "@/lib/platform-types";
import { TenantBrandingPreview } from "./tenant-branding-preview";

interface TenantFormProps {
  values: TenantFormValues;
  onChange: (values: TenantFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  submitLabel?: string;
  showPreview?: boolean;
  /** If true, slug is read-only (e.g. on edit when we don't allow slug change yet). */
  slugReadOnly?: boolean;
  /** Optional section rendered before the submit button (e.g. initial admin fields). */
  extraSection?: React.ReactNode;
}

const inputClass =
  "w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20";
const labelClass = "mb-1 block text-sm font-medium text-white/80";

/** Normalize to #rrggbb for native color input (only accepts 6-digit hex). */
function toHex6(hex: string, fallback: string): string {
  const trimmed = (hex || "").trim();
  if (!trimmed) return fallback;
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const r = trimmed[1] + trimmed[1];
    const g = trimmed[2] + trimmed[2];
    const b = trimmed[3] + trimmed[3];
    return `#${r}${g}${b}`;
  }
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed}`;
  if (/^[0-9A-Fa-f]{3}$/.test(trimmed))
    return `#${trimmed[0]}${trimmed[0]}${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}`;
  return fallback;
}

function ColorInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
}) {
  const fallback = placeholder || "#1976d2";
  const pickerValue = toHex6(value, fallback);

  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={pickerValue}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-white/20 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded [&::-moz-color-swatch]:rounded"
        title={`Pick ${label}`}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass + " flex-1"}
      />
    </div>
  );
}

export function TenantForm({
  values,
  onChange,
  onSubmit,
  saving,
  submitLabel = "Save changes",
  showPreview = true,
  slugReadOnly = false,
  extraSection,
}: TenantFormProps) {
  const set = (key: keyof TenantFormValues, value: string) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Tenant Information */}
      <section className="rounded-lg border border-white/10 bg-slate-900/50 p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-white">Tenant information</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Slug</label>
            <input
              type="text"
              value={values.slug}
              onChange={(e) => set("slug", e.target.value)}
              readOnly={slugReadOnly}
              className={inputClass + (slugReadOnly ? " opacity-70" : "")}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Display name</label>
            <input
              type="text"
              value={values.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Branding */}
      <section className="rounded-lg border border-white/10 bg-slate-900/50 p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-white">Branding</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Logo URL</label>
            <input
              type="text"
              value={values.logoUrl}
              onChange={(e) => set("logoUrl", e.target.value)}
              placeholder="https://... or /tenants/slug/logo.svg"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Favicon URL</label>
            <input
              type="text"
              value={values.faviconUrl}
              onChange={(e) => set("faviconUrl", e.target.value)}
              placeholder="https://... or /tenants/slug/favicon.svg"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Primary color</label>
            <ColorInput
              value={values.primaryColor}
              onChange={(v) => set("primaryColor", v)}
              label="Primary color"
              placeholder="#1976d2"
            />
          </div>
          <div>
            <label className={labelClass}>Accent color</label>
            <ColorInput
              value={values.accentColor}
              onChange={(v) => set("accentColor", v)}
              label="Accent color"
              placeholder="#ff9800"
            />
          </div>
          <div>
            <label className={labelClass}>Theme mode</label>
            <select
              value={values.themeMode}
              onChange={(e) => set("themeMode", e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              <option value="light">light</option>
              <option value="dark">dark</option>
              <option value="system">system</option>
            </select>
          </div>
        </div>

        {showPreview && (
          <div className="mt-4">
            <TenantBrandingPreview
              displayName={values.displayName || values.name}
              logoUrl={values.logoUrl}
              primaryColor={values.primaryColor || "#1976d2"}
              accentColor={values.accentColor || "#ff9800"}
            />
          </div>
        )}
      </section>

      {extraSection}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
