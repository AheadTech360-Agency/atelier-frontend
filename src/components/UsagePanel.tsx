import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useScopedClient } from "@/lib/session";
import { EmptyState, ErrorNote, Panel, Select, Skeleton, Tabs } from "./ui";
import type { Usage } from "@/api-types/Usage";
import type { UsageRow } from "@/api-types/UsageRow";

const n = (v: number) => v.toLocaleString("en-US");

/** Where LLM spend goes: tokens reported by bots in finish_run, per bot and per client. */
export function UsagePanel() {
  const [days, setDays] = useState(30);
  const [view, setView] = useState("bot");
  const clientId = useScopedClient();
  const q = useQuery({ queryKey: ["usage", days], queryFn: () => api.get<Usage>("/usage", { days }) });

  const rows: UsageRow[] = q.data ? (view === "bot" ? q.data.by_bot : q.data.by_client.filter((r) => !clientId || r.key === clientId)) : [];
  const total = rows.reduce((t, r) => t + r.input_tokens + r.output_tokens, 0);
  const anyUsage = q.data && [...q.data.by_bot].some((r) => r.runs_with_usage > 0);

  return (
    <Panel
      title="LLM usage"
      className="xl:col-span-2"
      actions={
        <Select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-8 w-auto">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </Select>
      }
    >
      <Tabs
        tabs={[
          { id: "bot", label: "By bot" },
          { id: "client", label: "By client" },
        ]}
        value={view}
        onChange={setView}
      />
      {q.isLoading ? (
        <Skeleton rows={4} />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : !anyUsage ? (
        <EmptyState
          title="No token counts reported yet"
          body="Bots report input_tokens, output_tokens and model when they call finish_run. Totals show up here after their next runs."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead className="text-[12.5px] text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">{view === "bot" ? "Bot" : "Client"}</th>
                <th className="px-4 py-2 text-right font-medium">Runs</th>
                <th className="px-4 py-2 text-right font-medium">Input tokens</th>
                <th className="px-4 py-2 text-right font-medium">Output tokens</th>
                <th className="px-4 py-2 text-right font-medium">Share</th>
                <th className="px-4 py-2 font-medium">Models</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tokens = r.input_tokens + r.output_tokens;
                const share = total ? Math.round((tokens / total) * 100) : 0;
                return (
                  <tr key={r.key} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 font-medium">{r.label}</td>
                    <td className="tabular px-4 text-right" title={`${r.runs_with_usage} of ${r.runs} runs reported tokens`}>
                      {n(r.runs)}
                      {r.runs_with_usage < r.runs ? <span className="text-ink-3"> ({n(r.runs - r.runs_with_usage)} unreported)</span> : null}
                    </td>
                    <td className="tabular px-4 text-right">{n(r.input_tokens)}</td>
                    <td className="tabular px-4 text-right">{n(r.output_tokens)}</td>
                    <td className="px-4">
                      <div className="flex items-center justify-end gap-2">
                        <span className="tabular w-9 text-right text-[13px] text-ink-2">{share}%</span>
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-sunken" aria-hidden>
                          <span className="block h-full bg-denim" style={{ width: `${share}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="px-4 text-[13px] text-ink-2">{r.models.join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-line px-4 py-2.5 text-[12.5px] text-ink-3">
            Token counts as reported by each bot. Multiply by your model prices for cost; Atelier doesn't store prices.
          </p>
        </div>
      )}
    </Panel>
  );
}
