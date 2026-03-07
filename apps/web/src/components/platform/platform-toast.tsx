"use client";

import { useEffect } from "react";
import { CheckCircle, XCircle } from "lucide-react";

export type ToastType = "success" | "error";

interface PlatformToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
  duration?: number;
}

export function PlatformToast({
  message,
  type,
  onDismiss,
  duration = 4000,
}: PlatformToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  const isSuccess = type === "success";
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg ${
        isSuccess
          ? "border-green-500/30 bg-green-500/15 text-green-200"
          : "border-red-500/30 bg-red-500/15 text-red-200"
      }`}
      role="alert"
    >
      {isSuccess ? (
        <CheckCircle className="h-5 w-5 shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 shrink-0" />
      )}
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
