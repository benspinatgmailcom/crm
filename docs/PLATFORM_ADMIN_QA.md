# Platform Admin (Global Admin) – QA Checklist & Affected Files

## Affected files

### Seed
- `packages/db/prisma/seed.ts` – already includes `ensureGlobalAdmin()`; dev credentials: `global-admin@platform.local` / `GlobalAdmin123!` (see comments in file).

### API
- `apps/api/src/auth/auth.service.ts` – login/refresh tenant status enforcement; `TenantStatus` import.
- `apps/api/src/auth/guards/tenant-status.guard.ts` – **new**; rejects requests when user’s tenant is not ACTIVE.
- `apps/api/src/app.module.ts` – `TenantStatusGuard` and `PlatformModule` registered.
- `apps/api/src/platform/platform.module.ts` – **new**.
- `apps/api/src/platform/platform.controller.ts` – **new**; `GET/POST /platform/tenants`, `GET/PATCH /platform/tenants/:id`, `POST :id/set-status`, `POST :id/create-admin`; all `@Roles(Role.GLOBAL_ADMIN)`.
- `apps/api/src/platform/platform.service.ts` – **new**; tenant CRUD, set-status, create-tenant-admin (reuses `UsersService.create` + set-password email).
- `apps/api/src/platform/dto/create-tenant.dto.ts` – **new**.
- `apps/api/src/platform/dto/update-tenant.dto.ts` – **new**.
- `apps/api/src/platform/dto/set-tenant-status.dto.ts` – **new**.
- `apps/api/src/platform/dto/create-tenant-admin.dto.ts` – **new**.

### Web
- `apps/web/src/lib/roles.ts` – added `isGlobalAdmin(role)`.
- `apps/web/src/context/auth-context.tsx` – login redirect: GLOBAL_ADMIN → `/platform`, else → `/accounts` (or change-password).
- `apps/web/src/app/(dashboard)/layout.tsx` – “Platform” nav link for GLOBAL_ADMIN only.
- `apps/web/src/app/login/page.tsx` – authenticated redirect: GLOBAL_ADMIN → `/platform`.
- `apps/web/src/app/page.tsx` – home redirect: GLOBAL_ADMIN → `/platform`.
- `apps/web/src/app/platform/layout.tsx` – **new**; platform shell; requires GLOBAL_ADMIN, else redirect to login/accounts.
- `apps/web/src/app/platform/page.tsx` – **new**; redirects to `/platform/tenants`.
- `apps/web/src/app/platform/tenants/page.tsx` – **new**; tenant list (name, slug, status, displayName, branding summary).
- `apps/web/src/app/platform/tenants/new/page.tsx` – **new**; create tenant form.
- `apps/web/src/app/platform/tenants/[id]/page.tsx` – **new**; tenant detail, edit form, set status, create tenant admin.

---

## Migration / seed notes

- **No new migration** was added; schema already has `TenantStatus`, `User.tenantId` nullable, and `UserRole.GLOBAL_ADMIN`.
- **Seed**: Run `pnpm db:seed` (from repo root) or `pnpm exec prisma db seed` from `packages/db`. This creates one GLOBAL_ADMIN user with `tenantId = null` and the dev credentials above. Idempotent for that user.

---

## Manual QA checklist

1. **Global admin login**
   - [ ] Log in as `global-admin@platform.local` / `GlobalAdmin123!`.
   - [ ] Redirects to `/platform` (then to `/platform/tenants`).
   - [ ] Platform nav shows “Tenants” and “CRM”; no tenant branding required.

2. **Tenant create/update**
   - [ ] From `/platform/tenants`, click “Add tenant”; create a tenant (name, slug, optional branding).
   - [ ] After create, redirects to tenant detail.
   - [ ] Edit name, slug, displayName, logoUrl, faviconUrl, primaryColor, accentColor, themeMode; save; changes persist.

3. **Tenant status changes**
   - [ ] On tenant detail, set status to SUSPENDED then back to ACTIVE.
   - [ ] Set to SUSPENDED; confirm a user of that tenant cannot log in (blocked with clear message).
   - [ ] (Optional) Set to DELETED; confirm login blocked for that tenant’s users.

4. **Tenant admin creation**
   - [ ] On tenant detail, “Create tenant admin” with an email; submit.
   - [ ] Success message; set-password email sent (check logs or mailhog if configured).
   - [ ] New user can set password and log in; belongs to that tenant and has ADMIN role.

5. **Blocked login for suspended tenant**
   - [ ] Suspend a tenant that has at least one user.
   - [ ] Log in as that user; login fails with message about tenant suspended.
   - [ ] As GLOBAL_ADMIN, set tenant back to ACTIVE; user can log in again.

6. **Access boundaries**
   - [ ] Log in as a normal tenant user (e.g. ADMIN); no “Platform” in nav; visiting `/platform` redirects to `/accounts`.
   - [ ] GLOBAL_ADMIN can open “CRM” and use normal CRM; “Platform” link appears in dashboard nav for return.

7. **API**
   - [ ] Without GLOBAL_ADMIN token, `GET /platform/tenants` returns 403.
   - [ ] With GLOBAL_ADMIN token, all platform endpoints (list, get, create, update, set-status, create-admin) succeed as expected.
