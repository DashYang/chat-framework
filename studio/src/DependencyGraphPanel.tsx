import { useEffect, useMemo, useRef, useState } from "react";

import { buildDependencyGraph, filterFlagDependencyGraph, filterScoreDependencyGraph } from "../../src/dependency-graph.js";
import type { AuthoringProject } from "./types";

export interface GraphNavigationTarget {
  panel: "conversations" | "social" | "articles" | "story";
  entityId: string;
  conversationId?: string;
}

interface DependencyGraphPanelProps {
  project: AuthoringProject;
  onNavigate: (target: GraphNavigationTarget) => void;
}

type GraphEdge = { id: string; from: string; to: string; kind: string; cyclic?: boolean };
type EdgePath = GraphEdge & { path: string };

const kindLabels: Record<string, string> = { all: "全部内容", conversation: "对话", message: "消息", social: "朋友圈", article: "文章", runtime: "结局" };
const severityLabels: Record<string, string> = { error: "错误", warning: "警告", info: "提示" };

function nodeRiskClass(nodeId: string, diagnostics: any[]) {
  const related = diagnostics.filter((item) => item.nodeIds.includes(nodeId));
  if (related.some((item) => item.severity === "error")) return "risk-error";
  if (related.some((item) => item.severity === "warning")) return "risk-warning";
  if (related.length) return "risk-info";
  return "";
}

function RiskPanel({ diagnostics, onNavigate }: { diagnostics: any[]; onNavigate: (target: GraphNavigationTarget) => void }) {
  if (!diagnostics.length) return null;
  return <div className="dependency-risks"><strong>逻辑风险</strong>{diagnostics.map((item) => <button key={item.id} className={`risk-row risk-${item.severity}`} onClick={() => item.target && onNavigate(item.target)}><span>{severityLabels[item.severity]}</span><span>{item.message}</span></button>)}</div>;
}

