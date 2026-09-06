import { useMemo, useState } from "react";
import { useParams } from "wouter";
import { Upload, Users, ShieldOff, FileCheck2, Search, Plus } from "lucide-react";
import { useI18n, Badge, EmptyState } from "@voz/ui";
import { useStore } from "../lib/store";
import { screenImportForConsent, type RemovalReason } from "@voz/compliance";
import { PageHeader, SectionCard } from "../components/ui";

const REMOVAL_REASONS: { value: RemovalReason; label: string }[] = [
  { value: "manual_optout", label: "Manual opt-out" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "landline", label: "Landline" },
  { value: "deceased", label: "Deceased" },
  { value: "do_not_contact", label: "Do not contact" },
  { value: "reassigned_risk", label: "Reassigned-number risk" },
  { value: "duplicate", label: "Duplicate" },
  { value: "invalid_consent", label: "Invalid consent" },
  { value: "carrier_complaint", label: "Carrier complaint" },
  { value: "expired_consent", label: "Expired consent" },
];

type Tab = "contacts" | "consent" | "suppression";

export default function Contacts() {
  const { t } = useI18n();
  const { state, importContacts, removeContact, toggleSuppression } = useStore();
  const [tab, setTab] = useState<Tab>("contacts");
  const [query, setQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [csv, setCsv] = useState("");
  const [importResult, setImportResult] = useState<{ added: number; deduped: number } | null>(null);

  const suppressedPhones = useMemo(
    () => new Set(state.suppression.map((s) => s.phone)),
    [state.suppression],
  );

  const consentByContact = useMemo(() => {
    const map = new Map<string, (typeof state.consents)[number]>();
    for (const c of state.consents) map.set(c.contactId, c);
    return map;
  }, [state.consents]);

  const filteredContacts = state.contacts.filter(
    (c) =>
      c.phone.includes(query) ||
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(query.toLowerCase()),
  );

  const handleImport = () => {
    const rows = csv
      .trim()
      .split("\n")
      .map((line) => line.split(",").map((s) => s.trim()))
      .filter((r) => r.length >= 4 && r[2])
      .map((r) => ({
        firstName: r[0] || "Unknown",
        lastName: r[1] || "",
        phone: r[2],
        language: (r[3]?.toLowerCase() === "es" ? "es" : "en") as "en" | "es",
        zip: r[4],
        source: "import" as const,
      }));
    const res = importContacts(rows);
    setImportResult(res);
    setCsv("");
    // simulate consent screening summary
    const screened = screenImportForConsent(
      rows.map((r) => ({ phone: r.phone, consent: undefined, channel: "sms" as const, disclosureVersion: "2026.1" })),
    );
    const invalid = screened.filter((s) => !s.valid).length;
    setImportResult((prev) => (prev ? { ...prev, deduped: prev.deduped + invalid } : prev));
  };

  return (
    <div className="p-4 md:p-6 max-w-[1180px] mx-auto">
      <PageHeader
        title={t("navContacts")}
        subtitle="Import with dedupe, consent validation, and suppression matching. Bilingual contact preferences are stored per record."
        actions={
          <button className="btn-primary" onClick={() => setShowImport(true)}>
            <Upload size={16} /> {t("importContacts")}
          </button>
        }
      />

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <TabBtn active={tab === "contacts"} onClick={() => setTab("contacts")} icon={<Users size={15} />} label={`${t("contacts")} (${state.contacts.length})`} />
        <TabBtn active={tab === "consent"} onClick={() => setTab("consent")} icon={<FileCheck2 size={15} />} label={`${t("consent")} (${state.consents.length})`} />
        <TabBtn active={tab === "suppression"} onClick={() => setTab("suppression")} icon={<ShieldOff size={15} />} label={`${t("suppression")} (${state.suppression.length})`} tone="error" />
      </div>

      {tab === "contacts" && (
        <SectionCard pad={false}>
          <div className="p-3 border-b border-divider flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-2.5 top-2.5 text-text-faint" />
              <input className="input pl-8 py-2" placeholder="Search name or phone…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <span className="text-xs text-text-faint ml-auto">{filteredContacts.length} shown</span>
          </div>
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            <table className="w-full">
              <thead className="border-b border-divider sticky top-0 bg-surface">
                <tr>
                  <th className="th">{t("name")}</th>
                  <th className="th">{t("phone")}</th>
                  <th className="th">{t("language")}</th>
                  <th className="th">{t("consent")}</th>
                  <th className="th">{t("status")}</th>
                  <th className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {filteredContacts.map((c) => {
                  const con = consentByContact.get(c.id);
                  const suppressed = suppressedPhones.has(c.phone);
                  return (
                    <tr key={c.id} className="hover:bg-surface-offset">
                      <td className="td font-medium">{c.firstName} {c.lastName}</td>
                      <td className="td font-mono text-xs">{c.phone}</td>
                      <td className="td"><Badge tone={c.language === "es" ? "purple" : "blue"}>{c.language.toUpperCase()}</Badge></td>
                      <td className="td">
                        {con ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge tone="success">{con.source}</Badge>
                            <span className="text-[11px] text-text-faint">v{con.disclosureVersion}</span>
                          </div>
                        ) : <Badge tone="error">none</Badge>}
                      </td>
                      <td className="td">
                        {suppressed ? <Badge tone="error">suppressed</Badge> : <Badge tone="success">eligible</Badge>}
                      </td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="btn-ghost px-2 py-1 text-xs"
                            onClick={() => toggleSuppression(c.id, c.phone, "sms", !suppressed)}
                            title={suppressed ? "Remove from suppression" : "Add to suppression"}
                          >
                            {suppressed ? "Restore" : "Suppress"}
                          </button>
                          <select
                            className="input py-1 px-2 text-xs w-auto"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                removeContact(c.id, e.target.value as RemovalReason);
                                e.target.value = "";
                              }
                            }}
                          >
                            <option value="">Remove…</option>
                            {REMOVAL_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {tab === "consent" && (
        <SectionCard pad={false}>
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            <table className="w-full">
              <thead className="border-b border-divider sticky top-0 bg-surface">
                <tr>
                  <th className="th">Contact</th>
                  <th className="th">Channel</th>
                  <th className="th">{t("source")}</th>
                  <th className="th">{t("language")}</th>
                  <th className="th">{t("disclosureVersion")}</th>
                  <th className="th">Timestamp</th>
                  <th className="th">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {state.consents.map((c) => {
                  const contact = state.contacts.find((x) => x.id === c.contactId);
                  return (
                    <tr key={c.id} className="hover:bg-surface-offset">
                      <td className="td">{contact ? `${contact.firstName} ${contact.lastName}` : c.contactId}</td>
                      <td className="td"><Badge tone="blue">{c.channel}</Badge></td>
                      <td className="td">{c.source}</td>
                      <td className="td">{c.language.toUpperCase()}</td>
                      <td className="td font-mono text-xs">v{c.disclosureVersion}</td>
                      <td className="td text-xs text-text-muted">{new Date(c.timestamp).toLocaleString()}</td>
                      <td className="td text-xs">{c.evidence ?? (c.ip ? `IP ${c.ip}` : "—")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {tab === "suppression" && (
        <SectionCard pad={false}>
          {state.suppression.length === 0 ? (
            <EmptyState title="Suppression list is empty" icon={<ShieldOff size={28} />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-divider">
                  <tr>
                    <th className="th">{t("phone")}</th>
                    <th className="th">{t("reason")}</th>
                    <th className="th">Channel</th>
                    <th className="th">{t("source")}</th>
                    <th className="th">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {state.suppression.map((s, i) => (
                    <tr key={i} className="hover:bg-surface-offset">
                      <td className="td font-mono text-xs">{s.phone}</td>
                      <td className="td"><Badge tone="error">{REMOVAL_REASONS.find((r) => r.value === s.reason)?.label ?? s.reason}</Badge></td>
                      <td className="td">{s.channel}</td>
                      <td className="td">{s.source}</td>
                      <td className="td text-xs text-text-muted">{new Date(s.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {showImport && (
        <Modal onClose={() => { setShowImport(false); setImportResult(null); }}>
          <h3 className="font-display font-semibold text-lg mb-1">{t("importContacts")}</h3>
          <p className="text-sm text-text-muted mb-3">Paste CSV rows: <code className="text-xs">firstName,lastName,phone,lang(en/es),zip</code>. Dedupe runs on phone; consent is screened against the current disclosure version.</p>
          <textarea
            className="input font-mono text-xs h-40"
            placeholder={"Maria,Garcia,+12125550100,es,90011\nJohn,Smith,+12125550101,en,53204"}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-text-muted">
              {importResult ? (
                <span className="text-success">Added {importResult.added} · deduped/invalid {importResult.deduped}</span>
              ) : "Purchased lists are not permitted — consent must be voluntary and documented."}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => { setShowImport(false); setImportResult(null); }}>{t("cancel")}</button>
              <button className="btn-primary" onClick={handleImport} disabled={!csv.trim()}><Plus size={15} /> Import</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label, tone }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; tone?: "error" }) {
  return (
    <button
      onClick={onClick}
      className={`btn ${active ? "bg-surface-offset text-text border border-border" : "text-text-muted hover:bg-surface-offset"} ${tone === "error" && active ? "text-error" : ""}`}
    >
      {icon}
      {label}
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card card-pad w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
