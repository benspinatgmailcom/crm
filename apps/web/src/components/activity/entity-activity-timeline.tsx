"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";

export type ActivityEntityType = "account" | "contact" | "lead" | "opportunity";

interface Activity {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
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

function ActivityItem({ activity }: { activity: Activity }) {
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
      case "ai_recommendation": {
        const actions = (p.actions as Array<{ title: string; type: string }>) ?? [];
        return (
          <div className="space-y-1">
            <span className="inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-800">
              AI Recommendation
            </span>
            <p className="text-sm text-gray-600">
              {actions.length} action{actions.length !== 1 ? "s" : ""} suggested
            </p>
          </div>
        );
      }
      default:
        return <p className="text-sm text-gray-500">{type}</p>;
    }
  };

  return (
    <div className="border-l-2 border-gray-200 pl-4 pb-4">
      <div className="flex items-center gap-2">
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {type}
        </span>
        <span className="text-xs text-gray-400">{formatDate(activity.createdAt)}</span>
      </div>
      <div className="mt-1">{renderContent()}</div>
    </div>
  );
}

export function EntityActivityTimeline({
  entityType,
  entityId,
  refreshTrigger,
}: EntityActivityTimelineProps) {
  const [data, setData] = useState<{ data: Activity[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: Activity[] }>(
        `/activities?entityType=${entityType}&entityId=${entityId}&pageSize=20&sortDir=desc`
      );
      setData(res);
    } catch {
      setData({ data: [] });
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, refreshTrigger]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  if (loading) return <p className="mt-4 text-sm text-gray-500">Loading activities...</p>;
  const activities = data?.data ?? [];
  if (activities.length === 0) return <p className="mt-4 text-sm text-gray-500">No activities yet.</p>;

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Activity Timeline</h3>
      <div className="space-y-0">
        {activities.map((a) => (
          <ActivityItem key={a.id} activity={a} />
        ))}
      </div>
    </div>
  );
}
