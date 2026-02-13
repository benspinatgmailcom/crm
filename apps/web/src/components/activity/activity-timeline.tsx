"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { Pagination } from "@/components/ui/pagination";
import { AddActivityModal } from "./add-activity-modal";

export type ActivityEntityType = "account" | "contact" | "lead" | "opportunity";

export const ACTIVITY_TYPES = [
  { value: "", label: "All" },
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "email", label: "Email" },
  { value: "task", label: "Task" },
  { value: "ai_summary", label: "AI Summary" },
] as const;

interface Activity {
  id: string;
  entityType: string;
  entityId: string;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt?: string;
}

interface PaginatedResponse {
  data: Activity[];
  page: number;
  pageSize: number;
  total: number;
}

interface ActivityTimelineProps {
  entityType: ActivityEntityType;
  entityId: string;
}

function formatDate(s: string) {
  const d = new Date(s);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString();
}

function ActivityItem({ activity }: { activity: Activity }) {
  const p = activity.payload ?? {};
  const type = activity.type;

  const renderPayload = () => {
    switch (type) {
      case "note":
        return <p className="text-sm text-gray-700">{String(p.text ?? "")}</p>;
      case "call":
      case "meeting":
        return (
          <div className="space-y-1 text-sm text-gray-700">
            {p.summary != null && p.summary !== "" ? <p>{String(p.summary)}</p> : null}
            {p.outcome != null && p.outcome !== "" ? <p><span className="text-gray-500">Outcome:</span> {String(p.outcome)}</p> : null}
            {p.nextStep != null && p.nextStep !== "" ? <p><span className="text-gray-500">Next:</span> {String(p.nextStep)}</p> : null}
          </div>
        );
      case "email":
        return (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-gray-900">{String(p.subject ?? "(No subject)")}</p>
            {p.direction != null && p.direction !== "" ? (
              <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${String(p.direction) === "inbound" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                {String(p.direction)}
              </span>
            ) : null}
            {p.body != null && p.body !== "" ? <p className="text-gray-700 line-clamp-2">{String(p.body)}</p> : null}
          </div>
        );
      case "task":
        return (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-gray-900">{String(p.title ?? "")}</p>
            <div className="flex flex-wrap gap-2">
              {p.status != null && p.status !== "" ? (
                <span className={`rounded px-1.5 py-0.5 text-xs ${String(p.status) === "done" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {String(p.status)}
                </span>
              ) : null}
              {p.dueAt != null && p.dueAt !== "" ? (
                <span className="text-gray-500">Due: {new Date(String(p.dueAt)).toLocaleDateString()}</span>
              ) : null}
            </div>
          </div>
        );
      case "ai_summary":
        return (
          <div className="space-y-1">
            <span className="inline-block rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800">
              AI Summary
            </span>
            <p className="text-sm text-gray-700">{String(p.text ?? "")}</p>
          </div>
        );
      default:
        return <p className="text-sm text-gray-500">{JSON.stringify(p)}</p>;
    }
  };

  const typeLabel = ACTIVITY_TYPES.find((t) => t.value === type)?.label ?? type;

  return (
    <div className="border-l-2 border-gray-200 pl-4 pb-4 last:pb-0">
      <div className="flex items-center gap-2">
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {typeLabel}
        </span>
        <span className="text-xs text-gray-400">{formatDate(activity.createdAt)}</span>
      </div>
      <div className="mt-1">{renderPayload()}</div>
    </div>
  );
}

export function ActivityTimeline({ entityType, entityId }: ActivityTimelineProps) {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [typeFilter, setTypeFilter] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("entityType", entityType);
    params.set("entityId", entityId);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sortDir", "desc");
    if (typeFilter) params.set("type", typeFilter);
    try {
      const res = await apiFetch<PaginatedResponse>(`/activities?${params}`);
      setData(res);
    } catch {
      setData({ data: [], page: 1, pageSize, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, page, pageSize, typeFilter]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleActivityAdded = () => {
    setAddModalOpen(false);
    setPage(1);
    fetchActivities();
  };

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Activity Timeline</h3>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value || "all"} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setAddModalOpen(true)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Activity
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-gray-500">Loading activities...</p>
      ) : !data || data.data.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No activities yet. Add one to get started.</p>
      ) : (
        <>
          <div className="mt-3 space-y-0">
            {data.data.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
          <div className="mt-3">
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
        </>
      )}

      <AddActivityModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        entityType={entityType}
        entityId={entityId}
        onSuccess={handleActivityAdded}
        presetType={typeFilter || undefined}
      />
    </div>
  );
}
