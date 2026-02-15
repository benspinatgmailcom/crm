"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { canWrite } from "@/lib/roles";

interface PipelineOpportunity {
  id: string;
  name: string;
  amount: { toString(): string } | null;
  closeDate: string | null;
  stage: string | null;
  accountId: string;
  accountName: string;
}

type PipelineData = Record<string, PipelineOpportunity[]>;

const STAGE_ORDER = [
  "prospecting",
  "qualification",
  "discovery",
  "proposal",
  "negotiation",
  "closed-won",
  "closed-lost",
  "_other",
] as const;

const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting",
  qualification: "Qualification",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  "closed-won": "Closed Won",
  "closed-lost": "Closed Lost",
  _other: "Other",
};

const STAGE_PROBABILITIES: Record<string, number> = {
  prospecting: 0.1,
  qualification: 0.2,
  discovery: 0.35,
  proposal: 0.55,
  negotiation: 0.75,
  "closed-won": 1.0,
  "closed-lost": 0.0,
  _other: 0.1,
};

function toNumber(amount: { toString(): string } | null): number {
  if (amount == null) return 0;
  const n = Number(amount.toString());
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(amount: { toString(): string } | null): string {
  if (amount == null) return "—";
  const n = toNumber(amount);
  return formatCurrency(n);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

type CloseFilter = "all" | "30" | "60" | "90" | "qtr";

function getCloseDateRange(close: CloseFilter): { start: Date; end: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (close === "all") return null;
  const end = new Date(today);
  if (close === "30") end.setDate(end.getDate() + 30);
  else if (close === "60") end.setDate(end.getDate() + 60);
  else if (close === "90") end.setDate(end.getDate() + 90);
  else if (close === "qtr") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    end.setMonth(q * 3, 0);
    end.setHours(23, 59, 59, 999);
    return { start: new Date(now.getFullYear(), (q - 1) * 3, 1), end };
  }
  return { start: today, end };
}

function matchesCloseFilter(
  closeDate: string | null,
  close: CloseFilter
): boolean {
  if (close === "all") return true;
  if (!closeDate) return false;
  const range = getCloseDateRange(close);
  if (!range) return true;
  const d = new Date(closeDate);
  return d >= range.start && d <= range.end;
}

function applyFilters(
  raw: PipelineData,
  filters: {
    close: CloseFilter;
    min: number | "";
    max: number | "";
    account: string;
    includeClosed: boolean;
  }
): PipelineData {
  const { close, min, max, account, includeClosed } = filters;
  const accountLower = account.trim().toLowerCase();
  const minVal = min === "" ? -Infinity : Number(min);
  const maxVal = max === "" ? Infinity : Number(max);
  const hasMin = min !== "";
  const hasMax = max !== "";

  const result: PipelineData = {};
  for (const stageId of STAGE_ORDER) {
    const list = raw[stageId] ?? [];
    let filtered = list;
    if (!includeClosed && (stageId === "closed-won" || stageId === "closed-lost")) {
      filtered = [];
    } else {
      filtered = list.filter((o) => {
        if (!matchesCloseFilter(o.closeDate, close)) return false;
        if (accountLower && !o.accountName.toLowerCase().includes(accountLower))
          return false;
        if (hasMin || hasMax) {
          if (o.amount == null) return false;
          const amt = toNumber(o.amount);
          if (hasMin && amt < minVal) return false;
          if (hasMax && amt > maxVal) return false;
        }
        return true;
      });
    }
    result[stageId] = filtered;
  }
  return result;
}

// Draggable card – uses useDraggable; when canDrag=false, card is still rendered but not draggable
function DraggableCard({
  opp,
  canDrag,
}: {
  opp: PipelineOpportunity;
  canDrag: boolean;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: opp.id,
    data: { opp, stage: opp.stage },
    disabled: !canDrag,
  });

  const cardContent = (
    <>
      <div className="text-sm font-medium text-gray-900">{opp.name}</div>
      <div className="mt-1 text-xs text-gray-500">{opp.accountName}</div>
      <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
        <span>{formatAmount(opp.amount)}</span>
        <span>
          {opp.closeDate ? new Date(opp.closeDate).toLocaleDateString() : "—"}
        </span>
      </div>
    </>
  );

  if (!canDrag) {
    return (
      <div
        onClick={() => router.push(`/opportunities/${opp.id}`)}
        className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md hover:border-accent-1/30"
      >
        {cardContent}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => router.push(`/opportunities/${opp.id}`)}
      className={`cursor-grab active:cursor-grabbing rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md hover:border-accent-1/30 ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      {cardContent}
    </div>
  );
}

function DroppableColumn({
  stageId,
  opportunities,
  stageTotal,
  canEdit,
}: {
  stageId: string;
  opportunities: PipelineOpportunity[];
  stageTotal: number;
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stageId,
    data: { stage: stageId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[120px] min-w-[260px] flex-col rounded-lg border-2 border-dashed p-3 transition-colors ${
        isOver ? "border-accent-1 bg-accent-1/5" : "border-gray-200 bg-gray-50/50"
      }`}
    >
      <div className="mb-2 space-y-0.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            {STAGE_LABELS[stageId] ?? stageId}
          </h3>
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
            {opportunities.length}
          </span>
        </div>
        {stageTotal > 0 && (
          <p className="text-xs text-gray-500">{formatCurrency(stageTotal)}</p>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {opportunities.map((opp) => (
          <DraggableCard key={opp.id} opp={opp} canDrag={canEdit} />
        ))}
      </div>
    </div>
  );
}

const CLOSE_OPTIONS: { value: CloseFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "30", label: "Next 30 days" },
  { value: "60", label: "Next 60 days" },
  { value: "90", label: "Next 90 days" },
  { value: "qtr", label: "This quarter" },
];

const DEFAULT_FILTERS = {
  close: "all" as CloseFilter,
  min: "" as number | "",
  max: "" as number | "",
  account: "",
  includeClosed: false,
};

export default function PipelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const canEdit = canWrite(user?.role);
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [filters, setFilters] = useState(() => {
    const close = (searchParams.get("close") || "all") as CloseFilter;
    const minRaw = searchParams.get("min");
    const maxRaw = searchParams.get("max");
    const account = searchParams.get("account") || "";
    const closed = searchParams.get("closed");
    const minNum = minRaw != null && minRaw !== "" ? Number(minRaw) : NaN;
    const maxNum = maxRaw != null && maxRaw !== "" ? Number(maxRaw) : NaN;
    return {
      close: CLOSE_OPTIONS.some((o) => o.value === close) ? close : "all",
      min: Number.isFinite(minNum) ? minNum : ("" as number | ""),
      max: Number.isFinite(maxNum) ? maxNum : ("" as number | ""),
      account,
      includeClosed: closed === "1",
    };
  });

  const [accountInput, setAccountInput] = useState(() =>
    searchParams.get("account") || ""
  );

  const syncUrl = useCallback(
    (f: typeof filters) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("close", f.close);
      if (f.min !== "") params.set("min", String(f.min));
      else params.delete("min");
      if (f.max !== "") params.set("max", String(f.max));
      else params.delete("max");
      if (f.account.trim()) params.set("account", f.account.trim());
      else params.delete("account");
      params.set("closed", f.includeClosed ? "1" : "0");
      router.replace(`/opportunities/pipeline?${params.toString()}`, {
        scroll: false,
      });
    },
    [router, searchParams]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((prev) => {
        if (prev.account === accountInput) return prev;
        const next = { ...prev, account: accountInput };
        syncUrl(next);
        return next;
      });
    }, 300);
    return () => clearTimeout(t);
  }, [accountInput, syncUrl]);

  const updateFilter = useCallback(
    <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value };
        syncUrl(next);
        return next;
      });
      if (key === "account") setAccountInput(String(value));
    },
    [syncUrl]
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setAccountInput("");
    syncUrl(DEFAULT_FILTERS);
  }, [syncUrl]);

  const filteredData = useMemo(() => {
    if (!data) return null;
    return applyFilters(data, filters);
  }, [data, filters]);

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<PipelineData>("/opportunities/pipeline");
      setData(res ?? {});
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !data || !canEdit) return;
      const oppId = String(active.id);
      const newStage = String(over.id);
      if (!STAGE_ORDER.includes(newStage as (typeof STAGE_ORDER)[number])) return;

      const opp = Object.values(data).flat().find((o) => o.id === oppId);
      const oldStage = opp?.stage || "qualification";
      const normalizedOld =
        STAGE_ORDER.includes(oldStage as (typeof STAGE_ORDER)[number])
          ? oldStage
          : "_other";
      if (normalizedOld === newStage) return;

      const movedToClosed =
        (newStage === "closed-won" || newStage === "closed-lost") &&
        !filters.includeClosed;

      // Optimistic update
      const prev = JSON.parse(JSON.stringify(data)) as PipelineData;
      for (const stage of Object.keys(prev)) {
        prev[stage] = prev[stage].filter((o) => o.id !== oppId);
      }
      const moved = Object.values(data).flat().find((o) => o.id === oppId);
      if (moved) {
        prev[newStage] = [...(prev[newStage] ?? []), { ...moved, stage: newStage }];
      }
      setData(prev);

      if (movedToClosed) {
        showToast("Opportunity moved but is hidden by current filters.");
      }

      try {
        await apiFetch(`/opportunities/${oppId}`, {
          method: "PATCH",
          body: JSON.stringify({ stage: newStage === "_other" ? "prospecting" : newStage }),
        });
      } catch {
        setData(data);
      }
    },
    [data, canEdit, filters.includeClosed, showToast]
  );

  const viewToggle = (
    <div className="flex rounded-lg border border-gray-200 p-0.5">
      <Link
        href="/opportunities"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
      >
        List
      </Link>
      <Link
        href="/opportunities/pipeline"
        className="rounded-md bg-accent-1 px-3 py-1.5 text-sm font-medium text-white"
      >
        Pipeline
      </Link>
    </div>
  );

  if (loading) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">
            Opportunity Pipeline
          </h1>
          {viewToggle}
        </div>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">
            Opportunity Pipeline
          </h1>
          {viewToggle}
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  const hasActiveFilters =
    filters.close !== "all" ||
    filters.min !== "" ||
    filters.max !== "" ||
    filters.account.trim() !== "" ||
    filters.includeClosed;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">
          Opportunity Pipeline
        </h1>
        {viewToggle}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-slate-50/80 px-4 py-3 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Filters
        </span>
        <select
          value={filters.close}
          onChange={(e) =>
            updateFilter("close", e.target.value as CloseFilter)
          }
          className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
        >
          {CLOSE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            step={1}
            placeholder="Min $"
            value={filters.min === "" ? "" : filters.min}
            onChange={(e) =>
              updateFilter(
                "min",
                e.target.value === "" ? "" : Number(e.target.value)
              )
            }
            className="w-24 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-gray-400 focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
          />
          <span className="text-gray-400">–</span>
          <input
            type="number"
            min={0}
            step={1}
            placeholder="Max $"
            value={filters.max === "" ? "" : filters.max}
            onChange={(e) =>
              updateFilter(
                "max",
                e.target.value === "" ? "" : Number(e.target.value)
              )
            }
            className="w-24 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-gray-400 focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
          />
        </div>
        <input
          type="text"
          placeholder="Account..."
          value={accountInput}
          onChange={(e) => setAccountInput(e.target.value)}
          className="w-36 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-gray-400 focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
        />
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={filters.includeClosed}
            onChange={(e) => updateFilter("includeClosed", e.target.checked)}
            className="rounded border-gray-300 text-accent-1 focus:ring-accent-1"
          />
          <span className="text-gray-600">Include closed</span>
        </label>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200/80 hover:text-gray-900"
          >
            Clear filters
          </button>
        )}
      </div>

      {toast && (
        <div className="mb-3 rounded-lg border border-accent-1/30 bg-accent-1/10 px-4 py-2 text-sm text-gray-800">
          {toast}
        </div>
      )}

      {(() => {
        const allOpps = Object.values(filteredData ?? {}).flat();
        const pipelineTotal = allOpps
          .filter((o) => (o.stage || "_other") !== "closed-lost")
          .reduce((sum, o) => sum + toNumber(o.amount), 0);
        const openTotal = allOpps
          .filter(
            (o) =>
              (o.stage || "_other") !== "closed-won" &&
              (o.stage || "_other") !== "closed-lost"
          )
          .reduce((sum, o) => sum + toNumber(o.amount), 0);
        const weightedForecast = allOpps.reduce((sum, o) => {
          const amt = toNumber(o.amount);
          const stage = o.stage || "_other";
          const prob =
            STAGE_PROBABILITIES[stage] ?? STAGE_PROBABILITIES._other ?? 0.1;
          return sum + amt * prob;
        }, 0);

        return (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-2 text-sm">
              <span className="text-gray-500">Pipeline Total:</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(pipelineTotal)}
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">Open:</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(openTotal)}
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">Weighted Forecast:</span>
              <span className="font-medium text-accent-1">
                {formatCurrency(weightedForecast)}
              </span>
            </div>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {STAGE_ORDER.map((stageId) => {
                  const opps = filteredData?.[stageId] ?? [];
                  const stTotal = opps.reduce(
                    (sum, o) => sum + toNumber(o.amount),
                    0
                  );
                  return (
                    <DroppableColumn
                      key={stageId}
                      stageId={stageId}
                      opportunities={opps}
                      stageTotal={stTotal}
                      canEdit={canEdit}
                    />
                  );
                })}
              </div>
            </DndContext>
          </>
        );
      })()}
    </div>
  );
}
