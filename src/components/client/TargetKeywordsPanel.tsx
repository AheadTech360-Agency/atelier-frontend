import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePagedList } from "@/lib/paged";
import { useSession } from "@/lib/session";
import { agentName, humanize } from "@/lib/format";
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  LoadMore,
  Panel,
  PriorityBadge,
  Select,
  Skeleton,
  Textarea,
  TextField,
  cx,
  errorText,
  useToast,
} from "../ui";
import { Intent, Kd } from "../seo";
import type { TargetKeyword } from "@/api-types/TargetKeyword";
import type { KeywordList } from "@/api-types/KeywordList";

const parseLists = (t: string) => [...new Set(t.split(",").map((x) => x.trim()).filter(Boolean))];

const fmt = new Intl.NumberFormat("en-US");
const INTENTS = ["informational", "commercial", "transactional", "navigational", "local", "unknown"];
const VIEWS = [
  { id: "suggested,approved", label: "Working list" },
  { id: "suggested", label: "To review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];
const STATUS_TONE: Record<string, "ok" | "neutral" | "p4"> = { approved: "ok", suggested: "neutral", rejected: "p4" };

/** The keywords a client should go after. The SEO Lead suggests them; every bot works from this list. */
export function TargetKeywordsPanel({ clientId }: { clientId: string }) {
  const { canReview } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [view, setView] = useState(VIEWS[0].id);
  const [search, setSearch] = useState("");
  const [list, setList] = useState("");
  const lists = useQuery({ queryKey: ["target-keywords", clientId, "lists"], queryFn: () => api.get<KeywordList[]>(`/clients/${clientId}/keyword-lists`) });
  const [editing, setEditing] = useState<TargetKeyword | "new" | null>(null);
  const q = usePagedList<TargetKeyword>(["target-keywords", clientId], `/clients/${clientId}/target-keywords`, {
    status: view,
    search: search.trim() || undefined,
    list: list || undefined,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["target-keywords", clientId] });
    qc.invalidateQueries({ queryKey: ["overview"] });
  };
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch<TargetKeyword>(`/target-keywords/${id}`, { status }),
    onSuccess: refresh,
    onError: (e) => toast(errorText(e), "error"),
  });

  return (
    <Panel
      title="Target keywords"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Search target keywords" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-40" />
          <Select aria-label="Which keywords" value={view} onChange={(e) => setView(e.target.value)} className="h-8 w-auto">
            {VIEWS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
          {lists.data?.length ? (
            <Select aria-label="Keyword list" value={list} onChange={(e) => setList(e.target.value)} className="h-8 w-auto">
              <option value="">All lists</option>
              {lists.data.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name} ({l.keywords})
                </option>
              ))}
            </Select>
          ) : null}
          {canReview ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              Add keyword
            </Button>
          ) : null}
        </div>
      }
    >
      <p className="px-4 pt-3 text-[13px] text-ink-2">
        The SEO Lead picks these from what competitors rank for, and every bot works from this list. Reject one and no bot works on it again.
      </p>
      {q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : !q.items.length ? (
        <EmptyState
          title={search || list || view !== VIEWS[0].id ? "Nothing here" : "No target keywords yet"}
          body={
            search || list || view !== VIEWS[0].id
              ? "Try another search or list."
              : "The SEO Lead suggests them after its weekly competitor research. You can add your own now."
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
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {q.items.map((k) => (
                <tr key={k.id} className={cx("align-top", k.status === "rejected" && "text-ink-3")}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">
                      {k.keyword}
                      {k.lists.map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setList(l)}
                          className="ml-1.5 rounded-full border border-line px-2 py-px align-middle text-[11.5px] font-normal text-ink-2 hover:border-denim hover:text-denim"
                          title={`Show the ${l} list`}
                        >
                          {l}
                        </button>
                      ))}
                    </p>
                    <p className="max-w-[60ch] text-[12.5px] text-ink-3">
                      {k.agent_id ? `Suggested by ${agentName(k.agent_id, true)}` : "Added or edited by a person"}
                      {k.competitors.length ? `. Competitors ranking: ${k.competitors.join(", ")}` : ""}
                      {k.notes ? `. ${k.notes}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{k.search_volume == null ? "–" : fmt.format(k.search_volume)}</td>
                  <td className="px-3 py-2.5 text-right"><Kd value={k.difficulty} /></td>
                  <td className="px-3 py-2.5"><Intent value={k.intent} /></td>
                  <td className="px-3 py-2.5">
                    <PriorityBadge p={k.priority} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={STATUS_TONE[k.status]}>{humanize(k.status)}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {canReview ? (
                      <div className="flex justify-end gap-1.5">
                        {k.status === "suggested" ? (
                          <Button size="sm" onClick={() => setStatus.mutate({ id: k.id, status: "approved" })}>
                            Approve
                          </Button>
                        ) : null}
                        {k.status === "rejected" ? (
                          <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: k.id, status: "suggested" })}>
                            Restore
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: k.id, status: "rejected" })}>
                            Reject
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setEditing(k)}>
                          Edit
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore hasMore={q.hasMore} loading={q.loadingMore} onClick={q.loadMore} />
      {editing ? <EditKeyword clientId={clientId} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} /> : null}
    </Panel>
  );
}

function EditKeyword({
  clientId,
  item,
  onClose,
  onSaved,
}: {
  clientId: string;
  item: TargetKeyword | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [keyword, setKeyword] = useState(item?.keyword ?? "");
  const [intent, setIntent] = useState(item?.intent ?? "unknown");
  const [priority, setPriority] = useState(item?.priority ?? "p3");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [lists, setLists] = useState((item?.lists ?? []).join(", "));
  const save = useMutation({
    mutationFn: () =>
      item
        ? api.patch<TargetKeyword>(`/target-keywords/${item.id}`, { keyword, intent, priority, notes, lists: parseLists(lists), status: null })
        : api.post<TargetKeyword>(`/clients/${clientId}/target-keywords`, { keyword, intent, priority, notes, lists: parseLists(lists) }),
    onSuccess: () => {
      toast(item ? "Keyword saved" : "Keyword added. The bots will work on it from their next run.");
      onSaved();
      onClose();
    },
  });
  const del = useMutation({
    mutationFn: () => api.del(`/target-keywords/${item!.id}`),
    onSuccess: () => {
      toast("Keyword removed. The SEO Lead may suggest it again; reject it to stop that.");
      onSaved();
      onClose();
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? "Edit keyword" : "Add a keyword"}
      footer={
        <>
          {item ? (
            <Button variant="danger" className="mr-auto" busy={del.isPending} onClick={() => del.mutate()}>
              Remove
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={save.isPending} disabled={!keyword.trim()} onClick={() => save.mutate()}>
            {item ? "Save" : "Add keyword"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (keyword.trim()) save.mutate();
        }}
      >
        <TextField label="Keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} error={save.error ? errorText(save.error) : null} autoFocus />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Intent">
            <Select value={intent} onChange={(e) => setIntent(e.target.value)}>
              {INTENTS.map((i) => (
                <option key={i} value={i}>
                  {i === "unknown" ? "Not sure" : humanize(i)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" hint="P1 matters most">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {["p1", "p2", "p3", "p4"].map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Lists" hint="Group keywords, for example: Summer launch, Blog ideas. Separate with commas">
          <Input value={lists} onChange={(e) => setLists(e.target.value)} />
        </Field>
        <Field label="Notes for the bots" hint="Why it matters, or which page should rank for it">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20" />
        </Field>
      </form>
    </Dialog>
  );
}
