// @voz/compliance — consent, opt-out, quiet hours, suppression, and policy engine
// for A2P 10DLC / WhatsApp messaging in the U.S. market.
//
// Compliance baseline enforced here:
//  - Documented consent with source, language, disclosure version, timestamp
//  - Clear call-to-action disclosures (EN/ES)
//  - Message-frequency disclosure + revocation handling
//  - CTIA / TCPA-style opt-out keyword handling (STOP family, HELP, advanced)
//  - Quiet-hours gating (federal + state-aware window)
//  - Per-campaign policy profiles inherited by campaign type
//
// Sources reflected in the design:
//  - Twilio A2P 10DLC onboarding & opt-out keyword handling
//  - Meta WhatsApp Business opt-in requirements
//  - CTIA Messaging Principles & Best Practices

export type Channel = "sms" | "whatsapp";
export type CampaignType = "political" | "nonprofit" | "employer" | "commercial";
export type Language = "en" | "es";
export type ConsentSource = "web" | "keyword" | "import" | "manual" | "form";
export type RemovalReason =
  | "manual_optout"
  | "wrong_number"
  | "landline"
  | "deceased"
  | "do_not_contact"
  | "reassigned_risk"
  | "duplicate"
  | "invalid_consent"
  | "carrier_complaint"
  | "expired_consent";

export interface ConsentRecord {
  id: string;
  contactId: string;
  channel: Channel;
  source: ConsentSource;
  language: Language;
  disclosureVersion: string;
  timestamp: number; // epoch ms
  ip?: string;
  userAgent?: string;
  evidence?: string; // document / screenshot reference
  revokedAt?: number;
}

export interface SuppressionEntry {
  contactId: string;
  phone: string;
  reason: RemovalReason;
  channel: Channel;
  source: "keyword" | "manual" | "import" | "carrier" | "admin";
  timestamp: number;
}

/** Result of classifying an inbound reply against the keyword engine. */
export interface InboundClassification {
  kind:
    | "stop"
    | "help"
    | "start"
    | "unstop"
    | "optout"
    | "revoke"
    | "reply"
    | "subscribe_keyword"
    | "unknown";
  matchedKeyword?: string;
  suppress: boolean; // should the number be added to the suppression list
  autoReplyRequired: boolean; // a confirmation message should be sent
}

// ---------------------------------------------------------------------------
// 1. OPT-OUT / KEYWORD ENGINE
// ---------------------------------------------------------------------------

// CTIA / Twilio standard STOP family + advanced opt-out keywords.
// Per Twilio guidance, nonstandard phrases (e.g. "cancel", "unsubscribe") are
// NOT auto-handled by carriers and require your own logic — we handle them here.
const STOP_FAMILY = new Set([
  "stop", "stopall", "unsubscribe", "cancel", "end", "quit", "optout",
  "cancelar", "cancelar todo", "detener", "salir", // ES variants
]);
const REVOKE_FAMILY = new Set(["revoke", "revokeall", "revocar", "retirar"]);
const HELP_FAMILY = new Set([
  "help", "info", "ayuda", "informacion", "información",
]);
const START_FAMILY = new Set(["start", "yes", "unstop", "optin", "si", "sí", "aceptar"]);

export function classifyInbound(raw: string): InboundClassification {
  const body = raw.trim().toLowerCase();
  const tokens = body.replace(/[^\w\sáéíóúñ]/g, "").split(/\s+/).filter(Boolean);
  const first = tokens[0] ?? "";
  const whole = tokens.join(" ");

  if (STOP_FAMILY.has(first) || STOP_FAMILY.has(whole) || REVOKE_FAMILY.has(first)) {
    return { kind: "stop", matchedKeyword: first, suppress: true, autoReplyRequired: true };
  }
  if (HELP_FAMILY.has(first) || HELP_FAMILY.has(whole)) {
    return { kind: "help", matchedKeyword: first, suppress: false, autoReplyRequired: true };
  }
  if (START_FAMILY.has(first)) {
    return { kind: "start", matchedKeyword: first, suppress: false, autoReplyRequired: true };
  }
  // Spanish yes-as-subscription when responding to an opt-in prompt
  if (whole === "si" || whole === "sí") {
    return { kind: "subscribe_keyword", matchedKeyword: whole, suppress: false, autoReplyRequired: false };
  }
  return { kind: "reply", suppress: false, autoReplyRequired: false };
}

