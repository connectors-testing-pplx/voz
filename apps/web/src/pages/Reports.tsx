import { useMemo, useState } from "react";
import { useParams } from "wouter";
import { Download, FileBarChart, ShieldCheck } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";
import { useI18n, Badge } from "@voz/ui";
import { useStore } from "../lib/store";
import { auditAppendix, buildReportHTML, computeMetrics, downloadFile, funnel, toCSV } from "@voz/reports";
import { KpiCard, PageHeader, SectionCard } from "../components/ui";

const FUNNEL_COLORS = ["hsl(var(--c-primary))", "hsl(var(--c-blue))", "hsl(var(--c-success))", "hsl(var(--c-gold))", "hsl(var(--c-purple))"];

export default function Reports() {
  const { id } = useParams<{ id?: string }>();
  const { t } = useI18n();
  const { state } = useStore();
  const [campaignId, setCampaignId] = useState(id ?? state.campaigns[0].id);
  const campaign = state.campaigns.find((c) => c.id === campaignId) ?? state.campaigns[0];

  const { metrics, f, audit } = useMemo(() => {
    const completions = new Set((state.completions[campaign.id] ?? []).map((s) => s));
    const m = computeMetrics(campaign.id, state.sends, state.responses, completions);
    const consents = state.consents.filter((c) =>
      state.sends.some((s) => s.campaignId === campaign.id && s.contactId === c.contactId),
    );
    const a = auditAppendix(
      campaign.id,
      consents.map((c) => ({ disclosureVersion: c.disclosureVersion, source: c.source, language: c.language })),
    );
    return { metrics: m, f: funnel(m), audit: a };
  }, [campaign.id, state]);

  const funnelData = f.map((s) => ({ name: s.stage, value: s.count, fill: FUNNEL_COLORS[0] }));

  const distData = Object.entries(metrics.answerDistribution)
    .map(([k, v]) => ({ name: k, value: v }))
    .sort((a, b) => b.value - a.value);
  const distColors = ["hsl(var(--c-primary))", "hsl(var(--c-blue))", "hsl(var(--c-gold))", "hsl(var(--c-purple))", "hsl(var(--c-success))", "hsl(var(--c-error))"];

  const exportCSV = () => {
    const rows = state.sends
      .filter((s) => s.campaignId === campaign.id)
      .map((s) => ({
        campaignId: s.campaignId,
        contactId: s.contactId,
        phone: s.phone,
        language: s.language,
        status: s.status,
        errorCode: s.errorCode ?? "",
        timestamp: new Date(s.timestamp).toISOString(),
      }));
    downloadFile(`${campaign.name.replace(/\s+/g, "_")}_sends.csv`, toCSV(rows));
  };

  const exportReport = () => {
    const html = buildReportHTML({
      campaignName: campaign.name,
      metrics,
      funnel: f,
      audit,
      methodology:
        "Metrics are aggregated from per-send delivery receipts and inbound response records. Consent and disclosure versions are logged per send for audit traceability. Answer distribution reflects structured branch answers stored on responses. Sentiment is a keyword proxy (EN/ES) and is indicative only.",
      generatedAt: Date.now(),
    });
    downloadFile(`${campaign.name.replace(/\s+/g, "_")}_report.html`, html, "text/html");
  };

  return (
    <div className="p-4 md:p-6 max-w-[1180px] mx-auto">
      <PageHeader
        title={t("navReports")}
        subtitle="Totals, funnel conversion, flow drop-off, opt-out rate, answer distribution, segment breakdowns, and an audit appendix of consent/disclosure versions."
        actions={
          <>
            <select className="input w-auto" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              {state.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn-outline" onClick={exportCSV}><Download size={15} /> {t("exportCSV")}</button>
            <button className="btn-primary" onClick={exportReport}><FileBarChart size={15} /> {t("exportReport")}</button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label={t("sent")} value={metrics.sent.toLocaleString()} tone="primary" />
        <KpiCard label={t("delivered")} value={metrics.delivered.toLocaleString()} tone="success" />
        <KpiCard label={t("responseRate")} value={`${metrics.responseRate.toFixed(1)}%`} />
        <KpiCard label={t("optedOut")} value={metrics.optedOut.toLocaleString()} sub={`${metrics.stopRate.toFixed(1)}% stop rate`} tone="error" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <SectionCard title={t("funnel")}>
          <ResponsiveContainer width="100%" height={300}>
            <FunnelChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Funnel data={funnelData} dataKey="value" isAnimationActive={false}>
                <LabelList position="right" fill="hsl(var(--c-text))" fontSize={12} stroke="none" dataKey="name" />
                <LabelList position="center" fill="#fff" fontSize={13} fontWeight={700} dataKey="value" />
                {funnelData.map((_, i) => <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />)}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title={t("answerDistribution")}>
          {distData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-text-faint">No structured answers recorded for this campaign.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--c-divider))" horizontal={false} />
                <XAxis type="number" tick={{ fill: "hsl(var(--c-text-muted))", fontSize: 11 }} stroke="hsl(var(--c-divider))" />
                <YAxis type="category" dataKey="name" width={80} tick={{ fill: "hsl(var(--c-text-muted))", fontSize: 12 }} stroke="hsl(var(--c-divider))" />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--c-surface-offset))" }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {distData.map((_, i) => <Cell key={i} fill={distColors[i % distColors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Language segment breakdown">
          <table className="w-full text-sm">
            <thead className="border-b border-divider">
              <tr>
                <th className="th">Language</th>
                <th className="th text-right">{t("sent")}</th>
                <th className="th text-right">{t("delivered")}</th>
                <th className="th text-right">Responses</th>
                <th className="th text-right">{t("optedOut")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              <tr><td className="td">English</td><td className="td text-right tabular-nums">{metrics.byLanguage.en.sent.toLocaleString()}</td><td className="td text-right tabular-nums">{metrics.byLanguage.en.delivered.toLocaleString()}</td><td className="td text-right tabular-nums">{metrics.byLanguage.en.responses.toLocaleString()}</td><td className="td text-right tabular-nums text-error">{metrics.byLanguage.en.optedOut.toLocaleString()}</td></tr>
              <tr><td className="td">Spanish</td><td className="td text-right tabular-nums">{metrics.byLanguage.es.sent.toLocaleString()}</td><td className="td text-right tabular-nums">{metrics.byLanguage.es.delivered.toLocaleString()}</td><td className="td text-right tabular-nums">{metrics.byLanguage.es.responses.toLocaleString()}</td><td className="td text-right tabular-nums text-error">{metrics.byLanguage.es.optedOut.toLocaleString()}</td></tr>
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title={<span className="flex items-center gap-2"><ShieldCheck size={16} className="text-primary" /> {t("auditAppendix")}</span>}>
          <dl className="grid grid-cols-1 gap-y-2.5 text-sm">
            <AuditRow k="Disclosure version" v={<code className="text-xs">v{audit.disclosureVersion}</code>} />
            <AuditRow k="Consent records applied" v={audit.consentCount.toLocaleString()} />
            <AuditRow k="Consent sources" v={Object.entries(audit.consentSources).map(([k, v]) => `${k}: ${v}`).join(" · ") || "n/a"} />
            <AuditRow k="Languages" v={`EN ${audit.languages.en} · ES ${audit.languages.es}`} />
            <AuditRow k="Generated" v={new Date(audit.generatedAt).toLocaleString()} />
          </dl>
          <div className="mt-3 pt-3 border-t border-divider">
            <span className="label-xs">{t("methodology")}</span>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Metrics aggregate per-send delivery receipts and inbound response records. Consent and disclosure versions are logged per send for audit traceability. Answer distribution reflects structured branch answers. Sentiment is a keyword proxy (EN/ES), indicative only.
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-text-faint">
        <Badge tone="success">CSV</Badge> exports raw sends. <Badge tone="primary">HTML/PDF</Badge> report opens in a browser — use “Print to PDF” for a client-facing file.
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "hsl(var(--c-surface))",
  border: "1px solid hsl(var(--c-border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--c-text))",
} as const;

function AuditRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-divider pb-2 last:border-0">
      <dt className="text-text-muted">{k}</dt>
      <dd className="font-medium text-right text-sm">{v}</dd>
    </div>
  );
}
