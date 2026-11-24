/**
 * Local preview data, so design checks can open every screen without signing in or touching the
 * database. Only used when the dev server runs with VITE_DEMO=1; production builds strip it out.
 * Everything here is sample data for two made-up fashion brands.
 */
import type { HumanRequired } from "@/api-types/HumanRequired";
import type { Run } from "@/api-types/Run";

const H = 3600_000;
const D = 24 * H;
const now = Date.now();
const at = (msAgo: number) => new Date(now - msAgo).toISOString();
const day = (daysAgo: number) => new Date(now - daysAgo * D).toISOString().slice(0, 10);
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

const NORTHLINE = uid();
const MARLOW = uid();
export const clients = [
  { id: NORTHLINE, name: "Northline Denim", domain: "northlinedenim.co", status: "active", timezone: "America/New_York", notes: "", phase: "execution", created_at: at(40 * D), updated_at: at(2 * D) },
  { id: MARLOW, name: "Marlow & Pine", domain: "marlowandpine.co", status: "active", timezone: "America/Los_Angeles", notes: "", phase: "fix_first", created_at: at(21 * D), updated_at: at(D) },
];

const AGENTS = [
  ["seo_lead", "SEO Lead", "Daily traffic check, weekly client summary, hands work to the other bots.", "Daily 7:00, weekly report Mondays"],
  ["technical_auditor", "Technical Auditor", "Crawls the site for broken links, redirects, indexing and Core Web Vitals.", "Weekly, Mondays"],
  ["on_page", "On-Page Optimizer", "Titles, metas, headings, alt text and internal links, from the keyword map.", "Weekly, after the audit"],
  ["content_writer", "Content Writer", "Monthly topic plan, briefs and posts in the brand's voice.", "Monthly plan, posts Tue and Thu"],
  ["off_page", "Off-Page Optimizer", "Syndication, pins, directory listings and link outreach drafts.", "Weekdays"],
  ["ai_search", "AI Search Optimizer", "How often the brand is cited in ChatGPT, Gemini and AI Overviews.", "Weekly, Wednesdays"],
  ["local_seo", "Local SEO Optimizer", "Google Business Profile and local listings.", "Weekly"],
  ["developer", "Developer", "Builds approved site changes and fixes in code and the CMS.", "Weekdays"],
  ["analyst", "Analyst", "Measures traffic, rankings and conversions, and reports what changed.", "Daily"],
  ["strategist", "Strategist", "Sets each client's priorities and plan for the next weeks.", "Weekly, Mondays"],
] as const;
export const agents = AGENTS.map(([id, name, description, schedule_label], i) => ({
  id, name, description, schedule_label, rakazo_webhook_url: i < 5 ? "https://hooks.rakazo.example/run" : null, sort_order: i,
}));

function hr(o: Partial<HumanRequired> & Pick<HumanRequired, "client_id" | "agent_id" | "category" | "issue" | "ask" | "priority">, hoursAgo: number): HumanRequired {
  return {
    id: uid(), action_type: null, draft: null, link: null, status: "open", reviewer_note: null, edited_draft: null,
    decided_by: null, decided_at: null, acted_on_at: null, run_id: null, created_at: at(hoursAgo * H), updated_at: at(hoursAgo * H), ...o,
  };
}

const TITLE_TABLE = `| What | Field | Now | After |
|---|---|---|---|
| blogPost "Raw vs washed denim" | seo.title | Raw vs Washed Denim | Raw vs Washed Denim: How Each Fades in a Year |`;