/** Localized confirmation replies for opt-out and HELP, by language. */
export function autoReply(
  kind: "stop" | "help" | "start",
  lang: Language,
  clientName = "Client Name",
): string {
  if (kind === "stop") {
    return lang === "es"
      ? `Ha sido dado de baja y no recibirá más mensajes de ${clientName}. Responda START para volver a suscribirse.`
      : `You are unsubscribed and will receive no further messages from ${clientName}. Reply START to resubscribe.`;
  }
  if (kind === "start") {
    return lang === "es"
      ? `Gracias por volver a suscribirse a ${clientName}. Msg frequency varies. Msg & data rates may apply. Responda STOP para cancelar, HELP para ayuda.`
      : `Thank you for resubscribing to ${clientName}. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`;
  }
  // HELP
  return lang === "es"
    ? `${clientName}: mensajes de texto recurrentes de campañas/encuestas. Frecuencia varía. Pueden aplicar tarifas. STOP para cancelar. Para ayuda llame al 1-800-555-0199.`
    : `${clientName}: recurring campaign/survey texts. Frequency varies. Msg & data rates may apply. Reply STOP to opt out. For help call 1-800-555-0199.`;
}

// ---------------------------------------------------------------------------
// 2. CONSENT VALIDATION
// ---------------------------------------------------------------------------

export interface ConsentValidationResult {
  valid: boolean;
  reasons: string[];
}

/**
 * A consent record is usable for sending only when:
 *  - it is not revoked,
 *  - it matches the channel being sent on (per-channel opt-in for WhatsApp),
 *  - it references a non-stale disclosure version.
 */
export function validateConsentForSend(
  consent: ConsentRecord | undefined,
  channel: Channel,
  currentDisclosureVersion: string,
  maxAgeDays = 365 * 4,
  now = Date.now(),
): ConsentValidationResult {
  if (!consent) return { valid: false, reasons: ["No consent record on file."] };
  const reasons: string[] = [];
  if (consent.revokedAt) reasons.push("Consent was revoked.");
  if (consent.channel !== channel)
    reasons.push(`Consent is for channel "${consent.channel}", not "${channel}".`);
  if (consent.disclosureVersion !== currentDisclosureVersion)
    reasons.push(`Disclosure version mismatch (record: ${consent.disclosureVersion}, current: ${currentDisclosureVersion}).`);
  const ageDays = (now - consent.timestamp) / 86_400_000;
  if (ageDays > maxAgeDays) reasons.push(`Consent is older than ${maxAgeDays} days.`);
  return { valid: reasons.length === 0, reasons };
}

/** Validate a batch of imported contacts for usable consent. */
export interface ImportRowConsentCheck {
  phone: string;
  hasConsent: boolean;
  channelMatch: boolean;
  valid: boolean;
  reason: string;
}

export function screenImportForConsent(
  rows: { phone: string; consent?: ConsentRecord; channel: Channel; disclosureVersion: string }[],
): ImportRowConsentCheck[] {
  return rows.map((r) => {
    const res = validateConsentForSend(r.consent, r.channel, r.disclosureVersion);
    return {
      phone: r.phone,
      hasConsent: !!r.consent,
      channelMatch: r.consent?.channel === r.channel,
      valid: res.valid,
      reason: res.reasons.join(" ") || "OK",
    };
  });
}

// ---------------------------------------------------------------------------
// 3. QUIET HOURS
// ---------------------------------------------------------------------------

export interface QuietHoursConfig {
  // Local civil time window during which outbound A2P traffic is suppressed.
  startHour: number; // 0-23, inclusive start
  endHour: number; // exclusive end (e.g. 21 to 8 means 21:00-08:00)
  timezone: string; // IANA tz, e.g. "America/Los_Angeles"
}

export const FEDERAL_QUIET_HOURS: QuietHoursConfig = {
  startHour: 21,
  endHour: 8,
  timezone: "America/Los_Angeles",
};

