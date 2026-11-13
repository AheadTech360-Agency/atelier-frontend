import type { AgentId } from "@/api-types/AgentId";

export const AGENTS: { id: AgentId; name: string; short: string }[] = [
  { id: "seo_lead", name: "SEO Lead", short: "Lead" },
  { id: "technical_auditor", name: "Technical Auditor", short: "Auditor" },
  { id: "on_page", name: "On-Page Optimizer", short: "On-Page" },
  { id: "content_writer", name: "Content Writer", short: "Writer" },
  { id: "off_page", name: "Off-Page Optimizer", short: "Off-Page" },
  { id: "ai_search", name: "AI Search Optimizer", short: "AI Search" },
  { id: "local_seo", name: "Local SEO Optimizer", short: "Local" },
];

export function agentName(id: string | null | undefined, short = false): string {
  if (!id) return "Human";
  const a = AGENTS.find((x) => x.id === id);
  return a ? (short ? a.short : a.name) : id;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const secs = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(secs);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(secs / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(secs / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(secs / 86400), "day");
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function daysOpen(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function humanize(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const PRIORITY_LABEL: Record<string, string> = { p1: "P1 urgent", p2: "P2 high", p3: "P3 normal", p4: "P4 low" };
