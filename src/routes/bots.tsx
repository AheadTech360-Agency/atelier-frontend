import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useScopedClient, useSession } from "@/lib/session";
import { agentName, ago } from "@/lib/format";
import { useClients } from "@/components/Shell";
import { Button, Dialog, ErrorNote, Field, PageHeader, Panel, Select, Skeleton, StatusBadge, TextField, errorText, useToast } from "@/components/ui";
import { ProspectReviewButton, ProspectReviewsPanel } from "@/components/ProspectReviews";
import type { Agent } from "@/api-types/Agent";
import type { AgentStats } from "@/api-types/AgentStats";
import type { TriggerResult } from "@/api-types/TriggerResult";

export function BotsPage() {
  const { isAdmin } = useSession();
  const clientId = useScopedClient();
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => api.get<Agent[]>("/agents") });
  // Last run, failures and queue per bot, computed in the database: one small row per bot.
  const stats = useQuery({
    queryKey: ["agent-stats", clientId],
    queryFn: () => api.get<AgentStats[]>("/agents/stats", { client_id: clientId }),
    refetchInterval: 60_000,
  });
  const [editing, setEditing] = useState<Agent | null>(null);
  const [running, setRunning] = useState<Agent | null>(null);

  const mcpUrl = `${(import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api\/v1\/?$/, "") ?? "http://127.0.0.1:8080"}/mcp`;

  return (
    <div>
      <PageHeader
        title="Bots"
        description={
          <>
            Each bot connects to <code className="rounded bg-sunken px-1 text-[13px]">{mcpUrl}</code> with its own key from{" "}
            <Link to="/settings" search={{ tab: "keys" }} className="text-denim underline underline-offset-2">
              Settings, Bot keys
            </Link>
            .
          </>
        }
        actions={<ProspectReviewButton />}
      />
      {agents.isLoading ? (
        <Skeleton rows={7} />
      ) : agents.error ? (
        <ErrorNote error={agents.error} />
      ) : (
        <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <ProspectReviewsPanel />
          </div>
          {agents.data!.map((a) => {
            const st = stats.data?.find((x) => x.agent_id === a.id);
            const last = st?.last_run_at ? { status: st.last_run_status ?? "", started_at: st.last_run_at, summary: st.last_run_summary, error: st.last_run_error } : null;
            const failed7 = st?.failed_7d ?? 0;
            const queue = st?.tasks_open ?? 0;
            return (
              <Panel
                key={a.id}
                title={a.name}
                actions={
                  <div className="flex gap-1.5">
                    {isAdmin ? (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                        Edit
                      </Button>
                    ) : null}
                    <Button size="sm" onClick={() => setRunning(a)} disabled={!a.rakazo_webhook_url} title={a.rakazo_webhook_url ? undefined : "Add the Rakazo webhook URL first"}>
                      Run now
                    </Button>
                  </div>
                }
              >
                <div className="px-4 py-3">
                  <p className="text-ink-2">{a.description}</p>
                  <p className="mt-1 text-[13px] text-ink-3">{a.schedule_label}</p>
                </div>
                <dl className="grid grid-cols-3 border-t border-line text-[13px]">
                  <div className="border-r border-line px-4 py-2.5">
                    <dt className="text-ink-3">Last run</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5">
                      {last ? (
                        <>
                          <StatusBadge s={last.status} /> {ago(last.started_at)}
                        </>
                      ) : (
                        "Never"
                      )}
                    </dd>
                  </div>
                  <div className="border-r border-line px-4 py-2.5">
                    <dt className="text-ink-3">Failed, 7 days</dt>
                    <dd className={`tabular mt-0.5 ${failed7 ? "font-semibold text-p1" : ""}`}>{failed7}</dd>
                  </div>
                  <div className="px-4 py-2.5">
                    <dt className="text-ink-3">Tasks queued</dt>
                    <dd className="tabular mt-0.5">{queue}</dd>
                  </div>
                </dl>
                {last?.summary || last?.error ? (
                  <p className={`border-t border-line px-4 py-2.5 text-[13px] ${last.error ? "text-p1" : "text-ink-2"}`}>{last.error ?? last.summary}</p>
                ) : null}
              </Panel>
            );
          })}
        </div>
      )}
      {editing ? <EditBot agent={editing} onClose={() => setEditing(null)} /> : null}
      {running ? <RunBot agent={running} onClose={() => setRunning(null)} /> : null}
    </div>
  );
}

function EditBot({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [schedule, setSchedule] = useState(agent.schedule_label);
  const [webhook, setWebhook] = useState(agent.rakazo_webhook_url ?? "");
  const save = useMutation({
    mutationFn: () => api.put(`/agents/${agent.id}`, { schedule_label: schedule, rakazo_webhook_url: webhook || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast("Bot saved");
      onClose();
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit ${agent.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={save.isPending} onClick={() => save.mutate()}>
            Save bot
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Schedule" value={schedule} onChange={(e) => setSchedule(e.target.value)} hint="Shown to the team. The real schedule is set in Rakazo." />
        <TextField label="Rakazo webhook URL" type="url" value={webhook} onChange={(e) => setWebhook(e.target.value)} hint="From the bot's webhook trigger in Rakazo. Enables Run now." />
      </div>
    </Dialog>
  );
}

function RunBot({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const clients = useClients();
  const toast = useToast();
  const [client, setClient] = useState("");
  const [note, setNote] = useState("");
  const run = useMutation({
    mutationFn: () => api.post<TriggerResult>(`/agents/${agent.id}/run`, { client_id: client || null, note: note || null }),
    onSuccess: (r) => {
      toast(r.sent ? `${agentName(agent.id)} started` : `Rakazo answered with status ${r.status}. Check the webhook in Rakazo.`, r.sent ? "ok" : "error");
      if (r.sent) onClose();
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Run ${agent.name} now`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={run.isPending} onClick={() => run.mutate()}>
            Start run
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Client" htmlFor="run-client" hint="Leave on all clients to run the bot's normal routine.">
          <Select id="run-client" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">All clients</option>
            {clients.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <TextField label="Note for the bot" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Prospect audit for brand.com before Thursday's call" />
      </div>
    </Dialog>
  );
}