export function isInQuietHours(
  date: Date,
  cfg: QuietHoursConfig = FEDERAL_QUIET_HOURS,
): boolean {
  // Compute hour in the configured tz via Intl.
  const hourStr = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: cfg.timezone,
  }).format(date);
  const hour = Number(hourStr) % 24;
  const { startHour, endHour } = cfg;
  if (startHour === endHour) return false;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  // wraps midnight
  return hour >= startHour || hour < endHour;
}

// ---------------------------------------------------------------------------
// 4. SUPPRESSION LIST
// ---------------------------------------------------------------------------

/** A simple in-memory suppression store keyed by phone + channel. */
export class SuppressionList {
  private map = new Map<string, SuppressionEntry>();

  private key(phone: string, channel: Channel) {
    return `${phone.normalize()}|${channel}`;
  }

  add(entry: SuppressionEntry): void {
    this.map.set(this.key(entry.phone, entry.channel), entry);
  }

  has(phone: string, channel: Channel): boolean {
    return this.map.has(this.key(phone, channel));
  }

  remove(phone: string, channel: Channel): boolean {
    return this.map.delete(this.key(phone, channel));
  }

  entries(): SuppressionEntry[] {
    return [...this.map.values()];
  }

  size(): number {
    return this.map.size;
  }
}

// ---------------------------------------------------------------------------
// 5. DISCLOSURE TEMPLATES (call-to-action)
// ---------------------------------------------------------------------------

export interface Disclosure {
  version: string;
  language: Language;
  clientName: string;
  cta: string;
  frequencyNote: string;
  privacyUrl: string;
  termsUrl: string;
}

export function buildDisclosure(opts: {
  language: Language;
  clientName: string;
  privacyUrl: string;
  termsUrl: string;
  version?: string;
}): Disclosure {
  const version = opts.version ?? "2026.1";
  const { language: lang, clientName, privacyUrl, termsUrl } = opts;
  const cta =
    lang === "es"
      ? `Al proporcionar su número, acepta recibir mensajes de texto recurrentes de encuestas o campañas de ${clientName}. La frecuencia varía. Pueden aplicarse tarifas por mensajes y datos. Responda STOP para cancelar o HELP para ayuda.`
      : `By providing your number, you agree to receive recurring survey or campaign texts from ${clientName}. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`;
  const frequencyNote =
    lang === "es"
      ? "La frecuencia varía. Pueden aplicarse tarifas por mensajes y datos."
      : "Frequency varies. Msg & data rates may apply.";
  return { version, language: lang, clientName, cta, frequencyNote, privacyUrl, termsUrl };
}

// ---------------------------------------------------------------------------
// 6. POLICY PROFILES (inherited per campaign type)
// ---------------------------------------------------------------------------

export interface PolicyProfile {
  id: string;
  campaignType: CampaignType;
  requiresCarrierRegistration: boolean;
  requiresContentVetting: boolean;
  quietHours: QuietHoursConfig;
  /** Channels allowed by default for this campaign type. */
  allowedChannels: Channel[];
  /** Required approvals before a launch. */
  requiredApprovals: string[];
  /** Sample-content rules the builder must surface. */
  sampleContentRules: string[];
  /** WhatsApp-specific notes (separate opt-in + template approval). */
  whatsappNotes: string[];
}

