import { useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Save, CheckCircle2, ShieldAlert, MessageSquare } from "lucide-react";
import { useI18n, Badge } from "@voz/ui";
import { useStore } from "../lib/store";
import { policyFor, buildDisclosure } from "@voz/compliance";
import { PageHeader, SectionCard } from "../components/ui";
import FlowEditor from "../components/FlowEditor";

export default function Builder() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const { state, updateFlow, updateCampaign } = useStore();
  const campaign = state.campaigns.find((c) => c.id === id) ?? state.campaigns[0];
  const flow = state.flows.find((f) => f.id === campaign?.flowId) ?? state.flows[0];
  const policy = policyFor(campaign.type);
  const client = state.clients.find((c) => c.id === campaign.clientId);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [approvalChecks, setApprovalChecks] = useState<Record<number, boolean>>({});

  if (!campaign || !flow) return <div className="p-6">Campaign not found.</div>;

  const disclosure = buildDisclosure({
    language: lang,
    clientName: client?.name ?? "Client Name",
    privacyUrl: "https://voz.example/privacy",
    termsUrl: "https://voz.example/terms",
    version: campaign.disclosureVersion,
  });

  const checksDone = policy.requiredApprovals.map((_, i) => approvalChecks[i]).filter(Boolean).length;
  const launchReady = checksDone === policy.requiredApprovals.length;

  return (
    <div className="p-4 md:p-6 max-w-[1180px] mx-auto">
      <Link href="/" className="btn-ghost px-2 py-1 mb-2 -ml-2 text-sm"><ArrowLeft size={15} /> {t("navCampaigns")}</Link>
      <PageHeader
        title={campaign.name}
        subtitle={`${campaign.type} · ${campaign.channel.toUpperCase()} · disclosure v${campaign.disclosureVersion} · flow: ${flow.name}`}
        actions={
          <>
            <button
              className="btn-primary"
              onClick={() => {
                updateFlow(flow.id, flow);
                setSavedAt(Date.now());
              }}
            >
              <Save size={16} /> {t("save")}
            </button>
            <button
              className="btn-outline"
              disabled={!launchReady}
              onClick={() => updateCampaign(campaign.id, { status: campaign.status === "draft" ? "active" : campaign.status })}
            >
              <CheckCircle2 size={16} /> {t("launch")}
            </button>
          </>
        }
      />
      {savedAt && <div className="text-xs text-success mb-3 -mt-2">Saved flow “{flow.name}” at {new Date(savedAt).toLocaleTimeString()}.</div>}

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <SectionCard title="Bilingual disclosure preview" className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Badge tone="primary">v{disclosure.version}</Badge>
            <Badge tone={lang === "es" ? "purple" : "neutral"}>{lang === "es" ? "Español" : "English"}</Badge>
            <span className="text-xs text-text-faint ml-auto">Call-to-action shown at opt-in</span>
          </div>
          <div className="rounded-md bg-surface-offset p-3.5 text-sm leading-relaxed border-l-2 border-primary">
            {disclosure.cta}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div><span className="text-text-faint">Privacy:</span> {disclosure.privacyUrl}</div>
            <div><span className="text-text-faint">Terms:</span> {disclosure.termsUrl}</div>
            <div><span className="text-text-faint">Frequency:</span> {disclosure.frequencyNote}</div>
            <div><span className="text-text-faint">Revocation:</span> Reply STOP to opt out</div>
          </div>
          <div className="mt-3 rounded-md border border-border p-2.5 flex items-start gap-2">
            <MessageSquare size={15} className="text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-text-muted">
              Templates use <code className="text-text">{"{first}"}</code> personalization and per-contact language. STOP/HELP replies are handled automatically by the compliance keyword engine, with confirmation + suppression across the sender pool.
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Send gate & approvals">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert size={15} className={launchReady ? "text-success" : "text-warning"} />
            <span className="text-sm font-medium">{launchReady ? "Ready to launch" : `${checksDone}/${policy.requiredApprovals.length} approvals`}</span>
          </div>
          <ul className="space-y-1.5">
            {policy.requiredApprovals.map((a, i) => (
              <li key={i}>
                <label className="flex items-start gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[hsl(var(--c-primary))]"
                    checked={!!approvalChecks[i]}
                    onChange={(e) => setApprovalChecks((s) => ({ ...s, [i]: e.target.checked }))}
                  />
                  <span className={approvalChecks[i] ? "text-text-muted line-through" : "text-text"}>{a}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-divider text-xs text-text-muted">
            Every send is gated by: consent status · quiet hours · sender eligibility · channel eligibility · suppression screening.
          </div>
        </SectionCard>
      </div>

      <FlowEditor flow={flow} onChange={(f) => updateFlow(f.id, f)} />

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <SectionCard title={`Policy profile — ${policy.campaignType}`}>
          <dl className="grid grid-cols-1 gap-y-2 text-sm">
            <Row k="Carrier registration" v={policy.requiresCarrierRegistration ? "Required (TCR / 10DLC)" : "Not required"} />
            <Row k="Content vetting" v={policy.requiresContentVetting ? "Required" : "Not required"} />
            <Row k="Quiet hours" v={`${policy.quietHours.startHour}:00–${policy.quietHours.endHour}:00 (${policy.quietHours.timezone})`} />
            <Row k="Channels" v={policy.allowedChannels.join(", ")} />
          </dl>
          <div className="mt-3">
            <span className="label-xs">Sample content rules</span>
            <ul className="mt-1 space-y-1 text-xs text-text-muted list-disc pl-4">
              {policy.sampleContentRules.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </SectionCard>
        <SectionCard title="WhatsApp channel notes">
          <ul className="space-y-1.5 text-xs text-text-muted list-disc pl-4">
            {policy.whatsappNotes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
          <div className="mt-3 rounded-md bg-warning/10 border border-warning/30 p-2.5 text-xs text-warning">
            WhatsApp opt-in is stored and managed separately from SMS in the data model, with its own template-approval path.
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-divider pb-2 last:border-0">
      <dt className="text-text-muted">{k}</dt>
      <dd className="font-medium text-right">{v}</dd>
    </div>
  );
}
