"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/api-client";
import type { ActivityEntityType } from "@/components/activity/entity-activity-timeline";

interface EntityOption {
  id: string;
  label: string;
}

interface EntityPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entityType: ActivityEntityType, entityId: string) => void;
  title?: string;
}

const ENTITY_TYPES: { value: ActivityEntityType; label: string }[] = [
  { value: "account", label: "Account" },
  { value: "contact", label: "Contact" },
  { value: "lead", label: "Lead" },
  { value: "opportunity", label: "Opportunity" },
];

export function EntityPickerModal({
  isOpen,
  onClose,
  onSelect,
  title = "Select entity",
}: EntityPickerModalProps) {
  const [entityType, setEntityType] = useState<ActivityEntityType>("account");
  const [entityId, setEntityId] = useState("");
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setEntityType("account");
    setEntityId("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const fetchOptions = async () => {
      try {
        const res = await apiFetch<{ data: { id: string; name?: string; firstName?: string; lastName?: string }[] }>(
          `/${entityType}?pageSize=50`
        );
        const data = res?.data ?? [];
        setOptions(
          data.map((item: { id: string; name?: string; firstName?: string; lastName?: string }) => ({
            id: item.id,
            label: entityType === "contact"
              ? `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim() || item.id
              : (item.name ?? item.id),
          }))
        );
        setEntityId("");
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOptions();
  }, [isOpen, entityType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entityId) {
      onSelect(entityType, entityId);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Entity type</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as ActivityEntityType)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Entity</label>
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            disabled={loading}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1 disabled:opacity-50"
          >
            <option value="">Select...</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
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
            disabled={!entityId || loading}
            className="rounded bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </form>
    </Modal>
  );
}
