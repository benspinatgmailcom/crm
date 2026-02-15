"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, apiDownloadFile, apiDelete } from "@/lib/api-client";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/context/auth-context";
import {
  ALL_ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
} from "@/lib/activity-types";

export type ActivityEntityType = "account" | "contact" | "lead" | "opportunity";

interface Activity {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
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
}: {
  activity: Activity;
  canDelete: boolean;
  onDelete: (id: string) => void;
  isDeleting: string | null;
}) {
  const p = activity.payload ?? {};
  const type = activity.type;

  const renderContent = () => {
    switch (type) {
      case "note":
        return <p className="text-sm text-gray-700">{String(p.text ?? "")}</p>;
      case "task":
        return (
          <div className="text-sm">
            <p className="font-medium text-gray-900">{String(p.title ?? "")}</p>
            {p.status != null && p.status !== "" ? (
              <span className="inline-block rounded px-1.5 py-0.5 text-xs text-amber-800 bg-amber-100">
                {String(p.status)}
              </span>
            ) : null}
          </div>
        );
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
      case "file_uploaded": {
        const filename = String(p.filename ?? "File");
        const pathVal = p.path as string | undefined;
        const hasDownload = !!pathVal;
        return (
          <div className="text-sm flex items-center gap-2">
            <span className="text-gray-700">{filename}</span>
            {hasDownload && (
              <button
                type="button"
                onClick={() =>
                  apiDownloadFile(
                    `/uploads/download?path=${encodeURIComponent(pathVal)}`,
                    filename
                  )
                }
                className="text-accent-1 hover:underline text-xs"
              >
                Download
              </button>
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
      default:
        return <p className="text-sm text-gray-500">{type}</p>;
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
          <button
            type="button"
            onClick={() => onDelete(activity.id)}
            disabled={deleting}
            className="shrink-0 text-red-600 hover:text-red-700 text-xs disabled:opacity-50"
            title="Delete activity"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
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
  const canDelete = user?.role === "ADMIN" || user?.role === "USER";
  const [data, setData] = useState<PaginatedActivities | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
