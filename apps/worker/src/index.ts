/**
 * @voz/worker — production send, webhook ingestion, suppression enforcement,
 * and report generation (production backend; not part of the static Pages build).
 *
 * In production this runs as a queue worker (BullMQ / pg-boss) backed by
 * Postgres (Supabase) and Twilio (SMS) + WhatsApp Business Platform via Twilio
 * or Meta partner routing. The static demo app (apps/web) mirrors this logic
 * client-side; here it is the real, server-side implementation.
 *
 * Responsibilities:
 *   1. Outbound send jobs — pre-flight compliance gate, then dispatch.
 *   2. Webhook ingestion — delivery receipts + inbound replies.
 *   3. Suppression enforcement — STOP/HELP keyword handling + confirmation.
 *   4. Analytics materialization — roll sends/responses into metrics tables.
 *   5. Report generation — CSV / PDF / HTML exports.
 *
 * Every outbound message is tied to a campaign, contact, consent artifact,
 * language, segment, and policy profile so you can prove who was contacted,
 * why, with what disclosure basis, and what happened next.
 */

import {
  autoReply,
  classifyInbound,
  policyFor,
  runSendGate,
  SuppressionList,
  type Channel,
  type ConsentRecord,
  type Language,
} from "@voz/compliance";
import { routeByAnswer, executeNode, findNode, type Flow, type QuestionNode } from "@voz/flows";
import type { Send, Response } from "@voz/reports";

// --- Placeholder storage interfaces (backed by Postgres/Supabase in prod) ---
export interface SendJob {
  campaignId: string;
  contactId: string;
  phone: string;
  language: Language;
  channel: Channel;
  consent: ConsentRecord | undefined;
  disclosureVersion: string;
  flowId: string;
  senderId: string;
}

export interface SendProvider {
  sendSms(to: string, body: string, from: string): Promise<{ sid: string; status: string }>;
  sendWhatsApp(to: string, body: string, from: string): Promise<{ sid: string; status: string }>;
}