export const items: HumanRequired[] = [
  hr({ client_id: NORTHLINE, agent_id: "on_page", category: "approval", action_type: "update_meta_titles", priority: "p3",
    issue: "Change: retitle the raw vs washed denim guide (412 impressions, 3 clicks at position 14.2)",
    ask: "Approve and Atelier applies this title change to the live site in Sanity. Send back if the wording is off.",
    draft: `Search Console, last 28 days: 412 impressions, 3 clicks, average position 14.2. The current title doesn't say what the reader gets.\n\n${TITLE_TABLE}` }, 3),
  hr({ client_id: NORTHLINE, agent_id: "content_writer", category: "approval", action_type: "publish_topic_calendar", priority: "p3",
    issue: "December topic calendar: 8 posts, Tuesdays and Thursdays",
    ask: "Approve the December plan, or send back the posts you'd change.",
    draft: "| Date | Post | Keyword |\n|---|---|---|\n| Tue Dec 1 | How to break in raw denim | break in raw denim |\n| Thu Dec 3 | Selvedge, explained | what is selvedge denim |\n| Tue Dec 8 | Gift guide: jeans that last | best jeans gift |\n| Thu Dec 10 | Washing raw denim the first time | first wash raw denim |" }, 20),
  hr({ client_id: MARLOW, agent_id: "off_page", category: "approval", action_type: "send_pitch", priority: "p3",
    issue: "Pitch to a home and style editor about the linen bedding line",
    ask: "Approve this pitch to send it. The editor wrote about linen care on Nov 9.",
    draft: "Hi Dana,\n\nYour Nov 9 piece on caring for linen was the clearest I've read. Marlow & Pine weaves its bedding from European flax, and our wash guide covers the one thing your piece left open: how hot is too hot. Happy to send the guide, or a set to try.\n\nBest,\nSam" }, 30),
  hr({ client_id: NORTHLINE, agent_id: "technical_auditor", category: "blocked", priority: "p2",
    issue: "Developer ticket: http and non-www URLs answer with 307, not 301",
    ask: "Ask the developer to make every http and non-www URL return one 301 to https://www.northlinedenim.co/, then mark this done.",
    draft: "Problem: http://northlinedenim.co/ returns 307 to https://northlinedenim.co/, which returns 307 to https://www.northlinedenim.co/. Google still reports 61 impressions on non-www URLs in the last 28 days." }, 76),
  hr({ client_id: MARLOW, agent_id: "ai_search", category: "captcha", priority: "p2",
    issue: "Gemini asked for a verification check before any query",
    ask: "Open the AI Search Optimizer's browser in Rakazo, pass the check on gemini.google.com, then mark this done." }, 8),
  hr({ client_id: NORTHLINE, agent_id: "content_writer", category: "question", priority: "p3",
    issue: "Can posts mention the lifetime repair offer?",
    ask: "The About page promises free repairs for life, but it isn't in the approved claims. Can posts mention it?" }, 52),
  hr({ client_id: MARLOW, agent_id: "seo_lead", category: "question", priority: "p4",
    issue: "Run the weekly summary on Mondays or Fridays?",
    ask: "The team reads the summary on Monday mornings. Should it arrive Monday 7:00 or the Friday before?" }, 5),
  hr({ client_id: NORTHLINE, agent_id: "off_page", category: "approval", action_type: "request_link", priority: "p4", status: "needs_changes",
    issue: "Link request to a denim forum's buying guide", reviewer_note: "Shorter, and lead with the fade photos.", decided_at: at(2 * H),
    ask: "Approve this link request.", draft: "Hello, your raw denim buying guide mentions us without a link..." }, 26),
];

const done: HumanRequired[] = [
  hr({ client_id: MARLOW, agent_id: "on_page", category: "approval", action_type: "update_alt_text", priority: "p3", status: "approved",
    issue: "Alt text for 14 bedding photos", ask: "Approve the alt text.", decided_at: at(28 * H), acted_on_at: at(27 * H) }, 50),
  hr({ client_id: NORTHLINE, agent_id: "technical_auditor", category: "login", priority: "p2", status: "resolved",
    issue: "Search Console sign-in expired", ask: "Sign in again in the bot's browser.", decided_at: at(3 * D), acted_on_at: at(3 * D) }, 4 * 24),
];

