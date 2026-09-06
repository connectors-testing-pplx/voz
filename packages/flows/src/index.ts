// @voz/flows — survey / conversation graph schema and execution engine.
//
// A flow is a directed node graph. Node types cover the full polling,
// satisfaction, CX, and voter-intent use cases with branching by response and
// language:
//
//   message        — send a static message (templated, language-aware)
//   question       — send a question, collect a reply, route by branch edges
//   branch         — route based on a stored variable / previous answer
//   unsubscribe    — enforce opt-out + suppression
//   tag            — apply a tag to the contact
//   escalation     — hand off to a human agent
//   completion     — terminal success node
//
// Edges carry an optional `condition` so a QuestionNode can route "Yes"/"No"/
// "Si"/"No (es)" answers to different downstream nodes — the "flow diagrams of
// potential answers" surfaced in the builder UI.

import type { Language } from "@voz/compliance";

export type FlowNodeType =
  | "message"
  | "question"
  | "branch"
  | "unsubscribe"
  | "tag"
  | "escalation"
  | "completion";

export interface FlowText {
  en: string;
  es: string;
}

export interface FlowNodeBase {
  id: string;
  type: FlowNodeType;
  x: number;
  y: number;
}

export interface MessageNode extends FlowNodeBase {
  type: "message";
  text: FlowText;
}
export interface QuestionNode extends FlowNodeBase {
  type: "question";
  prompt: FlowText;
  /** Allowed answer keys, e.g. ["yes","no","maybe"]. */
  options: { key: string; label: FlowText }[];
  /** free text accepted as "other". */
  allowOther?: boolean;
  storeAs: string; // variable name to store the answer under
}
export interface BranchNode extends FlowNodeBase {
  type: "branch";
  variable: string; // branch on a stored variable
  /** Match expressions on edges decide routing; default edge used when none match. */
}
export interface UnsubscribeNode extends FlowNodeBase {
  type: "unsubscribe";
  reason: string;
}
export interface TagNode extends FlowNodeBase {
  type: "tag";
  tags: string[];
}
export interface EscalationNode extends FlowNodeBase {
  type: "escalation";
  assignTo: string; // agent / queue id
  note: FlowText;
}
export interface CompletionNode extends FlowNodeBase {
  type: "completion";
  summary: FlowText;
}

export type FlowNode =
  | MessageNode
  | QuestionNode
  | BranchNode
  | UnsubscribeNode
  | TagNode
  | EscalationNode
  | CompletionNode;

export interface FlowEdge {
  id: string;
  from: string; // node id
  to: string; // node id
  /** Optional condition. For question options: the option key. For branch: an expression like "value == yes". */
  condition?: string;
  /** label rendered on the canvas */
  label?: string;
}

