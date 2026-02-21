"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { canWrite } from "@/lib/roles";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { env } from "@/lib/env";
import type { ActivityEntityType } from "@/components/activity/activity-timeline";

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface EntityAttachmentsProps {
  entityType: ActivityEntityType;
  entityId: string;
  onUploadSuccess?: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString();
}

export function EntityAttachments({
  entityType,
  entityId,
  onUploadSuccess,
}: EntityAttachmentsProps) {
  const { user } = useAuth();
  const canEdit = canWrite(user?.role);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Attachment[]>(
        `/attachments?entityType=${entityType}&entityId=${entityId}`
      );
      setAttachments(Array.isArray(data) ? data : []);
    } catch {
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [entityType, entityId]);

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
      const token = typeof window !== "undefined" ? (await import("@/lib/auth-store").then((m) => m.getAccessToken())) : null;
      const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/attachments`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Upload failed");
      }
      setUploadModalOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchAttachments();
      onUploadSuccess?.();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadClick = async (id: string, fileName: string) => {
    const { getAccessToken } = await import("@/lib/auth-store");
    const token = getAccessToken();
    const url = `${env.NEXT_PUBLIC_API_URL}/attachments/${id}/download`;
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(u);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/attachments/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      fetchAttachments();
      onUploadSuccess?.();
    } catch {
      setDeleteId(null);
      fetchAttachments();
    }
  };

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Attachments</h3>
        {canEdit && (
        <button
          onClick={() => setUploadModalOpen(true)}
          className="rounded-md bg-accent-1 px-3 py-1.5 text-sm font-medium text-white hover:brightness-90"
        >
          Upload
        </button>
        )}
      </div>
      {loading ? (
        <p className="mt-3 text-sm text-gray-500">Loading...</p>
      ) : attachments.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No attachments yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900">{a.fileName}</p>
                <p className="text-xs text-gray-500">
                  {formatSize(a.size)} • {formatDate(a.createdAt)}
                </p>
              </div>
              <div className="ml-2 flex gap-2">
                <button
                  onClick={() => handleDownloadClick(a.id, a.fileName)}
                  className="text-accent-1 hover:underline"
                >
                  Download
                </button>
                {canEdit && (
                <button
                  onClick={() => setDeleteId(a.id)}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setUploadError(null);
        }}
        title="Upload attachment"
      >
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

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete attachment"
        message="Are you sure you want to delete this attachment?"
        confirmLabel="Delete"
      />
    </div>
  );
}
