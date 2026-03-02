"use client";

import { useEffect, useState } from "react";
import { env } from "@/lib/env";
import { getAccessToken } from "@/lib/auth-store";

const REPORTS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_REPORTS === "true" ||
  (process.env.NEXT_PUBLIC_ENABLE_REPORTS == null &&
    process.env.NODE_ENV === "development");

export default function ReportsPage() {
  if (!REPORTS_ENABLED) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 py-16 text-center">
          <p className="text-lg font-medium text-gray-700">Coming Soon</p>
          <p className="mt-2 text-sm text-gray-500">
            Reports and dashboards will be available here.
          </p>
        </div>
      </div>
    );
  }

  return <ReportsEmbed />;
}

function ReportsEmbed() {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = `${env.NEXT_PUBLIC_API_URL}/metabase/dashboard-embed-url`;
    const token = getAccessToken();
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    fetch(url, { credentials: "include", headers })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText || "Failed to load report");
        return res.json();
      })
      .then((data: { iframeUrl: string }) => {
        setIframeUrl(data.iframeUrl);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load report");
        setIframeUrl(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!iframeUrl) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <p className="text-gray-500">No report URL available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
      <iframe
        src={iframeUrl}
        style={{ width: "100%", height: "80vh" }}
        frameBorder={0}
        title="Reports dashboard"
        className="rounded-lg border border-gray-200"
      />
    </div>
  );
}
