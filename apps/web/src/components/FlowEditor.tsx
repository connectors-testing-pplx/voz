import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { useI18n } from "@voz/ui";
import {
  findNode,
  NODE_TYPE_META,
  type Flow,
  type FlowNode,
  type FlowNodeType,
  type FlowText,
} from "@voz/flows";

const NODE_W = 210;
const NODE_H = 88;

const ICON: Record<FlowNodeType, string> = {
  message: "💬", question: "❓", branch: "🔀", unsubscribe: "🚫", tag: "🏷️", escalation: "🧑‍💼", completion: "✓",
};

export default function FlowEditor({
  flow,
  onChange,
}: {
  flow: Flow;
  onChange: (f: Flow) => void;
}) {
  const { lang, t } = useI18n();
  const [selected, setSelected] = useState<string | null>(flow.startNodeId);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedNode = selected ? findNode(flow, selected) : undefined;

  const update = (patch: Partial<Flow>) => onChange({ ...flow, ...patch });

  const addNode = (type: FlowNodeType) => {
    const id = "n_" + Math.random().toString(36).slice(2, 8);
    const n = makeNode(type, id, 80 + (flow.nodes.length % 5) * 230, 120 + Math.floor(flow.nodes.length / 5) * 160);
    update({ nodes: [...flow.nodes, n] });
    setSelected(id);
  };

  const onPointerDown = (e: RPointerEvent, node: FlowNode) => {
    e.stopPropagation();
    setSelected(node.id);
    const rect = canvasRef.current!.getBoundingClientRect();
    dragRef.current = { id: node.id, dx: e.clientX - rect.left - node.x, dy: e.clientY - rect.top - node.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: RPointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - d.dx);
    const y = Math.max(0, e.clientY - rect.top - d.dy);
    update({
      nodes: flow.nodes.map((n) => (n.id === d.id ? { ...n, x, y } : n)),
    });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const deleteNode = (id: string) => {
    update({
      nodes: flow.nodes.filter((n) => n.id !== id),
      edges: flow.edges.filter((e) => e.from !== id && e.to !== id),
    });
    setSelected(null);
  };

  const addEdge = (from: string, to: string, label?: string, condition?: string) => {
    if (from === to) return;
    if (flow.edges.some((e) => e.from === from && e.to === to)) return;
    update({
      edges: [...flow.edges, { id: "e_" + Math.random().toString(36).slice(2, 8), from, to, label, condition }],
    });
  };

  const removeEdge = (id: string) => update({ edges: flow.edges.filter((e) => e.id !== id) });

  // build edge paths
  const nodeById = (id: string) => flow.nodes.find((n) => n.id === id);

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4">
      {/* canvas */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-divider flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(Object.keys(NODE_TYPE_META) as FlowNodeType[]).map((type) => (
              <button key={type} className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => addNode(type)}>
                <span>{ICON[type]}</span>
                {t(NODE_TYPE_META[type].label.toLowerCase())}
              </button>
            ))}
          </div>
          <span className="label-xs">{t("flowCanvas")}</span>
        </div>
        <div
          ref={canvasRef}
          className="relative overflow-auto bg-surface-2 touch-none"
          style={{ height: 560, backgroundImage: "radial-gradient(hsl(var(--c-border)) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={() => setSelected(null)}
        >
          <div style={{ width: 1800, height: 700, position: "relative" }}>
            <svg className="absolute inset-0 pointer-events-none" width={1800} height={700}>
              {flow.edges.map((e) => {
                const a = nodeById(e.from);
                const b = nodeById(e.to);
                if (!a || !b) return null;
                const x1 = a.x + NODE_W / 2;
                const y1 = a.y + NODE_H;
                const x2 = b.x + NODE_W / 2;
                const y2 = b.y;
                const midY = (y1 + y2) / 2;
                const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
                return (
                  <g key={e.id}>
                    <path d={d} fill="none" stroke="hsl(var(--c-primary))" strokeWidth={1.8} strokeOpacity={0.7} markerEnd="url(#arrow)" />
                    {e.label && (
                      <g className="pointer-events-auto">
                        <rect x={(x1 + x2) / 2 - 30} y={midY - 17} width={60} height={18} rx={4} fill="hsl(var(--c-surface))" stroke="hsl(var(--c-border))" strokeWidth={1} />
                        <text x={(x1 + x2) / 2} y={midY - 4} textAnchor="middle" style={{ fontSize: 11, fill: "hsl(var(--c-text-muted))" }}>
                          {e.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="hsl(var(--c-primary))" />
                </marker>
              </defs>
            </svg>
            {flow.nodes.map((n) => {
              const meta = NODE_TYPE_META[n.type];
              const isSel = n.id === selected;
              return (
                <div
                  key={n.id}
                  onPointerDown={(e) => onPointerDown(e, n)}
                  onClick={(e) => { e.stopPropagation(); setSelected(n.id); }}
                  className={`absolute rounded-md border shadow-sm cursor-move select-none ${isSel ? "ring-2 ring-primary" : ""}`}
                  style={{
                    left: n.x, top: n.y, width: NODE_W, height: NODE_H,
                    background: "hsl(var(--c-surface))",
                    borderColor: meta.color,
                    borderLeftWidth: 3,
                  }}
                >
                  <div className="px-2.5 py-1.5 flex items-center gap-1.5 border-b border-divider" style={{ background: `hsl(${meta.color.replace('#', '')} / 0.08)` }}>
                    <span>{ICON[n.type]}</span>
                    <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                    {n.id === flow.startNodeId && <span className="ml-auto text-[10px] text-text-faint">start</span>}
                  </div>
                  <div className="px-2.5 py-1.5 text-[11px] text-text-muted leading-snug line-clamp-3">
                    {nodePreview(n, lang)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* inspector */}
      <div className="card card-pad h-fit lg:sticky lg:top-2 max-h-[560px] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold">{selectedNode ? "Edit node" : t("flowCanvas")}</h3>
          {selectedNode && (
            <button className="btn-ghost px-2 py-1 text-error" onClick={() => deleteNode(selectedNode.id)} title="Delete node">Delete</button>
          )}
        </div>
        {!selectedNode && <p className="text-sm text-text-muted">Select a node to edit its bilingual content and routing. Use the toolbar to add nodes.</p>}
        {selectedNode && (
          <NodeInspector
            node={selectedNode}
            lang={lang}
            flow={flow}
            onUpdate={(patch) => update({ nodes: flow.nodes.map((n) => (n.id === selectedNode.id ? { ...n, ...patch } as FlowNode : n)) })}
            onAddEdge={addEdge}
            onRemoveEdge={removeEdge}
          />
        )}
        <div className="mt-4 pt-3 border-t border-divider">
          <div className="label-xs mb-2">Legend</div>
          <div className="grid grid-cols-1 gap-1.5">
            {(Object.keys(NODE_TYPE_META) as FlowNodeType[]).map((ty) => (
              <div key={ty} className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-sm" style={{ background: NODE_TYPE_META[ty].color }} />
                <span className="text-text">{NODE_TYPE_META[ty].label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function nodePreview(n: FlowNode, lang: "en" | "es"): string {
  const pick = (ft?: FlowText) => (ft ? (lang === "es" ? ft.es : ft.en) : "");
  switch (n.type) {
    case "message": return pick(n.text);
    case "question": return pick(n.prompt) + " → " + n.options.map((o) => o.key).join(" / ");
    case "branch": return "branch on: " + n.variable;
    case "tag": return n.tags.join(", ");
    case "unsubscribe": return "unsubscribe · " + n.reason;
    case "escalation": return "→ " + n.assignTo;
    case "completion": return pick(n.summary);
  }
}

function makeNode(type: FlowNodeType, id: string, x: number, y: number): FlowNode {
  const base = { id, x, y };
  switch (type) {
    case "message": return { ...base, type, text: { en: "New message", es: "Nuevo mensaje" } };
    case "question": return { ...base, type, storeAs: "answer", prompt: { en: "New question?", es: "¿Nueva pregunta?" }, options: [{ key: "yes", label: { en: "Yes", es: "Sí" } }, { key: "no", label: { en: "No", es: "No" } }] };
    case "branch": return { ...base, type, variable: "answer" };
    case "unsubscribe": return { ...base, type, reason: "manual_optout" };
    case "tag": return { ...base, type, tags: ["new-tag"] };
    case "escalation": return { ...base, type, assignTo: "agent_queue_1", note: { en: "Agent follow-up", es: "Seguimiento de agente" } };
    case "completion": return { ...base, type, summary: { en: "Thank you!", es: "¡Gracias!" } };
  }
}

function LangInput({ label, value, onChange }: { label: string; value: FlowText; onChange: (v: FlowText) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="label-xs">{label}</span>
      <textarea className="input resize-y min-h-[64px] leading-snug auto-grow" rows={3} value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} placeholder="English" />
      <textarea className="input resize-y min-h-[64px] leading-snug auto-grow" rows={3} value={value.es} onChange={(e) => onChange({ ...value, es: e.target.value })} placeholder="Español" />
    </div>
  );
}

function NodeInspector({
  node, lang, flow, onUpdate, onAddEdge, onRemoveEdge,
}: {
  node: FlowNode;
  lang: "en" | "es";
  flow: Flow;
  onUpdate: (patch: Partial<FlowNode>) => void;
  onAddEdge: (from: string, to: string, label?: string, condition?: string) => void;
  onRemoveEdge: (id: string) => void;
}) {
  const outEdges = flow.edges.filter((e) => e.from === node.id);
  const otherNodes = flow.nodes.filter((n) => n.id !== node.id);

  return (
    <div className="space-y-3.5">
      <div>
        <span className="label-xs">Node type</span>
        <div className="text-sm font-medium mt-0.5">{NODE_TYPE_META[node.type].label}</div>
        <p className="text-xs text-text-muted">{NODE_TYPE_META[node.type].description}</p>
      </div>

      {node.type === "message" && <LangInput label="Message text (EN / ES)" value={node.text} onChange={(v) => onUpdate({ text: v } as Partial<FlowNode>)} />}
      {node.type === "question" && (
        <>
          <LangInput label="Prompt (EN / ES)" value={node.prompt} onChange={(v) => onUpdate({ prompt: v } as Partial<FlowNode>)} />
          <div>
            <span className="label-xs">Store answer as</span>
            <input className="input mt-1" value={node.storeAs} onChange={(e) => onUpdate({ storeAs: e.target.value } as Partial<FlowNode>)} />
          </div>
          <div>
            <span className="label-xs">Options ({node.options.length})</span>
            <div className="space-y-1.5 mt-1">
              {node.options.map((o, i) => (
                <div key={i} className="flex gap-1.5">
                  <input className="input py-1.5" value={o.key} placeholder="key" onChange={(e) => onUpdate({ options: node.options.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)) } as Partial<FlowNode>)} />
                  <input className="input py-1.5" value={lang === "es" ? o.label.es : o.label.en} placeholder={lang === "es" ? "ES" : "EN"} onChange={(e) => onUpdate({ options: node.options.map((x, j) => (j === i ? { ...x, label: { ...x.label, [lang]: e.target.value } } : x)) } as Partial<FlowNode>)} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {node.type === "branch" && (
        <div>
          <span className="label-xs">Branch variable</span>
          <input className="input mt-1" value={node.variable} onChange={(e) => onUpdate({ variable: e.target.value } as Partial<FlowNode>)} />
        </div>
      )}
      {node.type === "tag" && (
        <div>
          <span className="label-xs">Tags (comma separated)</span>
          <input className="input mt-1" value={node.tags.join(", ")} onChange={(e) => onUpdate({ tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } as Partial<FlowNode>)} />
        </div>
      )}
      {node.type === "unsubscribe" && (
        <div>
          <span className="label-xs">Reason</span>
          <input className="input mt-1" value={node.reason} onChange={(e) => onUpdate({ reason: e.target.value } as Partial<FlowNode>)} />
        </div>
      )}
      {node.type === "escalation" && (
        <>
          <div>
            <span className="label-xs">Assign to</span>
            <input className="input mt-1" value={node.assignTo} onChange={(e) => onUpdate({ assignTo: e.target.value } as Partial<FlowNode>)} />
          </div>
          <LangInput label="Note (EN / ES)" value={node.note} onChange={(v) => onUpdate({ note: v } as Partial<FlowNode>)} />
        </>
      )}
      {node.type === "completion" && <LangInput label="Summary (EN / ES)" value={node.summary} onChange={(v) => onUpdate({ summary: v } as Partial<FlowNode>)} />}

      <div className="pt-2 border-t border-divider">
        <span className="label-xs">Outgoing edges</span>
        {outEdges.length === 0 && <p className="text-xs text-text-faint mt-1">No outgoing edges. Add one below.</p>}
        <div className="space-y-1.5 mt-1.5">
          {outEdges.map((e) => {
            const to = flow.nodes.find((n) => n.id === e.to);
            return (
              <div key={e.id} className="flex items-center gap-1.5 text-xs">
                <span className="flex-1 truncate">→ {to ? NODE_TYPE_META[to.type].label : "?"}</span>
                {e.label && <Badge2>{e.label}</Badge2>}
                <button className="text-error px-1" onClick={() => onRemoveEdge(e.id)}>×</button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-2">
          <select className="input py-1.5 flex-1" id="edge-target" defaultValue={otherNodes[0]?.id}>
            {otherNodes.map((n) => <option key={n.id} value={n.id}>{NODE_TYPE_META[n.type].label}: {nodePreview(n, lang).slice(0, 24)}</option>)}
          </select>
          <button
            className="btn-outline px-2.5 py-1.5 text-xs"
            onClick={(e) => {
              const sel = (e.currentTarget.parentElement!.querySelector("#edge-target") as HTMLSelectElement).value;
              onAddEdge(node.id, sel, node.type === "question" ? "option" : undefined);
            }}
          >Connect</button>
        </div>
      </div>
    </div>
  );
}

function Badge2({ children }: { children: React.ReactNode }) {
  return <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-offset border border-border">{children}</span>;
}
