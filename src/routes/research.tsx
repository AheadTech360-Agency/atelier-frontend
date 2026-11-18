import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExternalLink, Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { usePageTitle } from "@/lib/title";
import { useClients } from "@/components/Shell";
import { Button, ErrorNote, Input, PageHeader, Panel, Select, Skeleton, Tabs, cx, errorText, useToast } from "@/components/ui";
import {
  COUNTRIES,
  ConnectDataForSeo,
  Gauge,
  Intent,
  Kd,
  ShareBar,
  kdBand,
  SortTh,
  StatCard,
  StatGrid,
  num,
  pct,
  sortRows,
  usd,
  useResearchStatus,
} from "@/components/seo";
import type { DomainOverview } from "@/api-types/DomainOverview";
import type { KeywordOverview } from "@/api-types/KeywordOverview";
import type { KeywordIdea } from "@/api-types/KeywordIdea";
import type { BacklinkOverview } from "@/api-types/BacklinkOverview";

const AXIS = { fontSize: 11, fill: "var(--color-ink-3)" };
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
};
const short = (u: string | null | undefined) => (u ?? "").replace(/^https?:\/\/(www\.)?/, "");

// Shared ----------------------------------------------------------------------------------------

function SearchBar({
  placeholder,
  initial,
  country,
  onSearch,
  busy,
}: {
  placeholder: string;
  initial: string;
  country: number;
  onSearch: (q: string, country: number) => void;
  busy?: boolean;
}) {
  const [q, setQ] = useState(initial);
  const [c, setC] = useState(country);
  useEffect(() => setQ(initial), [initial]);
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) onSearch(q.trim(), c);
      }}
    >
      <div className="relative min-w-[260px] flex-1">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input aria-label={placeholder} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} className="h-10 w-full pl-9 text-[15px]" />
      </div>
      <Select aria-label="Country" value={c} onChange={(e) => setC(Number(e.target.value))} className="h-10 w-auto">
        {COUNTRIES.map((x) => (
          <option key={x.code} value={x.code}>
            {x.label}
          </option>
        ))}
      </Select>
      <Button variant="primary" className="h-10 px-5" busy={busy} disabled={!q.trim()}>
        Search
      </Button>
    </form>
  );
}

/** Which client "Add" buttons save to. Defaults to the client picked in the header. */
function useTargetClient() {
  const { clientScope } = useSession();
  const clients = useClients();
  const [pick, setPick] = useState<string>("");
  const list = clients.data ?? [];
  const id = pick || (clientScope !== "all" ? clientScope : list[0]?.id) || "";
  const picker =
    list.length > 1 ? (
      <label className="flex items-center gap-2 text-[13px] text-ink-3">
        Save to
        <Select aria-label="Save to client" value={id} onChange={(e) => setPick(e.target.value)} className="h-8 w-auto">
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </label>
    ) : null;
  return { id, name: list.find((c) => c.id === id)?.name, picker };
}

