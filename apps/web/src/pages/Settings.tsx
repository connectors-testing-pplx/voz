import { useI18n, Badge } from "@voz/ui";
import {
  POLICY_PROFILES,
  FEDERAL_QUIET_HOURS,
  buildDisclosure,
  type CampaignType,
} from "@voz/compliance";
import { PageHeader, SectionCard } from "../components/ui";
import { Moon, KeyRound, FileText, ShieldCheck, Clock } from "lucide-react";

export default function Settings() {
  const { t, lang } = useI18n();
  const types = Object.keys(POLICY_PROFILES) as CampaignType[];
  const sample = buildDisclosure({
    language: lang,
    clientName: "Cámara Cívica",
    privacyUrl: "https://voz.example/privacy",
    termsUrl: "https://voz.example/terms",
  });

  return (
    <div className="p-4 md:p-6 max-w-[1180px] mx-auto">
      <PageHeader
        title={t("navSettings")}
        subtitle="Per-channel policy controls, quiet hours, opt-out keyword engine, and disclosure templates inherited by every campaign."
      />

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <SectionCard title={<span className="flex items-center gap-2"><ShieldCheck size={16} className="text-primary" /> Policy profiles by campaign type</span>}>
          <div className="space-y-3">
            {types.map((ty) => {
              const p = POLICY_PROFILES[ty];
              return (
                <div key={ty} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium capitalize">{p.campaignType}</span>
                    <div className="flex gap-1.5">
                      {p.allowedChannels.map((c) => <Badge key={c} tone="blue">{c}</Badge>)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-text-muted">
                    <span>Carrier registration: <b className="text-text">{p.requiresCarrierRegistration ? "Yes" : "No"}</b></span>
                    <span>Content vetting: <b className="text-text">{p.requiresContentVetting ? "Yes" : "No"}</b></span>
                    <span>Quiet hours: <b className="text-text">{p.quietHours.startHour}:00–{p.quietHours.endHour}:00</b></span>
                    <span>Approvals: <b className="text-text">{p.requiredApprovals.length}</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title={<span className="flex items-center gap-2"><Clock size={16} className="text-primary" /> {t("quietHours")}</span>}>
            <p className="text-sm text-text-muted mb-2">Outbound A2P traffic is suppressed during the federal quiet-hours window in the recipient’s local civil time. State-specific windows layer on top.</p>
            <div className="flex items-center gap-2">
              <Moon size={16} className="text-warning" />
              <Badge tone="warning">{FEDERAL_QUIET_HOURS.startHour}:00 – {FEDERAL_QUIET_HOURS.endHour}:00</Badge>
              <Badge tone="neutral">{FEDERAL_QUIET_HOURS.timezone}</Badge>
            </div>
          </SectionCard>

          <SectionCard title={<span className="flex items-center gap-2"><KeyRound size={16} className="text-primary" /> Opt-out keyword engine</span>}>
            <p className="text-sm text-text-muted mb-2">Inbound replies are classified and, when matched, the number is suppressed across the sender pool with a logged timestamp + source channel. Nonstandard phrases (e.g. “cancel”, “unsubscribe”, “cancelar”) are handled in-app since carriers do not auto-process them.</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <KwGroup label="STOP family" keys={["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "CANCELAR"]} tone="error" />
              <KwGroup label="REVOKE family" keys={["REVOKE", "REVOKEALL", "REVOCAR", "RETIRAR"]} tone="error" />
              <KwGroup label="HELP family" keys={["HELP", "INFO", "AYUDA", "INFORMACIÓN"]} tone="blue" />
              <KwGroup label="START family" keys={["START", "YES", "UNSTOP", "OPTIN", "SÍ"]} tone="success" />
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title={<span className="flex items-center gap-2"><FileText size={16} className="text-primary" /> {t("disclosureVersion")} · {lang === "es" ? "Español" : "English"}</span>}>
        <div className="rounded-md bg-surface-offset p-3.5 text-sm leading-relaxed border-l-2 border-primary">
          {sample.cta}
        </div>
        <div className="grid sm:grid-cols-4 gap-3 mt-3 text-xs">
          <div><span className="text-text-faint">Version:</span> v{sample.version}</div>
          <div><span className="text-text-faint">Frequency:</span> {sample.frequencyNote}</div>
          <div><span className="text-text-faint">Privacy:</span> {sample.privacyUrl}</div>
          <div><span className="text-text-faint">Terms:</span> {sample.termsUrl}</div>
        </div>
      </SectionCard>

      <SectionCard title={t("sendGate")} className="mt-4">
        <p className="text-sm text-text-muted mb-3">Every outbound message — even a manual “press send” by a staffer, which still counts as A2P business messaging in carrier policy — is gated before dispatch:</p>
        <div className="grid sm:grid-cols-5 gap-2">
          {["Consent status", "Quiet hours", "Sender eligibility", "Channel eligibility", "Suppression screening"].map((g) => (
            <div key={g} className="rounded-md border border-border p-2.5 text-center text-xs font-medium">{g}</div>
          ))}
        </div>
        <div className="mt-3 text-xs text-text-faint">Blocked sends are recorded with their reason and never dispatched. The gate is applied identically to SMS and WhatsApp (per-channel opt-in is required separately).</div>
      </SectionCard>
    </div>
  );
}

function KwGroup({ label, keys, tone }: { label: string; keys: string[]; tone: "error" | "blue" | "success" }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="label-xs mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1">
        {keys.map((k) => <Badge key={k} tone={tone}>{k}</Badge>)}
      </div>
    </div>
  );
}
