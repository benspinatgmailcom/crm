# Tenant branding assets (seed/demo)

This folder holds **static branding assets for seeded and demo tenants** only. Assets here are versioned in Git and deployed as static files by Vercel (everything under `public/` is served from the site root).

- **`acme/`** – Acme Telecom (seed tenant)
- **`northstar/`** – Northstar Health (seed tenant)

Each tenant folder may contain:

- `logo.svg` – Tenant logo (used in dashboard header, login, etc.)
- `favicon.svg` – Tenant favicon (used by seed; works in modern browsers). You can add `favicon.ico` for legacy support and point the tenant record to it instead.

**Production / customer branding:** For real customer tenants, branding assets (logos, favicons) should be stored in object storage (e.g. S3) and referenced by full URL in `Tenant.logoUrl` / `Tenant.faviconUrl`. This folder is only for seed/demo tenants that ship with the app.
