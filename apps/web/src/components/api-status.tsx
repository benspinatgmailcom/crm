"use client";

import { useEffect, useState } from "react";

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function ApiStatus({ className }: { className?: string }) {
  const [status, setStatus] = useState<"checking" | "ok" | "error">("checking");

  const check = () => {
    fetch(`${getBaseUrl()}/health/db`, { credentials: "omit" })
      .then((r) => r.json())
      .then((data) => setStatus(data?.ok ? "ok" : "error"))
      .catch(() => setStatus("error"));
  };

  useEffect(() => {
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex items-center gap-2 text-sm ${className ?? ""}`}>
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          status === "ok"
            ? "bg-green-500"
            : status === "error"
              ? "bg-red-500"
              : "animate-pulse bg-amber-500"
        }`}
        title={
          status === "ok"
            ? "API connected"
            : status === "error"
              ? "API disconnected"
              : "Checking..."
        }
      />
      <span className={className ? "text-inherit" : "text-gray-500"}>
        API {status === "ok" ? "Connected" : status === "error" ? "Disconnected" : "Checking..."}
      </span>
    </div>
  );
}
