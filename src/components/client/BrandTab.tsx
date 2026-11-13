import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { ago } from "@/lib/format";
import { Button, ErrorNote, Field, IconButton, Input, Panel, Select, Skeleton, Textarea, errorText, useToast } from "../ui";
import type { ClientProfile } from "@/api-types/ClientProfile";
import type { ProfileInput } from "@/api-types/ProfileInput";

type Claim = { claim: string; source?: string };

const ACTION_TYPES = [
  ["publish_blog_post", "Publish blog posts"],
  ["publish_pin", "Publish Pinterest pins"],
  ["syndicate_article", "Syndicate articles (Medium, LinkedIn, Substack)"],
  ["submit_directory_listing", "Submit directory listings"],
] as const;

export function BrandTab({ clientId }: { clientId: string }) {
  const { isAdmin } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["profile", clientId], queryFn: () => api.get<ClientProfile>(`/clients/${clientId}/profile`) });
  const [voice, setVoice] = useState("");
  const [rules, setRules] = useState<string[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [banned, setBanned] = useState<string[]>([]);
  const [cadence, setCadence] = useState(2);
  const [autonomy, setAutonomy] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    setVoice(q.data.brand_voice);
    setRules((q.data.voice_rules as string[]) ?? []);
    setClaims((q.data.approved_claims as Claim[]) ?? []);
    setBanned((q.data.banned_terms as string[]) ?? []);
    setCadence(q.data.post_cadence_per_week);
    setAutonomy((q.data.autonomy as Record<string, string>) ?? {});
    setDirty(false);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => {
      const body: ProfileInput = {
        brand_voice: voice,
        voice_rules: rules.map((r) => r.trim()).filter(Boolean),
        approved_claims: claims.filter((c) => c.claim.trim()),
        banned_terms: banned.map((b) => b.trim()).filter(Boolean),
        post_cadence_per_week: cadence,
        autonomy: autonomy as ProfileInput["autonomy"],
      };
      return api.put<ClientProfile>(`/clients/${clientId}/profile`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", clientId] });
      toast("Brand rules saved. Bots use them from their next run.");
    },
    onError: (e) => toast(errorText(e), "error"),
  });

  if (q.isLoading) return <Skeleton rows={6} />;
  if (q.error) return <ErrorNote error={q.error} />;
  const ro = !isAdmin;
  const touch = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setDirty(true);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Brand voice">
        <div className="flex flex-col gap-4 p-4">
          <Field label="How this brand sounds" hint="A few sentences the Content Writer and On-Page bots follow.">
            <Textarea disabled={ro} value={voice} onChange={(e) => touch(setVoice)(e.target.value)} className="min-h-28" />
          </Field>
          <ListEditor label="Voice rules" placeholder="e.g. Never use exclamation marks" items={rules} onChange={touch(setRules)} disabled={ro} />
          <ListEditor label="Banned words and phrases" placeholder="e.g. best in the world" items={banned} onChange={touch(setBanned)} disabled={ro} />
        </div>
      </Panel>

      <Panel title="Approved claims">
        <div className="p-4">
          <p className="mb-3 text-[13px] text-ink-2">
            Bots only make claims about materials, sustainability, sizing or discounts when they appear here or in Shopify product data. Add the source so the team can check it.
          </p>
          <ul className="flex flex-col gap-2">
            {claims.map((c, i) => (
              <li key={i} className="flex gap-2">
                <div className="grid flex-1 gap-1.5 sm:grid-cols-[2fr_1fr]">
                  <Input
                    aria-label="Claim"
                    disabled={ro}
                    value={c.claim}
                    placeholder="Made from 100% European linen"
                    onChange={(e) => touch(setClaims)(claims.map((x, j) => (j === i ? { ...x, claim: e.target.value } : x)))}
                  />
                  <Input
                    aria-label="Source"
                    disabled={ro}
                    value={c.source ?? ""}
                    placeholder="Source"
                    onChange={(e) => touch(setClaims)(claims.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)))}
                  />
                </div>
                {!ro ? (
                  <IconButton label="Remove claim" onClick={() => touch(setClaims)(claims.filter((_, j) => j !== i))}>
                    <X size={15} />
                  </IconButton>
                ) : null}
              </li>
            ))}
          </ul>
          {!ro ? (
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => touch(setClaims)([...claims, { claim: "", source: "" }])}>
              <Plus size={14} /> Add claim
            </Button>
          ) : null}
        </div>
      </Panel>

      <Panel title="Publishing limits" className="lg:col-span-2">
        <div className="grid gap-6 p-4 md:grid-cols-[220px_1fr]">
          <Field label="Blog posts per week, max" hint="Bots can't publish past this, even with approval.">
            <Input type="number" min={0} max={14} disabled={ro} value={cadence} onChange={(e) => touch(setCadence)(Number(e.target.value))} className="w-24" />
          </Field>
          <div>
            <p className="text-[13px] font-medium">What bots may publish without asking</p>
            <p className="mb-2 text-[13px] text-ink-2">
              Only applies to bots set to "Auto for low-risk" on the Bots tab. Everything else bots do on a live site or send to people, such as titles, alt text, links, copy, schema, pitches, review replies and Google Business Profile changes, always needs a person.
            </p>
            <ul className="divide-y divide-line rounded-md border border-line">
              {ACTION_TYPES.map(([id, label]) => (
                <li key={id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>{label}</span>
                  <Select
                    aria-label={label}
                    disabled={ro}
                    value={autonomy[id] ?? "approval"}
                    onChange={(e) => touch(setAutonomy)({ ...autonomy, [id]: e.target.value })}
                    className="h-8 w-auto"
                  >
                    <option value="approval">Ask first</option>
                    <option value="auto">Publish directly</option>
                  </Select>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      {!ro ? (
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-line bg-canvas py-3 lg:col-span-2">
          <span className="text-[13px] text-ink-3">{dirty ? "Unsaved changes" : `Saved ${ago(q.data?.updated_at)}`}</span>
          <Button variant="primary" disabled={!dirty} busy={save.isPending} onClick={() => save.mutate()}>
            Save brand rules
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ListEditor({ label, items, onChange, placeholder, disabled }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string; disabled?: boolean }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft("");
  };
  return (
    <div>
      <p className="mb-1 text-[13px] font-medium">{label}</p>
      <ul className="mb-2 flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="inline-flex items-center gap-1 rounded-md bg-sunken py-0.5 pr-1 pl-2 text-[13px]">
            {it}
            {!disabled ? (
              <button aria-label={`Remove ${it}`} className="rounded p-0.5 text-ink-3 hover:text-ink" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <X size={12} />
              </button>
            ) : null}
          </li>
        ))}
        {!items.length ? <li className="text-[13px] text-ink-3">None yet</li> : null}
      </ul>
      {!disabled ? (
        <div className="flex gap-2">
          <Input
            aria-label={`New ${label.toLowerCase()}`}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button onClick={add} disabled={!draft.trim()}>
            Add
          </Button>
        </div>
      ) : null}
    </div>
  );
}
