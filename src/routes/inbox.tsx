import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { api, DEMO } from "@/lib/api";
import { usePagedList } from "@/lib/paged";
import { supabase } from "@/lib/supabase";
import { useScopedClient, useSession } from "@/lib/session";
import {
  AGENTS,
  CATEGORY_LABEL,
  INBOX_GROUPS,
  agentName,
  ago,
  daysOpen,
  groupOf,
  humanize,
  plain,
  type InboxGroup,
} from "@/lib/format";
import { usePageTitle } from "@/lib/title";
import { useClients } from "@/components/Shell";
import { DeleteButton } from "@/components/DeleteButton";
import { ChangePanel, LiveChangeSummary, useChangeForItem } from "@/components/ChangePanel";
import {
  Badge,
  Button,
  ConfirmAction,
  cx,
  EmptyState,
  ErrorNote,
  LoadMore,
  PriorityBadge,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  errorText,
  useToast,
} from "@/components/ui";
import type { HumanRequired } from "@/api-types/HumanRequired";
import type { DecisionInput } from "@/api-types/DecisionInput";
import type { Overview } from "@/api-types/Overview";
import type { InboxSearch } from "@/router";
import type { Agent } from "@/api-types/Agent";
import type { HrVersion } from "@/api-types/HrVersion";
import { diffLines } from "@/lib/diff";

const DECIDED = "needs_changes,approved,rejected,resolved";
const HISTORY = [
  { id: DECIDED, label: "Everything decided" },
  { id: "needs_changes", label: "Sent back" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected or not needed" },
  { id: "resolved", label: "Done or answered" },
];

type View = InboxGroup | "all" | "history";

/** Live updates: any change to Human Required refreshes the lists. */
function useHumanRequiredRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    if (DEMO) return;
    // A bot often posts several items in a row: refresh once, two seconds after the last one.
    let timer: number | undefined;
    const ch = supabase
      .channel("hr-changes")
      .on("postgres_changes", { event: "*", schema: "app", table: "human_required" }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          qc.invalidateQueries({ queryKey: ["hr"] });
          qc.invalidateQueries({ queryKey: ["overview"] });
        }, 2000);
      })
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [qc]);
}

/** Open items per tab, for the current client filter. */
function useGroupCounts(clientId: string | undefined) {
  const ov = useQuery({ queryKey: ["overview"], queryFn: () => api.get<Overview>("/overview"), refetchInterval: 120_000 });
  return useMemo(() => {
    const n: Record<InboxGroup, number> = { decide: 0, unblock: 0, answer: 0 };
    for (const c of ov.data?.open_counts ?? []) {
      if (clientId && c.client_id !== clientId) continue;
      n[groupOf(c.category)] += c.n;
    }
    return { counts: n, loaded: !!ov.data };
  }, [ov.data, clientId]);
}

