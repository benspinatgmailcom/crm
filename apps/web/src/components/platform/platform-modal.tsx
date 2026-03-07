"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type PlatformModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  contentClassName?: string;
};

export function PlatformModal(props: PlatformModalProps) {
  const { isOpen, onClose, title, children, contentClassName } = props;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cn = contentClassName ?? "max-w-lg";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        className={`relative z-10 w-full max-h-[90vh] overflow-auto rounded-lg border border-white/10 bg-slate-900 shadow-xl ${cn}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-modal-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-slate-800/80 px-6 py-4">
          <h2 id="platform-modal-title" className="text-lg font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
