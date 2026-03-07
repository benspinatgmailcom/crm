"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { env } from "@/lib/env";

const DEFAULT_ACCENT_1 = "37 99 235";
const DEFAULT_ACCENT_2 = "124 58 237";

function hexToRgbChannels(hex: string): string | null {
  const m = hex.replace(/^#/, "").match(/^(?:[0-9a-f]{3}){1,2}$/i);
  if (!m) return null;
  let r: number, g: number, b: number;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return `${r} ${g} ${b}`;
}

function resolveRgb(value: string | null | undefined, envValue: string, defaultRgb: string): string {
  const raw = value ?? envValue;
  if (!raw) return defaultRgb;
  return raw.startsWith("#") ? (hexToRgbChannels(raw) ?? defaultRgb) : raw;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { tenant } = useAuth();

  useEffect(() => {
    const accent1 = resolveRgb(
      tenant?.primaryColor ?? undefined,
      env.NEXT_PUBLIC_ACCENT_1,
      DEFAULT_ACCENT_1
    );
    const accent2 = resolveRgb(
      tenant?.accentColor ?? undefined,
      env.NEXT_PUBLIC_ACCENT_2,
      DEFAULT_ACCENT_2
    );
    document.documentElement.style.setProperty("--accent-1", accent1);
    document.documentElement.style.setProperty("--accent-2", accent2);
  }, [tenant?.primaryColor, tenant?.accentColor]);

  useEffect(() => {
    const themeColor = (tenant?.primaryColor ?? tenant?.accentColor ?? env.NEXT_PUBLIC_ACCENT_1);
    const hex = themeColor.startsWith("#") ? themeColor : "#2563eb";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = hex;
  }, [tenant?.primaryColor, tenant?.accentColor]);

  return <>{children}</>;
}