// Seven days of runs: each bot's routine, with a few partial and one failed run.
export const runs: Run[] = (() => {
  const out: Run[] = [];
  const plan: Record<string, number[]> = {
    seo_lead: [0, 1, 2, 3, 4, 5, 6], technical_auditor: [0, 3, 6], on_page: [0, 3], content_writer: [1, 3, 5],
    off_page: [0, 1, 2, 5, 6], ai_search: [2], local_seo: [], developer: [1, 4], analyst: [0, 1, 2, 3, 4, 5, 6], strategist: [0],
  };
  const odd: Record<string, string> = { "off_page|1": "partial", "technical_auditor|3": "failed", "ai_search|2": "partial", "content_writer|5": "partial" };
  const summary: Record<string, string> = {
    seo_lead: "Daily check: saved 4 Search Console and 1 Analytics numbers per client, no drops over the thresholds.",
    technical_auditor: "Weekly audit: 6 findings recorded, 1 developer ticket raised.",
    on_page: "Planned 1 title change in Sanity, waiting for approval.",
    content_writer: "Drafted the December calendar and 1 post.",
    off_page: "Scored 3 prospects and drafted 1 pitch.",
    ai_search: "Asked ChatGPT 20 questions; Gemini blocked by a verification check.",
    local_seo: "",
    developer: "Opened 1 approved redirect change and checked it live.",
    analyst: "Saved daily traffic and ranking numbers for every client.",
    strategist: "Updated the priorities for the next two weeks.",
  };
  for (const [agent, days] of Object.entries(plan)) {
    for (const d of days) {
      const status = odd[`${agent}|${d}`] ?? "succeeded";
      const start = now - d * D - (9 + (agent.length % 5)) * H;
      out.push({
        id: uid(), agent_id: agent, client_id: d % 2 ? MARLOW : NORTHLINE, rakazo_run_id: null, status,
        summary: status === "failed" ? "" : summary[agent], stats: {}, error: status === "failed" ? "Sanity token was rejected (401)." : null,
        started_at: new Date(start).toISOString(), finished_at: new Date(start + 6 * 60_000).toISOString(),
        input_tokens: 41_200, output_tokens: 3_900, model: "claude-sonnet-5-5", last_activity_at: null, tool_calls: 18, auto_started: false,
      });
    }
  }
  return out.sort((a, b) => b.started_at.localeCompare(a.started_at));
})();

const findings = [
  ["redirect_chain", "high", "http://northlinedenim.co/", "Two 307 hops before the homepage"],
  ["title", "medium", "https://www.northlinedenim.co/blog/raw-vs-washed", "Title doesn't match the searches it ranks for"],
  ["alt_text", "low", "https://www.northlinedenim.co/collections/selvedge", "9 product images without alt text"],
  ["cwv_lcp", "medium", "https://www.northlinedenim.co/", "Largest paint 3.4 s on phones"],
].map(([finding_type, severity, url, title]) => ({
  id: uid(), client_id: NORTHLINE, agent_id: "technical_auditor", run_id: null, finding_type, severity, url, page_template: null, title,
  detail: "", data: {}, status: "open", assigned_agent: finding_type === "title" || finding_type === "alt_text" ? "on_page" : null,
  dev_ticket_url: null, fingerprint: `${finding_type}|${url}`, first_seen_at: at(6 * D), last_seen_at: at(D), resolved_at: null,
}));

const metricPoints = (clientId: string) =>
  Array.from({ length: 28 }, (_, i) => ({
    source: "gsc", metric: "clicks", dimension: "", value: (clientId === NORTHLINE ? 18 : 9) + ((i * 7) % 11), observed_on: day(27 - i),
  }));

const demoKeys: { id: string; agent_id: string | null; label: string; key_prefix: string; client_ids: string[] | null; created_at: string; last_used_at: string | null; revoked_at: string | null }[] = [
  { id: "k1", agent_id: null, label: "Rakazo", key_prefix: "atl_7Qx", client_ids: [NORTHLINE], created_at: new Date(Date.now() - 20 * 86_400_000).toISOString(), last_used_at: new Date().toISOString(), revoked_at: null },
];

