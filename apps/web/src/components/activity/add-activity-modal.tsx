"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import { ACTIVITY_TYPES, type ActivityEntityType } from "./activity-timeline";

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: ActivityEntityType;
  entityId: string;
  onSuccess: () => void;
  /** Preset the activity type when opening (e.g. from timeline filter) */
  presetType?: string;
}

type PayloadState = {
  note: { text: string };
  call: { summary: string; outcome: string; nextStep: string };
  meeting: { summary: string; outcome: string; nextStep: string };
  email: { subject: string; body: string; direction: string };
  task: { title: string; dueAt: string; status: string };
  ai_summary: { text: string };
};

const initialPayload: PayloadState = {
  note: { text: "" },
  call: { summary: "", outcome: "", nextStep: "" },
  meeting: { summary: "", outcome: "", nextStep: "" },
  email: { subject: "", body: "", direction: "" },
  task: { title: "", dueAt: "", status: "open" },
  ai_summary: { text: "" },
};

/** Valid activity type values (used here to avoid reading ACTIVITY_TYPES at module load and causing a circular dependency) */
const VALID_ACTIVITY_TYPE_VALUES = ["note", "call", "meeting", "email", "task", "ai_summary"];

export function AddActivityModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  onSuccess,
  presetType,
}: AddActivityModalProps) {
  const [type, setType] = useState<(typeof ACTIVITY_TYPES)[number]["value"]>("note");
  const [payload, setPayload] = useState<PayloadState>(initialPayload);

  useEffect(() => {
    if (isOpen) {
      const initialType = presetType && VALID_ACTIVITY_TYPE_VALUES.includes(presetType) ? presetType : "note";
      setType(initialType);
    }
  }, [isOpen, presetType]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setType("note");
    setPayload(JSON.parse(JSON.stringify(initialPayload)));
    setErrors({});
    setSubmitError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const activeType = type || "note";
    const p = payload[activeType as keyof PayloadState];

    // Client-side required validation
    if (activeType === "note") {
      const text = (p as { text?: string }).text?.trim();
      if (!text) {
        setErrors({ text: "Note text is required" });
        return;
      }
    }
    if (activeType === "task") {
      const title = (p as { title?: string }).title?.trim();
      if (!title) {
        setErrors({ title: "Task title is required" });
        return;
      }
    }
    if (activeType === "ai_summary") {
      const text = (p as { text?: string }).text?.trim();
      if (!text) {
        setErrors({ text: "AI summary text is required" });
        return;
      }
    }

    const buildPayload = () => {
      switch (activeType) {
        case "note":
          return { text: (p as { text: string }).text.trim() };
        case "call":
          return {
            summary: (p as { summary: string }).summary?.trim() || undefined,
            outcome: (p as { outcome: string }).outcome?.trim() || undefined,
            nextStep: (p as { nextStep: string }).nextStep?.trim() || undefined,
          };
        case "meeting":
          return {
            summary: (p as { summary: string }).summary?.trim() || undefined,
            outcome: (p as { outcome: string }).outcome?.trim() || undefined,
            nextStep: (p as { nextStep: string }).nextStep?.trim() || undefined,
          };
        case "email":
          return {
            subject: (p as { subject: string }).subject?.trim() || undefined,
            body: (p as { body: string }).body?.trim() || undefined,
            direction: (p as { direction: string }).direction || undefined,
          };
        case "task":
          return {
            title: (p as { title: string }).title.trim(),
            dueAt: (p as { dueAt: string }).dueAt?.trim() || undefined,
            status: (p as { status: string }).status || "open",
          };
        case "ai_summary":
          return { text: (p as { text: string }).text.trim() };
        default:
          return {};
      }
    };

    setSubmitting(true);
    try {
      await apiFetch("/activities", {
        method: "POST",
        body: JSON.stringify({
          entityType,
          entityId,
          type: activeType,
          payload: buildPayload(),
        }),
      });
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string; errors?: string[] } };
      setSubmitError(
        Array.isArray(e.body?.errors) ? e.body.errors.join(" ") : e.body?.message ?? "Failed to add activity"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const activeType = (type || "note") as keyof PayloadState;
  const p = payload[activeType] ?? initialPayload.note;

  const typeOptions = ACTIVITY_TYPES.filter((t) => t.value);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Activity">
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as (typeof ACTIVITY_TYPES)[number]["value"])}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {typeOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Note */}
        {activeType === "note" && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Text *</label>
            <textarea
              value={(p as { text: string }).text}
              onChange={(e) =>
                setPayload((prev) => ({
                  ...prev,
                  note: { ...prev.note, text: e.target.value },
                }))
              }
              rows={3}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.text && <p className="mt-0.5 text-sm text-red-600">{errors.text}</p>}
          </div>
        )}

        {/* Call / Meeting */}
        {(activeType === "call" || activeType === "meeting") && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Summary</label>
              <textarea
                value={(p as { summary: string }).summary}
                onChange={(e) =>
                  setPayload((prev) => ({
                    ...prev,
                    [activeType]: { ...prev[activeType], summary: e.target.value },
                  }))
                }
                rows={2}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Outcome</label>
              <input
                value={(p as { outcome: string }).outcome}
                onChange={(e) =>
                  setPayload((prev) => ({
                    ...prev,
                    [activeType]: { ...prev[activeType], outcome: e.target.value },
                  }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Next Step</label>
              <input
                value={(p as { nextStep: string }).nextStep}
                onChange={(e) =>
                  setPayload((prev) => ({
                    ...prev,
                    [activeType]: { ...prev[activeType], nextStep: e.target.value },
                  }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Email */}
        {activeType === "email" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Subject</label>
              <input
                value={(p as { subject: string }).subject}
                onChange={(e) =>
                  setPayload((prev) => ({
                    ...prev,
                    email: { ...prev.email, subject: e.target.value },
                  }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Direction</label>
              <select
                value={(p as { direction: string }).direction}
                onChange={(e) =>
                  setPayload((prev) => ({
                    ...prev,
                    email: { ...prev.email, direction: e.target.value },
                  }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">—</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Body</label>
              <textarea
                value={(p as { body: string }).body}
                onChange={(e) =>
                  setPayload((prev) => ({
                    ...prev,
                    email: { ...prev.email, body: e.target.value },
                  }))
                }
                rows={3}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Task */}
        {activeType === "task" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title *</label>
              <input
                value={(p as { title: string }).title}
                onChange={(e) =>
                  setPayload((prev) => ({
                    ...prev,
                    task: { ...prev.task, title: e.target.value },
                  }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.title && <p className="mt-0.5 text-sm text-red-600">{errors.title}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Due Date</label>
              <input
                type="date"
                value={(p as { dueAt: string }).dueAt}
                onChange={(e) =>
                  setPayload((prev) => ({
                    ...prev,
                    task: { ...prev.task, dueAt: e.target.value },
                  }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={(p as { status: string }).status}
                onChange={(e) =>
                  setPayload((prev) => ({
                    ...prev,
                    task: { ...prev.task, status: e.target.value },
                  }))
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="open">Open</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
        )}

        {/* AI Summary */}
        {activeType === "ai_summary" && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Text *</label>
            <textarea
              value={(p as { text: string }).text}
              onChange={(e) =>
                setPayload((prev) => ({
                  ...prev,
                  ai_summary: { ...prev.ai_summary, text: e.target.value },
                }))
              }
              rows={3}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.text && <p className="mt-0.5 text-sm text-red-600">{errors.text}</p>}
          </div>
        )}

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
            disabled={submitting}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
