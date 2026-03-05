"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { canWrite, isAdmin } from "@/lib/roles";
import { Check, X, MessageSquarePlus, ExternalLink } from "lucide-react";

interface FollowupItem {
  kind: "suggestion" | "openTask";
  id: string;
  opportunityId: string;
  opportunityName: string;
  ownerId: string | null;
  ownerEmail: string | null;
  title: string;
  description?: string;
  dueAt: string;
  createdAt: string;
  snoozedUntil?: string;
  severity?: "warning" | "critical";
}

interface ListResponse {
  items: FollowupItem[];
}

interface OpportunityOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  email: string;
}

export default function FollowupsPage() {
  const { user } = useAuth();
  const canEdit = canWrite(user?.role);
  const admin = isAdmin(user?.role);

  const [items, setItems] = useState<FollowupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string>("me");
  const [userId, setUserId] = useState<string>("");
  const [opportunityId, setOpportunityId] = useState<string>("");
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);

  const assigneeParam = assignee === "all" ? "all" : assignee === "user" && userId ? userId : "me";

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("assignee", assigneeParam);
    if (opportunityId) params.set("opportunityId", opportunityId);
    try {
      const res = await apiFetch<ListResponse>(`/followups?${params}`);
      setItems(res.items ?? []);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? "Failed to load follow-ups");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [assigneeParam, opportunityId]);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  useEffect(() => {
    const loadOpps = async () => {
      try {
        const list = await apiFetch<{ data: { id: string; name: string }[] }>("/opportunities?pageSize=500");
        setOpportunities(list.data ?? []);
      } catch {
        setOpportunities([]);
      }
    };
    loadOpps();
  }, []);

  useEffect(() => {
    if (admin) {
      apiFetch<UserOption[]>("/users/active")
        .then(setUsers)
        .catch(() => setUsers([]));
    }
  }, [admin]);

  const runAction = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        await fetchFollowups();
      } finally {
        setActionId(null);
      }
    },
    [fetchFollowups]
  );

  const createTaskFromSuggestion = (suggestionId: string) => {
    if (!canEdit) return;
    setActionId(suggestionId);
    runAction(() => apiFetch(`/followups/${suggestionId}/create-task`, { method: "POST" }));
  };

  const createDraftFromSuggestion = (suggestionId: string) => {
    if (!canEdit) return;
    setActionId(`draft-sug-${suggestionId}`);
    runAction(() => apiFetch(`/followups/${suggestionId}/draft`, { method: "POST", body: JSON.stringify({}) }));
  };

  const completeTask = (taskActivityId: string) => {
    if (!canEdit) return;
    setActionId(taskActivityId);
    runAction(() => apiFetch(`/tasks/${taskActivityId}/complete`, { method: "POST" }));
  };

  const dismissTask = (taskActivityId: string) => {
    if (!canEdit) return;
    setActionId(taskActivityId);
    runAction(() => apiFetch(`/tasks/${taskActivityId}/dismiss`, { method: "POST" }));
  };

  const snoozeTask = (taskActivityId: string, days: number) => {
    if (!canEdit) return;
    const d = new Date();
    d.setDate(d.getDate() + days);
    setActionId(taskActivityId);
    runAction(() =>
      apiFetch(`/tasks/${taskActivityId}/snooze`, { method: "POST", body: JSON.stringify({ until: d.toISOString() }) })
    );
  };

  const createDraftFromTask = (taskId: string) => {
    if (!canEdit) return;
    setActionId(`draft-task-${taskId}`);
    runAction(() => apiFetch(`/tasks/${taskId}/draft`, { method: "POST", body: JSON.stringify({}) }));
  };

  const formatDue = (dueAt: string, snoozedUntil?: string) => {
    if (snoozedUntil) {
      return (
        <span className="text-amber-700">
          Snoozed until {new Date(snoozedUntil).toLocaleDateString(undefined, { dateStyle: "short" })}
        </span>
      );
    }
    return new Date(dueAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Follow-ups</h1>
        <p className="mt-1 text-sm text-gray-500">
          Suggestions and open tasks from the follow-up engine. Create a task or draft from a suggestion; complete, dismiss, or snooze open tasks.
        </p>
      </div>

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
                className="mt-1 min-w-[180px] rounded border border-gray-300 px-3 py-2 text-sm"
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
            <label className="block text-xs font-medium text-gray-500">Opportunity</label>
            <select
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
              className="mt-1 min-w-[200px] rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All opportunities</option>
              {opportunities.map((opp) => (
                <option key={opp.id} value={opp.id}>
                  {opp.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading follow-ups…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No follow-up suggestions or open tasks match the filters.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Opportunity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Assignee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Due</th>
                {canEdit && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((item) => {
                const busy = actionId === item.id || actionId === `draft-sug-${item.id}` || actionId === `draft-task-${item.id}`;
                return (
                  <tr key={`${item.kind}-${item.id}`} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                          item.kind === "suggestion"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {item.kind === "suggestion" ? "Suggestion" : "Open task"}
                      </span>
                      {item.kind === "suggestion" && item.severity && (
                        <span
                          className={`ml-1 inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                            item.severity === "critical" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.severity}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.title}</td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/opportunities/${item.opportunityId}`}
                        className="inline-flex items-center gap-1 text-accent-1 hover:underline"
                      >
                        {item.opportunityName}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.ownerEmail ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDue(item.dueAt, item.snoozedUntil)}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {item.kind === "suggestion" && (
                            <>
                              <button
                                type="button"
                                onClick={() => createTaskFromSuggestion(item.id)}
                                disabled={busy}
                                className="inline-flex items-center gap-1 rounded border border-accent-1 bg-white px-2 py-1 text-xs font-medium text-accent-1 hover:bg-accent-1/5 disabled:opacity-50"
                              >
                                {actionId === item.id ? "Creating…" : "Create task"}
                              </button>
                              <button
                                type="button"
                                onClick={() => createDraftFromSuggestion(item.id)}
                                disabled={busy}
                                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                <MessageSquarePlus className="h-3.5 w-3.5" />
                                {actionId === `draft-sug-${item.id}` ? "Generating…" : "Draft"}
                              </button>
                            </>
                          )}
                          {item.kind === "openTask" && (
                            <>
                              <button
                                type="button"
                                onClick={() => completeTask(item.id)}
                                disabled={busy}
                                className="inline-flex items-center gap-1 rounded border border-emerald-600 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Complete
                              </button>
                              <button
                                type="button"
                                onClick={() => dismissTask(item.id)}
                                disabled={busy}
                                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                Dismiss
                              </button>
                              <select
                                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
                                defaultValue=""
                                onChange={(e) => {
                                  const v = e.target.value;
                                  e.target.value = "";
                                  if (v === "1d") snoozeTask(item.id, 1);
                                  else if (v === "3d") snoozeTask(item.id, 3);
                                  else if (v === "1w") snoozeTask(item.id, 7);
                                }}
                                disabled={busy}
                              >
                                <option value="">Snooze…</option>
                                <option value="1d">+1 day</option>
                                <option value="3d">+3 days</option>
                                <option value="1w">+1 week</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => createDraftFromTask(item.id)}
                                disabled={busy}
                                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                <MessageSquarePlus className="h-3.5 w-3.5" />
                                {actionId === `draft-task-${item.id}` ? "Generating…" : "Draft"}
                              </button>
                            </>
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
      )}
    </div>
  );
}
