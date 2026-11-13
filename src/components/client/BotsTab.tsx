import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { agentName } from "@/lib/format";
import { Checkbox, ErrorNote, Input, Panel, Select, Skeleton, errorText, useToast } from "../ui";
import type { AgentClientSetting } from "@/api-types/AgentClientSetting";
import type { AgentSettingInput } from "@/api-types/AgentSettingInput";

const AUTONOMY_HELP: Record<string, string> = {
  approval: "Drafts everything, asks before anything goes live",
  auto_low_risk: "Publishes the action types you allowed on Brand & claims, asks for the rest",
  auto: "Publishes directly, except actions that always need a person",
};

export function BotsTab({ clientId }: { clientId: string }) {
  const { isAdmin } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["settings", clientId], queryFn: () => api.get<AgentClientSetting[]>(`/clients/${clientId}/settings`) });
  const save = useMutation({
    mutationFn: ({ agent, body }: { agent: string; body: AgentSettingInput }) => api.put(`/clients/${clientId}/settings/${agent}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", clientId] });
      toast("Bot settings saved");
    },
    onError: (e) => toast(errorText(e), "error"),
  });

  if (q.isLoading) return <Skeleton rows={7} />;
  if (q.error) return <ErrorNote error={q.error} />;

  const update = (s: AgentClientSetting, patch: Partial<AgentSettingInput>) =>
    save.mutate({ agent: s.agent_id, body: { enabled: s.enabled, cadence: s.cadence, autonomy: s.autonomy, config: s.config as never, ...patch } });

  return (
    <Panel title="Bots for this client">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="text-[12.5px] text-ink-3">
            <tr className="border-b border-line">
              <th className="px-4 py-2 font-medium">Bot</th>
              <th className="px-4 py-2 font-medium">Cadence note</th>
              <th className="px-4 py-2 font-medium">Autonomy</th>
            </tr>
          </thead>
          <tbody>
            {q.data!.map((s) => (
              <tr key={s.agent_id} className="border-b border-line align-top last:border-0">
                <td className="px-4 py-3">
                  <Checkbox label={agentName(s.agent_id)} checked={s.enabled} onChange={(v) => isAdmin && update(s, { enabled: v })} />
                </td>
                <td className="px-4 py-3">
                  <Input
                    aria-label={`${agentName(s.agent_id)} cadence`}
                    disabled={!isAdmin}
                    defaultValue={s.cadence}
                    placeholder="e.g. 2 posts a week, Tue and Thu"
                    onBlur={(e) => e.target.value !== s.cadence && update(s, { cadence: e.target.value })}
                    className="h-8"
                  />
                </td>
                <td className="px-4 py-3">
                  <Select
                    aria-label={`${agentName(s.agent_id)} autonomy`}
                    disabled={!isAdmin}
                    value={s.autonomy}
                    onChange={(e) => update(s, { autonomy: e.target.value })}
                    className="h-8 w-auto"
                  >
                    <option value="approval">Ask first</option>
                    <option value="auto_low_risk">Auto for low-risk</option>
                    <option value="auto">Auto</option>
                  </Select>
                  <p className="mt-1 max-w-[42ch] text-[12.5px] text-ink-3">{AUTONOMY_HELP[s.autonomy]}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