export interface Flow {
  id: string;
  name: string;
  language: Language; // base language of the flow definition
  startNodeId: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export type NodeOutcome = "continue" | "completed" | "unsubscribed" | "escalate";

export interface FlowStepResult {
  nodeId: string;
  /** Outbound message text in the contact's language, if any. */
  message?: string;
  /** Variable writes produced this step (variable -> value). */
  vars?: Record<string, string>;
  /** Tags applied this step. */
  tags?: string[];
  /** Pending question awaiting the contact's reply (nodeId + options). */
  awaitingReply?: { nodeId: string; options: { key: string }[] };
  outcome: NodeOutcome;
  /** Next node id to advance to once any reply is resolved. */
  nextNodeId?: string;
}

export interface FlowExecutionContext {
  contactLanguage: Language;
  vars: Record<string, string>;
  tags: string[];
}

const t = (text: FlowText | undefined, lang: Language): string | undefined =>
  text ? (lang === "es" ? text.es || text.en : text.en || text.es) : undefined;

export function findNode(flow: Flow, id: string): FlowNode | undefined {
  return flow.nodes.find((n) => n.id === id);
}

function edgesFrom(flow: Flow, nodeId: string): FlowEdge[] {
  return flow.edges.filter((e) => e.from === nodeId);
}

/** Evaluate a simple condition expression like "answer == yes". */
export function evalCondition(expr: string | undefined, vars: Record<string, string>): boolean {
  if (!expr) return true;
  const m = expr.match(/^(\w+)\s*(==|!=)\s*(.+)$/);
  if (!m) return true;
  const [, varName, op, literalRaw] = m;
  const value = vars[varName] ?? "";
  const literal = literalRaw.trim().replace(/^['"]|['"]$/g, "");
  return op === "==" ? value === literal : value !== literal;
}

/**
 * Advance one node. For question nodes, returns an awaitingReply result so the
 * caller can collect the inbound reply, store it as a var, then call
 * `routeByAnswer` to pick the next edge.
 */
export function executeNode(
  flow: Flow,
  node: FlowNode,
  ctx: FlowExecutionContext,
): FlowStepResult {
  switch (node.type) {
    case "message": {
      const out = edgesFrom(flow, node.id)[0];
      return {
        nodeId: node.id,
        message: t(node.text, ctx.contactLanguage),
        outcome: "continue",
        nextNodeId: out?.to,
      };
    }
    case "question": {
      return {
        nodeId: node.id,
        message: t(node.prompt, ctx.contactLanguage),
        awaitingReply: {
          nodeId: node.id,
          options: node.options.map((o) => ({ key: o.key })),
        },
        outcome: "continue",
      };
    }
    case "branch": {
      const edges = edgesFrom(flow, node.id);
      const matched =
        edges.find((e) => e.condition && evalCondition(e.condition, ctx.vars)) ??
        edges.find((e) => !e.condition);
      return { nodeId: node.id, outcome: "continue", nextNodeId: matched?.to };
    }
    case "tag": {
      ctx.tags.push(...node.tags);
      const out = edgesFrom(flow, node.id)[0];
      return {
        nodeId: node.id,
        tags: node.tags,
        outcome: "continue",
        nextNodeId: out?.to,
      };
    }
    case "unsubscribe": {
      return { nodeId: node.id, outcome: "unsubscribed" };
    }
    case "escalation": {
      return {
        nodeId: node.id,
        message: t(node.note, ctx.contactLanguage),
        outcome: "escalate",
      };
    }
    case "completion": {
      return {
        nodeId: node.id,
        message: t(node.summary, ctx.contactLanguage),
        outcome: "completed",
      };
    }
  }
}

/** After a question node receives a reply, record the answer and route. */
export function routeByAnswer(
  flow: Flow,
  questionNode: QuestionNode,
  rawReply: string,
  ctx: FlowExecutionContext,
): FlowStepResult {
  const reply = rawReply.trim().toLowerCase();
  const matched = questionNode.options.find((o) => o.key.toLowerCase() === reply);
  let stored = matched ? matched.key : "other";
  if (!matched && questionNode.allowOther) stored = rawReply.trim();
  ctx.vars[questionNode.storeAs] = stored;
  const edges = edgesFrom(flow, questionNode.id);
  const edge =
    edges.find((e) => e.condition && evalCondition(e.condition, ctx.vars)) ??
    edges.find((e) => !e.condition);
  return {
    nodeId: questionNode.id,
    vars: { [questionNode.storeAs]: stored },
    outcome: "continue",
    nextNodeId: edge?.to,
  };
}

/** Walk the whole flow headlessly (no live replies) for reporting/simulation. */
export function simulateFlow(flow: Flow, lang: Language): FlowStepResult[] {
  const ctx: FlowExecutionContext = { contactLanguage: lang, vars: {}, tags: [] };
  const results: FlowStepResult[] = [];
  let current = findNode(flow, flow.startNodeId);
  let guard = 0;
  while (current && guard++ < 64) {
    const res = executeNode(flow, current, ctx);
    results.push(res);
    if (res.outcome !== "continue" || !res.nextNodeId) break;
    current = findNode(flow, res.nextNodeId);
  }
  return results;
}

export const NODE_TYPE_META: Record<
  FlowNodeType,
  { label: string; color: string; description: string }
> = {
  message: { label: "Message", color: "#0e7490", description: "Send a static, language-aware message." },
  question: { label: "Question", color: "#1d4ed8", description: "Ask a question, store the answer, branch by option." },
  branch: { label: "Branch", color: "#7c3aed", description: "Route based on a stored variable." },
  unsubscribe: { label: "Unsubscribe", color: "#b91c1c", description: "Enforce opt-out + suppression." },
  tag: { label: "Tag", color: "#b45309", description: "Apply tags to the contact." },
  escalation: { label: "Agent", color: "#be185d", description: "Hand off to a human agent." },
  completion: { label: "Done", color: "#15803d", description: "Terminal completion node." },
};
