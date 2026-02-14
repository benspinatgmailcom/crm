"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import type { ActivityEntityType } from "@/components/activity/entity-activity-timeline";

interface NextAction {
  priority: number;
  title: string;
  why: string;
  suggestedDueAt?: string;
  type: string;
  details?: string;
}

interface GenerateNextBestActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: ActivityEntityType;
  entityId: string;
  onSuccess: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  call: "bg-blue-100 text-blue-800",
  email: "bg-green-100 text-green-800",
  task: "bg-amber-100 text-amber-800",
  meeting: "bg-purple-100 text-purple-800",
  research: "bg-gray-100 text-gray-800",
};

export function GenerateNextBestActionsModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  onSuccess,
}: GenerateNextBestActionsModalProps) {
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [convertingIndex, setConvertingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [actions, setActions] = useState<NextAction[]>([]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActions([]);
    setActivityId(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ activityId: string; actions: NextAction[] }>(
        "/ai/next-actions",
        {
          method: "POST",
          body: JSON.stringify({ entityType, entityId, count }),
        }
      );
      setActivityId(res.activityId);
      const sorted = [...res.actions].sort((a, b) => a.priority - b.priority);
      setActions(sorted);
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      setError(e.body?.message ?? e.message ?? "Failed to generate next actions");
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async (actionIndex: number) => {
    if (!activityId) return;
    setConvertingIndex(actionIndex);
    setError(null);
    try {
      await apiFetch(`/ai/next-actions/${activityId}/convert`, {
        method: "POST",
        body: JSON.stringify({ actionIndex }),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      setError(e.body?.message ?? e.message ?? "Failed to convert to task");
    } finally {
      setConvertingIndex(null);
    }
  };

  const handleClose = () => {
    setActions([]);
    setActivityId(null);
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Next Best Actions">
      <form onSubmit={handleGenerate} className="space-y-4">
        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {actions.length === 0 ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Number of actions (1-10)
              </label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {[3, 5, 7, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Generating…" : "Generate"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Sorted by priority (1 = highest). Convert any action to a task.
            </p>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {actions.map((action, idx) => (
                <div
                  key={idx}
                  className="rounded border border-gray-200 bg-gray-50 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{action.title}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            TYPE_COLORS[action.type] ?? "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {action.type}
                        </span>
                        <span className="text-xs text-gray-500">P{action.priority}</span>
                      </div>
                      <p className="mt-1 text-gray-600">{action.why}</p>
                      {action.suggestedDueAt && (
                        <p className="mt-1 text-xs text-gray-500">
                          Suggested due: {new Date(action.suggestedDueAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConvert(idx)}
                      disabled={convertingIndex === idx}
                      className="shrink-0 rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {convertingIndex === idx ? "Converting…" : "Convert to Task"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setActions([]);
                  setActivityId(null);
                  setError(null);
                }}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Generate Again
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
