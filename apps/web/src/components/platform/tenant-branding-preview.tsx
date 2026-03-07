"use client";

interface TenantBrandingPreviewProps {
  displayName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
}

export function TenantBrandingPreview(props: TenantBrandingPreviewProps) {
  const primary = (props.primaryColor || "").trim() || "#1976d2";
  const accent = (props.accentColor || "").trim() || "#ff9800";

  return (
    <div
      className="rounded-lg border border-white/10 bg-slate-800/50 p-4 shadow-inner"
      style={{ borderLeftWidth: "4px", borderLeftColor: primary }}
    >
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/50">
        Branding preview
      </p>
      <div className="flex items-center gap-3">
        {props.logoUrl ? (
          <div className="relative h-10 w-24 shrink-0 overflow-hidden rounded bg-white/10">
            <img
              src={props.logoUrl}
              alt=""
              className="h-full w-full object-contain p-1"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        ) : (
          <div
            className="h-10 w-24 shrink-0 rounded"
            style={{ backgroundColor: primary + "20" }}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {props.displayName || "Display name"}
          </p>
          <div className="mt-1.5 flex gap-2">
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: primary }}
              title="Primary"
            />
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: accent }}
              title="Accent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
