"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import type { ActivityEntityType } from "./activity-timeline";

const SCOPE_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
] as const;

interface GenerateAiSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: ActivityEntityType;
  entityId: string;
  onSuccess: () => void;
}

export function GenerateAiSummaryModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  onSuccess,
}: GenerateAiSummaryModalProps) {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/ai/summary", {
        method: "POST",
        body: JSON.stringify({ entityType, entityId, days }),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      const msg = e.body?.message ?? e.message ?? "Failed to generate AI summary";
      setError(typeof msg === "string" ? msg : "Failed to generate AI summary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate AI Summary">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <p className="text-sm text-gray-600">
          Generate an AI summary based on entity data and recent activities.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700">Scope</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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
            disabled={loading}
            className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
