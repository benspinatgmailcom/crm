"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { apiUpload } from "@/lib/api-client";
import type { ActivityEntityType } from "@/components/activity/entity-activity-timeline";

interface QuickCreateAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: ActivityEntityType;
  entityId: string;
  onSuccess: () => void;
}

export function QuickCreateAttachmentModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  onSuccess,
}: QuickCreateAttachmentModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append("entityType", entityType);
    formData.append("entityId", entityId);
    formData.append("file", file);
    try {
      await apiUpload("/attachments", formData);
      onSuccess();
      onClose();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload attachment">
      <div className="space-y-4">
        {uploadError && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {uploadError}
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleUpload}
          disabled={uploading}
          className="block w-full text-sm"
        />
        {uploading && <p className="text-sm text-gray-500">Uploading...</p>}
      </div>
    </Modal>
  );
}
