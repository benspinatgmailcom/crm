"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Heart, Clock, CheckCircle, AlertTriangle, XCircle, Activity, ListTodo, Check, X, Pencil, Eye, Copy, Send } from "lucide-react";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { canWrite, isAdmin } from "@/lib/roles";
import { Modal } from "@/components/ui/modal";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { EntityAttachments } from "@/components/attachments/entity-attachments";
import { opportunitySchema, type OpportunityFormData } from "@/lib/validation";

interface HealthSignal {
  code: string;
  severity: string;
  message: string;
  penalty: number;
}

interface Opportunity {
  id: string;
  accountId: string;
  name: string;
  amount: { toString(): string } | null;
  stage: string | null;
  probability: number | null;
  closeDate: string | null;
  sourceLeadId?: string | null;
  ownerId?: string;
  owner?: { id: string; email: string };
  lastActivityAt?: string | null;
  lastStageChangedAt?: string | null;
  nextFollowUpAt?: string | null;
  daysSinceLastTouch?: number | null;
  daysInStage?: number | null;
  healthScore?: number;
  healthStatus?: "healthy" | "warning" | "critical";
  healthSignals?: HealthSignal[];
}

interface Account {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
}

interface Contact {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface LatestDraft {
  id: string;
  subject: string;
  body: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface FollowupSuggestion {
  id: string;
  metadata: {
    ruleCode: string;
    title: string;
    description: string;
    suggestedDueAt: string;
    severity: "warning" | "critical";
    reasonCodes: string[];
  };
  createdAt: string;
  latestDraft?: LatestDraft;
}

interface OpenTask {
  id: string;
  metadata: {
    title: string;
    description: string;
    dueAt: string;
    priority: string;
    status: string;
  };
  createdAt: string;
  snoozedUntil?: string;
  latestDraft?: LatestDraft;
}

interface FollowupsResponse {
  suggestions: FollowupSuggestion[];
  openTasks: OpenTask[];
}

const STAGE_OPTIONS = ["prospecting", "discovery", "qualification", "proposal", "negotiation", "closed-won", "closed-lost"];

function formatAmount(amount: { toString(): string } | null): string {
  if (amount == null) return "—";
  const n = Number(amount.toString());
  return isNaN(n) ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDays(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value} day${value === 1 ? "" : "s"}`;
}

function healthStatusLabel(status: "healthy" | "warning" | "critical"): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function OpportunityDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const canEdit = canWrite(user?.role);
  const id = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<OpportunityFormData>({ accountId: "", name: "", stage: "prospecting" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [followups, setFollowups] = useState<FollowupsResponse | null>(null);
  const [followupsLoading, setFollowupsLoading] = useState(false);
  const [followupActionId, setFollowupActionId] = useState<string | null>(null);
  const [followupError, setFollowupError] = useState<string | null>(null);
  const [draftSubjectBody, setDraftSubjectBody] = useState<Record<string, { subject: string; body: string }>>({});

  const [users, setUsers] = useState<{ id: string; email: string; role: string }[]>([]);
  const [ownerSaving, setOwnerSaving] = useState(false);

  const fetchOpportunity = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const o = await apiFetch<Opportunity>(`/opportunities/${id}`);
      setOpportunity(o);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      setError(e.status === 404 ? "Opportunity not found" : e.message || "Failed to load opportunity");
      setOpportunity(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchAccount = useCallback(async (accountId: string) => {
    try {
      const a = await apiFetch<Account>(`/accounts/${accountId}`);
      setAccount(a);
    } catch {
      setAccount(null);
    }
  }, []);

  const fetchContacts = useCallback(async (accountId: string) => {
    try {
      const res = await apiFetch<{ data: Contact[] }>(`/contacts?accountId=${accountId}&pageSize=5`);
      setContacts(res.data ?? []);
    } catch {
      setContacts([]);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: Account[] }>("/accounts?pageSize=100");
      setAccounts(res.data ?? []);
    } catch {
      setAccounts([]);
    }
  }, []);

  const fetchFollowups = useCallback(async (opportunityId: string) => {
    setFollowupsLoading(true);
    try {
      const res = await apiFetch<FollowupsResponse>(`/opportunities/${opportunityId}/followups`);
      setFollowups(res);
      setFollowupError(null);
    } catch {
      setFollowups(null);
    } finally {
      setFollowupsLoading(false);
    }
  }, []);

  const createTaskFromSuggestion = async (suggestionId: string) => {
    setFollowupActionId(suggestionId);
    try {
      await apiFetch(`/followups/${suggestionId}/create-task`, { method: "POST" });
      if (id) await fetchFollowups(id);
    } finally {
      setFollowupActionId(null);
    }
  };

  const completeTask = async (taskActivityId: string) => {
    setFollowupActionId(taskActivityId);
    try {
      await apiFetch(`/tasks/${taskActivityId}/complete`, { method: "POST" });
      if (id) await fetchFollowups(id);
    } finally {
      setFollowupActionId(null);
    }
  };

  const dismissTask = async (taskActivityId: string) => {
    setFollowupActionId(taskActivityId);
    try {
      await apiFetch(`/tasks/${taskActivityId}/dismiss`, { method: "POST" });
      if (id) await fetchFollowups(id);
    } finally {
      setFollowupActionId(null);
    }
  };

  const snoozeTask = async (taskActivityId: string, until: string) => {
    setFollowupActionId(taskActivityId);
    try {
      await apiFetch(`/tasks/${taskActivityId}/snooze`, {
        method: "POST",
        body: JSON.stringify({ until }),
      });
      if (id) await fetchFollowups(id);
    } finally {
      setFollowupActionId(null);
    }
  };

  const createDraftFromSuggestion = async (suggestionId: string) => {
    setFollowupActionId(`draft-sug-${suggestionId}`);
    setFollowupError(null);
    try {
      await apiFetch(`/followups/${suggestionId}/draft`, { method: "POST", body: JSON.stringify({}) });
      if (id) await fetchFollowups(id);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFollowupError(e.message ?? "Failed to generate draft");
    } finally {
      setFollowupActionId(null);
    }
  };

  const createDraftFromTask = async (taskId: string) => {
    setFollowupActionId(`draft-task-${taskId}`);
    setFollowupError(null);
    try {
      await apiFetch(`/tasks/${taskId}/draft`, { method: "POST", body: JSON.stringify({}) });
      if (id) await fetchFollowups(id);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFollowupError(e.message ?? "Failed to generate draft");
    } finally {
      setFollowupActionId(null);
    }
  };

  const markDraftSent = async (draftActivityId: string) => {
    setFollowupActionId(`sent-${draftActivityId}`);
    setFollowupError(null);
    try {
      await apiFetch(`/drafts/${draftActivityId}/mark-sent`, {
        method: "POST",
        body: JSON.stringify({ channel: "email" }),
      });
      if (id) await fetchFollowups(id);
      setTimelineRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFollowupError(e.message ?? "Failed to mark as sent");
    } finally {
      setFollowupActionId(null);
    }
  };

  const getDraftEdit = (draftId: string) => draftSubjectBody[draftId] ?? null;
  const setDraftEdit = (draftId: string, subject: string, body: string) => {
    setDraftSubjectBody((prev) => ({ ...prev, [draftId]: { subject, body } }));
  };
  const clearDraftEdit = (draftId: string) => {
    setDraftSubjectBody((prev) => {
      const next = { ...prev };
      delete next[draftId];
      return next;
    });
  };

  useEffect(() => {
    fetchOpportunity();
    fetchAccounts();
  }, [fetchOpportunity, fetchAccounts]);

  useEffect(() => {
    if (id) fetchFollowups(id);
  }, [id, fetchFollowups]);

  useEffect(() => {
    if (opportunity?.accountId) {
      fetchAccount(opportunity.accountId);
      fetchContacts(opportunity.accountId);
    } else {
      setAccount(null);
      setContacts([]);
    }
  }, [opportunity?.accountId, fetchAccount, fetchContacts]);

  useEffect(() => {
    if (!opportunity || !canEdit) return;
    const canChangeOwner = isAdmin(user?.role) || opportunity.ownerId === user?.id;
    if (canChangeOwner) {
      apiFetch<{ id: string; email: string; role: string }[]>("/users/active")
        .then(setUsers)
        .catch(() => setUsers([]));
    }
  }, [opportunity?.id, opportunity?.ownerId, user?.id, user?.role, canEdit]);

  const updateOwner = async (newOwnerId: string) => {
    if (!id || newOwnerId === opportunity?.ownerId) return;
    setOwnerSaving(true);
    try {
      await apiFetch(`/opportunities/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ownerId: newOwnerId }),
      });
      await fetchOpportunity();
    } finally {
      setOwnerSaving(false);
    }
  };

  const openEdit = () => {
    if (!opportunity) return;
    setFormData({
      accountId: opportunity.accountId,
      name: opportunity.name,
      amount: opportunity.amount != null ? Number(opportunity.amount.toString()) : undefined,
      stage: opportunity.stage || "prospecting",
      probability: opportunity.probability ?? undefined,
      closeDate: opportunity.closeDate ? opportunity.closeDate.slice(0, 10) : "",
    });
    setFormErrors({});
    setSubmitError(null);
    setEditModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunity) return;
    setFormErrors({});
    setSubmitError(null);
    const payload = {
      accountId: formData.accountId,
      name: formData.name,
      amount: formData.amount,
      stage: formData.stage || undefined,
      probability: formData.probability,
      closeDate: formData.closeDate || undefined,
    };
    const parsed = opportunitySchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const p = err.path[0] as string;
        if (p && !errs[p]) errs[p] = err.message;
      });
      setFormErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/opportunities/${opportunity.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: parsed.data.name,
          amount: parsed.data.amount,
          stage: parsed.data.stage,
          probability: parsed.data.probability,
          closeDate: parsed.data.closeDate,
        }),
      });
      setEditModalOpen(false);
      fetchOpportunity();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string } };
      setSubmitError(e.body?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !opportunity) {
    return (
      <div>
        <Link href="/opportunities" className="text-sm text-accent-1 hover:underline">
          ← Back to Opportunities
        </Link>
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div>
        <Link href="/opportunities" className="text-sm text-accent-1 hover:underline">
          ← Back to Opportunities
        </Link>
        <p className="mt-4 text-red-600">{error || "Opportunity not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/opportunities" className="text-sm text-accent-1 hover:underline">
          ← Back to Opportunities
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{opportunity.name}</h1>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-600">
              <span>{opportunity.stage ?? "—"}</span>
              <span>{formatAmount(opportunity.amount)}</span>
              <span>
                {opportunity.closeDate ? new Date(opportunity.closeDate).toLocaleDateString() : "—"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
            <ActionIconButton
              icon={Pencil}
              label="Edit Opportunity"
              onClick={openEdit}
              className="rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {(opportunity.healthScore != null || opportunity.daysSinceLastTouch != null || opportunity.daysInStage != null) && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Deal health & aging</h2>
              <div className="space-y-4">
                {opportunity.healthScore != null && opportunity.healthStatus != null && (
                  <div className="flex gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        opportunity.healthStatus === "healthy"
                          ? "bg-emerald-100 text-emerald-700"
                          : opportunity.healthStatus === "warning"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {opportunity.healthStatus === "healthy" ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : opportunity.healthStatus === "warning" ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : (
                        <XCircle className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-medium ${
                            opportunity.healthStatus === "healthy"
                              ? "bg-emerald-100 text-emerald-700"
                              : opportunity.healthStatus === "warning"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          <Heart className="h-3.5 w-3.5" />
                          {healthStatusLabel(opportunity.healthStatus)} · {opportunity.healthScore}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-gray-500">
                        Health is scored 0–100 from recent activity, stage movement, and follow-ups. 80+ is healthy, 50–79 warning, 0–49 critical.
                      </p>
                      {opportunity.healthSignals && opportunity.healthSignals.length > 0 && (
                        <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-gray-600">
                          {opportunity.healthSignals.map((s, i) => (
                            <li key={i}>{s.message}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
                {(opportunity.daysSinceLastTouch != null || opportunity.daysInStage != null) && (
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-sm text-gray-700">
                          <Activity className="h-3.5 w-3.5" />
                          Last touch: {formatDays(opportunity.daysSinceLastTouch ?? null)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-sm text-gray-700">
                          In stage: {formatDays(opportunity.daysInStage ?? null)}
                        </span>
                        {(() => {
                          const touch = opportunity.daysSinceLastTouch ?? null;
                          const stage = opportunity.daysInStage ?? null;
                          const stale = (touch != null && touch >= 7) || (stage != null && stage >= 14);
                          const atRisk =
                            !stale &&
                            ((touch != null && touch >= 5 && touch < 7) || (stage != null && stage >= 12 && stage < 14));
                          if (stale) {
                            return (
                              <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                Stale
                              </span>
                            );
                          }
                          if (atRisk) {
                            return (
                              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                At risk
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <p className="mt-1.5 text-xs text-gray-500">
                        Stale = 7+ days since last activity or 14+ days in current stage. At risk = within 2 days of those thresholds.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <ListTodo className="h-4 w-4" />
              Follow-ups
            </h2>
            {followupError && (
              <p className="mb-2 rounded bg-red-50 px-2 py-1.5 text-sm text-red-700">{followupError}</p>
            )}
            {followupsLoading ? (
              <p className="text-sm text-gray-500">Loading follow-ups...</p>
            ) : followups && (followups.suggestions.length > 0 || followups.openTasks.length > 0) ? (
              <div className="space-y-4">
                {followups.suggestions.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Suggestions</h3>
                    <ul className="space-y-3">
                      {followups.suggestions.map((s) => (
                        <li
                          key={s.id}
                          className="rounded-md border border-gray-200 bg-gray-50/50 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">{s.metadata.title}</span>
                            <span
                              className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                                s.metadata.severity === "critical"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {s.metadata.severity}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">{s.metadata.description}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span>Due: {new Date(s.metadata.suggestedDueAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>
                            {s.metadata.reasonCodes?.length > 0 && (
                              <span className="rounded bg-gray-200 px-1.5 py-0.5">
                                {s.metadata.reasonCodes.join(", ")}
                              </span>
                            )}
                          </div>
                          {canEdit && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => createDraftFromSuggestion(s.id)}
                                disabled={followupActionId === `draft-sug-${s.id}`}
                                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                {followupActionId === `draft-sug-${s.id}` ? "Generating…" : "Draft follow-up"}
                              </button>
                              <button
                                type="button"
                                onClick={() => createTaskFromSuggestion(s.id)}
                                disabled={followupActionId === s.id}
                                className="rounded border border-accent-1 bg-white px-2 py-1 text-xs font-medium text-accent-1 hover:bg-accent-1/5 disabled:opacity-50"
                              >
                                {followupActionId === s.id ? "Creating…" : "Create task"}
                              </button>
                            </div>
                          )}
                          {s.latestDraft && (
                            <div className="mt-3 rounded border border-gray-200 bg-white p-3 text-sm">
                              <div className="mb-2 font-medium text-gray-700">Draft</div>
                              <input
                                type="text"
                                className="mb-2 w-full rounded border border-gray-200 px-2 py-1 text-sm"
                                placeholder="Subject"
                                value={getDraftEdit(s.latestDraft.id)?.subject ?? s.latestDraft.subject}
                                onChange={(e) => setDraftEdit(s.latestDraft!.id, e.target.value, getDraftEdit(s.latestDraft!.id)?.body ?? s.latestDraft!.body)}
                              />
                              <textarea
                                className="mb-2 min-h-[80px] w-full rounded border border-gray-200 px-2 py-1 text-sm"
                                placeholder="Body"
                                value={getDraftEdit(s.latestDraft.id)?.body ?? s.latestDraft.body}
                                onChange={(e) => setDraftEdit(s.latestDraft!.id, getDraftEdit(s.latestDraft!.id)?.subject ?? s.latestDraft!.subject, e.target.value)}
                                rows={4}
                              />
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard.writeText((getDraftEdit(s.latestDraft!.id)?.body ?? s.latestDraft!.body) || "")}
                                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                                >
                                  <Copy className="h-3 w-3" /> Copy
                                </button>
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => markDraftSent(s.latestDraft!.id)}
                                    disabled={followupActionId === `sent-${s.latestDraft!.id}`}
                                    className="inline-flex items-center gap-1 rounded border border-emerald-600 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                  >
                                    <Send className="h-3 w-3" /> Mark as Sent
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {followups.openTasks.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Open tasks</h3>
                    <ul className="space-y-3">
                      {followups.openTasks.map((t) => (
                        <li
                          key={t.id}
                          className="rounded-md border border-gray-200 bg-white p-3 shadow-sm"
                        >
                          <div className="font-medium text-gray-900">{t.metadata.title}</div>
                          {t.metadata.description && (
                            <p className="mt-0.5 text-sm text-gray-600">{t.metadata.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span>Due: {new Date(t.metadata.dueAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>
                            {t.snoozedUntil && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                                Snoozed until {new Date(t.snoozedUntil).toLocaleString(undefined, { dateStyle: "short" })}
                              </span>
                            )}
                          </div>
                          {canEdit && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => createDraftFromTask(t.id)}
                                disabled={followupActionId === `draft-task-${t.id}`}
                                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                {followupActionId === `draft-task-${t.id}` ? "Generating…" : "Draft follow-up"}
                              </button>
                              <button
                                type="button"
                                onClick={() => completeTask(t.id)}
                                disabled={followupActionId === t.id}
                                className="inline-flex items-center gap-1 rounded border border-emerald-600 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                <Check className="h-3 w-3" />
                                Complete
                              </button>
                              <button
                                type="button"
                                onClick={() => dismissTask(t.id)}
                                disabled={followupActionId === t.id}
                                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                <X className="h-3 w-3" />
                                Dismiss
                              </button>
                              <select
                                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
                                defaultValue=""
                                onChange={(e) => {
                                  const v = e.target.value;
                                  e.target.value = "";
                                  if (v) {
                                    const d = new Date();
                                    if (v === "1d") d.setDate(d.getDate() + 1);
                                    else if (v === "3d") d.setDate(d.getDate() + 3);
                                    else if (v === "1w") d.setDate(d.getDate() + 7);
                                    snoozeTask(t.id, d.toISOString());
                                  }
                                }}
                                disabled={followupActionId === t.id}
                              >
                                <option value="">Snooze…</option>
                                <option value="1d">1 day</option>
                                <option value="3d">3 days</option>
                                <option value="1w">1 week</option>
                              </select>
                            </div>
                          )}
                          {t.latestDraft && (
                            <div className="mt-3 rounded border border-gray-200 bg-white p-3 text-sm">
                              <div className="mb-2 font-medium text-gray-700">Draft</div>
                              <input
                                type="text"
                                className="mb-2 w-full rounded border border-gray-200 px-2 py-1 text-sm"
                                placeholder="Subject"
                                value={getDraftEdit(t.latestDraft.id)?.subject ?? t.latestDraft.subject}
                                onChange={(e) => setDraftEdit(t.latestDraft!.id, e.target.value, getDraftEdit(t.latestDraft!.id)?.body ?? t.latestDraft!.body)}
                              />
                              <textarea
                                className="mb-2 min-h-[80px] w-full rounded border border-gray-200 px-2 py-1 text-sm"
                                placeholder="Body"
                                value={getDraftEdit(t.latestDraft.id)?.body ?? t.latestDraft.body}
                                onChange={(e) => setDraftEdit(t.latestDraft!.id, getDraftEdit(t.latestDraft!.id)?.subject ?? t.latestDraft!.subject, e.target.value)}
                                rows={4}
                              />
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard.writeText((getDraftEdit(t.latestDraft!.id)?.body ?? t.latestDraft!.body) || "")}
                                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                                >
                                  <Copy className="h-3 w-3" /> Copy
                                </button>
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => markDraftSent(t.latestDraft!.id)}
                                    disabled={followupActionId === `sent-${t.latestDraft!.id}`}
                                    className="inline-flex items-center gap-1 rounded border border-emerald-600 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                  >
                                    <Send className="h-3 w-3" /> Mark as Sent
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No follow-up suggestions or open tasks. The engine runs daily to suggest next steps.</p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Opportunity details</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{opportunity.name}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Owner</dt>
                <dd className="text-gray-900">
                  {canEdit && (isAdmin(user?.role) || opportunity.ownerId === user?.id) && users.length > 0 ? (
                    <select
                      value={opportunity.ownerId ?? ""}
                      onChange={(e) => updateOwner(e.target.value)}
                      disabled={ownerSaving}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 disabled:opacity-50"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email} {u.role !== "USER" ? `(${u.role})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{opportunity.owner?.email ?? opportunity.ownerId ?? "—"}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Stage</dt>
                <dd className="text-gray-900">{opportunity.stage ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Amount</dt>
                <dd className="text-gray-900">{formatAmount(opportunity.amount)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Probability</dt>
                <dd className="text-gray-900">{opportunity.probability != null ? `${opportunity.probability}%` : "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Close Date</dt>
                <dd className="text-gray-900">
                  {opportunity.closeDate ? new Date(opportunity.closeDate).toLocaleDateString() : "—"}
                </dd>
              </div>
              {opportunity.sourceLeadId && (
                <div>
                  <dt className="text-gray-500">Created from Lead</dt>
                  <dd className="text-gray-900">
                    <ActionIconButton
                      icon={Eye}
                      label="View lead"
                      href={`/leads/${opportunity.sourceLeadId}`}
                    />
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {account && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Related Account</h2>
              <Link
                href={`/accounts/${account.id}`}
                className="text-accent-1 hover:underline"
              >
                {account.name}
              </Link>
              {account.industry && (
                <p className="mt-1 text-sm text-gray-500">{account.industry}</p>
              )}
              {account.website && (
                <a
                  href={account.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-sm text-accent-1 hover:underline"
                >
                  {account.website}
                </a>
              )}
              <ActionIconButton
                icon={Eye}
                label="View full account"
                href={`/accounts/${account.id}`}
                className="mt-2 inline-block"
              />
            </div>
          )}

          {account && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">Key Contacts</h2>
                <ActionIconButton
                  icon={Eye}
                  label="View all on account"
                  href={`/accounts/${account.id}`}
                />
              </div>
              <div className="divide-y divide-gray-200">
                {contacts.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">No contacts yet.</p>
                ) : (
                  contacts.map((c) => (
                    <div key={c.id} className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {c.firstName} {c.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{c.email}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <EntityAttachments
            entityType="opportunity"
            entityId={opportunity.id}
            onUploadSuccess={() => setTimelineRefreshKey((k) => k + 1)}
          />
          <ActivityTimeline
            entityType="opportunity"
            entityId={opportunity.id}
            refreshTrigger={timelineRefreshKey}
            draftEmailConfig={{
              suggestedRecipients: contacts.map((c) => ({
                name: `${c.firstName} ${c.lastName}`.trim(),
                email: c.email,
              })),
            }}
          />
        </div>
      </div>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Opportunity">
        <form onSubmit={handleSubmit} className="space-y-4">
          {(submitError || formErrors._) && (
            <p className="text-sm text-red-600">{submitError || formErrors._}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Account *</label>
            <select
              value={formData.accountId}
              onChange={(e) => setFormData((d) => ({ ...d, accountId: e.target.value }))}
              disabled
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            >
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {formErrors.accountId && <p className="mt-0.5 text-sm text-red-600">{formErrors.accountId}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input
              value={formData.name}
              onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            {formErrors.name && <p className="mt-0.5 text-sm text-red-600">{formErrors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={formData.amount ?? ""}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    amount: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              {formErrors.amount && <p className="mt-0.5 text-sm text-red-600">{formErrors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Probability %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={formData.probability ?? ""}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    probability: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Stage</label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData((d) => ({ ...d, stage: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {STAGE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Close Date</label>
              <input
                type="date"
                value={formData.closeDate}
                onChange={(e) => setFormData((d) => ({ ...d, closeDate: e.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
