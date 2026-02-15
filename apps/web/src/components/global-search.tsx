"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
}

interface SearchResults {
  q: string;
  results: {
    accounts: SearchResultItem[];
    contacts: SearchResultItem[];
    leads: SearchResultItem[];
    opportunities: SearchResultItem[];
  };
}

const SECTIONS = [
  { key: "accounts" as const, label: "Accounts" },
  { key: "contacts" as const, label: "Contacts" },
  { key: "leads" as const, label: "Leads" },
  { key: "opportunities" as const, label: "Opportunities" },
] as const;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResults | null>(null);
  const [selected, setSelected] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 200);

  const flatItems = (() => {
    if (!data) return [];
    const items: { type: keyof SearchResults["results"]; item: SearchResultItem }[] = [];
    for (const { key } of SECTIONS) {
      for (const item of data.results[key]) {
        items.push({ type: key, item });
      }
    }
    return items;
  })();

  const fetchSearch = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<SearchResults>(
        `/search?q=${encodeURIComponent(q.trim())}&limit=5`
      );
      setData(res);
      setSelected(-1);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearch(debouncedQuery);
  }, [debouncedQuery, fetchSearch]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !open) {
        const target = e.target as HTMLElement;
        const tag = target.tagName.toLowerCase();
        if (tag !== "input" && tag !== "textarea" && !target.isContentEditable) {
          e.preventDefault();
          inputRef.current?.focus();
          setOpen(true);
        }
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
        setSelected(-1);
      }
      if (open && flatItems.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelected((s) => (s < flatItems.length - 1 ? s + 1 : 0));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelected((s) => (s > 0 ? s - 1 : flatItems.length - 1));
        } else if (e.key === "Enter" && selected >= 0) {
          e.preventDefault();
          const { type, item } = flatItems[selected];
          router.push(`/${type}/${item.id}`);
          setOpen(false);
          setQuery("");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, flatItems, selected, router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        open &&
        panelRef.current &&
        inputRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const navigateTo = (type: string, id: string) => {
    router.push(`/${type}/${id}`);
    setOpen(false);
    setQuery("");
  };

  const hasResults = data && Object.values(data.results).some((arr) => arr.length > 0);
  const showPanel = open && (query.length >= 2 || (data && data.q.length >= 2));

  return (
    <div className="relative" ref={panelRef}>
      <input
        ref={inputRef}
        type="search"
        placeholder='Search... (press "/")'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        className="w-52 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/40 focus:border-accent-1 focus:outline-none focus:ring-1 focus:ring-accent-1"
        aria-label="Search"
      />
      {showPanel && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-xl"
          role="listbox"
        >
          {loading ? (
            <div className="px-4 py-6 text-center text-sm text-white/60">
              Searching...
            </div>
          ) : !hasResults ? (
            <div className="px-4 py-6 text-center text-sm text-white/60">
              No results for &quot;{data?.q ?? query}&quot;
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-2">
              {SECTIONS.map(({ key, label }) => {
                const items = data!.results[key];
                if (!items.length) return null;
                return (
                  <div key={key} className="mb-2 last:mb-0">
                    <div className="px-3 py-1 text-xs font-medium text-white/50 uppercase tracking-wider">
                      {label}
                    </div>
                    {items.map((item, i) => {
                      const flatIndex = flatItems.findIndex(
                        (f) => f.type === key && f.item.id === item.id
                      );
                      const isSelected = flatIndex === selected;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => navigateTo(key, item.id)}
                          onMouseEnter={() => setSelected(flatIndex)}
                          className={`flex w-full flex-col items-start px-3 py-2 text-left transition-colors ${
                            isSelected ? "bg-accent-1/15 text-accent-1" : "text-white/90 hover:bg-white/5"
                          }`}
                        >
                          <span className="text-sm font-medium">{item.title}</span>
                          {item.subtitle && (
                            <span className="text-xs text-white/60">{item.subtitle}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
