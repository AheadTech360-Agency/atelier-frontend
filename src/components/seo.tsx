/** Building blocks for the SEO-tool screens: headline numbers, difficulty, health, research gate. */
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { api } from "@/lib/api";
import { cx } from "./ui";
import type { ResearchStatus } from "@/api-types/ResearchStatus";
import type { Kpi } from "@/api-types/Kpi";

const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const fullFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** 1,234 below ten thousand, 12.3K above. */
export function num(v: number | null | undefined, compact = true): string {
  if (v == null || Number.isNaN(v)) return "–";
  return compact && Math.abs(v) >= 10_000 ? compactFmt.format(v) : fullFmt.format(v);
}
export const usd = (v: number | null | undefined) => (v == null ? "–" : `$${v < 10 ? v.toFixed(2) : num(v)}`);
export const pct = (v: number | null | undefined, digits = 1) => (v == null ? "–" : `${(v * 100).toFixed(digits)}%`);
export const pos = (v: number | null | undefined) => (v == null ? "–" : v.toFixed(1));

/** Change from previous to current, as a share. Null when there's nothing to compare. */
export function change(k: Kpi | undefined): number | null {
  if (!k || k.current == null || k.previous == null || k.previous === 0) return null;
  return (k.current - k.previous) / Math.abs(k.previous);
}

export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value == null) return null;
  const good = invert ? value < 0 : value > 0;
  const flat = Math.abs(value) < 0.005;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-0.5 rounded px-1 text-[12px] font-medium tabular-nums",
        flat ? "bg-sunken text-ink-3" : good ? "bg-ok-soft text-ok" : "bg-p1-soft text-p1",
      )}
    >
      <Icon size={12} aria-hidden />
      {flat ? "0%" : `${Math.abs(value * 100).toFixed(value > 9.99 ? 0 : 1)}%`}
    </span>
  );
}

/** A headline number with its change, like the cards at the top of an SEO tool. */
export function StatCard({
  label,
  value,
  delta,
  invert,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  invert?: boolean;
  hint?: ReactNode;
  tone?: "accent";
}) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-surface p-4", tone === "accent" && "border-denim/40")}>
      <p className="text-[12.5px] font-medium text-ink-3">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-[26px] leading-none font-semibold tracking-tight tabular-nums">{value}</p>
        {delta !== undefined ? <Delta value={delta} invert={invert} /> : null}
      </div>
      {hint ? <p className="text-[12px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  const c = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" }[cols];
  return <div className={cx("grid grid-cols-2 gap-3", c)}>{children}</div>;
}

/** Keyword difficulty as an SEO tool shows it: a coloured dot, the number and a word. */
export function kdBand(kd: number | null | undefined): { label: string; color: string } {
  if (kd == null) return { label: "Unknown", color: "var(--color-line-strong)" };
  if (kd < 30) return { label: "Easy", color: "#2f9e5b" };
  if (kd < 50) return { label: "Possible", color: "#d6a21e" };
  if (kd < 70) return { label: "Hard", color: "#e0752d" };
  return { label: "Very hard", color: "#d23b3b" };
}

export function Kd({ value, wide = false }: { value: number | null | undefined; wide?: boolean }) {
  const b = kdBand(value);
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums" title={`SEO difficulty: ${b.label}`}>
      <span className="size-2.5 rounded-full" style={{ background: b.color }} aria-hidden />
      {value == null ? "–" : Math.round(value)}
      {wide ? <span className="text-ink-3">{b.label}</span> : null}
    </span>
  );
}

