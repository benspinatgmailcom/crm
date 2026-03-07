"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { TenantListItem } from "@/lib/platform-types";

export function usePlatformTenants() {
  const [data, setData] = useState<TenantListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiFetch<TenantListItem[]>("/platform/tenants");
      setData(list ?? []);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { tenants: data ?? [], loading, error, refetch };
}
