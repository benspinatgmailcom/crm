"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, apiDownloadFile, apiDelete } from "@/lib/api-client";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { Download, Trash2 } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/context/auth-context";
import { canWrite } from "@/lib/roles";
import {
  ALL_ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
} from "@/lib/activity-types";

export type ActivityEntityType = "account" | "contact" | "lead" | "opportunity";

interface Activity {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

interface PaginatedActivities {
  data: Activity[];
  page: number;
  pageSize: number;
  total: number;
}

interface EntityActivityTimelineProps {
  entityType: ActivityEntityType;
  entityId: string;
  refreshTrigger?: number;
}

function formatDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActivityItem({
  activity,
  canDelete,
  onDelete,
  isDeleting,
  onUpdateTaskStatus,
  markingTaskId,
  canEdit,
}: {
  activity: Activity;
  canDelete: boolean;
  onDelete: (id: string) => void;
  isDeleting: string | null;
  onUpdateTaskStatus?: (
    activityId: string,
    currentPayload: Record<string, unknown>,
    newStatus: "done" | "open"
  ) => void;
  markingTaskId?: string | null;
  canEdit?: boolean;
}) {
  const p = activity.payload ?? {};
  const m = activity.metadata ?? {};
  const type = activity.type;

  const renderContent = () => {
    switch (type) {
      case "followup_suggested": {
        const title = String(m.title ?? "Follow-up suggested");
        const description = m.description != null ? String(m.description) : null;
        const suggestedDueAt = m.suggestedDueAt != null ? String(m.suggestedDueAt) : null;
        const severity = m.severity != null ? String(m.severity) : null;
        const reasonCodes = Array.isArray(m.reasonCodes) ? (m.reasonCodes as string[]) : [];
        return (
          <div className="text-sm space-y-1">
            <p className="font-medium text-gray-900">{title}</p>
            {description && <p className="text-gray-700">{description}</p>}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {suggestedDueAt && <span className="text-gray-500">Due: {new Date(suggestedDueAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>}
              {severity && <span className={`rounded px-1.5 py-0.5 font-medium ${severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{severity}</span>}
              {reasonCodes.length > 0 && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{reasonCodes.join(", ")}</span>}
            </div>
          </div>
        );
      }
      case "task_created": {
        const title = String(m.title ?? "Task");
        const description = m.description != null ? String(m.description) : null;
        const dueAt = m.dueAt != null ? String(m.dueAt) : null;
        const status = m.status != null ? String(m.status) : null;
        return (
          <div className="text-sm space-y-1">
            <p className="font-medium text-gray-900">{title}</p>
            {description && <p className="text-gray-700">{description}</p>}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {dueAt && <span className="text-gray-500">Due: {new Date(dueAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>}
              {status && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">{status}</span>}
            </div>
          </div>
        );
      }
      case "task_completed":
        return <p className="text-sm text-gray-700">Task marked as <span className="font-medium text-green-700">completed</span>.</p>;
      case "task_dismissed":
        return <p className="text-sm text-gray-700">Task <span className="font-medium text-gray-600">dismissed</span>.</p>;
      case "task_snoozed": {
        const until = m.snoozedUntil != null ? String(m.snoozedUntil) : null;
        return <p className="text-sm text-gray-700">Task snoozed{until ? ` until ${new Date(until).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}` : ""}.</p>;
      }
      case "note":
        return <p className="text-sm text-gray-700">{String(p.text ?? "")}</p>;
      case "task": {
        const taskStatus = String(p.status ?? "").toLowerCase();
        const isDone = taskStatus === "done";
        const showTaskActions = canEdit && onUpdateTaskStatus;
        const isMarking = markingTaskId === activity.id;
        return (
          <div className="text-sm">
            <p className="font-medium text-gray-900">{String(p.title ?? "")}</p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              {p.status != null && p.status !== "" ? (
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                    taskStatus === "done" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {String(p.status)}
                </span>
              ) : null}
              {showTaskActions && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateTaskStatus?.(
                      activity.id,
                      (activity.payload as Record<string, unknown>) ?? {},
                      isDone ? "open" : "done"
                    )
                  }
                  disabled={isMarking}
                  className={
                    isDone
                      ? "rounded border border-gray-500 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      : "rounded border border-emerald-600 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  }
                >
                  {isMarking ? "Updating…" : isDone ? "Re-open" : "Mark Done"}
                </button>
              )}
            </div>
          </div>
        );
      }
      case "call":
      case "meeting":
        return (
          <div className="text-sm space-y-1">
            {p.summary != null && p.summary !== "" && (
              <p className="text-gray-700">{String(p.summary)}</p>
            )}
            {p.outcome != null && p.outcome !== "" && (
              <p className="text-gray-600 text-xs">Outcome: {String(p.outcome)}</p>
            )}
            {p.nextStep != null && p.nextStep !== "" && (
              <p className="text-gray-600 text-xs">Next: {String(p.nextStep)}</p>
            )}
          </div>
        );
      case "email":
        return (
          <div className="text-sm space-y-1">
            <p className="font-medium text-gray-900">{String(p.subject ?? "—")}</p>
            {p.direction != null && p.direction !== "" && (
              <span className="text-xs text-gray-500">{String(p.direction)}</span>
            )}
            {p.body != null && p.body !== "" && (
              <p className="text-gray-600 line-clamp-2">{String(p.body)}</p>
            )}
          </div>
        );
      case "ai_summary":
        return (
          <div className="space-y-1">
            <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
              AI Summary
            </span>
            <p className="text-sm text-gray-700">{String(p.summary ?? p.text ?? "")}</p>
          </div>
        );
      case "ai_recommendation": {
        const actions = (p.actions as Array<{ title: string; type?: string }>) ?? [];
        return (
          <div className="space-y-2">
            <span className="inline-block rounded bg-accent-2/15 px-1.5 py-0.5 text-xs font-medium text-accent-2">
              AI Recommendation
            </span>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-0.5">
              {actions.map((a, i) => (
                <li key={i}>{a.title}</li>
              ))}
            </ul>
          </div>
        );
      }
      case "ai_deal_brief": {
        const brief = String(p.briefMarkdown ?? "");
        return (
          <div className="space-y-1">
            <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
              AI Deal Brief
            </span>
            <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">{brief || "Deal brief generated."}</p>
          </div>
        );
      }
      case "file_uploaded": {
        const filename = String(p.filename ?? "File");
        const pathVal = p.path as string | undefined;
        const hasDownload = !!pathVal;
        return (
          <div className="text-sm flex items-center gap-2">
            <span className="text-gray-700">{filename}</span>
            {hasDownload && (
              <ActionIconButton
                icon={Download}
                label="Download"
                onClick={() =>
                  apiDownloadFile(
                    `/uploads/download?path=${encodeURIComponent(pathVal)}`,
                    filename
                  )
                }
              />
            )}
          </div>
        );
      }
      case "file_deleted":
        return (
          <p className="text-sm text-gray-600">
            Deleted: {String(p.fileName ?? "file")}
          </p>
        );
      case "stage_change": {
        const fromStage = String(p.fromStage ?? "—");
        const toStage = String(p.toStage ?? "—");
        const reason = p.reason ? String(p.reason) : null;
        const competitor = p.competitor ? String(p.competitor) : null;
        const notesRaw = p.notes ?? p.note;
        const notes = notesRaw != null && String(notesRaw).trim() !== "" ? String(notesRaw) : null;
        return (
          <div className="space-y-1 text-sm">
            <p className="text-gray-700">
              Moved from <span className="font-medium">{fromStage}</span> →{" "}
              <span className="font-medium">{toStage}</span>
            </p>
            {(reason || competitor) && (
              <p className="text-gray-600 text-xs">
                {reason}
                {reason && competitor ? " · " : ""}
                {competitor ? `Competitor: ${competitor}` : ""}
              </p>
            )}
            {notes && (
              <div className="mt-1 rounded border border-gray-100 bg-gray-50/80 px-2 py-1.5">
                <p className="text-xs font-medium text-gray-500">Note</p>
                <p className="whitespace-pre-wrap text-gray-700">{notes}</p>
              </div>
            )}
          </div>
        );
      }
      case "followup_draft_created": {
        const subject = m.subject != null ? String(m.subject) : null;
        const channel = m.channel != null ? String(m.channel) : "email";
        return (
          <div className="text-sm space-y-1">
            <p className="font-medium text-gray-900">Follow-up draft ({channel})</p>
            {subject && <p className="text-gray-700 truncate">{subject}</p>}
          </div>
        );
      }
      case "followup_sent": {
        const channel = m.channel != null ? String(m.channel) : "email";
        const notes = m.notes != null ? String(m.notes) : null;
        return (
          <div className="text-sm space-y-1">
            <p className="font-medium text-gray-900">Follow-up sent ({channel})</p>
            {notes && <p className="text-gray-700">{notes}</p>}
          </div>
        );
      }
      default: {
        const followupTaskTypes = ["followup_suggested", "task_created", "task_completed", "task_dismissed", "task_snoozed"];
        if (followupTaskTypes.includes(type) && m && typeof m === "object") {
          const title = m.title != null ? String(m.title) : type === "followup_suggested" ? "Follow-up suggested" : type === "task_created" ? "Task" : type.replace(/_/g, " ");
          const desc = m.description != null ? String(m.description) : null;
          const due = (m.suggestedDueAt ?? m.dueAt) != null ? String(m.suggestedDueAt ?? m.dueAt) : null;
          return (
            <div className="text-sm space-y-1">
              <p className="font-medium text-gray-900">{title}</p>
              {desc && <p className="text-gray-700">{desc}</p>}
              {due && <span className="text-gray-500 text-xs">Due: {new Date(due).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>}
            </div>
          );
        }
        return <p className="text-sm text-gray-500">{type}</p>;
      }
    }
  };

  const typeLabel = ACTIVITY_TYPE_LABELS[type] ?? type;
  const deleting = isDeleting === activity.id;

  return (
    <div className="border-l-2 border-gray-200 pl-4 pb-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {typeLabel}
            </span>
            <span className="text-xs text-gray-400">{formatDate(activity.createdAt)}</span>
          </div>
          <div className="mt-1">{renderContent()}</div>
        </div>
        {canDelete && (
          <ActionIconButton
            icon={Trash2}
            label={deleting ? "Deleting..." : "Delete"}
            variant="danger"
            onClick={() => onDelete(activity.id)}
            disabled={deleting}
          />
        )}
      </div>
    </div>
  );
}

export function EntityActivityTimeline({
  entityType,
  entityId,
  refreshTrigger,
}: EntityActivityTimelineProps) {
  const { user } = useAuth();
  const canEdit = canWrite(user?.role);
  const canDelete = canEdit;
  const [data, setData] = useState<PaginatedActivities | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingTaskId, setMarkingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("entityType", entityType);
      params.set("entityId", entityId);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      params.set("sortDir", "desc");
      if (typeFilter) params.set("type", typeFilter);
      const res = await apiFetch<PaginatedActivities>(
        `/activities?${params.toString()}`
      );
      setData(res);
    } catch {
      setData({ data: [], page: 1, pageSize, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, page, pageSize, typeFilter, refreshTrigger]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeletingId(deleteId);
    setError(null);
    try {
      await apiDelete(`/activities/${deleteId}`);
      setDeleteId(null);
      fetchActivities();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      setError(e.body?.message ?? e.message ?? "Failed to delete activity");
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateTaskStatus = useCallback(
    async (
      activityId: string,
      currentPayload: Record<string, unknown>,
      newStatus: "done" | "open"
    ) => {
      setMarkingTaskId(activityId);
      setError(null);
      try {
        await apiFetch(`/activities/${activityId}`, {
          method: "PATCH",
          body: JSON.stringify({ payload: { ...currentPayload, status: newStatus } }),
        });
        setPage(1);
        fetchActivities();
      } catch (err: unknown) {
        const e = err as { body?: { message?: string }; message?: string };
        setError(e.body?.message ?? e.message ?? "Failed to update task");
      } finally {
        setMarkingTaskId(null);
      }
    },
    [fetchActivities]
  );

  if (loading && !data) return <p className="mt-4 text-sm text-gray-500">Loading activities...</p>;

  const activities = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => {
          setDeleteId(null);
          setError(null);
        }}
        onConfirm={handleDelete}
        title="Delete Activity"
        message="Delete this activity?"
        confirmLabel="Delete"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Activity Timeline</h3>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {ALL_ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-gray-500">No activities yet.</p>
      ) : (
        <>
          <div className="space-y-0">
            {activities.map((a) => (
              <ActivityItem
                key={a.id}
                activity={a}
                canDelete={canDelete}
                onDelete={(id) => setDeleteId(id)}
                isDeleting={deletingId}
                onUpdateTaskStatus={canEdit ? handleUpdateTaskStatus : undefined}
                markingTaskId={markingTaskId}
                canEdit={canEdit}
              />
            ))}
          </div>
          {total > 0 && (
            <div className="mt-4">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
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
    </div>
  );
}
