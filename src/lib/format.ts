export const AGENTS: { id: string; name: string; short: string }[] = [
  { id: "seo_lead", name: "SEO Lead", short: "Lead" },
  { id: "technical_auditor", name: "Technical Auditor", short: "Auditor" },
  { id: "on_page", name: "On-Page Optimizer", short: "On-Page" },
  { id: "content_writer", name: "Content Writer", short: "Writer" },
  { id: "off_page", name: "Off-Page Optimizer", short: "Off-Page" },
  { id: "ai_search", name: "AI Search Optimizer", short: "AI Search" },
  { id: "local_seo", name: "Local SEO Optimizer", short: "Local" },
  { id: "developer", name: "Developer", short: "Developer" },
  { id: "analyst", name: "Analyst", short: "Analyst" },
  { id: "strategist", name: "Strategist", short: "Strategist" },
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

// Words that stay upper case when a snake_case value is shown as text.
const ACRONYMS = new Set(["ai", "seo", "gbp", "url", "urls", "ctr", "cwv", "lcp", "cls", "inp", "faq", "gsc", "ga4", "api", "pr", "oos", "nap"]);

export function humanize(s: string | null | undefined): string {
  if (!s) return "";
  const t = s
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w))
    .join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Like humanize, but lower case for use mid-sentence ("weekly summary", "monthly AI visibility"). */
export function phrase(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.toLowerCase()))
    .join(" ");
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Where a metric comes from, in words a reviewer knows. */
export const SOURCE_LABEL: Record<string, string> = {
  gsc: "Search Console",
  ga4: "Google Analytics",
  rank_tracker: "Rankings",
  pagespeed: "Page speed",
  ai_search: "AI search",
  gbp: "Google Business Profile",
  backlinks: "Backlinks",
};

export function sourceLabel(s: string): string {
  return SOURCE_LABEL[s] ?? humanize(s);
}

// Bot tool and task names that show up in run summaries, as plain words.
const TERMS: Record<string, string> = {
  start_run: "start of run",
  finish_run: "end of run",
  fix_on_page: "on-page fix",
  fix_titles: "title fix",
  write_post: "post to write",
  faq_content: "FAQ content",
  syndicate_post: "syndication",
  pin_post: "Pinterest pin",
  link_targets: "link targets",
  audit_pages: "page audit",
  investigate_drop: "traffic drop check",
  record_metrics: "saving metrics",
  record_findings: "saving findings",
  create_human_required: "inbox item",
  propose_change: "planned change",
};

/**
 * Bot-written text for people: drops record ids (full UUIDs and 8-character prefixes) and turns
 * tool and task names into words. Keeps everything else as written.
 */
export function plain(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/without calling finish_run/g, "without closing its run")
    .replace(/\s*\(?\b[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\b\)?/gi, "")
    .replace(/\s*\(?\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{8}\b\)?(?!-)/gi, "")
    .replace(/`?\b([a-z]+(?:_[a-z0-9]+)+)\b`?/g, (m, w: string) => TERMS[w] ?? (m.startsWith("`") ? phrase(w) : m))
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** One short label per inbox category, and what a person does with it. */
export const INBOX_GROUPS = [
  { id: "decide", label: "Decide", categories: ["approval"], empty: "No drafts or site changes waiting for a decision." },
  { id: "unblock", label: "Unblock", categories: ["blocked", "login", "captcha"], empty: "No bot is stuck. Logins, captchas and missing setup show up here." },
  { id: "answer", label: "Answer", categories: ["question", "negative_review", "other"], empty: "No questions from the bots." },
] as const;

export type InboxGroup = (typeof INBOX_GROUPS)[number]["id"];

export function groupOf(category: string): InboxGroup {
  return INBOX_GROUPS.find((g) => (g.categories as readonly string[]).includes(category))?.id ?? "answer";
}

export const CATEGORY_LABEL: Record<string, string> = {
  approval: "Approval",
  blocked: "Blocked",
  login: "Login",
  captcha: "Captcha",
  question: "Question",
  negative_review: "Review",
  other: "Note",
};

export const PRIORITY_LABEL: Record<string, string> = { p1: "P1 urgent", p2: "P2 high", p3: "P3 normal", p4: "P4 low" };