export function InboxPage() {
  useHumanRequiredRealtime();
  usePageTitle("Human Required");
  const search = useSearch({ from: "/inbox" });
  const navigate = useNavigate({ from: "/inbox" });
  const clientId = useScopedClient();
  const { counts } = useGroupCounts(clientId);
  const setSearch = (patch: Partial<InboxSearch>) => navigate({ search: (s) => ({ ...s, ...patch }) });

  // Old links used ?status=: anything other than open means history.
  const legacyHistory = search.status && search.status !== "open" && !search.view;
  // Everything open by default; the other tabs narrow it to one kind of work.
  const view: View = (search.view as View) ?? (legacyHistory ? "history" : "all");
  const group = INBOX_GROUPS.find((g) => g.id === view);

  const list = usePagedList<HumanRequired>(["hr"], "/human-required", {
    client_id: clientId,
    // Sent-back items stay in their tab while the bot revises them.
    status: view === "history" ? (search.status && search.status !== "open" ? search.status : DECIDED) : "open,needs_changes",
    category: group ? group.categories.join(",") : undefined,
    agent_id: search.agent,
    priority: search.priority,
    older_than_days: search.stale && view !== "history" ? 3 : undefined,
  });

  const items = list.items;
  const selected = items.find((i) => i.id === search.item) ?? null;
  const open = !!(selected || search.item);
  // Set when j or k moved the selection, so the detail takes focus for keyboard and screen-reader users.
  const keyMoved = useRef(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], dialog") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "j" && e.key !== "k") return;
      const idx = items.findIndex((i) => i.id === search.item);
      const next = e.key === "j" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
      if (items[next]) {
        keyMoved.current = true;
        setSearch({ item: items[next].id });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tabs: { id: View; label: string; count?: number }[] = [
    { id: "all", label: "All", count: counts.decide + counts.unblock + counts.answer },
    ...INBOX_GROUPS.map((g) => ({ id: g.id as View, label: g.label, count: counts[g.id] })),
    { id: "history", label: "History" },
  ];

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col md:h-[calc(100dvh-58px)]">
      {/* One title: full size over the list, compact while an item fills a narrower screen. */}
      <header className={cx("px-5 md:px-6", open ? "pt-4 pb-1 lg:pt-6 lg:pb-4" : "pt-6 pb-4")}>
        <h1 className={cx("leading-tight font-semibold tracking-[-0.01em]", open ? "text-[16px] lg:text-[22px]" : "text-[22px]")}>Human Required</h1>
        <p className={cx("mt-1 max-w-[70ch] text-ink-3", open && "max-lg:hidden")}>
          What the bots need from a person. They act on your answer at the start of their next run.
        </p>
      </header>
      <div className={cx(open && "max-lg:hidden")}>
        <div className="flex flex-wrap items-end gap-2 border-b border-line px-5 md:px-6">
          <div role="tablist" aria-label="Inbox" className="flex flex-wrap gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={view === t.id}
                onClick={() => setSearch({ view: t.id, status: undefined, item: undefined, stale: undefined })}
                className={cx(
                  "-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-2.5",
                  view === t.id ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink",
                )}
              >
                {t.label}
                {t.count ? <span className="tabular text-[12.5px] text-ink-3">{t.count}</span> : null}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 py-2">
            {view === "history" ? (
              <Select
                aria-label="Decision"
                value={search.status && search.status !== "open" ? search.status : DECIDED}
                onChange={(e) => setSearch({ status: e.target.value === DECIDED ? undefined : e.target.value, item: undefined })}
                className="h-8 w-auto"
              >
                {HISTORY.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
              </Select>
            ) : null}
            <Select
              aria-label="Bot"
              value={search.agent ?? ""}
              onChange={(e) => setSearch({ agent: e.target.value || undefined, item: undefined })}
              className="h-8 w-auto"
            >
              <option value="">All bots</option>
              {AGENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Priority"
              value={search.priority ?? ""}
              onChange={(e) => setSearch({ priority: e.target.value || undefined, item: undefined })}
              className="h-8 w-auto"
            >
              <option value="">Any priority</option>
              <option value="p1">P1 urgent</option>
              <option value="p2">P2 high</option>
              <option value="p3">P3 normal</option>
              <option value="p4">P4 low</option>
            </Select>
            {view !== "history" ? (
              <Button
                size="sm"
                variant={search.stale ? "primary" : "secondary"}
                onClick={() => setSearch({ stale: search.stale ? undefined : "1", item: undefined })}
                aria-pressed={!!search.stale}
              >
                Open 3+ days
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Queue */}
        <div className={cx("min-h-0 w-full overflow-y-auto border-r border-line lg:w-[384px] lg:shrink-0", open && "max-lg:hidden")}>
          {list.isLoading ? (
            <Skeleton rows={8} />
          ) : list.error ? (
            <ErrorNote error={list.error} />
          ) : items.length === 0 ? (
            <EmptyState
              title={view === "history" ? "Nothing decided yet" : "All clear"}
              body={
                search.agent || search.priority || search.stale
                  ? "Nothing matches these filters. Clear them to see everything."
                  : group
                    ? group.empty
                    : view === "all"
                      ? "Nothing is waiting on you. When a bot needs an approval, gets stuck or has a question, it shows up here."
                      : "Items you've decided show up here."
              }
            />
          ) : (
            <ul aria-label="Items">
              {items.map((i) => (
                <QueueRow
                  key={i.id}
                  item={i}
                  showType={view === "history" || group?.categories.length !== 1}
                  active={i.id === search.item}
                  onSelect={() => setSearch({ item: i.id })}
                />
              ))}
            </ul>
          )}
          <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
        </div>

        {/* Detail */}
        <div className={cx("min-h-0 flex-1 overflow-y-auto", !open && "max-lg:hidden")}>
          {open ? (
            <FullDetail
              key={selected?.id ?? search.item}
              id={selected?.id ?? search.item!}
              takeFocus={keyMoved}
              onBack={() => setSearch({ item: undefined })}
              onDecided={() => {
                // Move straight to the next item so a queue can be cleared without extra clicks.
                const current = selected?.id ?? search.item;
                const idx = items.findIndex((i) => i.id === current);
                const next = idx >= 0 ? (items[idx + 1] ?? items[idx - 1]) : undefined;
                setSearch({ item: next && next.id !== current ? next.id : undefined });
              }}
            />
          ) : items.length ? (
            <EmptyState title="Pick an item" body="Choose one from the list to see what the bot needs. Press j and k to move through the list." />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QueueRow({ item, active, showType, onSelect }: { item: HumanRequired; active: boolean; showType: boolean; onSelect: () => void }) {
  const clients = useClients();
  const client = clients.data?.find((c) => c.id === item.client_id);
  const days = daysOpen(item.created_at);
  const type = CATEGORY_LABEL[item.category] ?? humanize(item.category);
  const when = item.status === "open" ? (days === 0 ? "today" : `${days} days open`) : ago(item.decided_at);
  const title = plain(item.issue);
  return (
    <li>
      <button
        onClick={onSelect}
        aria-current={active || undefined}
        aria-label={`${item.priority.toUpperCase()}, ${type}, ${client?.name ?? "client"}, ${agentName(item.agent_id, true)}: ${title.slice(0, 110)}. ${when}`}
        className={cx(
          "flex w-full flex-col gap-1 border-b border-line px-5 py-3 text-left",
          active ? "bg-active" : "hover:bg-sunken",
        )}
      >
        <div className="flex items-center gap-2">
          <PriorityBadge p={item.priority} />
          {item.status === "needs_changes" ? <Badge tone="p2">Sent back</Badge> : showType ? <Badge>{type}</Badge> : null}
          <span className="min-w-0 truncate text-[13px] text-ink-2">{client?.name ?? "Client"}</span>
          <span className="shrink-0 text-[13px] text-ink-3">{agentName(item.agent_id, true)}</span>
          <span className={cx("tabular ml-auto shrink-0 text-[12.5px]", item.status === "open" && days >= 3 ? "font-medium text-p2" : "text-ink-3")}>
            {item.status === "open" ? (days === 0 ? "today" : `${days}d`) : ago(item.decided_at)}
          </span>
        </div>
        <p className="line-clamp-2 font-medium">{title}</p>
      </button>
    </li>
  );
}

/** The list only carries a 500-character preview of each draft; load the whole item when it's opened. */
function FullDetail({
  id,
  takeFocus,
  onBack,
  onDecided,
}: {
  id: string;
  takeFocus: React.MutableRefObject<boolean>;
  onBack: () => void;
  onDecided: () => void;
}) {
  const q = useQuery({ queryKey: ["hr", "item", id], queryFn: () => api.get<HumanRequired>(`/human-required/${id}`) });
  if (q.isLoading) return <Skeleton rows={6} />;
  if (q.error) return <ErrorNote error={q.error} />;
  return <Detail key={`${id}-${q.data!.updated_at}`} item={q.data!} takeFocus={takeFocus} onBack={onBack} onDecided={onDecided} />;
}

type Footer = "decide" | "unblock" | "answer";

function Detail({
  item,
  takeFocus,
  onBack,
  onDecided,
}: {
  item: HumanRequired;
  takeFocus: React.MutableRefObject<boolean>;
  onBack: () => void;
  onDecided: () => void;
}) {
  const { canReview } = useSession();
  const clients = useClients();
  const client = clients.data?.find((c) => c.id === item.client_id);
  const qc = useQueryClient();
  const toast = useToast();
  const heading = useRef<HTMLHeadingElement>(null);
  const original = item.edited_draft ?? item.draft ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(original);
  const [note, setNote] = useState(item.reviewer_note ?? "");
  const [confirming, setConfirming] = useState(false);
  const edited = draft.trim() !== (item.draft ?? "").trim() && draft.trim() !== "";
  const decidable = canReview && (item.status === "open" || item.status === "needs_changes" || !item.acted_on_at);
  // A planned site change: Atelier applies it on approval, exactly as shown (no draft edits).
  const changeQ = useChangeForItem(item.id);
  const change = changeQ.data ?? null;
  const changeOpen = change?.status === "proposed";
  const live = changeOpen && change?.kind !== "github";

  // Buttons follow what the person has to do: approvals and site changes get decided, blockers get
  // done, questions get answered. A question that came with a draft (a review reply) is decided.
  const footer: Footer =
    change || item.category === "approval"
      ? "decide"
      : groupOf(item.category) === "unblock"
        ? "unblock"
        : item.draft
          ? "decide"
          : "answer";
  const type = CATEGORY_LABEL[item.category] ?? humanize(item.category);

  useEffect(() => {
    if (takeFocus.current) {
      takeFocus.current = false;
      heading.current?.focus();
    }
  }, [takeFocus]);

  const agents = useQuery({ queryKey: ["agents"], queryFn: () => api.get<Agent[]>("/agents"), staleTime: 300_000 });
  const wakes = !!agents.data?.find((a) => a.id === item.agent_id)?.rakazo_webhook_url;
  const bot = agentName(item.agent_id);

  const decide = useMutation({
    mutationFn: (d: DecisionInput) => api.post<HumanRequired>(`/human-required/${item.id}/decision`, d),
    onSuccess: (_r, d) => {
      setConfirming(false);
      const next = wakes ? ` ${bot} is starting on it now.` : " The bot picks it up on its next run.";
      const text: Record<string, string> = {
        approved: change
          ? change.kind === "github"
            ? "Approved. Atelier is opening the pull request. Merge it from this item once the checks pass."
            : "Approved. Atelier is applying it now. If you need to, undo it from this item in History."
          : (edited ? "Approved with your edits." : "Approved.") + next,
        rejected: "Rejected." + next,
        needs_changes: wakes ? `Sent back. ${bot} is revising it now; the new version shows up here.` : "Sent back for changes." + next,
        resolved: footer === "answer" ? "Answer sent." + next : wakes ? `Marked done. ${bot} is retrying now.` : "Marked done. The bot retries on its next run.",
      };
      toast(text[d.decision]);
      qc.invalidateQueries({ queryKey: ["actions"] });
      onDecided();
      qc.invalidateQueries({ queryKey: ["hr"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e) => toast(errorText(e), "error"),
  });

  // The note box is only for asking the bot to change its plan: it goes with "Send back".
  const send = (decision: string) =>
    decide.mutate({
      decision,
      note: decision === "needs_changes" ? note.trim() : null,
      edited_draft: decision === "approved" && edited && !change ? draft : null,
    });
  const busy = (d: string) => decide.isPending && decide.variables?.decision === d;
  const needsNote = !note.trim();
  // A blocker that's approved means "done, carry on"; everything else is a plain approval.
  const approveAs = footer === "unblock" ? "resolved" : "approved";

  // Live-site changes get a second look first.
  const approve = () => (live ? setConfirming(true) : send(approveAs));

  const meta: [string, string][] = [
    ["Client", client?.name ?? ""],
    ["Bot", agentName(item.agent_id)],
    ["Type", type],
    ...(item.action_type ? ([["Action", humanize(item.action_type)]] as [string, string][]) : []),
    ["Raised", ago(item.created_at)],
  ];

  const askTitle = footer === "unblock" ? "What the bot needs done" : footer === "answer" ? "The bot's question" : "What the bot needs from you";

  return (
    <article className="flex min-h-full flex-col" aria-labelledby={`hr-${item.id}`}>
      <div className="flex-1 px-5 py-6 md:px-8">
        <button onClick={onBack} className="mb-3 inline-flex h-8 items-center gap-1 text-[13px] text-ink-2 lg:hidden">
          <ArrowLeft size={14} /> Back to list
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge p={item.priority} />
          {item.status !== "open" ? <StatusBadge s={item.status} /> : null}
          {item.acted_on_at ? <span className="text-[12.5px] text-ink-3">Bot acted {ago(item.acted_on_at)}</span> : null}
        </div>
        <h2 id={`hr-${item.id}`} ref={heading} tabIndex={-1} className="mt-2 max-w-[70ch] text-[19px] leading-snug font-semibold focus:outline-none">
          {plain(item.issue)}
        </h2>

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          {meta.map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-5 max-w-[70ch] rounded-lg bg-sunken px-4 py-3">
          <h3 className="text-[13px] font-medium text-ink-3">{askTitle}</h3>
          <p className="mt-1 text-[15px] whitespace-pre-wrap">{plain(item.ask)}</p>
        </section>

        {item.status === "needs_changes" ? (
          <p className="mt-3 max-w-[70ch] rounded-md bg-p2-soft px-4 py-2.5 text-[13.5px] text-p2">
            Sent back {ago(item.decided_at)}. {bot} revises this item and it comes back here as a new version.
            {wakes ? "" : " It picks it up on its next run."}
          </p>
        ) : null}

        {item.link ? (
          <a href={item.link} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1 text-denim underline underline-offset-2">
            Open link <ExternalLink size={13} />
          </a>
        ) : null}

        {item.draft && changeQ.isLoading ? (
          <div className="mt-6 max-w-[68ch]">
            <Skeleton rows={4} />
          </div>
        ) : item.draft && change ? (
          <ChangeDraft markdown={item.draft} />
        ) : item.draft ? (
          <section className="mt-6">
            <div className="mb-2 flex max-w-[68ch] items-center justify-between">
              <h3 className="font-semibold">{footer !== "decide" ? "Details" : item.edited_draft ? "Draft, with reviewer edits" : "Draft"}</h3>
              {decidable && footer === "decide" ? (
                <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
                  {editing ? "Preview" : "Edit draft"}
                </Button>
              ) : null}
            </div>
            {editing ? (
              <Textarea aria-label="Draft" value={draft} onChange={(e) => setDraft(e.target.value)} className="proof min-h-[420px] !text-[16px]" />
            ) : (
              <div className="proof rounded-md border border-line bg-canvas/40 px-5 py-4">
                <Markdown remarkPlugins={[remarkGfm]}>{draft || "_Empty draft_"}</Markdown>
              </div>
            )}
            {edited ? <p className="mt-1.5 text-[12.5px] text-p2">You changed the draft. Approving sends your version to the bot.</p> : null}
          </section>
        ) : null}

        {change ? (
          <div className="mt-5 max-w-[70ch]">
            <ChangePanel action={change} />
          </div>
        ) : null}

        {item.reviewer_note && !decidable ? (
          <section className="mt-5 max-w-[70ch]">
            <h3 className="text-[13px] font-medium text-ink-2">Note to the bot</h3>
            <p className="mt-1 whitespace-pre-wrap">{item.reviewer_note}</p>
          </section>
        ) : null}

        <VersionHistory item={item} />

        {canReview ? (
          <div className="mt-8 max-w-[70ch] border-t border-line pt-3">
            <DeleteButton
              labelled
              path={`/human-required/${item.id}`}
              thing="item"
              name={plain(item.issue).slice(0, 80)}
              consequence="The bot won't see a decision for it. It stays in the audit log."
              invalidate={["hr", "overview"]}
              onDeleted={onDecided}
            />
          </div>
        ) : null}
      </div>

      {decidable ? (
        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-surface px-5 py-3 md:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="approve" busy={busy(approveAs)} onClick={approve} disabled={changeQ.isLoading}>
              {changeOpen ? (change?.kind === "github" ? "Approve and open pull request" : "Approve and apply") : edited ? "Approve with my edits" : "Approve"}
            </Button>
            <Button variant="danger" busy={busy("rejected")} onClick={() => send("rejected")}>
              Reject
            </Button>
            <span className="text-[12.5px] text-ink-3">
              {footer === "unblock" ? "Approve once it's done; the bot carries on." : footer === "answer" ? "Approve means yes, go ahead." : ""}
            </span>
          </div>
          {/* Asking for changes: the bot revises the same item and it comes back as a new version. */}
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="hr-note" className="sr-only">
                What should the bot change?
              </label>
              <Textarea
                id="hr-note"
                rows={1}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="!min-h-0 resize-y"
                placeholder="Ask for changes to the plan, e.g. use the Spring collection link instead"
              />
            </div>
            <Button busy={busy("needs_changes")} disabled={needsNote} onClick={() => send("needs_changes")} className="shrink-0">
              Send back
            </Button>
          </div>
        </div>
      ) : !canReview ? (
        <p className="border-t border-line px-4 py-3 text-[13px] text-ink-3 md:px-8">You have view access. Reviewers and admins can decide on items.</p>
      ) : null}

      {change && confirming ? (
        <ConfirmAction
          open
          onClose={() => setConfirming(false)}
          title="Change the live site?"
          confirmLabel="Apply to the live site"
          busy={busy("approved")}
          onConfirm={() => send("approved")}
        >
          <p>
            <span className="font-medium text-ink">{change.title}</span>
          </p>
          <LiveChangeSummary action={change} domain={client?.domain} />
          <p>Search engines can see it within minutes. You can undo it afterwards from this item, under History.</p>
        </ConfirmAction>
      ) : null}
    </article>
  );
}

/** A planned site change: the before and after first, then the bot's reasons. */
function ChangeDraft({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => l.trim().startsWith("|"));
  const why = start > 0 ? lines.slice(0, start).join("\n").trim() : "";
  const change = start >= 0 ? lines.slice(start).join("\n").trim() : markdown;
  return (
    <>
      <section className="mt-6">
        <h3 className="mb-2 font-semibold">The change</h3>
        <div className="proof rounded-md border border-line bg-canvas/40 px-5 py-4">
          <Markdown remarkPlugins={[remarkGfm]}>{change}</Markdown>
        </div>
      </section>
      {why ? (
        <section className="mt-5">
          <h3 className="mb-1 font-semibold">Why the bot wants it</h3>
          <div className="proof text-ink-2">
            <Markdown remarkPlugins={[remarkGfm]}>{why}</Markdown>
          </div>
        </section>
      ) : null}
    </>
  );
}

/** Every version of the draft, newest first, with what changed between any two. Loads when opened. */
function VersionHistory({ item }: { item: HumanRequired }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["hr", "versions", item.id, item.updated_at],
    queryFn: () => api.get<HrVersion[]>(`/human-required/${item.id}/versions`),
    enabled: open,
  });
  const team = useQuery({
    queryKey: ["team"],
    queryFn: () => api.get<{ user_id: string; email: string }[]>("/team", { limit: 200 }),
    enabled: open,
    staleTime: 300_000,
  });
  const vs = q.data ?? [];
  const shown = vs.find((v) => v.version === pick) ?? vs[0];
  const before = shown ? vs.find((v) => v.version < shown.version) : undefined;
  const who = (v: HrVersion) =>
    v.author_type === "bot" ? agentName(v.author_id) : (team.data?.find((m) => m.user_id === v.author_id)?.email ?? "A reviewer");
  return (
    <details className="mt-6 max-w-[70ch] rounded-md border border-line" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-ink-2 hover:text-ink">Version history</summary>
      <div className="border-t border-line px-3 py-3">
        {q.isLoading ? (
          <Skeleton rows={2} />
        ) : q.error ? (
          <ErrorNote error={q.error} />
        ) : vs.length <= 1 ? (
          <p className="text-[13px] text-ink-3">Only one version so far. Revisions after you send it back show up here.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <ol className="flex flex-wrap gap-1.5" aria-label="Versions">
              {vs.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => setPick(v.version)}
                    aria-pressed={shown?.version === v.version}
                    className={cx(
                      "h-8 rounded-md border px-2.5 text-[13px]",
                      shown?.version === v.version ? "border-ink bg-active text-ink" : "border-line text-ink-2 hover:bg-sunken",
                    )}
                  >
                    Version {v.version}
                    {v === vs[0] ? ", current" : ""}
                  </button>
                </li>
              ))}
            </ol>
            {shown ? (
              <div>
                <p className="text-[13px] text-ink-2">
                  {shown.author_type === "bot" ? (shown.version === 1 ? "First draft" : "Revised") : "Edited while approving"} by {who(shown)},{" "}
                  {ago(shown.created_at)}.
                </p>
                {shown.note ? (
                  <p className="mt-1 text-[13px] text-ink-2">
                    Answering: <span className="text-ink">{shown.note}</span>
                  </p>
                ) : null}
                {before ? (
                  <>
                    <p className="mt-2 mb-1 text-[12.5px] text-ink-3">
                      Changes from version {before.version}: <span className="text-ok">added</span>,{" "}
                      <span className="text-p1 line-through">removed</span>
                    </p>
                    <Diff a={before.draft ?? ""} b={shown.draft ?? ""} />
                  </>
                ) : (
                  <pre className="mt-2 max-h-[420px] overflow-auto rounded-md bg-sunken px-3 py-2 text-[12.5px] whitespace-pre-wrap">
                    {shown.draft || "(no draft)"}
                  </pre>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </details>
  );
}

function Diff({ a, b }: { a: string; b: string }) {
  const parts = useMemo(() => diffLines(a, b), [a, b]);
  return (
    <div className="max-h-[420px] overflow-auto rounded-md bg-sunken py-2 text-[12.5px] leading-relaxed">
      {parts.map((p, i) => (
        <div
          key={i}
          className={cx("px-3 whitespace-pre-wrap", p.kind === "add" && "bg-ok-soft text-ok", p.kind === "del" && "bg-p1-soft text-p1 line-through")}
        >
          <span aria-hidden className="mr-2 inline-block w-3 select-none">
            {p.kind === "add" ? "+" : p.kind === "del" ? "-" : ""}
          </span>
          <span className="sr-only">{p.kind === "add" ? "Added: " : p.kind === "del" ? "Removed: " : ""}</span>
          {p.text || " "}
        </div>
      ))}
    </div>
  );
}
