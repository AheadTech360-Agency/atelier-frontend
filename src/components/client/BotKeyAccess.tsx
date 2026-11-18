import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { agentName } from "@/lib/format";
import { useClients } from "../Shell";
import { ErrorNote, Panel, Skeleton, errorText, useToast } from "../ui";
import type { AgentKey } from "@/api-types/AgentKey";
import type { KeyClientsInput } from "@/api-types/KeyClientsInput";

/** Which bot keys may work on this client. Admins only (keys are admin data). */
export function BotKeyAccess({ clientId, clientName }: { clientId: string; clientName: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const clients = useClients();
  const q = useQuery({ queryKey: ["keys"], queryFn: () => api.get<AgentKey[]>("/agent-keys", { limit: 200 }) });
  const save = useMutation({
    mutationFn: ({ key, ids }: { key: AgentKey; ids: string[] | null }) =>
      api.patch<AgentKey>(`/agent-keys/${key.id}`, { client_ids: ids } satisfies KeyClientsInput),
    onSuccess: (_d, { ids }) => {
      qc.invalidateQueries({ queryKey: ["keys"] });
      toast(ids === null || ids.includes(clientId) ? `Bots can now work on ${clientName}` : `Bots no longer reach ${clientName}`);
    },
    onError: (e) => toast(errorText(e), "error"),
  });

  if (q.isLoading) return <Skeleton rows={2} />;
  if (q.error) return <ErrorNote error={q.error} />;
  const keys = (q.data ?? []).filter((k) => !k.revoked_at);
  const covers = (k: AgentKey) => k.client_ids === null || k.client_ids.includes(clientId);
  const reached = keys.some(covers);

  const toggle = (k: AgentKey, on: boolean) => {
    const all = (clients.data ?? []).map((c) => c.id);
    let ids: string[] | null;
    if (on) {
      ids = [...new Set([...(k.client_ids ?? []), clientId])];
      // Ticking the last missing client is the same as "every client".
      if (all.length && all.every((id) => ids!.includes(id))) ids = null;
    } else {
      // A key for every client becomes "every client except this one".
      ids = (k.client_ids ?? all).filter((id) => id !== clientId);
      if (!ids.length) {
        toast("A key needs at least one client. Revoke it in Settings, Bot keys instead.", "error");
        return;
      }
    }
    save.mutate({ key: k, ids });
  };

  return (
    <Panel title="Bot key access">
      <p className="px-4 pb-2 text-[13px] text-ink-2">
        {reached
          ? `The bots use these keys in Rakazo. Ticked keys can work on ${clientName}.`
          : `No bot key can reach ${clientName} yet, so no bot works on it. Tick the key you use in Rakazo.`}
      </p>
      {!keys.length ? (
        <p className="px-4 pb-4 text-[13px] text-ink-3">No bot keys yet. Create one in Settings, Bot keys.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-[13.5px]">
                <input
                  type="checkbox"
                  checked={covers(k)}
                  disabled={save.isPending}
                  onChange={(e) => toggle(k, e.target.checked)}
                  className="size-4 rounded border-line-strong accent-[var(--color-denim)]"
                />
                <span className="font-medium">{k.agent_id ? agentName(k.agent_id) : "All bots"}</span>
                <span className="text-ink-2">{k.label}</span>
                <code className="text-[12px] text-ink-3">{k.key_prefix}…</code>
              </label>
              <span className="text-[12.5px] text-ink-3">
                {k.client_ids === null ? "Every client" : `${k.client_ids.length} ${k.client_ids.length === 1 ? "client" : "clients"}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
