"use client";

import { useEffect } from "react";
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const raw1 = env.NEXT_PUBLIC_ACCENT_1;
    const raw2 = env.NEXT_PUBLIC_ACCENT_2;
    const accent1 = raw1.startsWith("#") ? (hexToRgbChannels(raw1) ?? DEFAULT_ACCENT_1) : (raw1 || DEFAULT_ACCENT_1);
    const accent2 = raw2.startsWith("#") ? (hexToRgbChannels(raw2) ?? DEFAULT_ACCENT_2) : (raw2 || DEFAULT_ACCENT_2);
    document.documentElement.style.setProperty("--accent-1", accent1);
    document.documentElement.style.setProperty("--accent-2", accent2);
  }, []);
  return <>{children}</>;
}