export async function demoRequest(method: string, path: string, query: Record<string, unknown> = {}): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 120));
  if (method === "POST" && path === "/research/bulk") {
    const kws = ((query as { keywords?: string[] }).keywords ?? []).slice(0, 200);
    const intents = ["commercial", "transactional", "informational", "commercial", "navigational"];
    return kws.map((keyword, i) => ({
      keyword, search_volume: Math.max(90, 24_000 - keyword.length * 610 - i * 830), cpc: Math.round((0.6 + (i % 5) * 0.45) * 100) / 100,
      competition: ((i * 17) % 90) / 100 + 0.05, difficulty: 12 + ((keyword.length * 7 + i * 11) % 70), intent: intents[i % intents.length],
    }));
  }
  if (method === "PATCH" && path.startsWith("/agent-keys/")) {
    demoKeys[0].client_ids = (query as { client_ids?: string[] | null }).client_ids ?? null;
    return demoKeys[0];
  }
  if (method !== "GET") return {};
  const q = query as Record<string, string | undefined>;
  const cid = q.client_id;
  const limit = Number(q.limit ?? 50);
  const offset = Number(q.offset ?? 0);
  const page = <T,>(rows: T[]) => rows.slice(offset, offset + limit);
  const clientOf = path.match(/^\/clients\/([^/]+)/)?.[1];

  if (path === "/me") return { user_id: "demo", email: "reviewer@aheadtech360.com", role: "admin" };
  if (path === "/clients") return clients;
  if (path === "/agents") return agents;
  if (path === "/overview") {
    const openItems = items.filter((i) => i.status === "open");
    const by: Record<string, number> = {};
    for (const i of openItems) by[i.priority] = (by[i.priority] ?? 0) + 1;
    const counts = new Map<string, number>();
    for (const i of openItems) counts.set(`${i.client_id}|${i.category}`, (counts.get(`${i.client_id}|${i.category}`) ?? 0) + 1);
    const today = runs.filter((r) => now - Date.parse(r.started_at) < D);
    return {
      open_human_required: openItems.length, open_by_priority: by,
      stale_human_required: openItems.filter((i) => now - Date.parse(i.created_at) > 3 * D).length,
      runs_today: today.length, failed_runs_today: today.filter((r) => r.status === "failed").length,
      tasks_in_flight: 3, open_critical_findings: 0,
      clients: clients.map((c) => ({
        client_id: c.id, name: c.name, domain: c.domain, status: c.status,
        open_human_required: openItems.filter((i) => i.client_id === c.id).length,
        open_findings: c.id === NORTHLINE ? findings.length : 0, connections_with_problems: c.id === MARLOW ? 1 : 0, suggested_keywords: c.id === NORTHLINE ? 3 : 0,
        last_run_at: runs.find((r) => r.client_id === c.id)?.started_at ?? null,
      })),
      open_counts: [...counts].map(([k, v]) => ({ client_id: k.split("|")[0], category: k.split("|")[1], n: v })),
    };
  }
  if (path === "/human-required") {
    const statuses = (q.status ?? "").split(",").filter(Boolean);
    const cats = (q.category ?? "").split(",").filter(Boolean);
    const rows = [...items, ...done].filter(
      (i) => (!cid || i.client_id === cid) && (!statuses.length || statuses.includes(i.status)) && (!cats.length || cats.includes(i.category))
        && (!q.agent_id || i.agent_id === q.agent_id) && (!q.priority || i.priority === q.priority),
    );
    return page(rows.sort((a, b) => a.priority.localeCompare(b.priority) || a.created_at.localeCompare(b.created_at)));
  }
  const one = path.match(/^\/human-required\/([^/]+)(\/versions)?$/);
  if (one) {
    const it = [...items, ...done].find((i) => i.id === one[1]);
    if (one[2]) {
      return it?.draft
        ? [
            ...(it.status === "needs_changes" ? [] : []),
            { id: uid(), hr_id: it.id, version: 1, author_type: "bot", author_id: it.agent_id, issue: it.issue, ask: it.ask, draft: it.draft, note: null, created_at: it.created_at },
          ]
        : [];
    }
    return it;
  }
  if (path === "/actions") {
    const it = items[0];
    if (q.human_required_id && q.human_required_id !== it.id) return [];
    if (q.client_id && q.client_id !== it.client_id) return [];
    return [{
      id: uid(), client_id: it.client_id, agent_id: it.agent_id, run_id: null, kind: "sanity", title: "Retitle the raw vs washed denim guide",
      why: "", payload: {}, payload_hash: "", before: {}, result: {}, finding_ids: [], human_required_id: it.id, status: "proposed",
      error: null, attempts: 0, next_attempt_at: null, external_url: null, pr_number: null, approved_by: null, approved_at: null,
      applied_at: null, undone_at: null, created_at: it.created_at, updated_at: it.created_at,
    }];
  }
  if (/^\/actions\/[^/]+$/.test(path)) return { payload: { mutations: [{ op: "set", id: "post-raw-vs-washed", fields: { "seo.title": "Raw vs Washed Denim: How Each Fades in a Year" } }] } };
  if (path === "/runs") return page(runs.filter((r) => (!cid || r.client_id === cid) && (!q.agent_id || r.agent_id === q.agent_id)));
  if (path === "/agents/stats") {
    return agents.map((a) => {
      const mine = runs.filter((r) => r.agent_id === a.id);
      return {
        agent_id: a.id, last_run_status: mine[0]?.status ?? null, last_run_at: mine[0]?.started_at ?? null,
        last_run_summary: mine[0]?.summary ?? null, last_run_error: mine[0]?.error ?? null,
        failed_7d: mine.filter((r) => r.status === "failed").length, tasks_open: a.id === "on_page" ? 2 : a.id === "content_writer" ? 1 : 0,
      };
    });
  }
  if (path === "/findings") return page(findings.filter((f) => !cid || f.client_id === cid));
  if (path === "/reports") {
    return page([{ id: uid(), client_id: NORTHLINE, agent_id: "seo_lead", report_type: "weekly_summary", title: "Weekly summary: Northline Denim, Nov 10 to 16",
      period_start: day(7), period_end: day(1), body_markdown: "", data: {}, created_at: at(D) }].filter((r) => !cid || r.client_id === cid));
  }
  if (/^\/reports\/[^/]+$/.test(path)) {
    return {
      id: path.split("/")[2], client_id: NORTHLINE, agent_id: "seo_lead", report_type: "weekly_summary",
      title: "Weekly summary: Northline Denim, Nov 10 to 16", period_start: day(7), period_end: day(1), data: {}, created_at: at(D),
      body_markdown: "## Traffic\n\nSearch Console clicks: 168 this week against 151 the week before.\n\n## Waiting on the team\n\n- Title change for the raw vs washed guide\n- Developer ticket for the 307 redirects\n\n## Next week\n\nThe December posts start on Tuesday Dec 1 if the calendar is approved.",
    };
  }
  if (clientOf && path === `/clients/${clientOf}`) return clients.find((c) => c.id === clientOf);
  if (clientOf && path.endsWith("/metric-names")) return [{ source: "gsc", metric: "clicks" }, { source: "gsc", metric: "impressions" }];
  if (path === "/metrics" && q.source === "pagespeed") {
    const base: Record<string, Record<string, number>> = {
      score: { "template:home": 58, "template:collection": 71, "template:product": 49 },
      lcp: { "template:home": 3.9, "template:collection": 2.8, "template:product": 4.4 },
      cls: { "template:home": 0.04, "template:collection": 0.12, "template:product": 0.08 },
      tbt: { "template:home": 420, "template:collection": 260, "template:product": 690 },
    };
    const b = base[String(q.metric)] ?? {};
    const step = q.metric === "score" ? 2 : q.metric === "tbt" ? -25 : q.metric === "lcp" ? -0.1 : -0.005;
    return Object.entries(b).flatMap(([dimension, v]) =>
      Array.from({ length: 6 }, (_, i) => ({ source: "pagespeed", metric: q.metric, dimension, value: Math.round((v + step * (i - 5)) * 1000) / 1000, observed_on: day((5 - i) * 7 + 2) })));
  }
  if (path === "/metrics") return metricPoints(cid ?? NORTHLINE);
  if (clientOf && path.endsWith("/integrations")) {
    return [{ id: "int-shop", client_id: clientOf, kind: "shopify", has_token: false, status: "ok",
      status_note: "Store found at northlinedenim.co. Blog page loads. The Content Writer posts as seo.aheadtech360@gmail.com, signed in with Google on its browser.",
      config: { store: "northline-denim", admin_url: "https://admin.shopify.com/store/northline-denim", blog_url: "https://northlinedenim.co/blogs/journal", login_email: "seo.aheadtech360@gmail.com" },
      checked_at: at(2 * 3_600_000), created_at: at(3 * 86_400_000), updated_at: at(2 * 3_600_000) }];
  }
  if (clientOf && path.endsWith("/profile")) {
    return { client_id: clientOf, brand_voice: "Plain, warm, practical. Talks about how clothes wear over years.", voice_rules: [], approved_claims: [], banned_terms: [], post_cadence_per_week: 2, autonomy: {}, updated_at: at(D) };
  }
  if (clientOf && path.endsWith("/settings")) {
    return agents.map((a) => ({ client_id: clientOf, agent_id: a.id, enabled: a.id !== "local_seo", cadence: "", autonomy: "ask_first", config: {}, updated_at: at(D) }));
  }
  if (path === "/usage") return { days: 30, by_bot: [], by_client: [] };
  if (path === "/notifications") return { slack_configured: false, digest_hour_utc: 13, dashboard_url_set: true };
  if (path === "/agent-keys") return demoKeys;
  if (path === "/team") return [{ user_id: "demo", email: "reviewer@aheadtech360.com", full_name: null, role: "admin", created_at: at(40 * D) }];
  if (path === "/research/status") return { configured: true, calls_today: 14, daily_limit: 300 };
  const seoKw = ["linen pants women", "wide leg linen trousers", "summer linen set", "linen shirt dress", "best travel pants",
    "organic cotton joggers", "how to wash linen", "linen shorts women", "breathable work pants", "what is linen made of",
    "linen co ord set", "lightweight summer dress"];
  const intents = ["commercial", "transactional", "informational", "commercial"];
  if (path === "/research/domain") {
    const d = String(q.target ?? "vuori.com");
    return {
      domain: d, location_code: 2840, organic_keywords: 48210, organic_traffic: 1240000, traffic_value: 865000,
      pos_1: 1820, pos_2_3: 3410, pos_4_10: 7920, pos_11_20: 9100, pos_21_100: 25960,
      history: Array.from({ length: 18 }, (_, i) => {
        const dt = new Date(now - (17 - i) * 30 * D);
        return { month: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`, traffic: 820000 + i * 26000 + ((i * 37) % 9) * 15000, keywords: 39000 + i * 520 };
      }),
      top_keywords: seoKw.map((k, i) => ({ keyword: k, position: 1 + (i % 8), search_volume: 33100 - i * 2400, cpc: 0.6 + i * 0.21,
        difficulty: 18 + i * 6, intent: intents[i % 4], url: `https://${d}/collections/${k.replace(/ /g, "-")}`, traffic: 9100 - i * 610 })),
      top_pages: ["", "collections/linen", "collections/pants", "blogs/care/how-to-wash-linen", "products/linen-wide-leg-pant"].map((p, i) => ({
        url: `https://${d}/${p}`, keywords: 4200 - i * 700, traffic: 310000 - i * 52000 })),
      competitors: [["outdoorvoices.com", 6120, 31200, 410000, 14.2], ["girlfriend.com", 4380, 21800, 260000, 16.8], ["alo.com", 3910, 52000, 980000, 18.1],
        ["everlane.com", 3500, 61000, 1100000, 19.4]].map(([domain, shared, kw, tr, ap]) => ({ domain, shared_keywords: shared, organic_keywords: kw, organic_traffic: tr, avg_position: ap })),
      errors: [], fetched_at: at(2 * H),
    };
  }
  if (path === "/research/keyword") {
    const k = String(q.keyword ?? "linen pants women");
    const ideas = seoKw.map((x, i) => ({ keyword: i ? `${x}` : `${k} high waisted`, search_volume: 14800 - i * 1100, cpc: 0.4 + i * 0.15, difficulty: 12 + i * 7, intent: intents[i % 4] }));
    return {
      keyword: k, location_code: 2840, search_volume: 22200, cpc: 1.12, competition: 0.86, difficulty: 37, intent: "commercial",
      trend: Array.from({ length: 12 }, (_, i) => {
        const dt = new Date(now - (11 - i) * 30 * D);
        return { month: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`, volume: 14800 + Math.round(9000 * Math.sin(((dt.getMonth() + 9) / 12) * Math.PI) ** 2) };
      }),
      serp: ["quince.com", "vuori.com", "jcrew.com", "madewell.com", "abercrombie.com", "everlane.com", "uniqlo.com", "gap.com", "reddit.com", "nordstrom.com"].map((d, i) => ({
        position: i + 1, domain: d, url: `https://${d}/linen-pants`, title: `Women's Linen Pants | ${d.split(".")[0].replace(/^\w/, (c) => c.toUpperCase())}` })),
      suggestions: ideas, related: ideas.slice(2), questions: ideas.filter((x) => /^(how|what)/.test(x.keyword)), errors: [], fetched_at: at(H),
    };
  }
  if (path === "/research/backlinks") {
    return { target: String(q.target ?? "vuori.com"), backlinks: 1840000, referring_domains: 21400, referring_ips: 15800, rank: 612, broken_backlinks: 3100, dofollow_share: 0.71,
      top_referring: ["vogue.com", "gq.com", "nytimes.com", "runnersworld.com", "wired.com", "forbes.com"].map((d, i) => ({ domain: d, rank: 890 - i * 31, backlinks: 410 - i * 52, first_seen: day(400 - i * 40) })),
      errors: [], fetched_at: at(3 * H) };
  }
  if (clientOf && path.endsWith("/kpis")) {
    const dd = Number(q.days ?? 28);
    const daily = Array.from({ length: dd }, (_, i) => ({ day: day(dd - i + 2), clicks: 40 + ((i * 13) % 17) + Math.round(i * 0.8), impressions: 2100 + ((i * 57) % 400) + i * 12 }));
    return {
      days: dd,
      clicks: { current: 1480, previous: 1210 }, impressions: { current: 66400, previous: 61900 }, ctr: { current: 0.0223, previous: 0.0195 },
      position: { current: 14.2, previous: 16.9 }, sessions: { current: 9800, previous: 9100 }, organic_sessions: { current: 3120, previous: 2760 },
      conversions: { current: 84, previous: 91 }, revenue: { current: 11240, previous: 12020 }, daily,
      health: { score: 72, open: 11, critical: 0, high: 2, medium: 5, low: 4, fixed: 9, by_type: [] },
      competitors: 4, keywords_suggested: 3, keywords_approved: 7, competitor_keywords: 380,
    };
  }
  if (clientOf && path.endsWith("/gsc")) {
    const pages = q.kind === "pages";
    const rows = (pages ? ["", "collections/linen", "collections/denim", "products/wide-leg-jean", "blogs/journal/how-to-wash-linen", "pages/about"] : seoKw)
      .map((x, i) => ({ dimension: pages ? `https://northlinedenim.co/${x}` : x, clicks: 310 - i * 24, impressions: 9100 - i * 610, ctr: (310 - i * 24) / (9100 - i * 610), position: 3.2 + i * 1.7 }));
    const s2 = String(q.search ?? "").toLowerCase();
    return rows.filter((r) => r.dimension.includes(s2));
  }
  if (clientOf && path.endsWith("/audit-summary")) {
    return { score: 72, open: 11, critical: 0, high: 2, medium: 5, low: 4, fixed: 9,
      by_type: [["redirect_chain", "high", 2], ["canonical", "medium", 3], ["cwv_lcp", "medium", 1], ["image_size", "medium", 1], ["alt_text", "low", 4]]
        .map(([finding_type, severity, count]) => ({ finding_type, severity, count })) };
  }
  if (clientOf && path.endsWith("/target-keywords")) {
    const rows = [
      ["linen pants women", 22000, 34, "commercial", "p1", "suggested", ["vuori.com"], "Vuori ranks #1; we sell three linen cuts"],
      ["wide leg linen trousers", 20100, 38, "commercial", "p2", "approved", ["outdoorvoices.com"], ""],
      ["how to wash linen", 9900, 12, "informational", "p3", "suggested", ["vuori.com", "outdoorvoices.com"], "Guide post"],
      ["summer linen set", 18200, 41, "transactional", "p2", "suggested", ["vuori.com"], ""],
      ["linen shirt dress", 16300, 45, "commercial", "p3", "rejected", ["outdoorvoices.com"], ""],
    ].map(([keyword, v, d, intent, priority, status, competitors, notes], i) => ({
      id: `tk-${i}`, client_id: clientOf, keyword, search_volume: v, difficulty: d, intent, priority, status, competitors, notes,
      agent_id: "seo_lead", updated_at: at(2 * D), lists: i < 2 || i === 3 ? ["Summer launch"] : i === 2 ? ["Blog ideas"] : [],
    }));
    const want = (q.status ?? "suggested,approved").split(",");
    const s = (q.search ?? "").toLowerCase();
    return page(rows.filter((r) => want.includes(r.status as string) && (r.keyword as string).includes(s) && (!q.list || r.lists.includes(q.list))));
  }
  if (clientOf && path.endsWith("/competitors")) {
    return [
      ["vuori.com", "Vuori", "confirmed", 412, 18_900, 1_240_000, 100],
      ["outdoorvoices.com", "Outdoor Voices", "suggested", 287, 9_400, 310_000, 100],
      ["girlfriend.com", "", "suggested", 164, 6_100, 145_000, 0],
    ].map(([domain, name, status, shared, all, traffic, kw], i) => ({
      id: `comp-${i}`, client_id: clientOf, domain, name, status, shared_keywords: shared, organic_keywords: all,
      organic_traffic: traffic, notes: "", agent_id: "seo_lead", keywords_pulled_at: kw ? at(3 * D) : null, keyword_count: kw, updated_at: at(3 * D),
    }));
  }
  if (clientOf && path.endsWith("/competitor-keywords")) {
    const words = ["linen pants women", "wide leg linen trousers", "summer linen set", "linen shirt dress", "best travel pants",
      "organic cotton joggers", "linen shorts women", "breathable work pants", "linen co ord set", "lightweight summer dress"];
    const rows = words.map((keyword, i) => ({
      id: `kw-${i}`, competitor_id: `comp-${i % 2}`, competitor_domain: i % 2 ? "outdoorvoices.com" : "vuori.com", keyword,
      search_volume: 22_000 - i * 1_900, cpc: 1.2, difficulty: 28 + i * 4, intent: i % 3 ? "commercial" : "transactional",
      position: 1 + (i % 9), url: `https://${i % 2 ? "outdoorvoices.com" : "vuori.com"}/collections/${keyword.replace(/ /g, "-")}`, created_at: at(3 * D),
    }));
    const s = (q.search ?? "").toLowerCase();
    return page(rows.filter((r) => (!q.competitor_id || r.competitor_id === q.competitor_id) && r.keyword.includes(s)
      && r.search_volume >= Number(q.min_volume ?? 0)));
  }
  if (clientOf && path.endsWith("/keyword-lists")) {
    return [{ name: "Summer launch", keywords: 3, volume: 60_300 }, { name: "Blog ideas", keywords: 1, volume: 9_900 }];
  }
  if (clientOf && path.endsWith("/rankings")) {
    const kws = [
      ["linen pants women", 22000, "p1", 8.4, 11.2, 6.9, 210, 9800],
      ["wide leg linen trousers", 20100, "p2", 4.1, 4.6, 3.2, 340, 7100],
      ["how to wash linen", 9900, "p3", 2.3, 2.9, 1.8, 520, 6400],
      ["summer linen set", 18200, "p2", 17.6, 14.9, 12.0, 22, 3100],
      ["linen co ord set", 8100, "p3", 34.0, null, 31.5, 3, 640],
      ["linen shorts women", 12100, "p3", null, null, null, null, null],
    ].map(([keyword, search_volume, priority, position, previous, best, clicks, impressions], i) => ({
      id: `tk-${i}`, keyword, status: "approved", priority, search_volume, position, previous, best, clicks, impressions,
    }));
    const weeks = Array.from({ length: 12 }, (_, i) => ({ week: day((11 - i) * 7 + 3), top3: 1 + Math.floor(i / 5), top10: 1 + Math.floor(i / 4), top100: 2 + (i % 2) }));
    return { keywords: kws, weeks };
  }
  if (clientOf && path.endsWith("/ai-visibility")) {
    return [
      { engine: "ai_overviews", citation_share: 0.18, mentions: 9, observed_on: day(6) },
      { engine: "chatgpt", citation_share: 0.12, mentions: 6, observed_on: day(6) },
      { engine: "gemini", citation_share: 0.08, mentions: 4, observed_on: day(6) },
      { engine: "ai_mode", citation_share: 0.1, mentions: 5, observed_on: day(6) },
    ];
  }
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 11 + i);
    return d.toISOString().slice(0, 7);
  });
  if (path === "/research/trends") {
    return {
      domain: q.target, fetched_at: at(0),
      organic: months.map((month, i) => ({
        month, traffic: 2400 + i * 260 + (i % 3) * 120, keywords: 1900 + i * 140,
        pos_1_3: 60 + i * 9, pos_4_10: 180 + i * 16, pos_11_50: 820 + i * 60, pos_51_100: 840 + i * 55,
      })),
      links: months.map((month, i) => ({ month, backlinks: 5200 + i * 310, referring_domains: 610 + i * 22, rank: 212 + i * 4 })),
      errors: [],
    };
  }
  if (path === "/research/compare") {
    const base: Record<string, number> = {};
    return String(q.targets ?? "").split(",").filter(Boolean).map((domain, j) => {
      base[domain] = [3200, 18_000, 9_000, 6_500][j] ?? 4000;
      return { domain, error: null, history: months.map((month, i) => ({ month, traffic: Math.round(base[domain] * (0.8 + i * (j === 0 ? 0.06 : 0.02) + (i % 3) * 0.03)), keywords: null })) };
    });
  }
  if (path === "/outreach/counts") return [];
  return [];
}
