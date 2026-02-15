"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/roles";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface UserItem {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

const ROLES = ["ADMIN", "USER", "VIEWER"] as const;

export default function UsersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState<{
    userId: string;
    tempPassword: string;
  } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<{
    user: UserItem;
    action: "deactivate" | "activate";
  } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<UserItem[]>("/users");
      setUsers(data ?? []);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e.status === 403) {
        router.replace("/accounts");
        return;
      }
      setError(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (user && !isAdmin(user.role)) {
      router.replace("/accounts");
      return;
    }
    fetchUsers();
  }, [user, router, fetchUsers]);

  const handleRoleChange = useCallback(
    async (userId: string, newRole: string) => {
      try {
        await apiFetch(`/users/${userId}`, {
          method: "PATCH",
          body: JSON.stringify({ role: newRole }),
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        showToast("Role updated.");
      } catch (err: unknown) {
        const e = err as { body?: { message?: string }; message?: string };
        showToast(e.body?.message ?? e.message ?? "Failed to update role.");
      }
    },
    [showToast]
  );

  const handleDeactivateActivate = useCallback(async () => {
    if (!deactivateTarget) return;
    const { user: u, action } = deactivateTarget;
    const isActive = action === "activate";
    try {
      await apiFetch(`/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      setUsers((prev) =>
        prev.map((us) => (us.id === u.id ? { ...us, isActive } : us))
      );
      showToast(isActive ? "User activated." : "User deactivated.");
      setDeactivateTarget(null);
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      showToast(e.body?.message ?? e.message ?? "Failed to update user.");
    }
  }, [deactivateTarget, showToast]);

  const handleResetPassword = useCallback(
    async (userId: string) => {
      try {
        const res = await apiFetch<{ tempPassword: string }>(
          `/users/${userId}/reset-password`,
          { method: "POST", body: "{}" }
        );
        setResetPasswordModal({ userId, tempPassword: res.tempPassword });
      } catch (err: unknown) {
        const e = err as { body?: { message?: string }; message?: string };
        showToast(e.body?.message ?? e.message ?? "Failed to reset password.");
      }
    },
    [showToast]
  );

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setToast("Copied to clipboard.");
    setTimeout(() => setToast(null), 2000);
  }, []);

  if (user && !isAdmin(user.role)) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-gray-600">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/accounts"
            className="text-sm text-accent-1 hover:underline"
          >
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="rounded-md bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90"
        >
          Create user
        </button>
      </div>

      {toast && (
        <div className="mb-3 rounded-lg border border-accent-1/30 bg-accent-1/10 px-4 py-2 text-sm text-gray-800">
          {toast}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Email
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Role
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Created
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Last login
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={u.id === user?.id}
                      className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1 disabled:bg-gray-100"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        u.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() =>
                        setDeactivateTarget({
                          user: u,
                          action: u.isActive ? "deactivate" : "activate",
                        })
                      }
                      disabled={u.id === user?.id}
                      className="mr-2 text-sm text-accent-1 hover:underline disabled:opacity-50 disabled:hover:no-underline"
                    >
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleResetPassword(u.id)}
                      className="text-sm text-accent-1 hover:underline"
                    >
                      Reset password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(created) => {
          const { tempPassword: _, ...userWithoutPass } = created;
          setUsers((prev) => [
            { ...userWithoutPass, lastLoginAt: null },
            ...prev,
          ]);
          setCreateModalOpen(false);
          setResetPasswordModal({
            userId: created.id,
            tempPassword: created.tempPassword,
          });
          showToast("User created.");
        }}
        showToast={showToast}
      />

      {resetPasswordModal && (
        <Modal
          isOpen
          onClose={() => setResetPasswordModal(null)}
          title="Temporary password"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Copy this temporary password and share it securely with the user.
              They will need to change it after first login.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-gray-100 px-3 py-2 font-mono text-sm">
                {resetPasswordModal.tempPassword}
              </code>
              <button
                onClick={() =>
                  copyToClipboard(resetPasswordModal.tempPassword)
                }
                className="rounded bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90"
              >
                Copy
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivateActivate}
        title={
          deactivateTarget?.action === "deactivate"
            ? "Deactivate user"
            : "Activate user"
        }
        message={
          deactivateTarget?.action === "deactivate"
            ? `Deactivating ${deactivateTarget.user.email} will prevent them from logging in. Continue?`
            : `Reactivating ${deactivateTarget?.user.email} will allow them to log in again. Continue?`
        }
        confirmLabel={deactivateTarget?.action === "deactivate" ? "Deactivate" : "Activate"}
        variant={deactivateTarget?.action === "deactivate" ? "danger" : "default"}
      />
    </div>
  );
}

function CreateUserModal({
  isOpen,
  onClose,
  onSuccess,
  showToast,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserItem & { tempPassword: string }) => void;
  showToast: (msg: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("USER");
  const [tempPassword, setTempPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const body: { email: string; role: string; tempPassword?: string } = {
        email: email.trim(),
        role,
      };
      if (tempPassword.trim()) body.tempPassword = tempPassword.trim();
      const res = await apiFetch<UserItem & { tempPassword: string }>(
        "/users",
        { method: "POST", body: JSON.stringify(body) }
      );
      onSuccess(res);
      setEmail("");
      setRole("USER");
      setTempPassword("");
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      const msg = e.body?.message ?? e.message ?? "Failed to create user";
      setSubmitError(msg);
      showToast(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen onClose={onClose} title="Create user">
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <p className="text-sm text-red-600">{submitError}</p>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Role *
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Temp password (optional, auto-generated if empty)
          </label>
          <input
            type="text"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            placeholder="Leave empty to auto-generate"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
