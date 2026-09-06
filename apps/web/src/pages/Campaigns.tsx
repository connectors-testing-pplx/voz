import { Link } from "wouter";
import { Plus, Megaphone, Activity, FileBarChart, Workflow, Phone } from "lucide-react";
import { useI18n, Badge } from "@voz/ui";
import { useStore } from "../lib/store";
import { computeMetrics } from "@voz/reports";
import { PageHeader, SectionCard, KpiCard, statusBadge, channelIcon } from "../components/ui";

export default function Campaigns() {
  const { t } = useI18n();
  const { state } = useStore();

  return (
    <div className="p-4 md:p-6 max-w-[1180px] mx-auto">
      <PageHeader
        title={t("navCampaigns")}
        subtitle="Political · Nonprofit · Employer · Commercial — each inherits its own rules, disclosures, and approval checks."
        actions={
          <Link href="/builder/cam_1" className="btn-primary">
            <Plus size={16} /> {t("newCampaign")}
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Active campaigns" value={state.campaigns.filter((c) => c.status === "active").length} icon={<Activity size={16} />} />
        <KpiCard label="Contacts" value={state.contacts.length.toLocaleString()} icon={<Phone size={16} />} />
        <KpiCard label="Total sent" value={state.sends.length.toLocaleString()} tone="primary" />
        <KpiCard label="Opt-outs logged" value={state.suppression.length.toLocaleString()} tone="error" />
      </div>

      <SectionCard title="Campaigns" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-divider">
              <tr>
                <th className="th">{t("campaignName")}</th>
                <th className="th">{t("campaignType")}</th>
                <th className="th">{t("channel")}</th>
                <th className="th text-right">{t("sent")}</th>
                <th className="th text-right">{t("responseRate")}</th>
                <th className="th text-right">{t("optedOut")}</th>
                <th className="th">{t("status")}</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {state.campaigns.map((c) => {
                const flow = state.flows.find((f) => f.id === c.flowId);
                const completions = new Set((state.completions[c.id] ?? []).map((id) => id));
                const m = computeMetrics(c.id, state.sends, state.responses, completions);
                const sb = statusBadge(c.status);
                return (
                  <tr key={c.id} className="hover:bg-surface-offset transition-colors">
                    <td className="td">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-text-faint">{flow?.name ?? "—"}</div>
                    </td>
                    <td className="td"><Badge tone="purple">{c.type}</Badge></td>
                    <td className="td"><Badge tone="blue">{channelIcon(c.channel)}</Badge></td>
                    <td className="td text-right tabular-nums">{m.sent.toLocaleString()}</td>
                    <td className="td text-right tabular-nums">{m.responseRate.toFixed(1)}%</td>
                    <td className="td text-right tabular-nums text-error">{m.optedOut.toLocaleString()}</td>
                    <td className="td"><Badge tone={sb.tone}>{sb.label}</Badge></td>
                    <td className="td">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Link href={`/builder/${c.id}`} className="btn-ghost px-2 py-1.5" title={t("navBuilder")}><Workflow size={15} /></Link>
                        <Link href={`/live/${c.id}`} className="btn-ghost px-2 py-1.5" title={t("navLive")}><Activity size={15} /></Link>
                        <Link href={`/reports/${c.id}`} className="btn-ghost px-2 py-1.5" title={t("navReports")}><FileBarChart size={15} /></Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="mt-5 grid md:grid-cols-3 gap-3">
        <SectionCard>
          <div className="flex items-center gap-2 text-primary mb-1.5"><Megaphone size={16} /><span className="font-medium text-sm">Campaign types</span></div>
          <p className="text-sm text-text-muted">Political, nonprofit, employer, and commercial each inherit different rules, carrier disclosures, and approval checks from the policy engine.</p>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center gap-2 text-primary mb-1.5"><Workflow size={16} /><span className="font-medium text-sm">Branching flows</span></div>
          <p className="text-sm text-text-muted">A node graph (message · question · branch · unsubscribe · tag · agent · completion) powers bilingual polling and voter-intent paths.</p>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center gap-2 text-primary mb-1.5"><FileBarChart size={16} /><span className="font-medium text-sm">Audit-ready</span></div>
          <p className="text-sm text-text-muted">Every outbound send is tied to a campaign, contact, consent artifact, language, segment, and policy profile.</p>
        </SectionCard>
      </div>
    </div>
  );
}
