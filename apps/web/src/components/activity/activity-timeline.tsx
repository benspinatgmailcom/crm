"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { Pagination } from "@/components/ui/pagination";
import { useAuth } from "@/context/auth-context";
import { AddActivityModal } from "./add-activity-modal";
import { GenerateAiSummaryModal } from "./generate-ai-summary-modal";
import { GenerateNextBestActionsModal } from "@/components/ai/generate-next-best-actions-modal";

export type ActivityEntityType = "account" | "contact" | "lead" | "opportunity";

export const ACTIVITY_TYPES = [
  { value: "", label: "All" },
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "email", label: "Email" },
  { value: "task", label: "Task" },
  { value: "file_uploaded", label: "File Uploaded" },
  { value: "ai_summary", label: "AI Summary" },
  { value: "ai_recommendation", label: "AI Recommendations" },
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
  /** Change to trigger a refresh (e.g. after attachment upload) */
  refreshTrigger?: number;
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
      case "file_uploaded":
        return (
          <div className="text-sm text-gray-700">
            <span className="font-medium">{String(p.fileName ?? "File")}</span>
            {p.size != null ? (
              <span className="ml-1 text-gray-500">
                ({(p.size as number) < 1024 ? `${p.size} B` : `${((p.size as number) / 1024).toFixed(1)} KB`})
              </span>
            ) : null}
          </div>
        );
      case "file_deleted":
        return (
          <p className="text-sm text-gray-700">
            Deleted: {String(p.fileName ?? "file")}
          </p>
        );
      case "lead_converted":
        return (
          <div className="space-y-1 text-sm text-gray-700">
            <p>Lead converted to Account, Contact, and Opportunity.</p>
            {p.accountId && <p><span className="text-gray-500">Account:</span> <a href={`/accounts/${p.accountId}`} className="text-blue-600 hover:underline">View</a></p>}
            {p.contactId && <p><span className="text-gray-500">Contact:</span> <a href={`/contacts/${p.contactId}`} className="text-blue-600 hover:underline">View</a></p>}
            {p.opportunityId && <p><span className="text-gray-500">Opportunity:</span> <a href={`/opportunities/${p.opportunityId}`} className="text-blue-600 hover:underline">View</a></p>}
          </div>
        );
      case "ai_recommendation": {
        const actions = Array.isArray(p.actions) ? p.actions : [];
        const generatedAt = p.generatedAt != null ? String(p.generatedAt) : null;
        return (
          <div className="space-y-2">
            <span className="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
              Next Best Actions
            </span>
            {generatedAt && (
              <p className="text-xs text-gray-500">
                Generated {new Date(generatedAt).toLocaleDateString()} at {new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            {actions.length === 0 ? (
              <p className="text-sm text-gray-500">No recommendations</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {actions.map((a, i) => {
                  const action = a as Record<string, unknown>;
                  const title = typeof action.title === "string" ? action.title : `Action ${i + 1}`;
                  const why = typeof action.why === "string" ? action.why : null;
                  const actionType = typeof action.type === "string" ? String(action.type) : "task";
                  const suggestedDueAt = action.suggestedDueAt != null ? String(action.suggestedDueAt) : null;
                  return (
                    <li key={i} className="rounded border border-gray-100 bg-gray-50 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{title}</span>
                        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700">
                          {actionType}
                        </span>
                        {suggestedDueAt && (
                          <span className="text-xs text-gray-500">
                            Due: {new Date(suggestedDueAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {why && <p className="mt-1 text-gray-600">{why}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      }
      case "ai_summary": {
        const bullets = Array.isArray(p.summaryBullets) ? p.summaryBullets : [];
        const risks = Array.isArray(p.risks) ? p.risks : [];
        const nextActions = Array.isArray(p.nextActions) ? p.nextActions : [];
        const scope = p.scope != null ? String(p.scope) : null;
        const text = p.text != null ? String(p.text) : "";
        const hasStructured = bullets.length > 0 || risks.length > 0 || nextActions.length > 0;
        return (
          <div className="space-y-2">
            <span className="inline-block rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800">
              AI Summary
            </span>
            {scope && <p className="text-xs text-gray-500">{scope}</p>}
            {hasStructured ? (
              <div className="space-y-1.5 text-sm text-gray-700">
                {bullets.length > 0 && (
                  <ul className="list-inside list-disc space-y-0.5">
                    {bullets.map((b, i) => (
                      <li key={i}>{String(b)}</li>
                    ))}
                  </ul>
                )}
                {risks.length > 0 && (
                  <div>
                    <span className="font-medium text-amber-700">Risks:</span>
                    <ul className="list-inside list-disc space-y-0.5">
                      {risks.map((r, i) => (
                        <li key={i}>{String(r)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {nextActions.length > 0 && (
                  <div>
                    <span className="font-medium text-green-700">Next actions:</span>
                    <ul className="list-inside list-disc space-y-0.5">
                      {nextActions.map((a, i) => (
                        <li key={i}>{String(a)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.emailDraft != null && typeof p.emailDraft === "object" ? (
                  <div className="rounded border border-gray-200 bg-gray-50 p-2">
                    <p className="text-xs font-medium text-gray-500">Suggested email</p>
                    <p className="font-medium">{String((p.emailDraft as { subject?: string }).subject ?? "")}</p>
                    <p className="line-clamp-2">{String((p.emailDraft as { body?: string }).body ?? "")}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-gray-700">{text}</p>
            )}
          </div>
        );
      }
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

export function ActivityTimeline({ entityType, entityId, refreshTrigger }: ActivityTimelineProps) {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [typeFilter, setTypeFilter] = useState("");
  const { user } = useAuth();
  const canUseNextActions = user?.role === "ADMIN" || user?.role === "USER";
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [aiSummaryModalOpen, setAiSummaryModalOpen] = useState(false);
  const [nextActionsModalOpen, setNextActionsModalOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

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
  }, [entityType, entityId, page, pageSize, typeFilter, refreshTrigger]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleActivityAdded = () => {
    setAddModalOpen(false);
    setPage(1);
    fetchActivities();
  };

  const handleAiSummarySuccess = () => {
    setAiSummaryModalOpen(false);
    setPage(1);
    fetchActivities();
    setToast({ type: "success", message: "AI summary generated." });
    setTimeout(() => setToast(null), 4000);
  };

  const handleNextActionsSuccess = () => {
    setNextActionsModalOpen(false);
    setPage(1);
    fetchActivities();
    setToast({ type: "success", message: "Next best actions generated." });
    setTimeout(() => setToast(null), 4000);
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
            onClick={() => setAiSummaryModalOpen(true)}
            className="rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100"
          >
            Generate AI Summary
          </button>
          {canUseNextActions && (
            <button
              onClick={() => setNextActionsModalOpen(true)}
              className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              Next Best Actions
            </button>
          )}
          <button
            onClick={() => setAddModalOpen(true)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Activity
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`mt-3 rounded px-3 py-2 text-sm ${
            toast.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {toast.message}
        </div>
      )}

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
      <GenerateAiSummaryModal
        isOpen={aiSummaryModalOpen}
        onClose={() => setAiSummaryModalOpen(false)}
        entityType={entityType}
        entityId={entityId}
        onSuccess={handleAiSummarySuccess}
      />
      {canUseNextActions && (
        <GenerateNextBestActionsModal
          isOpen={nextActionsModalOpen}
          onClose={() => setNextActionsModalOpen(false)}
          entityType={entityType}
          entityId={entityId}
          onSuccess={handleNextActionsSuccess}
        />
      )}
    </div>
  );
}
