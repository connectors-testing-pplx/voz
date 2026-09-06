// @voz/reports — KPI aggregation, funnel + drop-off, and exports.
// Live receipts/responses stream into materialized metrics so dashboards stay fast.
//
// Post-campaign reporting includes: totals, funnel conversion, flow drop-off,
// opt-out rate, answer distribution, segment/language breakdowns, and an audit
// appendix recording the consent + disclosure versions used during the run.

import type { Language } from "@voz/compliance";

export type SendStatus = "queued" | "sent" | "delivered" | "failed" | "skipped";
export type ResponseKind =
  | "reply"
  | "stop"
  | "help"
  | "start"
  | "optout"
  | "subscribe_keyword"
  | "unknown";

export interface Send {
  id: string;
  campaignId: string;
  contactId: string;
  phone: string;
  language: Language;
  status: SendStatus;
  errorCode?: string;
  timestamp: number;
}

export interface Response {
  id: string;
  sendId?: string;
  campaignId: string;
  contactId: string;
  body: string;
  language: Language;
  kind: ResponseKind;
  timestamp: number;
  nodeId?: string;
  answerVar?: string;
  answerValue?: string;
}

export interface CampaignMetrics {
  campaignId: string;
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  skipped: number;
  optedOut: number;
  responses: number;
  responseRate: number; // %
  completionRate: number; // %
  stopRate: number; // %
  // live dashboard cards
  byLanguage: Record<Language, { sent: number; delivered: number; responses: number; optedOut: number }>;
  byStatus: Record<SendStatus, number>;
  answerDistribution: Record<string, number>;
  sentimentSplit: { positive: number; neutral: number; negative: number };
  hourly: { hour: string; sent: number; delivered: number; responses: number }[];
}

export function computeMetrics(
  campaignId: string,
  sends: Send[],
  responses: Response[],
  completionsByContact: Set<string>,
  now = Date.now(),
): CampaignMetrics {
  const cs = sends.filter((s) => s.campaignId === campaignId);
  const cr = responses.filter((r) => r.campaignId === campaignId);

  const total = cs.length;
  const sent = cs.filter((s) => s.status === "sent" || s.status === "delivered").length;
  const delivered = cs.filter((s) => s.status === "delivered").length;
  const failed = cs.filter((s) => s.status === "failed").length;
  const skipped = cs.filter((s) => s.status === "skipped").length;
  const optedOut = cr.filter((r) => r.kind === "stop" || r.kind === "optout").length;
  const responsesCount = cr.filter((r) => r.kind === "reply" || r.kind === "subscribe_keyword").length;

  const byLanguage: CampaignMetrics["byLanguage"] = {
    en: { sent: 0, delivered: 0, responses: 0, optedOut: 0 },
    es: { sent: 0, delivered: 0, responses: 0, optedOut: 0 },
  };
  for (const s of cs) {
    if (s.status === "sent" || s.status === "delivered") byLanguage[s.language].sent++;
    if (s.status === "delivered") byLanguage[s.language].delivered++;
  }
  for (const r of cr) {
    if (r.kind === "reply" || r.kind === "subscribe_keyword") byLanguage[r.language].responses++;
    if (r.kind === "stop" || r.kind === "optout") byLanguage[r.language].optedOut++;
  }

  const byStatus: Record<SendStatus, number> = {
    queued: 0, sent: 0, delivered: 0, failed: 0, skipped: 0,
  };
  for (const s of cs) byStatus[s.status]++;

  const answerDistribution: Record<string, number> = {};
  for (const r of cr) {
    if (r.answerValue) answerDistribution[r.answerValue] = (answerDistribution[r.answerValue] ?? 0) + 1;
  }

  // crude sentiment proxy over reply bodies
  const pos = /(yes|sí|si|good|great|support|apoyo|sí\b|favor)/i;
  const neg = /(no|bad|stop|cancel|optout|cancelar|detener|mal)/i;
  let positive = 0, neutral = 0, negative = 0;
  for (const r of cr) {
    if (r.kind !== "reply" && r.kind !== "subscribe_keyword") continue;
    if (pos.test(r.body)) positive++;
    else if (neg.test(r.body)) negative++;
    else neutral++;
  }

  const hourlyMap = new Map<string, { sent: number; delivered: number; responses: number }>();
  for (const s of cs) {
    const h = new Date(s.timestamp).toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const cell = hourlyMap.get(h) ?? { sent: 0, delivered: 0, responses: 0 };
    if (s.status === "sent" || s.status === "delivered") cell.sent++;
    if (s.status === "delivered") cell.delivered++;
    hourlyMap.set(h, cell);
  }
  for (const r of cr) {
    const h = new Date(r.timestamp).toISOString().slice(0, 13);
    const cell = hourlyMap.get(h) ?? { sent: 0, delivered: 0, responses: 0 };
    cell.responses++;
    hourlyMap.set(h, cell);
  }
  const hourly = [...hourlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([hour, v]) => ({ hour, ...v }));

  const responseRate = sent ? (responsesCount / sent) * 100 : 0;
  const completionRate = sent ? (completionsByContact.size / sent) * 100 : 0;
  const stopRate = sent ? (optedOut / sent) * 100 : 0;

  return {
    campaignId, total, sent, delivered, failed, skipped, optedOut,
    responses: responsesCount, responseRate, completionRate, stopRate,
    byLanguage, byStatus, answerDistribution,
    sentimentSplit: { positive, neutral, negative },
    hourly,
  };
}