/** A half-circle score from 0 to 100. */
export function Gauge({ value, label, size = 140, color: fixed }: { value: number | null | undefined; label?: string; size?: number; color?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const color = fixed ?? (value == null ? "var(--color-line-strong)" : v >= 80 ? "#2f9e5b" : v >= 50 ? "#d6a21e" : "#d23b3b");
  const r = 52;
  const len = Math.PI * r;
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 120 68" width={size} aria-hidden>
        <path d="M8 62a52 52 0 0 1 104 0" fill="none" stroke="var(--color-sunken)" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M8 62a52 52 0 0 1 104 0"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * len} ${len}`}
        />
      </svg>
      <p className="-mt-9 text-[28px] leading-none font-semibold tabular-nums">{value == null ? "–" : Math.round(v)}</p>
      {label ? <p className="mt-1 text-[12.5px] text-ink-3">{label}</p> : null}
    </div>
  );
}

const INTENT_STYLE: Record<string, string> = {
  informational: "bg-denim-soft text-denim",
  commercial: "bg-p2-soft text-p2",
  transactional: "bg-ok-soft text-ok",
  navigational: "bg-p3-soft text-p3",
  local: "bg-p4-soft text-p4",
};

export function Intent({ value }: { value: string | null | undefined }) {
  if (!value || value === "unknown") return <span className="text-ink-3">–</span>;
  return (
    <span className={cx("rounded px-1.5 py-0.5 text-[12px] font-medium", INTENT_STYLE[value] ?? "bg-sunken text-ink-2")} title={value}>
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  );
}

export function useResearchStatus() {
  return useQuery({ queryKey: ["research-status"], queryFn: () => api.get<ResearchStatus>("/research/status"), staleTime: 60_000 });
}

/** Shown in place of research results until DataForSEO is connected on the server. */
export function ConnectDataForSeo() {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface p-6">
      <p className="font-medium">Connect DataForSEO to use the SEO tools</p>
      <p className="mt-1 max-w-[70ch] text-ink-2">
        Add <code className="rounded bg-sunken px-1">DATAFORSEO_LOGIN</code> and <code className="rounded bg-sunken px-1">DATAFORSEO_PASSWORD</code>{" "}
        (the API login from app.dataforseo.com, API Access) to the backend's settings on Railway. Lookups are cached for a day and capped per day,
        so nothing runs up a bill. Your saved client data below still works without it.
      </p>
    </div>
  );
}

export const COUNTRIES = [
  { code: 2840, label: "United States" },
  { code: 2826, label: "United Kingdom" },
  { code: 2124, label: "Canada" },
  { code: 2036, label: "Australia" },
];

/** A thin bar showing a share of a whole, for position distribution and the like. */
export function ShareBar({ parts }: { parts: { label: string; value: number | null | undefined; color: string }[] }) {
  const total = parts.reduce((s, p) => s + (p.value ?? 0), 0);
  if (!total) return <p className="text-[13px] text-ink-3">No ranking positions yet.</p>;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-sunken">
        {parts.map((p) => (
          <span key={p.label} style={{ width: `${((p.value ?? 0) / total) * 100}%`, background: p.color }} title={`${p.label}: ${num(p.value)}`} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
        {parts.map((p) => (
          <li key={p.label} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
            {p.label} <span className="tabular-nums text-ink">{num(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Column header that sorts a table. */
export function SortTh({
  label,
  k,
  sort,
  setSort,
  right,
}: {
  label: string;
  k: string;
  sort: { key: string; desc: boolean };
  setSort: (s: { key: string; desc: boolean }) => void;
  right?: boolean;
}) {
  const on = sort.key === k;
  return (
    <th className={cx("px-3 py-2 font-medium", right && "text-right")}>
      <button
        type="button"
        className={cx("inline-flex items-center gap-1 hover:text-ink", on && "text-ink")}
        onClick={() => setSort({ key: k, desc: on ? !sort.desc : true })}
      >
        {label}
        {on ? <span aria-hidden>{sort.desc ? "↓" : "↑"}</span> : null}
      </button>
    </th>
  );
}

export function sortRows<T>(rows: T[], sort: { key: string; desc: boolean }): T[] {
  const k = sort.key as keyof T;
  return [...rows].sort((a, b) => {
    const x = a[k] as unknown, y = b[k] as unknown;
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return sort.desc ? -c : c;
  });
}
