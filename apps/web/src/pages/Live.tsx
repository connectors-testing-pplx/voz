import { useMemo, useState } from "react";
import { useParams } from "wouter";
import {
  Send,
  CheckCheck,
  XCircle,
  ShieldOff,
  Gauge,
  Flag,
  Languages,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { useI18n, Badge } from "@voz/ui";
import { useStore } from "../lib/store";
import { computeMetrics } from "@voz/reports";
import { KpiCard, PageHeader, SectionCard } from "../components/ui";

const PIE_COLORS = ["hsl(var(--c-success))", "hsl(var(--c-gold))", "hsl(var(--c-error))"];

export default function Live() {
  const { id } = useParams<{ id?: string }>();
  const { t, lang } = useI18n();
  const { state } = useStore();
  const activeCampaigns = state.campaigns.filter((c) => c.status === "active" || c.status === "completed");
  const [campaignId, setCampaignId] = useState(id ?? activeCampaigns[0]?.id ?? state.campaigns[0].id);
  const campaign = state.campaigns.find((c) => c.id === campaignId) ?? state.campaigns[0];

  const metrics = useMemo(() => {
    const completions = new Set((state.completions[campaign.id] ?? []).map((s) => s));
    return computeMetrics(campaign.id, state.sends, state.responses, completions);
  }, [campaign.id, state]);

  const langData = [
    { name: "English", sent: metrics.byLanguage.en.sent, delivered: metrics.byLanguage.en.delivered, responses: metrics.byLanguage.en.responses, optedOut: metrics.byLanguage.en.optedOut },
    { name: "Spanish", sent: metrics.byLanguage.es.sent, delivered: metrics.byLanguage.es.delivered, responses: metrics.byLanguage.es.responses, optedOut: metrics.byLanguage.es.optedOut },
  ];
  const posLabel = lang === "es" ? "Positivo" : "Positive";
  const neuLabel = lang === "es" ? "Neutral" : "Neutral";
  const negLabel = lang === "es" ? "Negativo" : "Negative";
  const sentimentData = [
    { name: posLabel, value: metrics.sentimentSplit.positive, key: posLabel },
    { name: neuLabel, value: metrics.sentimentSplit.neutral, key: neuLabel },
    { name: negLabel, value: metrics.sentimentSplit.negative, key: negLabel },
  ];
  const hourly = metrics.hourly.map((h) => ({ ...h, time: h.hour.slice(11) + ":00" }));

  const chartGrid = "hsl(var(--c-divider))";
  const axisTick = { fill: "hsl(var(--c-text-muted))", fontSize: 11 };

  return (
    <div className="p-4 md:p-6 max-w-[1180px] mx-auto">
      <PageHeader
        title={t("navLive")}
        subtitle="Delivery receipts and inbound responses stream into materialized metrics so cards stay fast."
        actions={
          <select className="input w-auto" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            {state.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <Badge tone="primary">{campaign.type}</Badge>
        <Badge tone="blue">{campaign.channel.toUpperCase()}</Badge>
        <Badge tone="success">{campaign.status}</Badge>
        <span className="text-xs text-text-faint ml-auto">Updated {new Date().toLocaleTimeString()}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label={t("sent")} value={metrics.sent.toLocaleString()} icon={<Send size={16} />} tone="primary" />
        <KpiCard label={t("delivered")} value={metrics.delivered.toLocaleString()} icon={<CheckCheck size={16} />} sub={`${metrics.sent ? Math.round(metrics.delivered / metrics.sent * 100) : 0}% delivery`} tone="success" />
        <KpiCard label={t("failed")} value={metrics.failed.toLocaleString()} icon={<XCircle size={16} />} tone="error" />
        <KpiCard label={t("optedOut")} value={metrics.optedOut.toLocaleString()} icon={<ShieldOff size={16} />} tone="error" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label={t("responseRate")} value={`${metrics.responseRate.toFixed(1)}%`} icon={<Gauge size={16} />} />
        <KpiCard label={t("completionRate")} value={`${metrics.completionRate.toFixed(1)}%`} icon={<Flag size={16} />} tone="success" />
        <KpiCard label="Skipped (gate)" value={metrics.skipped.toLocaleString()} tone="warning" />
        <KpiCard label="Responses" value={metrics.responses.toLocaleString()} icon={<Languages size={16} />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <SectionCard title={t("throughput")} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={hourly} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--c-primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--c-primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis dataKey="time" tick={axisTick} stroke={chartGrid} />
              <YAxis tick={axisTick} stroke={chartGrid} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="sent" name="Sent" stroke="hsl(var(--c-primary))" fill="url(#gSent)" strokeWidth={2} />
              <Area type="monotone" dataKey="delivered" name="Delivered" stroke="hsl(var(--c-success))" fill="hsl(var(--c-success))" fillOpacity={0.15} strokeWidth={1.5} />
              <Area type="monotone" dataKey="responses" name="Responses" stroke="hsl(var(--c-gold))" fill="hsl(var(--c-gold))" fillOpacity={0.12} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title={t("sentimentSplit")}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={sentimentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {sentimentData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-xs text-text-faint text-center -mt-1">Crude keyword proxy over reply bodies (EN/ES).</p>
        </SectionCard>
      </div>

      <SectionCard title={t("responseByLanguage")}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={langData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
            <XAxis dataKey="name" tick={axisTick} stroke={chartGrid} />
            <YAxis tick={axisTick} stroke={chartGrid} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="sent" name="Sent" fill="hsl(var(--c-primary))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="delivered" name="Delivered" fill="hsl(var(--c-success))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="responses" name="Responses" fill="hsl(var(--c-gold))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="optedOut" name="Opt-outs" fill="hsl(var(--c-error))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
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
