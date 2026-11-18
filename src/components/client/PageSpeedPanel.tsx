import { useQueries } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { ErrorNote, Panel, Skeleton, cx } from "../ui";
import type { MetricPoint } from "@/api-types/MetricPoint";

const METRICS = ["score", "lcp", "cls", "tbt"] as const;
type Metric = (typeof METRICS)[number];
const TEMPLATES = [
  { id: "template:home", label: "Home page", color: "var(--color-denim)" },
  { id: "template:collection", label: "Collection pages", color: "#d6a21e" },
  { id: "template:product", label: "Product pages", color: "#c0567a" },
];
/** Google's lines: good up to the first number, poor past the second. Score is the other way round. */
const BANDS: Record<Metric, { good: number; poor: number; higherIsBetter?: boolean }> = {
  score: { good: 90, poor: 50, higherIsBetter: true },
  lcp: { good: 2.5, poor: 4 },
  cls: { good: 0.1, poor: 0.25 },
  tbt: { good: 200, poor: 600 },
};
const fmt: Record<Metric, (v: number) => string> = {
  score: (v) => String(Math.round(v)),
  lcp: (v) => `${v.toFixed(1)} s`,
  cls: (v) => v.toFixed(2),
  tbt: (v) => `${Math.round(v)} ms`,
};
const HEAD: Record<Metric, { label: string; hint: string }> = {
  score: { label: "Speed score", hint: "Lighthouse performance, 0 to 100" },
  lcp: { label: "Largest paint", hint: "LCP: when the main content shows" },
  cls: { label: "Layout shift", hint: "CLS: how much the page jumps" },
  tbt: { label: "Blocking time", hint: "TBT: how long taps wait" },
};

function rating(m: Metric, v: number) {
  const b = BANDS[m];
  const good = b.higherIsBetter ? v >= b.good : v <= b.good;
  const poor = b.higherIsBetter ? v < b.poor : v > b.poor;
  return good ? "good" : poor ? "poor" : "fix";
}
const TONE = { good: "text-ok", fix: "text-p2", poor: "text-p1" };
const WORD = { good: "Good", fix: "Needs work", poor: "Poor" };

/** Mobile speed per page type, from the Technical Auditor's weekly DataForSEO Lighthouse checks. */
export function PageSpeedPanel({ clientId }: { clientId: string }) {
  const from = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
  const qs = useQueries({
    queries: METRICS.map((metric) => ({
      queryKey: ["metrics", clientId, "pagespeed", metric],
      queryFn: () => api.get<MetricPoint[]>("/metrics", { client_id: clientId, source: "pagespeed", metric, from }),
    })),
  });
  if (qs.some((q) => q.isLoading)) return <Skeleton rows={3} />;
  const err = qs.find((q) => q.error)?.error;
  if (err) return <ErrorNote error={err} />;
  const points: Record<Metric, MetricPoint[]> = Object.fromEntries(METRICS.map((m, i) => [m, qs[i].data ?? []])) as Record<Metric, MetricPoint[]>;

  // Latest and previous check per template and metric.
  const latest = (m: Metric, t: string) => {
    const rows = points[m].filter((p) => p.dimension === t).sort((a, b) => b.observed_on.localeCompare(a.observed_on));
    return { now: rows[0], before: rows[1] };
  };
  const templates = TEMPLATES.filter((t) => METRICS.some((m) => latest(m, t.id).now));
  const lastCheck = METRICS.flatMap((m) => points[m].map((p) => p.observed_on)).sort().at(-1);

  // Score history: one row per check day, one column per template.
  const days = [...new Set(points.score.map((p) => p.observed_on))].sort();
  const history = days.map((d) => {
    const row: Record<string, string | number | null> = { day: d };
    for (const t of TEMPLATES) row[t.id] = points.score.find((p) => p.observed_on === d && p.dimension === t.id)?.value ?? null;
    return row;
  });

  return (
    <Panel title="Page speed on phones">
      {!templates.length ? (
        <p className="px-4 py-6 text-center text-[13px] text-ink-3">
          No speed checks yet. The Technical Auditor runs Lighthouse on the home page, collections and products every Monday.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px]">
              <thead className="text-[12.5px] text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium">Page type</th>
                  {METRICS.map((m) => (
                    <th key={m} className="px-3 py-2 text-right font-medium" title={HEAD[m].hint}>
                      {HEAD[m].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2.5 font-medium">{t.label}</td>
                    {METRICS.map((m) => {
                      const { now, before } = latest(m, t.id);
                      if (!now) return <td key={m} className="px-3 py-2.5 text-right text-ink-3">–</td>;
                      const r = rating(m, now.value);
                      const moved = before ? now.value - before.value : 0;
                      const better = BANDS[m].higherIsBetter ? moved > 0 : moved < 0;
                      return (
                        <td key={m} className="px-3 py-2.5 text-right tabular-nums">
                          <span className={cx("font-semibold", TONE[r])}>{fmt[m](now.value)}</span>
                          <span className={cx("block text-[11.5px]", TONE[r])}>{WORD[r]}</span>
                          {before && Math.abs(moved) > 1e-9 ? (
                            <span className={cx("block text-[11.5px]", better ? "text-ok" : "text-p1")}>
                              {better ? "Better" : "Worse"} than last check
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.length > 1 ? (
            <div className="h-52 px-2 pt-2 pb-3">
              <ResponsiveContainer>
                <LineChart data={history} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={dateLabel} tick={{ fontSize: 11, fill: "var(--color-ink-3)" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--color-ink-3)" }} tickLine={false} axisLine={false} width={32} />
                  <Tooltip
                    labelFormatter={(d) => `Check on ${dateLabel(String(d))}`}
                    contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: 6, fontSize: 13 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {TEMPLATES.map((t) => (
                    <Line key={t.id} dataKey={t.id} name={t.label} stroke={t.color} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          <p className="px-4 pb-3 text-[12px] text-ink-3">
            Lab test on a mid-range phone (DataForSEO Lighthouse), averaged per page type. Last check {lastCheck ? dateLabel(lastCheck) : "–"}, compared with the one before. Google counts LCP up to 2.5 s,
            layout shift up to 0.1 and blocking time up to 200 ms as good.
          </p>
        </>
      )}
    </Panel>
  );
}