function FlagEdges({ rootRef, edges, zoom, layoutKey }: { rootRef: React.RefObject<HTMLDivElement | null>; edges: GraphEdge[]; zoom: number; layoutKey: string }) {
  const [paths, setPaths] = useState<EdgePath[]>([]);
  useEffect(() => {
    const root = rootRef.current || document.querySelector<HTMLDivElement>(".flag-dependency-graph");
    if (!root) return;
    const measure = () => {
      const rootRect = root.getBoundingClientRect();
      const nodes = new Map<string, HTMLElement>();
      root.querySelectorAll<HTMLElement>("[data-graph-node-id]").forEach((element) => nodes.set(element.dataset.graphNodeId || "", element));
      setPaths(edges.flatMap((edge) => {
        const from = nodes.get(edge.from);
        const to = nodes.get(edge.to);
        if (!from || !to) return [];
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        const x1 = (a.right - rootRect.left) / zoom;
        const y1 = (a.top + a.height / 2 - rootRect.top) / zoom;
        const x2 = (b.left - rootRect.left) / zoom;
        const y2 = (b.top + b.height / 2 - rootRect.top) / zoom;
        const direction = x2 >= x1 ? 1 : -1;
        const bend = Math.max(26, Math.abs(x2 - x1) * .42);
        const path = `M ${x1} ${y1} C ${x1 + bend * direction} ${y1}, ${x2 - bend * direction} ${y2}, ${x2} ${y2}`;
        return [{ ...edge, path }];
      }));
    };
    measure();
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll<HTMLElement>("[data-graph-node-id]").forEach((element) => observer.observe(element));
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [edges, layoutKey, rootRef, zoom]);
  return <svg className="dependency-edge-layer" aria-hidden="true"><defs><marker id="flag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>{paths.map((edge) => <path key={edge.id} className={`flag-edge edge-${edge.kind} ${edge.cyclic ? "cyclic" : ""}`} d={edge.path} markerEnd="url(#flag-arrow)" />)}</svg>;
}

function FlagGraphView({ model, onNavigate }: { model: any; onNavigate: (target: GraphNavigationTarget) => void }) {
  const [kind, setKind] = useState("all");
  const [flagQuery, setFlagQuery] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);
  const [zoom, setZoom] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const graph = useMemo(() => filterFlagDependencyGraph(model, { kind, flagQuery, riskOnly }), [model, kind, flagQuery, riskOnly]);
  const maxLayer = Math.max(0, ...graph.flags.map((item: any) => item.layer), ...graph.contents.map((item: any) => item.layer));
  const layers = Array.from({ length: maxLayer + 1 }, (_, layer) => [
    ...graph.contents.filter((item: any) => item.layer === layer).map((item: any) => ({ ...item, nodeType: "content" })),
    ...graph.flags.filter((item: any) => item.layer === layer).map((item: any) => ({ ...item, nodeType: "flag" }))
  ].sort((a: any, b: any) => a.nodeType === b.nodeType ? String(a.label || a.name).localeCompare(String(b.label || b.name), "zh-CN") : a.nodeType === "content" ? -1 : 1));
  const contentById = new Map(graph.contents.map((item: any) => [item.id, item]));
  const layoutKey = `${kind}|${flagQuery}|${riskOnly}|${zoom}|${graph.edges.map((edge: any) => edge.id).join(",")}`;
  return <>
    <div className="dependency-toolbar flag-toolbar">
      <label>内容<select value={kind} onChange={(event) => setKind(event.target.value)}>{Object.entries(kindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="dependency-search">Flag 搜索<input value={flagQuery} placeholder="输入 Flag 名称" onChange={(event) => setFlagQuery(event.target.value)} /></label>
      <label className="toggle-row dependency-risk-toggle"><input type="checkbox" checked={riskOnly} onChange={(event) => setRiskOnly(event.target.checked)} />仅看风险</label>
      <div className="dependency-zoom"><button onClick={() => setZoom((value) => Math.max(.75, value - .1))}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(1.5, value + .1))}>＋</button><button onClick={() => setZoom(1)}>复位</button></div>
    </div>
    <RiskPanel diagnostics={graph.diagnostics} onNavigate={onNavigate} />
    <div className="dependency-canvas-scroll flag-canvas-scroll">
      <div className="flag-dependency-graph" ref={rootRef} style={{ gridTemplateColumns: `repeat(${Math.max(1, layers.length)}, minmax(128px, 1fr))`, transform: `scale(${zoom})`, width: `${100 / zoom}%` }}>
        <FlagEdges rootRef={rootRef} edges={graph.edges} zoom={zoom} layoutKey={layoutKey} />
        {layers.map((nodes, index) => <section className="flag-layer" key={index}>{nodes.map((node: any) => node.nodeType === "flag"
          ? <button type="button" data-graph-node-id={node.id} title={node.name} className={`flag-compact-node ${node.cycleId ? "in-cycle" : ""} ${nodeRiskClass(node.id, model.diagnostics)}`} key={node.id} onClick={() => setFlagQuery(node.name)}><span>FLAG</span><strong>{node.name}</strong>{node.cycleId && <small>环</small>}</button>
          : <button type="button" data-graph-node-id={node.id} title={`${node.fullLabel}\n${node.entityId}`} className={`content-compact-node ${node.cycleId ? "in-cycle" : ""} ${nodeRiskClass(node.id, model.diagnostics)}`} key={node.id} onClick={() => onNavigate(node.target)}><span className={`message-kind kind-${node.kind}`}>{kindLabels[node.kind]}</span><strong>{node.label}</strong>{node.cycleId && <small>环</small>}</button>)}</section>)}
        {!graph.flags.length && !graph.contents.length && <div className="dependency-empty"><strong>当前筛选下没有 Flag 关系</strong><span>为选择项配置 Flag，或给内容添加 Flag 条件后会自动出现。</span></div>}
      </div>
    </div>
    <div className="flag-mobile-relations">{graph.flags.map((flag: any) => {
      const producers = flag.producerIds.map((id: string) => contentById.get(id)).filter(Boolean) as any[];
      const consumers = flag.consumerIds.map((id: string) => contentById.get(id)).filter(Boolean) as any[];
      return <article className={`flag-mobile-card ${flag.cycleId ? "in-cycle" : ""}`} key={flag.id}><strong>{flag.name}</strong><div><span>{producers.length ? producers.map((item) => item.label).join("、") : "无生产者"}</span><b>→ FLAG →</b><span>{consumers.length ? consumers.map((item) => item.label).join("、") : "无解锁内容"}</span></div></article>;
    })}</div>
  </>;
}

function ScoreGraphView({ model, onNavigate }: { model: any; onNavigate: (target: GraphNavigationTarget) => void }) {
  const [lane, setLane] = useState("all");
  const [kind, setKind] = useState("all");
  const [riskOnly, setRiskOnly] = useState(false);
  const graph = useMemo(() => filterScoreDependencyGraph(model, { lane, kind, riskOnly }), [model, lane, kind, riskOnly]);
  return <>
    <div className="dependency-toolbar score-toolbar">
      <label>泳道<select value={lane} onChange={(event) => setLane(event.target.value)}><option value="all">全部泳道</option>{model.lanes.map((item: any) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      <label>内容<select value={kind} onChange={(event) => setKind(event.target.value)}>{Object.entries(kindLabels).filter(([value]) => value !== "runtime").map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="toggle-row dependency-risk-toggle"><input type="checkbox" checked={riskOnly} onChange={(event) => setRiskOnly(event.target.checked)} />仅看风险</label>
    </div>
    <RiskPanel diagnostics={graph.diagnostics} onNavigate={onNavigate} />
    <div className="score-lanes">{graph.lanes.map((item: any) => <section className="score-lane" key={item.id}>
      <header><div><span>{item.scope === "global" ? "GLOBAL" : "ACCOUNT"}</span><strong>{item.label}</strong></div><small>固定点可达上限 {item.reachableMax} 分</small></header>
      <div className="score-lane-grid">
        <div className="score-sources"><strong>得分来源</strong>{item.sources.length ? item.sources.map((source: any) => <button title={`${source.fullLabel}\n${source.messageId}`} className={`score-source-card ${source.reachable ? "reachable" : "unreachable"}`} key={source.id} onClick={() => onNavigate(source.target)}><span>{source.label}</span><b>最高 +{source.maxScore}</b><small>{source.reachable ? "可达" : "不可达"}</small></button>) : <p>没有得分来源</p>}</div>
        <div className="score-requirements"><strong>Require 检查</strong>{item.requirements.length ? item.requirements.map((requirement: any) => <button title={`${requirement.fullLabel}\n${requirement.entityId}`} className={`score-require-card ${requirement.sufficient ? "sufficient" : "insufficient"}`} key={requirement.id} onClick={() => onNavigate(requirement.target)}><span className={`message-kind kind-${requirement.kind}`}>{kindLabels[requirement.kind]}</span><b>{requirement.label}</b><span>需要 ≥{requirement.requiredScore}</span><span>前向 {requirement.forwardMax}</span><small>{requirement.sufficient ? "分数充足" : "分数不足"}</small></button>) : <p>没有 Require 分数</p>}</div>
      </div>
    </section>)}{!graph.lanes.length && <div className="score-empty"><strong>当前筛选下没有得分关系</strong><span>选择题得分和 Require 分数会按作用域出现在这里。</span></div>}</div>
  </>;
}

export default function DependencyGraphPanel({ project, onNavigate }: DependencyGraphPanelProps) {
  const model = useMemo(() => buildDependencyGraph(project), [project]);
  const [view, setView] = useState<"flags" | "scores">("flags");
  const flagRiskCount = model.flagGraph.diagnostics.filter((item: any) => item.severity !== "info").length;
  const scoreRiskCount = model.scoreGraph.diagnostics.filter((item: any) => item.severity !== "info").length;
  const activeRiskCount = view === "flags" ? flagRiskCount : scoreRiskCount;
  return <div className="dependency-panel">
    <div className="section-heading"><div><h2>依赖图</h2><p>Flag 关系与得分可达性分开规划；图只读，点击内容返回原编辑器。</p></div><span className={`diagnostic-badge ${activeRiskCount ? "error" : ""}`}>{activeRiskCount ? `${activeRiskCount} 个逻辑风险` : "逻辑关系有效"}</span></div>
    <div className="dependency-view-tabs">
      <button className={view === "flags" ? "active" : ""} onClick={() => setView("flags")}><strong>Flag</strong><span>{model.flagGraph.flags.length} 个 · {flagRiskCount} 风险</span></button>
      <button className={view === "scores" ? "active" : ""} onClick={() => setView("scores")}><strong>得分</strong><span>{model.scoreGraph.lanes.length} 条泳道 · {scoreRiskCount} 风险</span></button>
    </div>
    {view === "flags" ? <FlagGraphView model={model.flagGraph} onNavigate={onNavigate} /> : <ScoreGraphView model={model.scoreGraph} onNavigate={onNavigate} />}
  </div>;
}
