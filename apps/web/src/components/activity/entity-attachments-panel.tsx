"use client";

import { useEffect, useState, useRef } from "react";
import { apiFetch, apiUpload, apiDownloadFile, apiDelete } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/context/auth-context";
import type { ActivityEntityType } from "./entity-activity-timeline";

interface Attachment {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

interface EntityAttachmentsPanelProps {
  entityType: ActivityEntityType;
  entityId: string;
  refreshTrigger?: number;
  onSuccess?: () => void;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EntityAttachmentsPanel({
  entityType,
  entityId,
  refreshTrigger,
  onSuccess,
}: EntityAttachmentsPanelProps) {
  const { user } = useAuth();
  const canDelete = user?.role === "ADMIN" || user?.role === "USER";
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: Attachment[] }>(
        `/activities?entityType=${entityType}&entityId=${entityId}&type=file_uploaded&pageSize=50&sortDir=desc`
      );
      setAttachments(res.data ?? []);
    } catch {
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [entityType, entityId, refreshTrigger]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        formData.append("entityType", entityType);
        formData.append("entityId", entityId);
        await apiUpload("/uploads", formData);
      }
      await fetchAttachments();
      onSuccess?.();
    } catch {
      // Error could be surfaced via toast
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDownload = (pathVal: string, filename: string) => {
    apiDownloadFile(
      `/uploads/download?path=${encodeURIComponent(pathVal)}`,
      filename
    );
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeletingId(deleteId);
    setError(null);
    try {
      await apiDelete(`/attachments/${deleteId}`);
      setDeleteId(null);
      await fetchAttachments();
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      setError(e.body?.message ?? e.message ?? "Failed to delete attachment");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => {
          setDeleteId(null);
          setError(null);
        }}
        onConfirm={handleDelete}
        title="Delete Attachment"
        message="Delete this attachment? The file will be removed."
        confirmLabel="Delete"
      />
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Attachments</h3>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Attach File"}
          </button>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading attachments...</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-gray-500">No attachments yet.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => {
            const p = a.payload ?? {};
            const filename = String(p.filename ?? "File");
            const pathVal = p.path as string | undefined;
            const deleting = deletingId === a.id;
            return (
              <li
                key={a.id}
                className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="text-gray-700 truncate flex-1 min-w-0">
                  {filename}
                </span>
                <span className="text-xs text-gray-400 shrink-0 ml-2">
                  {formatDate(a.createdAt)}
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {pathVal && (
                    <button
                      type="button"
                      onClick={() => handleDownload(pathVal, filename)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Download
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleteId(a.id)}
                      disabled={deleting}
                      className="text-red-600 hover:text-red-700 text-xs disabled:opacity-50"
                      title="Delete attachment"
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
