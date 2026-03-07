# Platform Admin UI – Polish & QA Checklist

## Summary of changes

- **Layout**: Dedicated platform layout with sidebar (Dashboard, Tenants), header "Platform Admin", logout. Renders only for GLOBAL_ADMIN; non–global users are redirected to `/accounts`.
- **Dashboard** (`/platform`): Metric cards for Total tenants, Active tenants, Suspended tenants, Total users (placeholder with TODO until stats API exists).
- **Tenant list** (`/platform/tenants`): Table with Tenant name, Slug, Status (green/amber/red badges), Primary color, Created date, Actions (View, Edit, Create admin). "Create tenant" button above table. Create Admin modal from list.
- **Tenant detail** (`/platform/tenants/[id]`): Sections – Tenant information, Branding (with live preview card and color preview circles), Status (ACTIVE/SUSPENDED/DELETED with confirmation for SUSPENDED/DELETED), Tenant admin users (button opens Create Admin modal).
- **Create tenant** (`/platform/tenants/new`): Uses shared TenantForm with branding preview.
- **UX**: Loading states, success/error toasts, disabled buttons during submit, form validation (required fields).

---

## Updated / new files

### Layout & pages
- `apps/web/src/app/platform/layout.tsx` – Platform layout with Dashboard + Tenants sidebar, header, logout.
- `apps/web/src/app/platform/page.tsx` – Dashboard with metric cards (uses `usePlatformTenants`).
- `apps/web/src/app/platform/tenants/page.tsx` – Tenant list using TenantTable, CreateAdminModal, toasts.
- `apps/web/src/app/platform/tenants/[id]/page.tsx` – Detail with TenantForm, status + confirm, CreateAdminModal.
- `apps/web/src/app/platform/tenants/new/page.tsx` – Create tenant using TenantForm.

### Reusable components (`apps/web/src/components/platform/`)
- `platform-modal.tsx` – Dark-themed modal for platform.
- `platform-confirm-dialog.tsx` – Dark-themed confirm dialog (e.g. status change).
- `platform-toast.tsx` – Success/error toast with auto-dismiss.
- `tenant-table.tsx` – Table with columns and status badges, actions (View, Edit, Create admin).
- `tenant-form.tsx` – Tenant info + branding fields, color preview circles, optional live branding preview.
- `tenant-branding-preview.tsx` – Small card: logo, primary/accent swatches, display name (updates with form).
- `create-admin-modal.tsx` – Modal: Email, Name (optional), Role (default ADMIN); calls create-admin API, shows success.

### Hooks & types
- `apps/web/src/hooks/use-platform-tenants.ts` – Fetches tenant list, returns `{ tenants, loading, error, refetch }`.
- `apps/web/src/hooks/use-platform-tenant.ts` – Fetches single tenant by id, returns `{ tenant, loading, error, refetch }`.
- `apps/web/src/lib/platform-types.ts` – `TenantListItem`, `TenantDetail`, `TenantFormValues`.

---

## Manual test checklist

1. **Layout & guard**
   - [ ] As GLOBAL_ADMIN: sidebar shows "Dashboard" and "Tenants"; header shows "Platform Admin" and Logout.
   - [ ] As non–GLOBAL_ADMIN: visiting `/platform` or `/platform/tenants` redirects to `/accounts`.

2. **Dashboard**
   - [ ] Cards show Total tenants, Active tenants, Suspended tenants.
   - [ ] "Total users" shows 0 with TODO subtitle (or placeholder until API exists).
   - [ ] Loading state while fetching; error state if API fails.

3. **Tenant list**
   - [ ] Table shows Tenant name, Slug, Status (green/amber/red), Primary color (swatch + value), Created date.
   - [ ] View and Edit go to tenant detail; Create admin opens modal.
   - [ ] Create tenant button goes to `/platform/tenants/new`.
   - [ ] Loading and error states; success toast after creating admin from modal.

4. **Tenant detail**
   - [ ] Tenant information and Branding sections with live branding preview and color circles.
   - [ ] Changing form updates preview in real time.
   - [ ] Save changes: loading, success toast, form stays in sync.
   - [ ] Status: clicking SUSPENDED or DELETED opens confirmation with correct message; confirm applies change and shows toast.
   - [ ] "Create admin user" opens modal; after success, toast and modal closes.

5. **Create tenant**
   - [ ] Form has name, slug, display name, branding fields; preview updates live.
   - [ ] Submit creates tenant and redirects to detail; validation/error shown if API fails.

6. **Create Admin modal**
   - [ ] Email required; Name optional; Role defaults to ADMIN.
   - [ ] Submit disabled while saving; success toast and modal close on success; error message on failure.

7. **General UX**
   - [ ] Buttons disabled during submit where required.
   - [ ] Success and error toasts appear and auto-dismiss.
   - [ ] No backend or auth logic changed; platform APIs unchanged.
