"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import type { ActivityEntityType } from "@/components/activity/activity-timeline";

const INTENT_OPTIONS = [
  { value: "follow_up", label: "Follow up" },
  { value: "recap", label: "Recap" },
  { value: "pricing", label: "Pricing" },
  { value: "next_steps", label: "Next steps" },
  { value: "re_engage", label: "Re-engage" },
  { value: "intro", label: "Introduction" },
] as const;

const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "direct", label: "Direct" },
] as const;

const LENGTH_OPTIONS = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
] as const;

interface SuggestedRecipient {
  name?: string;
  email: string;
}

interface DraftEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: ActivityEntityType | "account";
  entityId: string;
  defaultRecipientEmail?: string;
  suggestedRecipients?: SuggestedRecipient[];
  onSuccess: () => void;
}

export function DraftEmailModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  defaultRecipientEmail,
  suggestedRecipients = [],
  onSuccess,
}: DraftEmailModalProps) {
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail ?? "");
  const [intent, setIntent] = useState<"follow_up" | "recap" | "pricing" | "next_steps" | "re_engage" | "intro">("follow_up");
  const [tone, setTone] = useState<"friendly" | "professional" | "direct">("professional");
  const [length, setLength] = useState<"short" | "medium">("medium");
  const [additionalContext, setAdditionalContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    activityId: string;
    subject: string;
    body: string;
    suggestedRecipients?: SuggestedRecipient[];
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRecipientEmail(defaultRecipientEmail ?? "");
      setResult(null);
      setError(null);
    }
  }, [isOpen, defaultRecipientEmail]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await apiFetch<{ activityId: string; subject: string; body: string; suggestedRecipients?: SuggestedRecipient[] }>("/ai/draft-email", {
        method: "POST",
        body: JSON.stringify({
          entityType,
          entityId,
          recipientEmail: recipientEmail.trim() || undefined,
          intent,
          tone,
          length,
          additionalContext: additionalContext.trim() || undefined,
        }),
      });
      setResult({
        activityId: res.activityId,
        subject: res.subject,
        body: res.body,
        suggestedRecipients: res.suggestedRecipients,
      });
      onSuccess();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      setError(e.body?.message ?? e.message ?? "Failed to generate draft");
    } finally {
      setLoading(false);
    }
  };

  const handleLogOutbound = async () => {
    if (!result) return;
    setError(null);
    setLogging(true);
    try {
      await apiFetch(`/ai/draft-email/${result.activityId}/log`, {
        method: "POST",
        body: JSON.stringify({ toEmail: recipientEmail.trim() || undefined }),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      setError(e.body?.message ?? e.message ?? "Failed to log email");
    } finally {
      setLogging(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Draft Email">
      <div className="space-y-4">
        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {!result ? (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Recipient email</label>
              {suggestedRecipients.length > 0 ? (
                <>
                  <select
                    value={suggestedRecipients.some((r) => r.email === recipientEmail) ? recipientEmail : ""}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">— Select or type below —</option>
                    {suggestedRecipients.map((r) => (
                      <option key={r.email} value={r.email}>
                        {r.name ? `${r.name} (${r.email})` : r.email}
                      </option>
                    ))}
                  </select>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="Or type email..."
                    className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </>
              ) : (
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Intent</label>
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value as typeof intent)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {INTENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as typeof tone)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {TONE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Length</label>
                <select
                  value={length}
                  onChange={(e) => setLength(e.target.value as typeof length)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {LENGTH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Additional context (optional)</label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={3}
                placeholder="Any extra instructions for the AI..."
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
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
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Generating…" : "Generate Draft"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Subject</label>
              <div className="mt-1 flex gap-2">
                <textarea
                  value={result.subject}
                  onChange={(e) => setResult((r) => (r ? { ...r, subject: e.target.value } : null))}
                  rows={1}
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(result.subject)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Copy
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Body</label>
              <div className="mt-1 flex flex-col gap-2">
                <textarea
                  value={result.body}
                  onChange={(e) => setResult((r) => (r ? { ...r, body: e.target.value } : null))}
                  rows={8}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(result.body)}
                  className="self-start rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Copy Body
                </button>
              </div>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                New Draft
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleLogOutbound}
                  disabled={logging}
                  className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {logging ? "Logging…" : "Log as Outbound Email"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
