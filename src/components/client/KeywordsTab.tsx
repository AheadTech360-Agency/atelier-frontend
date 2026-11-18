import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { usePagedList } from "@/lib/paged";
import { useSession } from "@/lib/session";
import { agentName, ago, humanize } from "@/lib/format";
import {
  Badge,
  Button,
  Checkbox,
  ConfirmAction,
  Dialog,
  EmptyState,
  ErrorNote,
  Input,
  LoadMore,
  Panel,
  Select,
  Skeleton,
  TextField,
  cx,
  errorText,
  useToast,
} from "../ui";
import type { Competitor } from "@/api-types/Competitor";
import type { CompetitorKeyword } from "@/api-types/CompetitorKeyword";

const fmt = new Intl.NumberFormat("en-US");
const n = (v: number | null | undefined) => (v == null ? "–" : fmt.format(Math.round(v)));

const STATUS_TONE: Record<string, "ok" | "neutral" | "p4"> = { confirmed: "ok", suggested: "neutral", ignored: "p4" };

/** Who each client competes with in search, and the keywords those competitors rank for. */
export function KeywordsTab({ clientId }: { clientId: string }) {
  const [picked, setPicked] = useState<string>("");
  return (
    <div className="flex flex-col gap-6">
      <CompetitorsPanel clientId={clientId} picked={picked} onPick={setPicked} />
      <CompetitorKeywordsPanel clientId={clientId} picked={picked} onPick={setPicked} />
    </div>
  );
}

