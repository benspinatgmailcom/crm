# Tenant Provisioning – QA Checklist & Notes

## Summary

- **TenantProvisioningService** orchestrates: create tenant with default settings (including pipeline + activity config), then optionally create initial admin user (reusing UsersService + set-password email).
- **Single API flow**: `POST /platform/tenants` accepts tenant fields + optional `initialAdmin: { email, name?, role? }`. Response: `{ tenant, initialAdmin? }`.
- **Default settings** (in `Tenant.settings` JSON): defaultCurrency, dateFormat, locale, featureFlags, defaultPipelineStages, defaultActivityTypes, dashboard, branding. Stored in `packages/shared` and used by API and seed.
- **Transaction**: Tenant creation is inside a Prisma transaction; initial admin is created after (so set-password email can be sent).
- **Idempotency**: Slug uniqueness enforced; initial admin created at most once per request.
- **Web**: Create-tenant form has an optional "Initial admin" section; success redirects to tenant detail with a message (tenant + admin created when applicable).

---

## Schema assumptions

- **Tenant.settings**: Existing `Json?` field. No migration. Shape is application-defined (see `TenantSettingsDto` in `packages/shared`).
- **Opportunity.stage**: Still a string; default pipeline stages are stored in tenant settings for future UI/config; existing opportunity pipeline logic unchanged.
- **Activity.type**: Still a string; default activity types stored in tenant settings for future UI.
- **User**: No `name` field; `initialAdmin.name` is accepted in API/UI but not persisted (follow-up: add User.name if needed).

---

## Migration notes

- **None.** No schema changes. Existing `Tenant.settings` is used.

---

## Affected backend files

| File | Change |
|------|--------|
| `apps/api/src/platform/tenant-provisioning.service.ts` | **New** – provisioning orchestration, default settings merge, optional initial admin |
| `apps/api/src/platform/tenant-provisioning.types.ts` | **New** – re-exports from @crm/shared |
| `apps/api/src/platform/dto/initial-admin.dto.ts` | **New** – email, name?, role? |
| `apps/api/src/platform/dto/create-tenant.dto.ts` | Added optional `initialAdmin`, `settings` @IsObject |
| `apps/api/src/platform/platform.service.ts` | createTenant delegates to TenantProvisioningService, returns ProvisionTenantResult |
| `apps/api/src/platform/platform.controller.ts` | createTenant return type ProvisionTenantResult |
| `apps/api/src/platform/platform.module.ts` | Registered TenantProvisioningService |
| `packages/shared/src/tenant-defaults.ts` | **New** – getDefaultTenantSettings(), DEFAULT_PIPELINE_STAGES, DEFAULT_ACTIVITY_TYPES |
| `packages/shared/src/index.ts` | Export tenant-defaults |
| `packages/db/package.json` | Added @crm/shared dependency |
| `packages/db/prisma/seed.ts` | Import getDefaultTenantSettings, pass settings when creating tenants |

---

## Affected frontend files

| File | Change |
|------|--------|
| `apps/web/src/lib/platform-types.ts` | Added ProvisionTenantResult |
| `apps/web/src/components/platform/tenant-form.tsx` | Added optional `extraSection` prop |
| `apps/web/src/app/platform/tenants/new/page.tsx` | Initial admin section (email, name, role), payload.initialAdmin, handle ProvisionTenantResult, redirect with message |
| `apps/web/src/app/platform/tenants/[id]/page.tsx` | useSearchParams; show success toast when redirected with ?created=1&message=... |

---

## Manual QA checklist

1. **Create tenant with initial admin**
   - [ ] As GLOBAL_ADMIN, go to Create tenant; fill tenant info and set Initial admin email (and optional name, role).
   - [ ] Submit; expect redirect to tenant detail and success toast: "Tenant and initial admin created. Set-password email sent to admin."
   - [ ] Response includes `tenant` and `initialAdmin`; admin user exists for that tenant and received set-password email (check logs/mailhog if configured).

2. **Create tenant without initial admin**
   - [ ] Create tenant with no initial admin email; submit.
   - [ ] Tenant is created; redirect to detail; toast "Tenant created." No initial admin in response.

3. **Default settings created**
   - [ ] After creating a tenant (with or without initial admin), open tenant in API or DB.
   - [ ] `tenant.settings` contains defaultCurrency "USD", dateFormat "MM/dd/yyyy", locale "en-US", featureFlags {}, defaultPipelineStages array, defaultActivityTypes array.

4. **Default pipeline config**
   - [ ] `tenant.settings.defaultPipelineStages` equals the shared default list (prospecting, qualification, discovery, proposal, negotiation, closed-won, closed-lost).
   - [ ] Existing opportunity pipeline behavior unchanged (stages still work in pipeline view).

5. **Default activity config**
   - [ ] `tenant.settings.defaultActivityTypes` equals the shared default list (call, email, meeting, note, task, follow-up, stage_change, ai_summary, ai_draft, ai_next_action).
   - [ ] Existing activity creation/display unchanged.

6. **Duplicate protection**
   - [ ] Create tenant with slug "acme"; succeed.
   - [ ] Create another tenant with slug "acme"; expect 409 Conflict "Tenant with slug \"acme\" already exists".
   - [ ] Initial admin is only created once per create request (no double-create path).

7. **Seed**
   - [ ] Run `pnpm db:seed` (from repo root); tenants are created with `settings` set to default (getDefaultTenantSettings from shared).
   - [ ] Seeded tenants have same default pipeline/activity config as provisioned tenants.

---

## Follow-up notes

- **initialAdmin.name**: Accepted in API and UI but not stored (User model has no name field). Add User.name + migration when needed.
- **Set-password email**: Reuses existing UsersService.create flow; if email fails, tenant is still created and admin user exists (they can use password reset later).