/** Funnel: queued -> sent -> delivered -> responded -> completed. */
export interface FunnelStage { stage: string; count: number; }
export function funnel(metrics: CampaignMetrics): FunnelStage[] {
  return [
    { stage: "Queued", count: metrics.total },
    { stage: "Sent", count: metrics.sent },
    { stage: "Delivered", count: metrics.delivered },
    { stage: "Responded", count: metrics.responses },
    { stage: "Completed", count: Math.round((metrics.completionRate / 100) * metrics.sent) },
  ];
}

/** Audit appendix: consent/disclosure versions used during the run. */
export interface AuditRow {
  campaignId: string;
  disclosureVersion: string;
  consentCount: number;
  consentSources: Record<string, number>;
  languages: Record<Language, number>;
  generatedAt: number;
}
export function auditAppendix(
  campaignId: string,
  consents: { disclosureVersion: string; source: string; language: Language }[],
): AuditRow {
  const disclosureVersion = consents[0]?.disclosureVersion ?? "n/a";
  const sources: Record<string, number> = {};
  const langs: Record<Language, number> = { en: 0, es: 0 };
  for (const c of consents) {
    sources[c.source] = (sources[c.source] ?? 0) + 1;
    langs[c.language]++;
  }
  return { campaignId, disclosureVersion, consentCount: consents.length, consentSources: sources, languages: langs, generatedAt: Date.now() };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const head = cols.map(csvEscape).join(",");
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(",")).join("\n");
  return head + "\n" + body;
}

