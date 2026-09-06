// Seed data generator — realistic bilingual (EN/ES) demo state for a political
// polling campaign and a nonprofit survey. Generates contacts with per-contact
// language preference, documented consent, suppression entries, a branching
// survey flow, and a send/response timeline so live + post-campaign reports
// render with believable data.

import type { ConsentRecord, SuppressionEntry } from "@voz/compliance";
import type { Flow } from "@voz/flows";
import type { Response, Send } from "@voz/reports";
import type { AppState, Campaign, Client, Contact, Organization } from "../types";

const now = Date.now();
const hour = 3_600_000;
const day = 24 * hour;

function id(prefix: string, i: number): string {
  return `${prefix}_${i}`;
}

const firstNames = {
  en: ["James", "Mary", "Robert", "Patricia", "Michael", "Linda", "David", "Sarah", "Kevin", "Emily", "Brian", "Amanda", "Daniel", "Laura", "Tyler"],
  es: ["Carlos", "María", "José", "Ana", "Luis", "Carmen", "Jorge", "Lucía", "Miguel", "Sofía", "Ricardo", "Isabel", "Pedro", "Rosa", "Diego"],
};
const lastNames = {
  en: ["Smith", "Johnson", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas"],
  es: ["García", "Rodríguez", "Martínez", "Hernández", "López", "González", "Pérez", "Sánchez", "Ramírez", "Torres"],
};

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

export function buildSeed(): AppState {
  const org: Organization = { id: "org_1", name: "Voz Demo Org", type: "political" };
  const clients: Client[] = [
    { id: "cli_1", orgId: org.id, name: "Cámara Cívica", senderId: "+12125550001" },
    { id: "cli_2", orgId: org.id, name: "Comunidad Unido", senderId: "+12125550002" },
  ];

  // Contacts: ~60 EN + 40 ES
  const contacts: Contact[] = [];
  const consents: ConsentRecord[] = [];
  const suppression: SuppressionEntry[] = [];

  const N = 120;
  for (let i = 0; i < N; i++) {
    const lang: "en" | "es" = i % 10 < 6 ? "en" : "es";
    const first = pick(firstNames[lang], i);
    const last = pick(lastNames[lang], i);
    const phone = `+1212555${String(1000 + i).padStart(4, "0")}`;
    const createdAt = now - (30 - (i % 30)) * day;
    contacts.push({
      id: id("con", i),
      phone,
      firstName: first,
      lastName: last,
      language: lang,
      zip: lang === "es" ? (i % 2 ? "90011" : "33135") : (i % 2 ? "53204" : "85016"),
      tags: [lang === "es" ? "latino-us" : "gen-pop"],
      createdAt,
    });
    consents.push({
      id: id("cs", i),
      contactId: id("con", i),
      channel: "sms",
      source: i % 3 === 0 ? "web" : i % 3 === 1 ? "form" : "keyword",
      language: lang,
      disclosureVersion: "2026.1",
      timestamp: createdAt + day,
      ip: i % 3 === 0 ? `104.28.${10 + (i % 200)}.5` : undefined,
      userAgent: i % 3 === 0 ? "Mozilla/5.0 (web opt-in)" : undefined,
      evidence: i % 3 === 0 ? "form-screenshot.png" : undefined,
    });
  }

  // A few suppressions (wrong number, carrier complaint, manual opt-out)
  const reasons = ["wrong_number", "carrier_complaint", "manual_optout", "landline", "reassigned_risk"] as const;
  [3, 11, 17, 24, 29, 55, 71].forEach((i, k) => {
    suppression.push({
      contactId: id("con", i),
      phone: contacts[i].phone,
      reason: reasons[k % reasons.length] as SuppressionEntry["reason"],
      channel: "sms",
      source: k % 2 ? "manual" : "carrier",
      timestamp: now - (10 - k) * day,
    });
  });

  // --- Flow: bilingual voter-intent branching poll ---
  const flow: Flow = {
    id: "flow_1",
    name: "Voter intent poll (EN/ES)",
    language: "en",
    startNodeId: "n_msg1",
    createdAt: now - 28 * day,
    nodes: [
      { id: "n_msg1", type: "message", x: 80, y: 220, text: { en: "Hi {first}, this is Cámara Cívica. We have a 3-question community survey. Reply YES to take part (msg & data rates may apply).", es: "Hola {first}, soy de Cámara Cívica. Tenemos una breve encuesta de 3 preguntas. Responda SÍ para participar (pueden aplicar tarifas)." } },
      { id: "n_q1", type: "question", x: 320, y: 220, storeAs: "consent", prompt: { en: "Do you plan to vote in the next election?", es: "¿Planea votar en la próxima elección?" }, options: [
        { key: "yes", label: { en: "Yes", es: "Sí" } },
        { key: "no", label: { en: "No", es: "No" } },
        { key: "unsure", label: { en: "Unsure", es: "No seguro" } },
      ], allowOther: true },
      { id: "n_tag_yes", type: "tag", x: 600, y: 120, tags: ["voter-yes"] },
      { id: "n_q2", type: "question", x: 860, y: 120, storeAs: "issue", prompt: { en: "Which issue matters most: Housing, Jobs, or Immigration?", es: "¿Qué tema le importa más: Vivienda, Empleos o Inmigración?" }, options: [
        { key: "housing", label: { en: "Housing", es: "Vivienda" } },
        { key: "jobs", label: { en: "Jobs", es: "Empleos" } },
        { key: "immigration", label: { en: "Immigration", es: "Inmigración" } },
      ] },
      { id: "n_done_yes", type: "completion", x: 1120, y: 120, summary: { en: "Thanks for participating! Your voice matters. Reply STOP to opt out.", es: "¡Gracias por participar! Su voz cuenta. Responda STOP para cancelar." } },
      { id: "n_unsub", type: "unsubscribe", x: 600, y: 360, reason: "answered_no" },
    ],
    edges: [
      { id: "e1", from: "n_msg1", to: "n_q1" },
      { id: "e2", from: "n_q1", to: "n_tag_yes", condition: "consent == yes", label: "yes / sí" },
      { id: "e3", from: "n_q1", to: "n_unsub", condition: "consent == no", label: "no" },
      { id: "e4", from: "n_q1", to: "n_tag_yes", label: "unsure / other" },
      { id: "e5", from: "n_tag_yes", to: "n_q2" },
      { id: "e6", from: "n_q2", to: "n_done_yes" },
    ],
  };

  // Second flow (nonprofit satisfaction)
  const flow2: Flow = {
    id: "flow_2",
    name: "Member satisfaction survey",
    language: "es",
    startNodeId: "m1",
    createdAt: now - 14 * day,
    nodes: [
      { id: "m1", type: "message", x: 80, y: 200, text: { en: "Hi {first}, Comunidad Unido values your feedback. Reply YES for a 1-question survey.", es: "Hola {first}, Comunidad Unido valora su opinión. Responda SÍ para una encuesta de 1 pregunta." } },
      { id: "m2", type: "question", x: 360, y: 200, storeAs: "rating", prompt: { en: "How satisfied are you? (1-5)", es: "¿Qué tan satisfecho(a) está? (1-5)" }, options: [
        { key: "5", label: { en: "Very", es: "Mucho" } }, { key: "3", label: { en: "Okay", es: "Regular" } }, { key: "1", label: { en: "Poor", es: "Poco" } },
      ], allowOther: true },
      { id: "m3", type: "completion", x: 640, y: 120, summary: { en: "Thank you for your feedback!", es: "¡Gracias por su opinión!" } },
      { id: "m4", type: "escalation", x: 640, y: 320, assignTo: "agent_queue_1", note: { en: "An agent will follow up shortly.", es: "Un agente le contactará pronto." } },
    ],
    edges: [
      { id: "f1", from: "m1", to: "m2" },
      { id: "f2", from: "m2", to: "m3", condition: "rating == 5", label: "5" },
      { id: "f3", from: "m2", to: "m4", condition: "rating == 1", label: "1" },
      { id: "f4", from: "m2", to: "m3", label: "other" },
    ],
  };

  const campaigns: Campaign[] = [
    { id: "cam_1", name: "Civic voter intent poll — District 9", orgId: org.id, clientId: "cli_1", type: "political", channel: "sms", language: "en", senderId: clients[0].senderId, flowId: flow.id, disclosureVersion: "2026.1", status: "active", scheduledAt: now - 6 * hour, createdAt: now - 26 * day },
    { id: "cam_2", name: "Member satisfaction pulse", orgId: org.id, clientId: "cli_2", type: "nonprofit", channel: "sms", language: "es", senderId: clients[1].senderId, flowId: flow2.id, disclosureVersion: "2026.1", status: "active", scheduledAt: now - 30 * hour, createdAt: now - 12 * day },
    { id: "cam_3", name: "Get-out-the-vote reminder (draft)", orgId: org.id, clientId: "cli_1", type: "political", channel: "whatsapp", language: "es", senderId: clients[0].senderId, flowId: flow.id, disclosureVersion: "2026.1", status: "draft", createdAt: now - 2 * day },
  ];

  // Generate sends + responses for the two active campaigns over the last ~8h
  const sends: Send[] = [];
  const responses: Response[] = [];
  const completions: Record<string, string[]> = { cam_1: [], cam_2: [] };
  const suppressedPhones = new Set(suppression.map((s) => s.phone));

  let sid = 0;
  let rid = 0;
  for (const c of contacts) {
    if (suppressedPhones.has(c.phone)) continue;
    // campaign 1 ~ 80 contacts, campaign 2 ~ 45
    const target1 = (parseInt(c.id.split("_")[1]) % 3 !== 0);
    const target2 = (parseInt(c.id.split("_")[1]) % 4 === 0);
    for (const [cid, chosen] of [["cam_1", target1], ["cam_2", target2]] as const) {
      if (!chosen) continue;
      const ts = now - Math.round(Math.random() * 8 * hour);
      // some skipped by gate (quiet hours / suppression)
      const gateSkip = Math.random() < 0.06;
      let status: Send["status"] = gateSkip ? "skipped" : Math.random() < 0.97 ? "delivered" : "failed";
      const send: Send = {
        id: id("snd", sid++),
        campaignId: cid,
        contactId: c.id,
        phone: c.phone,
        language: c.language,
        status,
        errorCode: status === "failed" ? "30007 (carrier violation)" : undefined,
        timestamp: ts,
      };
      sends.push(send);
      if (status !== "delivered") continue;
      // response probability
      if (Math.random() < 0.62) {
        const isStop = Math.random() < 0.04;
        const isHelp = Math.random() < 0.03;
        const kind: Response["kind"] = isStop ? "stop" : isHelp ? "help" : "reply";
        const answerVal = cid === "cam_1" ? (Math.random() < 0.5 ? "yes" : Math.random() < 0.7 ? "no" : "unsure") : (Math.random() < 0.4 ? "5" : Math.random() < 0.6 ? "3" : "1");
        const body = isStop ? "STOP" : isHelp ? "HELP" : c.language === "es" ? (answerVal === "yes" ? "sí" : answerVal) : answerVal;
        responses.push({
          id: id("rsp", rid++),
          sendId: send.id,
          campaignId: cid,
          contactId: c.id,
          body,
          language: c.language,
          kind: kind === "reply" && /stop/i.test(body) ? "stop" : kind,
          timestamp: ts + Math.round(Math.random() * 2 * hour),
          answerVar: kind === "reply" ? (cid === "cam_1" ? "consent" : "rating") : undefined,
          answerValue: kind === "reply" ? answerVal : undefined,
        });
        if (kind === "stop" || /stop/i.test(body)) {
          suppression.push({ contactId: c.id, phone: c.phone, reason: "manual_optout", channel: "sms", source: "keyword", timestamp: ts + hour });
        }
        if (kind === "reply" && Math.random() < 0.7) {
          completions[cid].push(c.id);
        }
      }
    }
  }

  return { organizations: [org], clients, contacts, consents, suppression, flows: [flow, flow2], campaigns, sends, responses, completions };
}