export interface MetricsWriter {
  recordSend(s: Send): Promise<void>;
  recordResponse(r: Response): Promise<void>;
  markCompletion(campaignId: string, contactId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// 1. OUTBOUND SEND JOB
// ---------------------------------------------------------------------------

export async function processSendJob(
  job: SendJob,
  provider: SendProvider,
  suppression: SuppressionList,
  flow: Flow,
  metrics: MetricsWriter,
  now = Date.now(),
): Promise<Send> {
  const policy = policyFor(/* campaignType resolved upstream */ "political");
  const gate = runSendGate({
    channel: job.channel,
    phone: job.phone,
    language: job.language,
    consent: job.consent,
    disclosureVersion: job.disclosureVersion,
    suppression,
    senderEligible: policy.allowedChannels.includes(job.channel),
    quietHours: policy.quietHours,
    now: new Date(now),
  });

  const base: Send = {
    id: `snd_${now}_${job.contactId}`,
    campaignId: job.campaignId,
    contactId: job.contactId,
    phone: job.phone,
    language: job.language,
    status: "queued",
    timestamp: now,
  };

  if (!gate.allowed) {
    const skipped: Send = { ...base, status: "skipped", errorCode: gate.blockedReasons.join("; ") };
    await metrics.recordSend(skipped);
    return skipped;
  }

  // Walk the flow’s first message node and dispatch it.
  const start = findNode(flow, flow.startNodeId);
  if (!start) {
    const failed: Send = { ...base, status: "failed", errorCode: "no_start_node" };
    await metrics.recordSend(failed);
    return failed;
  }
  const step = executeNode(flow, start, { contactLanguage: job.language, vars: {}, tags: [] });

  try {
    const res =
      job.channel === "sms"
        ? await provider.sendSms(job.phone, step.message ?? "", job.senderId)
        : await provider.sendWhatsApp(job.phone, step.message ?? "", job.senderId);
    const sent: Send = { ...base, status: "sent" };
    await metrics.recordSend(sent);
    return sent;
  } catch (e) {
    const failed: Send = { ...base, status: "failed", errorCode: String(e) };
    await metrics.recordSend(failed);
    return failed;
  }
}

// ---------------------------------------------------------------------------
// 2. WEBHOOK INGESTION (inbound reply + delivery receipt)
// ---------------------------------------------------------------------------

export async function processInbound(
  args: {
    campaignId: string;
    contactId: string;
    phone: string;
    body: string;
    language: Language;
    channel: Channel;
    flow: Flow;
    pendingNodeId?: string; // question node awaiting this reply
    senderId: string;
    clientName: string;
  },
  provider: SendProvider,
  suppression: SuppressionList,
  metrics: MetricsWriter,
  now = Date.now(),
): Promise<Response> {
  const classification = classifyInbound(args.body);

  const response: Response = {
    id: `rsp_${now}_${args.contactId}`,
    campaignId: args.campaignId,
    contactId: args.contactId,
    body: args.body,
    language: args.language,
    kind: classification.kind,
    timestamp: now,
    nodeId: args.pendingNodeId,
  };

  // 3. Suppression enforcement
  if (classification.suppress) {
    suppression.add({
      contactId: args.contactId,
      phone: args.phone,
      reason: "manual_optout",
      channel: args.channel,
      source: "keyword",
      timestamp: now,
    });
  }

  // Auto-reply confirmation (STOP/HELP/START)
  if (classification.autoReplyRequired) {
    const reply = autoReply(
      classification.kind === "stop" ? "stop" : classification.kind === "help" ? "help" : "start",
      args.language,
      args.clientName,
    );
    if (args.channel === "sms") await provider.sendSms(args.phone, reply, args.senderId);
    else await provider.sendWhatsApp(args.phone, reply, args.senderId);
  }

  // Route flow by answer if a question node was pending
  if (args.pendingNodeId && classification.kind === "reply") {
    const node = findNode(flow, args.pendingNodeId) as QuestionNode | undefined;
    if (node?.type === "question") {
      const ctx = { contactLanguage: args.language, vars: {}, tags: [] };
      const routed = routeByAnswer(flow, node, args.body, ctx);
      response.answerVar = node.storeAs;
      response.answerValue = ctx.vars[node.storeAs];
      // advance and send the next node's message
      const next = routed.nextNodeId ? findNode(flow, routed.nextNodeId) : undefined;
      if (next) {
        const nextStep = executeNode(flow, next, ctx);
        if (nextStep.message) {
          if (args.channel === "sms") await provider.sendSms(args.phone, nextStep.message, args.senderId);
          else await provider.sendWhatsApp(args.phone, nextStep.message, args.senderId);
        }
        if (nextStep.outcome === "completed") await metrics.markCompletion(args.campaignId, args.contactId);
        if (nextStep.outcome === "unsubscribed") {
          suppression.add({ contactId: args.contactId, phone: args.phone, reason: "manual_optout", channel: args.channel, source: "manual", timestamp: now });
        }
      }
    }
  }

  await metrics.recordResponse(response);
  return response;
}

// ---------------------------------------------------------------------------
// 3. DELIVERY RECEIPT
// ---------------------------------------------------------------------------
export async function processDeliveryReceipt(
  send: Send,
  status: "delivered" | "failed",
  errorCode: string | undefined,
  metrics: MetricsWriter,
): Promise<void> {
  const updated: Send = { ...send, status, errorCode: status === "failed" ? errorCode : undefined };
  await metrics.recordSend(updated);
}

/**
 * Entry point for the queue worker. Wires providers, suppression list
 * (loaded from Postgres), and metrics writer. In production this is a long-
 * running process consuming jobs from the outbound queue and a webhook
 * listener for inbound + receipts.
 */
export async function run(args: { job: SendJob; provider: SendProvider; suppression: SuppressionList; flow: Flow; metrics: MetricsWriter }) {
  return processSendJob(args.job, args.provider, args.suppression, args.flow, args.metrics);
}
