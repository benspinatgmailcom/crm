"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/roles";
import { Modal } from "@/components/ui/modal";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";

const STAGES = [
  "prospecting",
  "qualification",
  "discovery",
  "proposal",
  "negotiation",
];
const SORT_OPTIONS = [
  { value: "risk", label: "Highest risk" },
  { value: "amount", label: "Biggest $" },
  { value: "lastTouch", label: "Oldest touch" },
  { value: "stageAge", label: "Oldest in stage" },
  { value: "overdue", label: "Overdue first" },
];

interface DashboardData {
  filtersEcho: {
    owner: string;
    stages: string[];
    status: string[];
    overdueOnly: boolean;
    staleOnly: boolean;
    sort: string;
    page: number;
    pageSize: number;
  };
  summary: {
    totalDeals: number;
    totalAmount: number;
    healthyCount: number;
    warningCount: number;
    criticalCount: number;
    atRiskAmount: number;
    overdueNextStepsCount: number;
    staleTouchCount: number;
  };
  topDrivers: Array<{ code: string; deals: number; amount: number }>;
  byStage: Array<{
    stage: string;
    deals: number;
    amount: number;
    avgDaysInStage: number | null;
    criticalPct: number;
  }>;
  queue: {
    total: number;
    page: number;
    pageSize: number;
    items: Array<{
      id: string;
      name: string;
      stage: string;
      amount: number | null;
      owner: { id: string; name: string; email?: string };
      nextFollowUpAt: string | null;
      daysSinceLastTouch: number | null;
      daysInStage: number | null;
      healthScore: number | null;
      healthStatus: "healthy" | "warning" | "critical";
      healthSignals: Array<{ code: string; severity: string; message: string; penalty: number }>;
      followup: { hasSuggestion: boolean; hasOpenTask: boolean; hasDraft: boolean };
      winProbability?: number;
      forecastCategory?: string;
      expectedRevenue?: number | null;
      forecastDrivers?: Array<{ code: string; label: string; impact: number }>;
    }>;
  };
  forecast: {
    totalAmount: number;
    weightedPipeline: number;
    commitAmount: number;
    commitWeighted: number;
    bestCaseAmount: number;
    bestCaseWeighted: number;
    byOwner: Array<{
      ownerId: string;
      ownerName: string;
      pipelineAmount: number;
      bestCaseAmount: number;
      commitAmount: number;
      weightedTotal: number;
    }>;
    byStage: Array<{
      stage: string;
      pipelineAmount: number;
      bestCaseAmount: number;
      commitAmount: number;
      weightedTotal: number;
    }>;
  };
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function PipelineHealthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const admin = isAdmin(user?.role);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; email: string; role: string }[]>([]);
  const [listModal, setListModal] = useState<{ title: string; params: Record<string, string> } | null>(null);
  const [listModalItems, setListModalItems] = useState<DashboardData["queue"]["items"] | null>(null);
  const [listModalLoading, setListModalLoading] = useState(false);

  const owner = searchParams.get("owner") ?? (admin ? "all" : "me");
  const stagesParam = searchParams.get("stages") ?? "";
  const statusParam = searchParams.get("status") ?? "";
  const overdueOnly = searchParams.get("overdueOnly") === "true";
  const staleOnly = searchParams.get("staleOnly") === "true";
  const sort = searchParams.get("sort") ?? "risk";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10)));

  const stagesFilter = useMemo(
    () => (stagesParam ? stagesParam.split(",").map((s) => s.trim()).filter(Boolean) : []),
    [stagesParam]
  );
  const statusFilter = useMemo(
    () => (statusParam ? statusParam.split(",").map((s) => s.trim().toLowerCase()) : []),
    [statusParam]
  );

  const setQuery = useCallback(
    (updates: Record<string, string | number | boolean | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === "" || v === false) params.delete(k);
        else params.set(k, String(v));
      }
      router.replace(`/health?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const baseListParams = useMemo(() => {
    const p: Record<string, string> = { owner, sort: "risk", page: "1", pageSize: "100" };
    if (stagesFilter.length) p.stages = stagesFilter.join(",");
    if (statusFilter.length) p.status = statusFilter.join(",");
    return p;
  }, [owner, stagesFilter, statusFilter]);

  const openListModal = useCallback(
    (title: string, extraParams: Record<string, string>) => {
      setListModal({ title, params: { ...baseListParams, ...extraParams } });
      setListModalItems(null);
      setListModalLoading(true);
    },
    [baseListParams]
  );

  useEffect(() => {
    if (!listModal) return;
    const params = new URLSearchParams(listModal.params);
    apiFetch<DashboardData>(`/dashboard/pipeline-health?${params.toString()}`)
      .then((res) => {
        setListModalItems(res.queue.items);
      })
      .catch(() => setListModalItems([]))
      .finally(() => setListModalLoading(false));
  }, [listModal]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (owner) params.set("owner", owner);
      if (stagesFilter.length) params.set("stages", stagesFilter.join(","));
      if (statusFilter.length) params.set("status", statusFilter.join(","));
      if (overdueOnly) params.set("overdueOnly", "true");
      if (staleOnly) params.set("staleOnly", "true");
      params.set("sort", sort);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await apiFetch<DashboardData>(`/dashboard/pipeline-health?${params.toString()}`);
      setData(res);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [owner, stagesFilter, statusFilter, overdueOnly, staleOnly, sort, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (admin) {
      apiFetch<{ id: string; email: string; role: string }[]>("/users/active")
        .then(setUsers)
        .catch(() => setUsers([]));
    }
  }, [admin]);

  const toggleStage = (stage: string) => {
    const next = stagesFilter.includes(stage)
      ? stagesFilter.filter((s) => s !== stage)
      : [...stagesFilter, stage];
    setQuery({ stages: next.length ? next.join(",") : undefined });
  };

  const toggleStatus = (status: string) => {
    const next = statusFilter.includes(status)
      ? statusFilter.filter((s) => s !== status)
      : [...statusFilter, status];
    setQuery({ status: next.length ? next.join(",") : undefined });
  };

  if (loading && !data) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Loading pipeline health...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  const d = data!;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="h-7 w-7 text-accent-1" />
          Pipeline Health Dashboard
        </h1>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-slate-50/80 px-4 py-3 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Filters</span>
        <select
          value={owner}
          onChange={(e) => setQuery({ owner: e.target.value, page: 1 })}
          className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
        >
          <option value="me">Mine</option>
          {admin && <option value="all">All</option>}
          {admin && users.map((u) => (
            <option key={u.id} value={u.id}>{u.email}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStage(s)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                stagesFilter.length === 0 || stagesFilter.includes(s)
                  ? "bg-accent-1/15 text-accent-1 border border-accent-1/30"
                  : "bg-gray-100 text-gray-600 border border-gray-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {(["healthy", "warning", "critical"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                statusFilter.length === 0 || statusFilter.includes(s)
                  ? s === "healthy"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : s === "warning"
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-red-100 text-red-800 border border-red-200"
                  : "bg-gray-100 text-gray-600 border border-gray-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setQuery({ overdueOnly: e.target.checked, page: 1 })}
            className="rounded border-gray-300 text-accent-1 focus:ring-accent-1"
          />
          <span className="text-gray-600">Overdue only</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={staleOnly}
            onChange={(e) => setQuery({ staleOnly: e.target.checked, page: 1 })}
            className="rounded border-gray-300 text-accent-1 focus:ring-accent-1"
          />
          <span className="text-gray-600">Stale only</span>
        </label>
        <select
          value={sort}
          onChange={(e) => setQuery({ sort: e.target.value, page: 1 })}
          className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600">{error}</p>
      )}

      {/* Summary tiles - each count opens a modal list */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <button
          type="button"
          onClick={() => openListModal("All deals", {})}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm text-left hover:bg-gray-50 transition-colors"
        >
          <p className="text-xs font-medium uppercase text-gray-500">Deals</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{d.summary.totalDeals}</p>
          <p className="text-xs text-gray-500">{formatCurrency(d.summary.totalAmount)}</p>
        </button>
        <button
          type="button"
          onClick={() => openListModal("Healthy deals", { status: "healthy" })}
          className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm text-left hover:bg-emerald-100/50 transition-colors"
        >
          <p className="text-xs font-medium uppercase text-emerald-700">Healthy</p>
          <p className="mt-1 text-xl font-semibold text-emerald-800">{d.summary.healthyCount}</p>
        </button>
        <button
          type="button"
          onClick={() => openListModal("Warning deals", { status: "warning" })}
          className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 shadow-sm text-left hover:bg-amber-100/50 transition-colors"
        >
          <p className="text-xs font-medium uppercase text-amber-700">Warning</p>
          <p className="mt-1 text-xl font-semibold text-amber-800">{d.summary.warningCount}</p>
        </button>
        <button
          type="button"
          onClick={() => openListModal("Critical deals", { status: "critical" })}
          className="rounded-lg border border-red-200 bg-red-50/50 p-4 shadow-sm text-left hover:bg-red-100/50 transition-colors"
        >
          <p className="text-xs font-medium uppercase text-red-700">Critical</p>
          <p className="mt-1 text-xl font-semibold text-red-800">{d.summary.criticalCount}</p>
        </button>
        <button
          type="button"
          onClick={() => openListModal("At-risk deals (warning + critical)", { status: "warning,critical" })}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm text-left hover:bg-gray-50 transition-colors"
        >
          <p className="text-xs font-medium uppercase text-gray-500">At-risk $</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{formatShort(d.summary.atRiskAmount)}</p>
        </button>
        <button
          type="button"
          onClick={() => openListModal("Overdue next steps", { overdueOnly: "true" })}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm text-left hover:bg-gray-50 transition-colors"
        >
          <p className="text-xs font-medium uppercase text-gray-500">Overdue</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{d.summary.overdueNextStepsCount}</p>
        </button>
        <button
          type="button"
          onClick={() => openListModal("Stale touch (7+ days)", { staleOnly: "true" })}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm text-left hover:bg-gray-50 transition-colors"
        >
          <p className="text-xs font-medium uppercase text-gray-500">Stale touch</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{d.summary.staleTouchCount}</p>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top drivers */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Top risk drivers</h2>
          {d.topDrivers.length === 0 ? (
            <p className="text-sm text-gray-500">No risk signals in filtered set.</p>
          ) : (
            <ul className="space-y-2">
              {d.topDrivers.map((dr) => (
                <li
                  key={dr.code}
                  className="flex items-center justify-between rounded border border-gray-100 bg-gray-50/50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-gray-700">{dr.code}</span>
                  <span className="text-gray-600">
                    <button
                      type="button"
                      onClick={() => openListModal(`Deals with ${dr.code}`, { signalCode: dr.code })}
                      className="text-primary-600 hover:underline font-medium"
                    >
                      {dr.deals} deals
                    </button>
                    {" · "}
                    {formatCurrency(dr.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* By stage */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">By stage</h2>
          {d.byStage.length === 0 ? (
            <p className="text-sm text-gray-500">No data.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="py-2 pr-2">Stage</th>
                  <th className="py-2 pr-2">Deals</th>
                  <th className="py-2 pr-2">Amount</th>
                  <th className="py-2 pr-2">Avg days</th>
                  <th className="py-2">% critical</th>
                </tr>
              </thead>
              <tbody>
                {d.byStage.map((row) => (
                  <tr key={row.stage} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">{row.stage}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => openListModal(`Deals in ${row.stage}`, { stages: row.stage })}
                        className="text-primary-600 hover:underline font-medium"
                      >
                        {row.deals}
                      </button>
                    </td>
                    <td className="py-2 text-gray-700">{formatShort(row.amount)}</td>
                    <td className="py-2 text-gray-700">
                      {row.avgDaysInStage != null ? Math.round(row.avgDaysInStage) : "—"}
                    </td>
                    <td className="py-2 text-gray-700">{row.criticalPct.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </div>

      {/* Forecast panel */}
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Forecast</h2>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Total amount</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(d.forecast.totalAmount)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Weighted pipeline</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(d.forecast.weightedPipeline)}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-emerald-700">Commit amount</p>
            <p className="mt-1 text-lg font-semibold text-emerald-800">{formatCurrency(d.forecast.commitAmount)}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-emerald-700">Commit weighted</p>
            <p className="mt-1 text-lg font-semibold text-emerald-800">{formatCurrency(d.forecast.commitWeighted)}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-amber-700">Best case amount</p>
            <p className="mt-1 text-lg font-semibold text-amber-800">{formatCurrency(d.forecast.bestCaseAmount)}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-amber-700">Best case weighted</p>
            <p className="mt-1 text-lg font-semibold text-amber-800">{formatCurrency(d.forecast.bestCaseWeighted)}</p>
          </div>
        </div>
        {admin && d.forecast.byOwner.length > 0 && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm overflow-x-auto">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">By owner</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="py-2 pr-2">Owner</th>
                  <th className="py-2 pr-2">Pipeline $</th>
                  <th className="py-2 pr-2">Best case $</th>
                  <th className="py-2 pr-2">Commit $</th>
                  <th className="py-2">Weighted total</th>
                </tr>
              </thead>
              <tbody>
                {d.forecast.byOwner.map((row) => (
                  <tr key={row.ownerId} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">{row.ownerName || row.ownerId}</td>
                    <td className="py-2 text-gray-700">{formatCurrency(row.pipelineAmount)}</td>
                    <td className="py-2 text-gray-700">{formatCurrency(row.bestCaseAmount)}</td>
                    <td className="py-2 text-gray-700">{formatCurrency(row.commitAmount)}</td>
                    <td className="py-2 text-gray-700">{formatCurrency(row.weightedTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d.forecast.byStage.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm overflow-x-auto">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">By stage</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="py-2 pr-2">Stage</th>
                  <th className="py-2 pr-2">Pipeline $</th>
                  <th className="py-2 pr-2">Best case $</th>
                  <th className="py-2 pr-2">Commit $</th>
                  <th className="py-2">Weighted total</th>
                </tr>
              </thead>
              <tbody>
                {d.forecast.byStage.map((row) => (
                  <tr key={row.stage} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">{row.stage}</td>
                    <td className="py-2 text-gray-700">{formatCurrency(row.pipelineAmount)}</td>
                    <td className="py-2 text-gray-700">{formatCurrency(row.bestCaseAmount)}</td>
                    <td className="py-2 text-gray-700">{formatCurrency(row.commitAmount)}</td>
                    <td className="py-2 text-gray-700">{formatCurrency(row.weightedTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* At-risk queue */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">At-risk queue</h2>
          <span className="text-xs text-gray-500">
            {d.queue.total} total · page {d.queue.page}
          </span>
        </div>
        <div className="overflow-x-auto">
          {d.queue.items.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">No opportunities match the filters.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="py-2 px-3">Health</th>
                  <th className="py-2 px-3">Reasons</th>
                  <th className="py-2 px-3">Deal</th>
                  <th className="py-2 px-3">Stage</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Owner</th>
                  <th className="py-2 px-3">Last touch</th>
                  <th className="py-2 px-3">In stage</th>
                  <th className="py-2 px-3">Next step</th>
                  <th className="py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {d.queue.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                          item.healthStatus === "healthy"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.healthStatus === "warning"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.healthStatus === "healthy" && <CheckCircle className="h-3 w-3" />}
                        {item.healthStatus === "warning" && <AlertTriangle className="h-3 w-3" />}
                        {item.healthStatus === "critical" && <XCircle className="h-3 w-3" />}
                        {item.healthStatus} {item.healthScore != null ? `· ${item.healthScore}` : ""}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-0.5">
                        {(item.healthSignals ?? []).slice(0, 3).map((sig) => (
                          <span
                            key={sig.code}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700"
                          >
                            {sig.code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-medium text-gray-900">{item.name}</td>
                    <td className="py-2 px-3 text-gray-700">{item.stage}</td>
                    <td className="py-2 px-3 text-gray-700">
                      {item.amount != null ? formatCurrency(item.amount) : "—"}
                    </td>
                    <td className="py-2 px-3 text-gray-700">{item.owner.name ?? item.owner.email}</td>
                    <td className="py-2 px-3 text-gray-700">
                      {item.daysSinceLastTouch != null ? `${item.daysSinceLastTouch}d` : "—"}
                    </td>
                    <td className="py-2 px-3 text-gray-700">
                      {item.daysInStage != null ? `${item.daysInStage}d` : "—"}
                    </td>
                    <td className="py-2 px-3 text-gray-700">
                      {item.nextFollowUpAt
                        ? new Date(item.nextFollowUpAt).toLocaleDateString(undefined, {
                            dateStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="py-2 px-3">
                      <Link
                        href={
                          item.followup.hasDraft ||
                          item.followup.hasSuggestion ||
                          item.followup.hasOpenTask
                            ? `/opportunities/${item.id}#followups`
                            : `/opportunities/${item.id}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-accent-1 bg-white px-2 py-1 text-xs font-medium text-accent-1 hover:bg-accent-1/5"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {d.queue.items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-2">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={d.queue.page <= 1}
                onClick={() => setQuery({ page: d.queue.page - 1 })}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={d.queue.page * d.queue.pageSize >= d.queue.total}
                onClick={() => setQuery({ page: d.queue.page + 1 })}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {d.queue.items.length} of {d.queue.total} on this page
            </p>
          </div>
        )}
      </div>

      {/* List modal: opportunities for the clicked count */}
      <Modal
        isOpen={!!listModal}
        onClose={() => {
          setListModal(null);
          setListModalItems(null);
        }}
        title={listModal?.title ?? ""}
        contentClassName="max-w-[70vw]"
      >
        <div className="min-h-[120px]">
          {listModalLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : listModalItems && listModalItems.length === 0 ? (
            <p className="text-sm text-gray-500">No opportunities match.</p>
          ) : listModalItems ? (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
                    <th className="py-2 pr-2">Deal</th>
                    <th className="py-2 pr-2">Stage</th>
                    <th className="py-2 pr-2">Amount</th>
                    <th className="py-2 pr-2">Owner</th>
                    <th className="py-2 pr-2">Close %</th>
                    <th className="py-2 pr-2">Forecast</th>
                    <th className="py-2 pr-2">Health</th>
                    <th className="py-2">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {listModalItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-2 font-medium text-gray-900">{item.name}</td>
                      <td className="py-2 text-gray-700">{item.stage}</td>
                      <td className="py-2 text-gray-700">
                        {item.amount != null ? formatCurrency(item.amount) : "—"}
                      </td>
                      <td className="py-2 text-gray-700">{item.owner.name ?? item.owner.email}</td>
                      <td className="py-2 text-gray-700">
                        {item.winProbability != null ? `${item.winProbability}%` : "—"}
                      </td>
                      <td className="py-2 text-gray-700">
                        {item.forecastCategory === "commit"
                          ? "Commit"
                          : item.forecastCategory === "best_case"
                            ? "Best case"
                            : item.forecastCategory === "closed"
                              ? "Closed"
                              : item.forecastCategory === "pipeline"
                                ? "Pipeline"
                                : item.forecastCategory ?? "—"}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                            item.healthStatus === "healthy"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.healthStatus === "warning"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {item.healthStatus === "healthy" && <CheckCircle className="h-3 w-3" />}
                          {item.healthStatus === "warning" && <AlertTriangle className="h-3 w-3" />}
                          {item.healthStatus === "critical" && <XCircle className="h-3 w-3" />}
                          {item.healthStatus}
                        </span>
                      </td>
                      <td className="py-2">
                        <Link
                          href={
                            item.followup.hasDraft ||
                            item.followup.hasSuggestion ||
                            item.followup.hasOpenTask
                              ? `/opportunities/${item.id}#followups`
                              : `/opportunities/${item.id}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary-600 hover:underline font-medium"
                        >
                          <ExternalLink className="h-3 w-3" /> Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