export const POLICY_PROFILES: Record<CampaignType, PolicyProfile> = {
  political: {
    id: "pol-us",
    campaignType: "political",
    requiresCarrierRegistration: true,
    requiresContentVetting: true,
    quietHours: FEDERAL_QUIET_HOURS,
    allowedChannels: ["sms", "whatsapp"],
    requiredApprovals: [
      "A2P 10DLC campaign registration via The Campaign Registry",
      "Brand vetting (Vetter of Record)",
      "Legal sign-off on disclosure language (EN/ES)",
      "Sample message approval by sending partner",
    ],
    sampleContentRules: [
      "Identify the sender and campaign committee in every message.",
      "No purchased lists — consent must be voluntary and documented.",
      "Bilingual disclosures required for EN/ES audiences.",
      "Quiet-hours compliance enforced for all outbound sends.",
    ],
    whatsappNotes: [
      "Political messaging requires a Meta Business verification and message-template approval.",
      "WhatsApp opt-in must be collected and stored separately from SMS opt-in.",
    ],
  },
  nonprofit: {
    id: "nonprofit-us",
    campaignType: "nonprofit",
    requiresCarrierRegistration: true,
    requiresContentVetting: false,
    quietHours: FEDERAL_QUIET_HOURS,
    allowedChannels: ["sms", "whatsapp"],
    requiredApprovals: [
      "A2P 10DLC campaign registration (nonprofit use case)",
      "501(c) status confirmation",
    ],
    sampleContentRules: [
      "Disclose the organization name in CTA and first message.",
      "Consent must be voluntary; cannot be required to make a donation.",
    ],
    whatsappNotes: ["WhatsApp template approval required for utility/marketing categories."],
  },
  employer: {
    id: "employer-us",
    campaignType: "employer",
    requiresCarrierRegistration: true,
    requiresContentVetting: false,
    quietHours: FEDERAL_QUIET_HOURS,
    allowedChannels: ["sms"],
    requiredApprovals: ["A2P 10DLC campaign registration (employee/HR use case)"],
    sampleContentRules: [
      "Message must be transactional/HR in nature; marketing rules do not apply.",
      "Employer must retain documented employee consent.",
    ],
    whatsappNotes: ["WhatsApp not enabled by default for employer use case."],
  },
  commercial: {
    id: "commercial-us",
    campaignType: "commercial",
    requiresCarrierRegistration: true,
    requiresContentVetting: true,
    quietHours: FEDERAL_QUIET_HOURS,
    allowedChannels: ["sms", "whatsapp"],
    requiredApprovals: [
      "A2P 10DLC campaign registration (marketing)",
      "Brand vetting",
      "Marketing legal review of CTA + frequency disclosure",
    ],
    sampleContentRules: [
      "Prior express written consent required for marketing messages.",
      "Cannot bundle consent as a condition of purchase or account creation.",
      "Frequency disclosure + STOP/HELP must appear in CTA.",
    ],
    whatsappNotes: [
      "Marketing templates require Meta approval and explicit opt-in.",
      "User-facing controls to stop promotional offers must be honored.",
    ],
  },
};

export function policyFor(type: CampaignType): PolicyProfile {
  return POLICY_PROFILES[type];
}

// ---------------------------------------------------------------------------
// 7. SEND GATE — pre-flight compliance checks before any outbound message
// ---------------------------------------------------------------------------

export interface SendGateContext {
  channel: Channel;
  phone: string;
  language: Language;
  consent?: ConsentRecord;
  disclosureVersion: string;
  suppression: SuppressionList;
  senderEligible: boolean; // sender/number pool registered for this channel+use case
  quietHours?: QuietHoursConfig;
  now?: Date;
}

export interface SendGateResult {
  allowed: boolean;
  blockedReasons: string[];
}

/**
 * Every outbound message passes through this gate. A manual "press send" by a
 * staffer still counts as A2P business messaging in carrier policy, so the
 * gate enforces: consent status, quiet hours, sender eligibility, channel
 * eligibility, and suppression screening.
 */
export function runSendGate(ctx: SendGateContext): SendGateResult {
  const now = ctx.now ?? new Date();
  const reasons: string[] = [];

  if (ctx.suppression.has(ctx.phone, ctx.channel)) {
    reasons.push("Number is on the suppression list for this channel.");
  }
  const consent = validateConsentForSend(ctx.consent, ctx.channel, ctx.disclosureVersion);
  if (!consent.valid) reasons.push(`Consent: ${consent.reasons.join("; ")}`);
  if (!ctx.senderEligible) {
    reasons.push("Sender is not registered/eligible for this channel + use case.");
  }
  if (isInQuietHours(now, ctx.quietHours ?? FEDERAL_QUIET_HOURS)) {
    reasons.push("Send attempted within quiet hours — deferred.");
  }
  return { allowed: reasons.length === 0, blockedReasons: reasons };
}