export function downloadFile(filename: string, content: string, mime = "text/csv"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Client-facing report export as a self-contained HTML file (open in browser, print to PDF). */
export function buildReportHTML(opts: {
  campaignName: string;
  metrics: CampaignMetrics;
  funnel: FunnelStage[];
  audit: AuditRow;
  methodology: string;
  generatedAt: number;
}): string {
  const { campaignName, metrics, funnel, audit, methodology, generatedAt } = opts;
  const fmt = (n: number) => n.toLocaleString("en-US");
  const pct = (n: number) => n.toFixed(1) + "%";
  const rows = funnel
    .map(
      (f) =>
        `<tr><td>${f.stage}</td><td style="text-align:right">${fmt(f.count)}</td><td style="text-align:right">${
          metrics.total ? ((f.count / metrics.total) * 100).toFixed(1) : "0"
        }%</td></tr>`,
    )
    .join("");
  const dist = Object.entries(metrics.answerDistribution)
    .map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right">${fmt(v)}</td></tr>`)
    .join("") || '<tr><td colspan="2">No structured answers recorded.</td></tr>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${campaignName} — Report</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:880px;margin:40px auto;padding:0 24px;color:#1a2330;line-height:1.6}
  h1{font-size:28px;margin:0 0 4px} h2{font-size:18px;margin:28px 0 10px;border-bottom:1px solid #ddd;padding-bottom:6px}
  .sub{color:#666;font-size:14px;margin-bottom:8px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}
  .stat{border:1px solid #e3e8ef;border-radius:10px;padding:14px}
  .stat b{font-size:22px;display:block} .stat span{font-size:12px;color:#668;text-transform:uppercase;letter-spacing:.04em}
  table{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eef}
  th{font-size:12px;text-transform:uppercase;color:#668}
  .note{background:#f5f8fb;border-left:3px solid #0e7490;padding:12px 16px;font-size:13px;border-radius:0 8px 8px 0;margin-top:18px}
  code{background:#f0f3f7;padding:2px 5px;border-radius:4px;font-size:12px}
</style></head><body>
<h1>${campaignName}</h1>
<div class="sub">Post-campaign compliance report · Generated ${new Date(generatedAt).toLocaleString("en-US")}</div>
<div class="grid">
  <div class="stat"><span>Sent</span><b>${fmt(metrics.sent)}</b></div>
  <div class="stat"><span>Delivered</span><b>${fmt(metrics.delivered)}</b></div>
  <div class="stat"><span>Response rate</span><b>${pct(metrics.responseRate)}</b></div>
  <div class="stat"><span>Opt-out rate</span><b>${pct(metrics.stopRate)}</b></div>
  <div class="stat"><span>Failed</span><b>${fmt(metrics.failed)}</b></div>
  <div class="stat"><span>Skipped (gate)</span><b>${fmt(metrics.skipped)}</b></div>
  <div class="stat"><span>Completion rate</span><b>${pct(metrics.completionRate)}</b></div>
  <div class="stat"><span>Total opted out</span><b>${fmt(metrics.optedOut)}</b></div>
</div>
<h2>Conversion funnel</h2>
<table><thead><tr><th>Stage</th><th style="text-align:right">Count</th><th style="text-align:right">% of queued</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Answer distribution</h2>
<table><thead><tr><th>Answer</th><th style="text-align:right">Count</th></tr></thead><tbody>${dist}</tbody></table>
<h2>Language split</h2>
<table><thead><tr><th>Language</th><th style="text-align:right">Sent</th><th style="text-align:right">Delivered</th><th style="text-align:right">Responses</th><th style="text-align:right">Opt-outs</th></tr></thead><tbody>
<tr><td>English</td><td style="text-align:right">${fmt(metrics.byLanguage.en.sent)}</td><td style="text-align:right">${fmt(metrics.byLanguage.en.delivered)}</td><td style="text-align:right">${fmt(metrics.byLanguage.en.responses)}</td><td style="text-align:right">${fmt(metrics.byLanguage.en.optedOut)}</td></tr>
<tr><td>Spanish</td><td style="text-align:right">${fmt(metrics.byLanguage.es.sent)}</td><td style="text-align:right">${fmt(metrics.byLanguage.es.delivered)}</td><td style="text-align:right">${fmt(metrics.byLanguage.es.responses)}</td><td style="text-align:right">${fmt(metrics.byLanguage.es.optedOut)}</td></tr>
</tbody></table>
<h2>Audit appendix — consent & disclosure</h2>
<div class="note">
  Disclosure version in use: <code>${audit.disclosureVersion}</code><br>
  Consent records applied: <b>${fmt(audit.consentCount)}</b><br>
  Consent sources: ${Object.entries(audit.consentSources).map(([k, v]) => `${k} (${fmt(v)})`).join(", ") || "n/a"}<br>
  Languages: EN ${fmt(audit.languages.en)} · ES ${fmt(audit.languages.es)}
</div>
<h2>Methodology</h2>
<div class="note">${methodology}</div>
<p style="margin-top:28px;color:#668;font-size:12px">Voz — compliance-first bilingual messaging. This report is generated from materialized delivery + response tables. Consent and disclosure versions are logged per send for audit traceability.</p>
</body></html>`;
}
