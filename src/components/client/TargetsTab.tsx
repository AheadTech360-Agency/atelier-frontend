import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { agentName, humanize } from "@/lib/format";
import { AgentPicker } from "../AgentPicker";
import { Badge, Button, Checkbox, ConfirmDelete, Dialog, EmptyState, ErrorNote, Field, IconButton, Panel, Select, Skeleton, TextField, errorText, useToast } from "../ui";
import type { Target } from "@/api-types/Target";
import type { TargetInput } from "@/api-types/TargetInput";

const CATEGORIES = ["syndication", "directory", "social", "review_platform", "journalist_feed", "competitor", "forum_watch", "other"];
const DIRECTION_LABEL: Record<string, string> = { read: "Read from", post: "Post to", both: "Read and post" };

export function TargetsTab({ clientId }: { clientId: string }) {
  const { isAdmin } = useSession();
  const q = useQuery({ queryKey: ["targets", clientId], queryFn: () => api.get<Target[]>(`/clients/${clientId}/targets`) });
  const [editing, setEditing] = useState<Target | "new" | null>(null);
  const [deleting, setDeleting] = useState<Target | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/targets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["targets", clientId] });
      toast("Site deleted");
      setDeleting(null);
    },
    onError: (e) => toast(errorText(e), "error"),
  });

  const groups = CATEGORIES.map((c) => ({ c, items: (q.data ?? []).filter((t) => t.category === c) })).filter((g) => g.items.length);

  return (
    <Panel title="Sites the bots read from and post to" actions={isAdmin ? <Button size="sm" variant="primary" onClick={() => setEditing("new")}>Add site</Button> : null}>
      {q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : !groups.length ? (
        <EmptyState
          title="No sites yet"
          body="Add competitors to watch, directories to list in, and syndication sites like Medium. Forums are watch-only: bots flag threads, they never post."
          action={isAdmin ? <Button variant="primary" onClick={() => setEditing("new")}>Add site</Button> : null}
        />
      ) : (
        groups.map((g) => (
          <section key={g.c}>
            <h3 className="border-b border-line bg-sunken px-4 py-1.5 text-[13px] font-medium text-ink-2">{humanize(g.c)}</h3>
            <ul className="divide-y divide-line">
              {g.items.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      <Badge tone={t.direction === "read" ? "neutral" : "denim"}>{DIRECTION_LABEL[t.direction]}</Badge>
                      {!t.active ? <Badge>Paused</Badge> : null}
                    </div>
                    <a href={t.url} target="_blank" rel="noreferrer noopener" className="block truncate text-[13px] text-ink-3 hover:underline">
                      {t.url}
                    </a>
                    <p className="text-[12.5px] text-ink-2">{t.allowed_agents.map((a) => agentName(a, true)).join(", ") || "No bots"}</p>
                  </div>
                  {isAdmin ? (
                    <div className="flex gap-1">
                      <IconButton label={`Edit ${t.name}`} onClick={() => setEditing(t)}>
                        <Pencil size={15} />
                      </IconButton>
                      <IconButton label={`Delete ${t.name}`} onClick={() => setDeleting(t)}>
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {editing ? <TargetDialog clientId={clientId} target={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        thing="site"
        name={deleting?.name ?? ""}
        consequence="Bots stop reading from or posting to it."
        busy={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
    </Panel>
  );
}

function TargetDialog({ clientId, target, onClose }: { clientId: string; target?: Target; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<TargetInput>({
    direction: target?.direction ?? "post",
    category: target?.category ?? "syndication",
    name: target?.name ?? "",
    url: target?.url ?? "",
    allowed_agents: target?.allowed_agents ?? ["off_page"],
    notes: target?.notes ?? "",
    active: target?.active ?? true,
  });
  const save = useMutation({
    mutationFn: () => (target ? api.put<Target>(`/targets/${target.id}`, form) : api.post<Target>(`/clients/${clientId}/targets`, form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["targets", clientId] });
      toast(target ? "Site saved" : "Site added");
      onClose();
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  const watchOnly = form.category === "forum_watch";

  return (
    <Dialog
      open
      onClose={onClose}
      title={target ? "Edit site" : "Add site"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="target-form" busy={save.isPending}>
            {target ? "Save site" : "Add site"}
          </Button>
        </>
      }
    >
      <form id="target-form" onSubmit={submit} className="flex flex-col gap-3">
        <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField label="URL" type="url" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="t-cat">
            <Select
              id="t-cat"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value, direction: e.target.value === "forum_watch" || e.target.value === "competitor" ? "read" : form.direction })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bots will" htmlFor="t-dir" hint={watchOnly ? "Forums are watch-only. Bots flag threads, they never post." : undefined}>
            <Select id="t-dir" value={form.direction} disabled={watchOnly} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              <option value="read">Read from it</option>
              <option value="post">Post to it</option>
              <option value="both">Read and post</option>
            </Select>
          </Field>
        </div>
        <TextField label="Notes for the bots" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <AgentPicker label="Bots that use this site" value={form.allowed_agents} onChange={(v) => setForm({ ...form, allowed_agents: v })} />
        <Checkbox label="Active" checked={form.active ?? true} onChange={(v) => setForm({ ...form, active: v })} />
      </form>
    </Dialog>
  );
}
