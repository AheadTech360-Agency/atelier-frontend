import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useScopedClient, useSession } from "@/lib/session";
import { AGENTS, agentName, ago, humanize } from "@/lib/format";
import { useClients } from "@/components/Shell";
import { Button, Dialog, ErrorNote, Field, PageHeader, PriorityBadge, Select, Skeleton, TextField, Textarea, errorText, useToast } from "@/components/ui";
import type { Task } from "@/api-types/Task";

const COLUMNS = [
  { id: "queued", label: "Queued" },
  { id: "in_progress", label: "In progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];

export function TasksPage() {
  const clientId = useScopedClient();
  const { canReview } = useSession();
  const clients = useClients();
  const [agent, setAgent] = useState("");
  const [adding, setAdding] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: ["tasks", clientId, agent],
    queryFn: () => api.get<Task[]>("/tasks", { client_id: clientId, to_agent: agent, limit: 500 }),
    refetchInterval: 60_000,
  });
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/tasks/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e) => toast(errorText(e), "error"),
  });
  const clientName = (id: string) => clients.data?.find((c) => c.id === id)?.name ?? "";

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Work the bots hand to each other, plus anything you assign to a bot."
        actions={
          <>
            <Select aria-label="Bot" value={agent} onChange={(e) => setAgent(e.target.value)} className="h-9 w-auto">
              <option value="">All bots</option>
              {AGENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  For {a.name}
                </option>
              ))}
            </Select>
            {canReview ? (
              <Button variant="primary" onClick={() => setAdding(true)}>
                Assign task
              </Button>
            ) : null}
          </>
        }
      />
      {q.isLoading ? (
        <Skeleton rows={6} />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : (
        <div className="grid gap-4 overflow-x-auto p-4 md:grid-cols-2 md:p-6 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = (q.data ?? []).filter((t) => t.status === col.id);
            return (
              <section key={col.id} className="flex min-w-0 flex-col rounded-lg bg-sunken">
                <h2 className="flex items-center justify-between px-3 py-2 font-semibold">
                  {col.label}
                  <span className="tabular text-[13px] font-normal text-ink-3">{items.length}</span>
                </h2>
                <ul className="flex flex-col gap-2 px-2 pb-2">
                  {items.length === 0 ? <li className="px-1 pb-2 text-[13px] text-ink-3">Nothing here</li> : null}
                  {items.map((t) => (
                    <li key={t.id} className="rounded-md border border-line bg-surface p-3">
                      <div className="flex items-center gap-2">
                        <PriorityBadge p={t.priority} />
                        <span className="truncate text-[12.5px] text-ink-3">{clientName(t.client_id)}</span>
                      </div>
                      <p className="mt-1.5 font-medium">{t.title}</p>
                      <p className="mt-1 text-[12.5px] text-ink-2">
                        {agentName(t.from_agent, true)} to {agentName(t.to_agent, true)}, {humanize(t.task_type).toLowerCase()}, {ago(t.created_at)}
                      </p>
                      {canReview ? (
                        <Select
                          aria-label={`Move ${t.title}`}
                          value={t.status}
                          onChange={(e) => move.mutate({ id: t.id, status: e.target.value })}
                          className="mt-2 h-7 text-[13px]"
                        >
                          {[...COLUMNS.map((c) => c.id), "cancelled"].map((s) => (
                            <option key={s} value={s}>
                              {humanize(s)}
                            </option>
                          ))}
                        </Select>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {adding ? <AssignTask onClose={() => setAdding(false)} defaultClient={clientId} /> : null}
    </div>
  );
}

function AssignTask({ onClose, defaultClient }: { onClose: () => void; defaultClient?: string }) {
  const clients = useClients();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ client_id: defaultClient ?? "", to_agent: "technical_auditor", task_type: "", title: "", details: "", priority: "p3" });
  const save = useMutation({
    mutationFn: () =>
      api.post<Task>("/tasks", {
        client_id: form.client_id,
        to_agent: form.to_agent,
        task_type: form.task_type || "manual",
        title: form.title,
        payload: form.details ? { details: form.details } : {},
        priority: form.priority,
      }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast(`Assigned to ${agentName(t.to_agent)}`);
      onClose();
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Assign a task to a bot"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="task-form" busy={save.isPending} disabled={!form.client_id || !form.title}>
            Assign task
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client" htmlFor="task-client">
            <Select id="task-client" required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
              <option value="">Choose a client</option>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bot" htmlFor="task-bot">
            <Select id="task-bot" value={form.to_agent} onChange={(e) => setForm({ ...form, to_agent: e.target.value })}>
              {AGENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <TextField label="What to do" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Run a prospect audit on brand.com" />
        <TextField label="Task type" value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })} placeholder="e.g. prospect_audit" hint="Optional short code the bot's routine can match on." />
        <Field label="Details" htmlFor="task-details">
          <Textarea id="task-details" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
        </Field>
        <Field label="Priority" htmlFor="task-priority">
          <Select id="task-priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-auto">
            <option value="p1">P1 urgent</option>
            <option value="p2">P2 high</option>
            <option value="p3">P3 normal</option>
            <option value="p4">P4 low</option>
          </Select>
        </Field>
      </form>
    </Dialog>
  );
}
