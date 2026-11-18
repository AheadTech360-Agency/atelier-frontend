import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ErrorNote, Input, Panel, Select, Skeleton, Tabs } from "../ui";
import { SortTh, num, pct, pos, sortRows } from "../seo";
import { PERIODS } from "./DashboardTab";
import type { GscRow } from "@/api-types/GscRow";

// Keep the host: www and bare-domain versions of a page are reported separately.
const short = (u: string) => u.replace(/^https?:\/\//, "");

/** Search Console by query or by page, sortable, the way an SEO tool lists them. */
export function GscTable({
  clientId,
  kind,
  days,
  limit,
  title,
  search,
}: {
  clientId: string;
  kind: "queries" | "pages";
  days: number;
  limit?: number;
  title?: string;
  search?: string;
}) {
  const [sort, setSort] = useState({ key: "clicks", desc: true });
  const q = useQuery({
    queryKey: ["gsc", clientId, kind, days, search ?? ""],
    queryFn: () => api.get<GscRow[]>(`/clients/${clientId}/gsc`, { kind, days, search: search || undefined }),
  });
  const rows = sortRows(q.data ?? [], sort).slice(0, limit ?? 200);
  const body = q.isLoading ? (
    <Skeleton rows={5} />
  ) : q.error ? (
    <ErrorNote error={q.error} />
  ) : !rows.length ? (
    <p className="px-4 py-6 text-center text-[13px] text-ink-3">
      {search ? "Nothing matches." : "No Search Console data for this period yet."}
    </p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13.5px]">
        <thead className="text-[12.5px] text-ink-3">
          <tr className="border-b border-line">
            <SortTh label={kind === "pages" ? "Page" : "Search"} k="dimension" sort={sort} setSort={setSort} />
            <SortTh label="Clicks" k="clicks" sort={sort} setSort={setSort} right />
            <SortTh label="Impressions" k="impressions" sort={sort} setSort={setSort} right />
            <SortTh label="CTR" k="ctr" sort={sort} setSort={setSort} right />
            <SortTh label="Position" k="position" sort={sort} setSort={setSort} right />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.dimension}>
              <td className="max-w-[44ch] truncate px-3 py-2" title={r.dimension}>
                {kind === "pages" ? (
                  <a href={r.dimension} target="_blank" rel="noreferrer noopener" className="hover:underline">{short(r.dimension)}</a>
                ) : (
                  <Link to="/research/keywords" search={{ k: r.dimension }} className="hover:underline">{r.dimension}</Link>
                )}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{num(r.clicks)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{num(r.impressions)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{pct(r.ctr)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{pos(r.position)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return title ? <Panel title={title}>{body}</Panel> : body;
}

/** Everything Search Console knows about the client's searches and pages. */
export function TrafficTab({ clientId }: { clientId: string }) {
  const [days, setDays] = useState(28);
  const [kind, setKind] = useState<"queries" | "pages">("queries");
  const [search, setSearch] = useState("");
  return (
    <Panel
      title="Search traffic"
      actions={
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Search" placeholder={kind === "pages" ? "Filter pages" : "Filter searches"} value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-44" />
          <Select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-8 w-auto">
            {PERIODS.map((p) => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
      }
    >
      <Tabs
        tabs={[
          { id: "queries", label: "Searches" },
          { id: "pages", label: "Pages" },
        ]}
        value={kind}
        onChange={(v) => setKind(v as "queries" | "pages")}
      />
      <GscTable clientId={clientId} kind={kind} days={days} search={search.trim()} />
      <p className="px-4 py-3 text-[12px] text-ink-3">
        From Google Search Console, saved daily by the SEO Lead. Only searches and pages that got clicks are kept.
      </p>
    </Panel>
  );
}
