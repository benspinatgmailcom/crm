"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/api-client";
import type { ActivityEntityType } from "./entity-activity-timeline";
import {
  CREATABLE_ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
} from "@/lib/activity-types";

interface CreateActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: ActivityEntityType;
  entityId: string;
  onSuccess?: () => void;
}

type ActivityType = (typeof CREATABLE_ACTIVITY_TYPES)[number];

const TASK_STATUSES = ["open", "in_progress", "done"] as const;
const EMAIL_DIRECTIONS = ["inbound", "outbound"] as const;

export function CreateActivityModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  onSuccess,
}: CreateActivityModalProps) {
  const [type, setType] = useState<ActivityType>("note");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    text: "",
    title: "",
    status: "open" as string,
    dueAt: "",
    summary: "",
    outcome: "",
    nextStep: "",
    subject: "",
    body: "",
    direction: "outbound" as string,
  });

  const resetForm = () => {
    setForm({
      text: "",
      title: "",
      status: "open",
      dueAt: "",
      summary: "",
      outcome: "",
      nextStep: "",
      subject: "",
      body: "",
      direction: "outbound",
    });
  };

  const buildPayload = (): Record<string, unknown> => {
    switch (type) {
      case "note":
        return { text: form.text.trim() || "(No content)" };
      case "task":
        return {
          title: form.title.trim() || "Untitled task",
          status: form.status,
          dueAt: form.dueAt || undefined,
        };
      case "call":
      case "meeting":
        return {
          summary: form.summary.trim(),
          outcome: form.outcome.trim() || undefined,
          nextStep: form.nextStep.trim() || undefined,
        };
      case "email":
        return {
          subject: form.subject.trim(),
          body: form.body.trim(),
          direction: form.direction,
        };
      default:
        return {};
    }
  };

  const isValid = (): boolean => {
    switch (type) {
      case "note":
        return !!form.text.trim();
      case "task":
        return !!form.title.trim();
      case "call":
      case "meeting":
        return !!form.summary.trim();
      case "email":
        return !!form.subject.trim();
      default:
        return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/activities", {
        method: "POST",
        body: JSON.stringify({
          entityType,
          entityId,
          type,
          payload: buildPayload(),
        }),
      });
      resetForm();
      onClose();
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string } };
      setError(e.body?.message || "Failed to create activity");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Activity">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ActivityType)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {CREATABLE_ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </div>

        {type === "note" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note *</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              rows={4}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Enter your note..."
            />
          </div>
        )}

        {type === "task" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. Follow up with customer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </>
        )}

        {(type === "call" || type === "meeting") && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary *</label>
              <textarea
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                rows={3}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="What was discussed?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
              <input
                type="text"
                value={form.outcome}
                onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Result of the call/meeting"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next step</label>
              <input
                type="text"
                value={form.nextStep}
                onChange={(e) => setForm((f) => ({ ...f, nextStep: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Follow-up action"
              />
            </div>
          </>
        )}

        {type === "email" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Email subject"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={4}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Email content"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
              <select
                value={form.direction}
                onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {EMAIL_DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !isValid()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