function AddKeyword({
  clientId,
  clientName,
  keyword,
  intent,
  wide,
}: {
  clientId: string;
  clientName?: string;
  keyword: string;
  intent?: string | null;
  wide?: boolean;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [done, setDone] = useState(false);
  const add = useMutation({
    mutationFn: () =>
      api.post(`/clients/${clientId}/target-keywords`, {
        keyword,
        intent: intent && intent !== "unknown" ? intent : null,
        priority: null,
        notes: "Added from keyword research",
      }),
    onSuccess: () => {
      setDone(true);
      qc.invalidateQueries({ queryKey: ["target-keywords", clientId] });
      toast(`"${keyword}" added to ${clientName ?? "the client"}'s target keywords`);
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  if (!clientId) return null;
  if (wide)
    return (
      <Button size="sm" disabled={done} busy={add.isPending} onClick={() => add.mutate()}>
        {done ? "Added" : `Add to ${clientName ?? "client"}'s keywords`}
      </Button>
    );
  return (
    <button
      type="button"
      disabled={done || add.isPending}
      onClick={() => add.mutate()}
      title={`Add to ${clientName ?? "client"}'s target keywords`}
      className="inline-flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink disabled:text-ok"
    >
      {done ? "✓" : <Plus size={15} aria-label={`Add ${keyword} to target keywords`} />}
    </button>
  );
}

function PartErrors({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div className="rounded-lg border border-p2/30 bg-p2-soft px-4 py-3 text-[13px] text-p2">
      Some data didn't load: {errors.join(" · ")}
    </div>
  );
}

function Fetched({ at }: { at: string }) {
  return <p className="text-[12px] text-ink-3">Data from DataForSEO, {new Date(at).toLocaleString()}. Cached for 24 hours.</p>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-[13px] text-ink-3">{children}</p>;
}

// Domain overview -------------------------------------------------------------------------------

export function DomainResearchPage() {
  usePageTitle("Domain overview");
  const { d = "", c } = useSearch({ from: "/research/domain" });
  const navigate = useNavigate({ from: "/research/domain" });
  const country = c ? Number(c) : 2840;
  const status = useResearchStatus();
  const { clientScope } = useSession();
  const clients = useClients();
  const fallback = clients.data?.find((x) => x.id === clientScope)?.domain ?? "";
  const q = useQuery({
    queryKey: ["research", "domain", d, country],
    queryFn: () => api.get<DomainOverview>("/research/domain", { target: d, location_code: country }),
    enabled: !!d && !!status.data?.configured,
    staleTime: 3_600_000,
    retry: false,
  });
  const target = useTargetClient();

  return (
    <div>
      <PageHeader title="Domain overview" description="Organic traffic, keywords, top pages and competitors for any website." actions={target.picker} />
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <SearchBar
          placeholder="Enter a domain, e.g. vuori.com"
          initial={d || fallback}
          country={country}
          busy={q.isFetching}
          onSearch={(v, cc) => navigate({ search: { d: v, c: String(cc) } })}
        />
        {status.data && !status.data.configured ? <ConnectDataForSeo /> : null}
        {!d ? null : q.isLoading ? (
          <Skeleton rows={8} />
        ) : q.error ? (
          <ErrorNote error={q.error} />
        ) : q.data ? (
          <DomainReport data={q.data} clientId={target.id} clientName={target.name} />
        ) : null}
      </div>
    </div>
  );
}

function DomainReport({ data: o, clientId, clientName }: { data: DomainOverview; clientId: string; clientName?: string }) {
  const [tab, setTab] = useState("keywords");
  const [sort, setSort] = useState({ key: "traffic", desc: true });
  const toast = useToast();
  const qc = useQueryClient();
  const addComp = useMutation({
    mutationFn: (domain: string) => api.post(`/clients/${clientId}/competitors`, { domain, name: null, notes: `Added from the domain overview of ${o.domain}` }),
    onSuccess: (_r, domain) => {
      qc.invalidateQueries({ queryKey: ["competitors", clientId] });
      toast(`${domain} added to ${clientName ?? "the client"}'s competitors`);
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const top3 = (o.pos_1 ?? 0) + (o.pos_2_3 ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[20px] font-semibold">
          <a href={`https://${o.domain}`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 hover:underline">
            {o.domain} <ExternalLink size={14} />
          </a>
        </h2>
        <div className="flex items-center gap-3">
          <Link to="/research/backlinks" search={{ d: o.domain }} className="text-[13px] text-denim hover:underline">
            Backlinks for {o.domain}
          </Link>
          <Fetched at={o.fetched_at} />
        </div>
      </div>
      <PartErrors errors={o.errors} />
      <StatGrid cols={4}>
        <StatCard label="Organic keywords" value={num(o.organic_keywords)} hint="Keywords it ranks for in the top 100" />
        <StatCard label="Organic traffic / month" value={num(o.organic_traffic)} hint="Estimated visits from Google" tone="accent" />
        <StatCard label="Traffic value / month" value={usd(o.traffic_value)} hint="What that traffic would cost in ads" />
        <StatCard label="Keywords in the top 3" value={num(top3)} hint={`${num(o.pos_1)} at position 1`} />
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Organic traffic over time">
          {o.history.length ? (
            <div className="h-64 px-2 pb-3">
              <ResponsiveContainer>
                <ComposedChart data={o.history} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="t" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => num(v)} width={48} />
                  <YAxis yAxisId="k" orientation="right" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => num(v)} width={40} />
                  <Tooltip labelFormatter={(m) => monthLabel(String(m))} formatter={(v, n) => [num(Number(v), false), n === "traffic" ? "Traffic" : "Keywords"]} />
                  <Area yAxisId="t" type="monotone" dataKey="traffic" stroke="var(--color-denim)" fill="var(--color-denim-soft)" strokeWidth={2} />
                  <Line yAxisId="k" type="monotone" dataKey="keywords" stroke="#d6a21e" strokeWidth={1.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>No traffic history for this domain.</Empty>
          )}
        </Panel>
        <Panel title="Ranking positions">
          <div className="p-4">
            <ShareBar
              parts={[
                { label: "1", value: o.pos_1, color: "#1b6c80" },
                { label: "2-3", value: o.pos_2_3, color: "#3d93a8" },
                { label: "4-10", value: o.pos_4_10, color: "#7bbccb" },
                { label: "11-20", value: o.pos_11_20, color: "#d6a21e" },
                { label: "21-100", value: o.pos_21_100, color: "#cdced1" },
              ]}
            />
          </div>
        </Panel>
      </div>

      <Panel>
        <Tabs
          tabs={[
            { id: "keywords", label: "Top keywords", count: o.top_keywords.length },
            { id: "pages", label: "Top pages", count: o.top_pages.length },
            { id: "competitors", label: "Competitors", count: o.competitors.length },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="overflow-x-auto">
          {tab === "keywords" ? (
            o.top_keywords.length ? (
              <table className="w-full text-left text-[13.5px]">
                <thead className="text-[12.5px] text-ink-3">
                  <tr className="border-b border-line">
                    <SortTh label="Keyword" k="keyword" sort={sort} setSort={setSort} />
                    <SortTh label="Position" k="position" sort={sort} setSort={setSort} right />
                    <SortTh label="Volume" k="search_volume" sort={sort} setSort={setSort} right />
                    <SortTh label="SD" k="difficulty" sort={sort} setSort={setSort} />
                    <SortTh label="CPC" k="cpc" sort={sort} setSort={setSort} right />
                    <SortTh label="Est. visits" k="traffic" sort={sort} setSort={setSort} right />
                    <th className="px-3 py-2 font-medium">Intent</th>
                    <th className="px-3 py-2 font-medium">URL</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sortRows(o.top_keywords, sort).map((k) => (
                    <tr key={k.keyword}>
                      <td className="px-3 py-2 font-medium">
                        <Link to="/research/keywords" search={{ k: k.keyword }} className="hover:underline">
                          {k.keyword}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{k.position ?? "–"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(k.search_volume)}</td>
                      <td className="px-3 py-2"><Kd value={k.difficulty} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{usd(k.cpc)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(k.traffic)}</td>
                      <td className="px-3 py-2"><Intent value={k.intent} /></td>
                      <td className="max-w-[28ch] truncate px-3 py-2 text-ink-2" title={k.url ?? ""}>{short(k.url)}</td>
                      <td className="px-1"><AddKeyword clientId={clientId} clientName={clientName} keyword={k.keyword} intent={k.intent} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No ranking keywords found.</Empty>
            )
          ) : tab === "pages" ? (
            o.top_pages.length ? (
              <table className="w-full text-left text-[13.5px]">
                <thead className="text-[12.5px] text-ink-3">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2 font-medium">Page</th>
                    <th className="px-3 py-2 text-right font-medium">Keywords</th>
                    <th className="px-3 py-2 text-right font-medium">Est. visits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {o.top_pages.map((p) => (
                    <tr key={p.url}>
                      <td className="max-w-[60ch] truncate px-3 py-2">
                        <a href={p.url} target="_blank" rel="noreferrer noopener" className="hover:underline" title={p.url}>{short(p.url)}</a>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(p.keywords)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(p.traffic)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No top pages found.</Empty>
            )
          ) : o.competitors.length ? (
            <table className="w-full text-left text-[13.5px]">
              <thead className="text-[12.5px] text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 font-medium">Domain</th>
                  <th className="px-3 py-2 text-right font-medium">Shared keywords</th>
                  <th className="px-3 py-2 text-right font-medium">Their keywords</th>
                  <th className="px-3 py-2 text-right font-medium">Their traffic</th>
                  <th className="px-3 py-2 text-right font-medium">Avg. position</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {o.competitors.map((c) => (
                  <tr key={c.domain}>
                    <td className="px-3 py-2 font-medium">
                      <Link to="/research/domain" search={{ d: c.domain }} className="hover:underline">{c.domain}</Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(c.shared_keywords)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(c.organic_keywords)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(c.organic_traffic)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.avg_position == null ? "–" : c.avg_position.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">
                      {clientId ? (
                        <Button size="sm" variant="ghost" onClick={() => addComp.mutate(c.domain)}>
                          Add as competitor
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No competitors found.</Empty>
          )}
        </div>
      </Panel>
    </div>
  );
}

// Keyword research -------------------------------------------------------------------------------

export function KeywordResearchPage() {
  usePageTitle("Keyword research");
  const { k = "", c } = useSearch({ from: "/research/keywords" });
  const navigate = useNavigate({ from: "/research/keywords" });
  const country = c ? Number(c) : 2840;
  const status = useResearchStatus();
  const q = useQuery({
    queryKey: ["research", "keyword", k, country],
    queryFn: () => api.get<KeywordOverview>("/research/keyword", { keyword: k, location_code: country }),
    enabled: !!k && !!status.data?.configured,
    staleTime: 3_600_000,
    retry: false,
  });
  const target = useTargetClient();
  return (
    <div>
      <PageHeader title="Keyword research" description="Search volume, difficulty, cost per click, who ranks, and hundreds of keyword ideas." actions={target.picker} />
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <SearchBar
          placeholder="Enter a keyword, e.g. linen pants women"
          initial={k}
          country={country}
          busy={q.isFetching}
          onSearch={(v, cc) => navigate({ search: { k: v, c: String(cc) } })}
        />
        {status.data && !status.data.configured ? <ConnectDataForSeo /> : null}
        {!k ? null : q.isLoading ? (
          <Skeleton rows={8} />
        ) : q.error ? (
          <ErrorNote error={q.error} />
        ) : q.data ? (
          <KeywordReport data={q.data} clientId={target.id} clientName={target.name} />
        ) : null}
      </div>
    </div>
  );
}

function KeywordReport({ data: o, clientId, clientName }: { data: KeywordOverview; clientId: string; clientName?: string }) {
  const [tab, setTab] = useState("suggestions");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState({ key: "search_volume", desc: true });
  const lists: Record<string, KeywordIdea[]> = { suggestions: o.suggestions, related: o.related, questions: o.questions };
  const rows = sortRows(
    (lists[tab] ?? []).filter((r) => r.keyword.includes(filter.toLowerCase())),
    sort,
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[20px] font-semibold">{o.keyword}</h2>
        <div className="flex items-center gap-3">
          <AddKeyword clientId={clientId} clientName={clientName} keyword={o.keyword} intent={o.intent} wide />
          <Fetched at={o.fetched_at} />
        </div>
      </div>
      <PartErrors errors={o.errors} />
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-surface p-4">
          <Gauge value={o.difficulty} label="SEO difficulty" color={kdBand(o.difficulty).color} />
          <p className="mt-2 text-center text-[12.5px] text-ink-2"><Kd value={o.difficulty} wide /></p>
        </div>
        <StatGrid cols={4}>
          <StatCard label="Search volume / month" value={num(o.search_volume)} tone="accent" />
          <StatCard label="Cost per click" value={usd(o.cpc)} />
          <StatCard
            label="Paid difficulty"
            value={o.competition == null ? "–" : Math.round(o.competition * 100)}
            hint="0 to 100: how crowded the ads are"
          />
          <StatCard label="Search intent" value={<span className="text-[18px]"><Intent value={o.intent} /></span>} />
        </StatGrid>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Search volume, last 12 months">
          {o.trend.length ? (
            <div className="h-56 px-2 pb-3">
              <ResponsiveContainer>
                <BarChart data={o.trend} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => num(v)} width={44} />
                  <Tooltip labelFormatter={(m) => monthLabel(String(m))} formatter={(v) => [num(Number(v), false), "Searches"]} />
                  <Bar dataKey="volume" fill="var(--color-denim)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>No monthly data.</Empty>
          )}
        </Panel>
        <Panel title="Who ranks on Google">
          {o.serp.length ? (
            <ol className="divide-y divide-line">
              {o.serp.map((r, i) => (
                <li key={`${r.url}-${i}`} className="flex gap-3 px-4 py-2">
                  <span className="w-5 shrink-0 text-right text-ink-3 tabular-nums">{r.position ?? i + 1}</span>
                  <div className="min-w-0">
                    <a href={r.url ?? "#"} target="_blank" rel="noreferrer noopener" className="block truncate font-medium hover:underline">{r.title ?? r.url}</a>
                    <Link to="/research/domain" search={{ d: r.domain ?? "" }} className="text-[12.5px] text-denim hover:underline">{r.domain}</Link>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>No search results.</Empty>
          )}
        </Panel>
      </div>

      <Panel
        actions={
          <Input aria-label="Filter ideas" placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 w-44" />
        }
        title="Keyword ideas"
      >
        <Tabs
          tabs={[
            { id: "suggestions", label: "Suggestions", count: o.suggestions.length },
            { id: "related", label: "Related", count: o.related.length },
            { id: "questions", label: "Questions", count: o.questions.length },
          ]}
          value={tab}
          onChange={setTab}
        />
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px]">
              <thead className="text-[12.5px] text-ink-3">
                <tr className="border-b border-line">
                  <SortTh label="Keyword" k="keyword" sort={sort} setSort={setSort} />
                  <SortTh label="Volume" k="search_volume" sort={sort} setSort={setSort} right />
                  <SortTh label="SD" k="difficulty" sort={sort} setSort={setSort} />
                  <SortTh label="CPC" k="cpc" sort={sort} setSort={setSort} right />
                  <th className="px-3 py-2 font-medium">Intent</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.keyword}>
                    <td className="px-3 py-2 font-medium">
                      <Link to="/research/keywords" search={{ k: r.keyword }} className="hover:underline">{r.keyword}</Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(r.search_volume)}</td>
                    <td className="px-3 py-2"><Kd value={r.difficulty} /></td>
                    <td className="px-3 py-2 text-right tabular-nums">{usd(r.cpc)}</td>
                    <td className="px-3 py-2"><Intent value={r.intent} /></td>
                    <td className="px-1"><AddKeyword clientId={clientId} clientName={clientName} keyword={r.keyword} intent={r.intent} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No ideas in this list.</Empty>
        )}
      </Panel>
    </div>
  );
}

// Backlinks ------------------------------------------------------------------------------------

export function BacklinksPage() {
  usePageTitle("Backlinks");
  const { d = "" } = useSearch({ from: "/research/backlinks" });
  const navigate = useNavigate({ from: "/research/backlinks" });
  const status = useResearchStatus();
  const { clientScope } = useSession();
  const clients = useClients();
  const fallback = clients.data?.find((x) => x.id === clientScope)?.domain ?? "";
  const q = useQuery({
    queryKey: ["research", "backlinks", d],
    queryFn: () => api.get<BacklinkOverview>("/research/backlinks", { target: d }),
    enabled: !!d && !!status.data?.configured,
    staleTime: 3_600_000,
    retry: false,
  });
  return (
    <div>
      <PageHeader title="Backlinks" description="Links pointing at a website: how many, from how many sites, and the strongest ones." />
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <SearchBar placeholder="Enter a domain" initial={d || fallback} country={2840} busy={q.isFetching} onSearch={(v) => navigate({ search: { d: v } })} />
        {status.data && !status.data.configured ? <ConnectDataForSeo /> : null}
        {!d ? null : q.isLoading ? (
          <Skeleton rows={6} />
        ) : q.error ? (
          <ErrorNote error={q.error} />
        ) : q.data ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[20px] font-semibold">{q.data.target}</h2>
              <Fetched at={q.data.fetched_at} />
            </div>
            <PartErrors errors={q.data.errors} />
            <StatGrid cols={5}>
              <StatCard label="Domain rank" value={num(q.data.rank)} hint="DataForSEO, 0 to 1000" tone="accent" />
              <StatCard label="Backlinks" value={num(q.data.backlinks)} />
              <StatCard label="Referring domains" value={num(q.data.referring_domains)} />
              <StatCard label="Follow links" value={q.data.dofollow_share == null ? "–" : pct(q.data.dofollow_share, 0)} hint="Share of referring domains" />
              <StatCard label="Broken backlinks" value={num(q.data.broken_backlinks)} hint="Worth reclaiming" />
            </StatGrid>
            <Panel title="Strongest referring domains">
              {q.data.top_referring.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13.5px]">
                    <thead className="text-[12.5px] text-ink-3">
                      <tr className="border-b border-line">
                        <th className="px-3 py-2 font-medium">Domain</th>
                        <th className="px-3 py-2 text-right font-medium">Rank</th>
                        <th className="px-3 py-2 text-right font-medium">Backlinks</th>
                        <th className="px-3 py-2 font-medium">First seen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {q.data.top_referring.map((r) => (
                        <tr key={r.domain}>
                          <td className="px-3 py-2 font-medium">{r.domain}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{num(r.rank)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{num(r.backlinks)}</td>
                          <td className="px-3 py-2 text-ink-2">{r.first_seen ?? "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>No referring domains found.</Empty>
              )}
            </Panel>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A small strip used on dashboards to jump into research for a domain. */
export function ResearchLinks({ domain, className }: { domain: string; className?: string }) {
  return (
    <div className={cx("flex flex-wrap gap-3 text-[13px]", className)}>
      <Link to="/research/domain" search={{ d: domain }} className="text-denim hover:underline">Domain overview</Link>
      <Link to="/research/backlinks" search={{ d: domain }} className="text-denim hover:underline">Backlinks</Link>
    </div>
  );
}