function CompetitorsPanel({ clientId, picked, onPick }: { clientId: string; picked: string; onPick: (id: string) => void }) {
  const { canReview } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [showIgnored, setShowIgnored] = useState(false);
  const [adding, setAdding] = useState(false);
  const list = useQuery({
    queryKey: ["competitors", clientId, showIgnored],
    queryFn: () => api.get<Competitor[]>(`/clients/${clientId}/competitors`, { include_ignored: showIgnored }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["competitors", clientId] });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch<Competitor>(`/competitors/${id}`, { status }),
    onSuccess: (c) => {
      refresh();
      qc.invalidateQueries({ queryKey: ["competitor-keywords", clientId] });
      if (c.status === "ignored" && picked === c.id) onPick("");
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  // Queue a job for the SEO Lead and wake it. Keywords-only jobs skip the competitor search.
  const wake = useMutation({
    mutationFn: async (job: { title: string; payload: Record<string, unknown> }) => {
      await api.post("/tasks", {
        client_id: clientId,
        to_agent: "seo_lead",
        task_type: "find_competitors",
        title: job.title,
        payload: job.payload,
        priority: "p3",
        due_at: null,
      });
      try {
        await api.post(`/agents/seo_lead/run`, { client_id: clientId, note: `${job.title}.` });
        return "woken";
      } catch {
        return "queued";
      }
    },
    onSuccess: (r) =>
      toast(r === "woken" ? "The SEO Lead is on it. Results show up here in a few minutes." : "Queued for the SEO Lead's next run."),
    onError: (e) => toast(errorText(e), "error"),
  });
  const findNow = () => wake.mutate({ title: "Find competitors and the keywords they rank for", payload: {} });
  const pullKeywords = (domains?: string[]) =>
    wake.mutate({
      title: domains?.length === 1 ? `Pull keywords for ${domains[0]}` : "Pull keywords for the saved competitors",
      payload: { keywords_only: true, ...(domains ? { domains } : {}) },
    });

  const rows = list.data ?? [];
  return (
    <Panel
      title="Competitors"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Checkbox label="Show ignored" checked={showIgnored} onChange={setShowIgnored} />
          {canReview ? (
            <>
              <Button size="sm" onClick={() => setAdding(true)}>
                Add competitor
              </Button>
              {rows.length ? (
                <Button size="sm" busy={wake.isPending && wake.variables?.payload.keywords_only === true && !wake.variables?.payload.domains} onClick={() => pullKeywords()}>
                  Pull keywords
                </Button>
              ) : null}
              <Button size="sm" variant="primary" busy={wake.isPending && !wake.variables?.payload.keywords_only} onClick={findNow}>
                Find competitors now
              </Button>
            </>
          ) : null}
        </div>
      }
    >
      {list.isLoading ? (
        <Skeleton />
      ) : list.error ? (
        <ErrorNote error={list.error} />
      ) : !rows.length ? (
        <EmptyState
          title="No competitors yet"
          body="The SEO Lead finds them with DataForSEO every week. Press Find competitors now to start sooner, or add one you know."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[12.5px] text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">Site</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Shared keywords</th>
                <th className="px-3 py-2 text-right font-medium">All keywords</th>
                <th className="px-3 py-2 text-right font-medium">Visits a month</th>
                <th className="px-3 py-2 font-medium">Keywords stored</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className={cx(
                    "align-top",
                    c.status === "ignored" && "text-ink-3",
                    picked === c.id && "bg-active",
                  )}
                >
                  <td className="px-4 py-2.5">
                    <a href={`https://${c.domain}`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-medium hover:underline">
                      {c.domain} <ExternalLink size={11} />
                    </a>
                    <p className="text-[12.5px] text-ink-3">
                      {c.name ? `${c.name}. ` : ""}
                      {c.agent_id ? `Found by ${agentName(c.agent_id, true)}` : "Added by a person"}
                      {c.notes ? `. ${c.notes}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={STATUS_TONE[c.status]}>{c.status === "ignored" ? "Not a competitor" : humanize(c.status)}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{n(c.shared_keywords)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{n(c.organic_keywords)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{n(c.organic_traffic)}</td>
                  <td className="px-3 py-2.5">
                    {c.keyword_count ? (
                      <button type="button" className="text-denim hover:underline" onClick={() => onPick(picked === c.id ? "" : c.id)}>
                        {picked === c.id ? "Showing below" : `${n(c.keyword_count)} keywords`}
                      </button>
                    ) : (
                      <span className="text-ink-3">None yet</span>
                    )}
                    {canReview && c.status !== "ignored" ? (
                      <button type="button" className="ml-2 text-[12.5px] text-denim hover:underline" onClick={() => pullKeywords([c.domain])}>
                        {c.keyword_count ? "Refresh" : "Pull"}
                      </button>
                    ) : null}
                    {c.keywords_pulled_at ? <p className="text-[12.5px] text-ink-3">Pulled {ago(c.keywords_pulled_at)}</p> : null}
                  </td>
                  <td className="px-4 py-2.5">
                    {canReview ? (
                      <div className="flex justify-end gap-1.5">
                        {c.status === "suggested" ? (
                          <Button size="sm" onClick={() => setStatus.mutate({ id: c.id, status: "confirmed" })}>
                            Confirm
                          </Button>
                        ) : null}
                        {c.status === "ignored" ? (
                          <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: c.id, status: "suggested" })}>
                            Restore
                          </Button>
                        ) : (
                          <IgnoreButton domain={c.domain} onConfirm={() => setStatus.mutate({ id: c.id, status: "ignored" })} />
                        )}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding ? <AddCompetitor clientId={clientId} onClose={() => setAdding(false)} onAdded={refresh} /> : null}
    </Panel>
  );
}

function IgnoreButton({ domain, onConfirm }: { domain: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Not a competitor
      </Button>
      <ConfirmAction
        open={open}
        onClose={() => setOpen(false)}
        title={`Remove ${domain} from competitors?`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
      >
        <p>Its keywords are removed and the bots won't add it again. You can bring it back from Show ignored.</p>
      </ConfirmAction>
    </>
  );
}

function AddCompetitor({ clientId, onClose, onAdded }: { clientId: string; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const add = useMutation({
    mutationFn: () => api.post<Competitor>(`/clients/${clientId}/competitors`, { domain, name: name || null, notes: null }),
    onSuccess: (c) => {
      toast(`${c.domain} added. Its keywords come in on the SEO Lead's next competitor run.`);
      onAdded();
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a competitor"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={add.isPending} disabled={!domain.trim()} onClick={() => add.mutate()}>
            Add competitor
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (domain.trim()) add.mutate();
        }}
      >
        <TextField
          label="Website"
          placeholder="rival.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          error={add.error ? errorText(add.error) : null}
          autoFocus
        />
        <TextField label="Brand name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      </form>
    </Dialog>
  );
}

function CompetitorKeywordsPanel({ clientId, picked, onPick }: { clientId: string; picked: string; onPick: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [minVolume, setMinVolume] = useState("");
  const comps = useQuery({
    queryKey: ["competitors", clientId, false],
    queryFn: () => api.get<Competitor[]>(`/clients/${clientId}/competitors`, { include_ignored: false }),
  });
  const q = usePagedList<CompetitorKeyword>(["competitor-keywords", clientId], `/clients/${clientId}/competitor-keywords`, {
    competitor_id: picked || undefined,
    search: search.trim() || undefined,
    min_volume: minVolume || undefined,
  });

  return (
    <Panel
      title="Keywords they rank for"
      actions={
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="Search keywords"
            placeholder="Search keywords"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48"
          />
          <Select aria-label="Competitor" value={picked} onChange={(e) => onPick(e.target.value)} className="h-8 w-auto">
            <option value="">All competitors</option>
            {(comps.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.domain}
              </option>
            ))}
          </Select>
          <Select aria-label="Monthly searches" value={minVolume} onChange={(e) => setMinVolume(e.target.value)} className="h-8 w-auto">
            <option value="">Any searches</option>
            <option value="100">100+ a month</option>
            <option value="1000">1,000+ a month</option>
            <option value="10000">10,000+ a month</option>
          </Select>
        </div>
      }
    >
      {q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : !q.items.length ? (
        <EmptyState
          title={search || minVolume || picked ? "No keywords match" : "No competitor keywords yet"}
          body={
            search || minVolume || picked
              ? "Try a different search or filter."
              : "Once competitors are found, the SEO Lead pulls the top 100 keywords each one ranks for."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[12.5px] text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">Keyword</th>
                <th className="px-3 py-2 text-right font-medium">Searches a month</th>
                <th className="px-3 py-2 text-right font-medium">Difficulty</th>
                <th className="px-3 py-2 font-medium">Intent</th>
                <th className="px-3 py-2 font-medium">Competitor</th>
                <th className="px-3 py-2 text-right font-medium">Their position</th>
                <th className="px-4 py-2 font-medium">Their page</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {q.items.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-2 font-medium">{k.keyword}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(k.search_volume)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{k.difficulty ?? "–"}</td>
                  <td className="px-3 py-2">{k.intent === "unknown" ? <span className="text-ink-3">–</span> : humanize(k.intent)}</td>
                  <td className="px-3 py-2">{k.competitor_domain}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{k.position ?? "–"}</td>
                  <td className="max-w-[28ch] truncate px-4 py-2">
                    {k.url ? (
                      <a href={k.url} target="_blank" rel="noreferrer noopener" className="text-ink-2 hover:underline" title={k.url}>
                        {k.url.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    ) : (
                      <span className="text-ink-3">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore hasMore={q.hasMore} loading={q.loadingMore} onClick={q.loadMore} />
    </Panel>
  );
}
