"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client-side errors; can be extended to send to Sentry etc.
    console.error("[Error boundary]", error.message, error.digest ?? "", error.stack);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6">
      <h2 className="mb-2 text-lg font-semibold text-gray-900">Something went wrong</h2>
      <p className="mb-4 max-w-md text-center text-sm text-gray-600">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={() => reset()}
        className="rounded-lg bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-accent-1 focus:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
