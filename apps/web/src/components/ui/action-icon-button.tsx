"use client";

import { type LucideIcon } from "lucide-react";

interface ActionIconButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  variant?: "default" | "danger";
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Icon-only button or link with hover tooltip (title). Use for View, Edit, Delete, Download actions.
 */
export function ActionIconButton({
  icon: Icon,
  label,
  onClick,
  href,
  variant = "default",
  disabled,
  className = "",
  "aria-label": ariaLabel,
}: ActionIconButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-1 focus:ring-offset-1 disabled:opacity-50";
  const variantClass =
    variant === "danger"
      ? "text-red-600 hover:bg-red-50 hover:text-red-700"
      : "text-accent-1 hover:bg-accent-1/10 hover:text-accent-1";
  const combined = `${base} ${variantClass} ${className}`.trim();

  if (href) {
    return (
      <a
        href={href}
        className={combined}
        title={label}
        aria-label={ariaLabel ?? label}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      disabled={disabled}
      className={combined}
      title={label}
      aria-label={ariaLabel ?? label}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
