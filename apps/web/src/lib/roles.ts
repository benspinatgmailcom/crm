/**
 * Centralized role helpers for RBAC.
 * ADMIN + USER = full CRUD (create/edit/delete/upload/AI).
 * VIEWER = read-only.
 */
export function canWrite(role: string | undefined): boolean {
  return role === "ADMIN" || role === "USER";
}

export function isAdmin(role: string | undefined): boolean {
  return role === "ADMIN";
}
