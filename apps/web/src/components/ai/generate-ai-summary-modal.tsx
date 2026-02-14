"use client";

import { Modal } from "@/components/ui/modal";

interface GenerateAiSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GenerateAiSummaryModal({
  isOpen,
  onClose,
}: GenerateAiSummaryModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate AI Summary">
      <p className="text-sm text-gray-600">
        AI Summary generation will analyze recent activities and produce a concise summary for this entity. This feature is coming soon.
      </p>
      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
