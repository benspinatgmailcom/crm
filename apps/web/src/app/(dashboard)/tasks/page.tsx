"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { canWrite, isAdmin } from "@/lib/roles";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Check, Pencil, ExternalLink } from "lucide-react";

const TASK_PRIORITIES = ["low", "medium", "high"] as const;

const PRIORITY_PILL_CLASSES: Record<(typeof TASK_PRIORITIES)[number], string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-700",
};

interface TaskItem {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  dueAt: string | null;
  status: string;
  priority: string | null;
  ownerId: string | null;
  ownerEmail: string | null;
  entityName?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedTasks {
  data: TaskItem[];
  page: number;
  pageSize: number;
  total: number;
}

interface UserOption {
  id: string;
  email: string;
  role?: string;
}

export default function TasksPage() {
  const { user } = useAuth();
  const canEdit = canWrite(user?.role);
  const admin = isAdmin(user?.role);

  const [data, setData] = useState<PaginatedTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assignee, setAssignee] = useState<"me" | "all" | string>("me");
  const [userId, setUserId] = useState<string>("");
  const [status, setStatus] = useState<"open" | "done">("open");
  const [overdue, setOverdue] = useState(false);
  const [dueToday, setDueToday] = useState(false);
  const [dueThisWeek, setDueThisWeek] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<TaskItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const assigneeParam =
    assignee === "me"
      ? "me"
      : assignee === "all"
        ? (userId || "all")
        : assignee === "user" && userId
          ? userId
          : "me";

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("assignee", assigneeParam);
    params.set("status", status);
    if (overdue) params.set("overdue", "true");
    if (dueToday) params.set("dueToday", "true");
    if (dueThisWeek) params.set("dueThisWeek", "true");
    try {
      const res = await apiFetch<PaginatedTasks>(`/tasks?${params}`);
      setData(res);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? "Failed to load tasks");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, assigneeParam, status, overdue, dueToday, dueThisWeek]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (admin) {
      apiFetch<UserOption[]>("/users/active")
        .then(setUsers)
        .catch(() => setUsers([]));
    }
  }, [admin]);

  const runFetch = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("assignee", assigneeParam);
    params.set("status", status);
    if (overdue) params.set("overdue", "true");
    if (dueToday) params.set("dueToday", "true");
    if (dueThisWeek) params.set("dueThisWeek", "true");
    return apiFetch<PaginatedTasks>(`/tasks?${params}`).then(setData);
  }, [page, pageSize, assigneeParam, status, overdue, dueToday, dueThisWeek]);

  const handleCompleteReopen = async (task: TaskItem) => {
    if (!canEdit) return;
    setActionId(task.id);
    try {
      await apiFetch(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: task.status === "done" ? "open" : "done" }),
      });
      await runFetch();
    } finally {
      setActionId(null);
    }
  };

  const handleSnooze = async (task: TaskItem, days: number) => {
    if (!canEdit) return;
    setActionId(task.id);
    try {
      const d = new Date();
      d.setDate(d.getDate() + days);
      await apiFetch(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ dueAt: d.toISOString() }),
      });
      await runFetch();
    } finally {
      setActionId(null);
    }
  };

  const openEdit = (task: TaskItem) => {
    setEditTask(task);
    setEditTitle(task.title);
    setEditDueAt(task.dueAt ? task.dueAt.slice(0, 10) : "");
    setEditPriority(
      task.priority && TASK_PRIORITIES.includes(task.priority as (typeof TASK_PRIORITIES)[number]) ? task.priority : "",
    );
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTask) return;
    setEditSubmitting(true);
    try {
      await apiFetch(`/tasks/${editTask.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle.trim() || editTask.title,
          dueAt: editDueAt || null,
          priority: TASK_PRIORITIES.includes(editPriority as (typeof TASK_PRIORITIES)[number]) ? editPriority : null,
        }),
      });
      setEditTask(null);
      await runFetch();
    } finally {
      setEditSubmitting(false);
    }
  };

  const relatedLink = (task: TaskItem) => {
    if (task.entityType === "opportunity") return `/opportunities/${task.entityId}`;
    if (task.entityType === "account") return `/accounts/${task.entityId}`;
    if (task.entityType === "contact") return `/contacts/${task.entityId}`;
    if (task.entityType === "lead") return `/leads/${task.entityId}`;
    return null;
  };

  const formatDue = (dueAt: string | null) => {
    if (!dueAt) return "—";
    const d = new Date(dueAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(d);
    due.setHours(0, 0, 0, 0);
    if (due.getTime() < today.getTime()) return d.toLocaleDateString(undefined, { dateStyle: "short" }) + " (overdue)";
    return d.toLocaleDateString(undefined, { dateStyle: "short" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500">Assignee</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value as "me" | "all" | "user")}
              className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="me">My</option>
              <option value="all">All</option>
              {admin && <option value="user">Specific user</option>}
            </select>
          </div>
          {admin && (assignee === "all" || assignee === "user") && (
            <div>
              <label className="block text-xs font-medium text-gray-500">User</label>
              <select
                value={assignee === "user" ? userId : ""}
                onChange={(e) => setUserId(e.target.value)}
                className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm min-w-[180px]"
              >
                <option value="">All users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500">Status</label>
            <div className="mt-1 flex rounded border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setStatus("open")}
                className={`px-3 py-2 text-sm font-medium ${status === "open" ? "bg-accent-1 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setStatus("done")}
                className={`px-3 py-2 text-sm font-medium ${status === "done" ? "bg-accent-1 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                Done
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Quick:</span>
            <button
              type="button"
              onClick={() => { setOverdue((o) => !o); setDueToday(false); setDueThisWeek(false); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${overdue ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              Overdue
            </button>
            <button
              type="button"
              onClick={() => { setDueToday((d) => !d); setOverdue(false); setDueThisWeek(false); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${dueToday ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              Due today
            </button>
            <button
              type="button"
              onClick={() => { setDueThisWeek((d) => !d); setOverdue(false); setDueToday(false); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${dueThisWeek ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              Due this week
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading tasks…</p>
      ) : !data?.data.length ? (
        <p className="text-sm text-gray-500">No tasks match the filters.</p>
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Due</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Assignee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Related</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Priority</th>
                  {canEdit && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data.data.map((task) => {
                  const link = relatedLink(task);
                  const busy = actionId === task.id;
                  return (
                    <tr key={task.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{task.title || "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDue(task.dueAt)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{task.ownerEmail ?? "—"}</td>
                      <td className="px-4 py-3 text-sm">
                        {link ? (
                          <Link href={link} className="inline-flex items-center gap-1 text-accent-1 hover:underline">
                            {task.entityName ?? task.entityType}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {task.priority && TASK_PRIORITIES.includes(task.priority as (typeof TASK_PRIORITIES)[number]) ? (
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_PILL_CLASSES[task.priority as (typeof TASK_PRIORITIES)[number]]}`}
                          >
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </span>
                        ) : task.priority ? (
                          <span className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {task.priority}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleCompleteReopen(task)}
                              disabled={busy}
                              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                                task.status === "done"
                                  ? "border-gray-400 text-gray-700 hover:bg-gray-50"
                                  : "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              {task.status === "done" ? "Reopen" : "Complete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(task)}
                              className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            {task.status !== "done" && (
                              <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => handleSnooze(task, 1)}
                                  disabled={busy}
                                  className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                  title="+1 day"
                                >
                                  +1d
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSnooze(task, 3)}
                                  disabled={busy}
                                  className="border-l border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                  title="+3 days"
                                >
                                  +3d
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSnooze(task, 7)}
                                  disabled={busy}
                                  className="border-l border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                  title="Next week"
                                >
                                  +1w
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data && (
            <div className="mt-4">
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={setPage}
                onPageSizeChange={(v) => {
                  setPageSize(v);
                  setPage(1);
                }}
              />
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={!!editTask}
        onClose={() => setEditTask(null)}
        title="Edit task"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {editTask && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Due date</label>
                <input
                  type="date"
                  value={editDueAt}
                  onChange={(e) => setEditDueAt(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTask(null)}
                  className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 disabled:opacity-50"
                >
                  {editSubmitting ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
