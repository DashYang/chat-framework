function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function requirementOf(item, accountId = "") {
  const hasScore = item?.requireScore !== undefined && item?.requireScore !== null && item?.requireScore !== "";
  const flags = unique((item?.requireFlags || []).map((flag) => String(flag).trim())).sort();
  if (!hasScore && !flags.length) return null;
  const scoreScope = hasScore ? (item.requireScope === "global" ? "global" : "account") : "";
  return { score: hasScore ? Number(item.requireScore) : undefined, scoreScope, accountId: scoreScope === "account" ? accountId : "", flags };
}

function shortLabel(value, limit = 10) {
  const chars = Array.from(String(value || "").replace(/\s+/g, " ").trim());
  return chars.length <= limit ? chars.join("") : `${chars.slice(0, limit - 1).join("")}…`;
}

function fullContentLabel(kind, entity) {
  if (kind === "conversation") return entity.title || entity.id;
  if (kind === "message") return entity.text || entity.choice?.prompt || entity.caption || entity.linkCard?.title || entity.kind || entity.id;
  if (kind === "social") return entity.text || `${entity.images?.length || 0} 张图片`;
  if (kind === "article") return entity.title || entity.id;
  return entity.label || entity.id;
}

function targetFor(kind, entity, context = {}) {
  if (kind === "conversation") return { panel: "conversations", conversationId: entity.id, entityId: entity.id };
  if (kind === "message") return { panel: "conversations", conversationId: context.conversationId, entityId: entity.id };
  if (kind === "social") return { panel: "social", entityId: entity.id };
  if (kind === "article") return { panel: "articles", entityId: entity.id };
  return { panel: "story", entityId: "story" };
}

function contentNodeId(kind, entityId, parentId = "") {
  return `content:${kind}:${parentId || "root"}:${entityId}`;
}

function scoreLaneId(scope, accountId = "") {
  return scope === "global" ? "score:global" : `score:account:${accountId}`;
}

function diagnostic(severity, code, message, nodeIds, target) {
  return { id: `risk:${code}:${nodeIds.join(":")}`, severity, code, message, nodeIds: unique(nodeIds), target };
}

function stronglyConnectedComponents(nodeIds, edges) {
  const adjacency = new Map(nodeIds.map((id) => [id, []]));
  for (const edge of edges) if (adjacency.has(edge.from) && adjacency.has(edge.to)) adjacency.get(edge.from).push(edge.to);
  let cursor = 0;
  const indices = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];
  const visit = (id) => {
    indices.set(id, cursor);
    low.set(id, cursor);
    cursor += 1;
    stack.push(id);
    onStack.add(id);
    for (const next of adjacency.get(id) || []) {
      if (!indices.has(next)) {
        visit(next);
        low.set(id, Math.min(low.get(id), low.get(next)));
      } else if (onStack.has(next)) low.set(id, Math.min(low.get(id), indices.get(next)));
    }
    if (low.get(id) !== indices.get(id)) return;
    const component = [];
    while (stack.length) {
      const member = stack.pop();
      onStack.delete(member);
      component.push(member);
      if (member === id) break;
    }
    components.push(component.sort());
  };
  for (const id of nodeIds) if (!indices.has(id)) visit(id);
  return components;
}

function addFlagLayout(flagGraph) {
  const nodeIds = [...flagGraph.flags.map((item) => item.id), ...flagGraph.contents.map((item) => item.id)];
  const components = stronglyConnectedComponents(nodeIds, flagGraph.edges);
  const componentByNode = new Map();
  components.forEach((component, index) => component.forEach((id) => componentByNode.set(id, index)));
  const selfLoops = new Set(flagGraph.edges.filter((edge) => edge.from === edge.to).map((edge) => edge.from));
  const cycles = components.filter((component) => component.length > 1 || component.some((id) => selfLoops.has(id))).map((nodeIds, index) => ({ id: `flag-cycle:${index + 1}`, nodeIds }));
  const cycleNodeIds = new Set(cycles.flatMap((item) => item.nodeIds));
  const componentEdges = new Set();
  const incoming = new Map(components.map((_, index) => [index, []]));
  for (const edge of flagGraph.edges) {
    const from = componentByNode.get(edge.from);
    const to = componentByNode.get(edge.to);
    if (from === to || componentEdges.has(`${from}:${to}`)) continue;
    componentEdges.add(`${from}:${to}`);
    incoming.get(to).push(from);
  }
  const layers = new Map();
  const layerOf = (index, visiting = new Set()) => {
    if (layers.has(index)) return layers.get(index);
    if (visiting.has(index)) return 0;
    visiting.add(index);
    const value = Math.max(0, ...(incoming.get(index) || []).map((parent) => layerOf(parent, visiting) + 1));
    visiting.delete(index);
    layers.set(index, value);
    return value;
  };
  components.forEach((_, index) => layerOf(index));
  for (const item of [...flagGraph.flags, ...flagGraph.contents]) {
    item.layer = layers.get(componentByNode.get(item.id)) || 0;
    item.cycleId = cycles.find((cycle) => cycle.nodeIds.includes(item.id))?.id || "";
  }
  for (const edge of flagGraph.edges) edge.cyclic = cycleNodeIds.has(edge.from) && componentByNode.get(edge.from) === componentByNode.get(edge.to);
  flagGraph.cycles = cycles;
  return flagGraph;
}

export function buildDependencyGraph(project) {
  const allContents = [];
  const contentById = new Map();
  const messageContentByKey = new Map();
  const choiceRecords = [];
  const addContent = (kind, entity, context = {}) => {
    const parentId = context.conversationId || "";
    const fullLabel = String(fullContentLabel(kind, entity)).replace(/\s+/g, " ").trim();
    const item = {
      id: contentNodeId(kind, entity.id, parentId), kind, entityId: entity.id, parentId,
      accountId: context.accountId || "", fullLabel, label: shortLabel(fullLabel),
      requirement: requirementOf(entity, context.accountId || ""), target: targetFor(kind, entity, context), projectOrder: allContents.length
    };
    allContents.push(item);
    contentById.set(item.id, item);
    return item;
  };

  for (const conversation of project.conversations || []) {
    const conversationContent = addContent("conversation", conversation, { accountId: conversation.selfId });
    for (const message of conversation.messages || []) {
      const content = addContent("message", message, { conversationId: conversation.id, accountId: conversation.selfId });
      content.parentContentId = conversationContent.id;
      messageContentByKey.set(`${conversation.id}:${message.id}`, content);
      if (message.kind !== "choice" || !message.choice) continue;
      const options = (message.choice.options || []).map((option) => ({
        id: option.id, label: option.label || option.id, score: Number(option.score || 0), flags: unique((option.flags || []).map(String))
      }));
      choiceRecords.push({
        id: `choice:${conversation.id}:${message.id}`, conversationId: conversation.id, messageId: message.id,
        contentId: content.id, content, scope: message.choice.scope === "global" ? "global" : "account",
        accountId: message.choice.scope === "global" ? "" : conversation.selfId, options,
        maxScore: Math.max(0, ...options.map((option) => option.score)),
        flags: unique(options.flatMap((option) => option.flags)).sort(),
        hasScoreEffect: options.some((option) => option.score !== 0)
      });
    }
  }
  for (const post of project.socialPosts || []) addContent("social", post, { accountId: post.authorId });
  for (const article of project.articles || []) addContent("article", article, { accountId: article.authorId });

  const flagMap = new Map();
  const ensureFlag = (name) => {
    if (!flagMap.has(name)) flagMap.set(name, { id: `flag:${name}`, name, producerIds: [], consumerIds: [], layer: 0, cycleId: "" });
    return flagMap.get(name);
  };
  const flagEdges = new Map();
  const addFlagEdge = (from, to, kind) => {
    const key = `${from}|${to}|${kind}`;
    if (!flagEdges.has(key)) flagEdges.set(key, { id: `flag-edge:${key}`, from, to, kind, cyclic: false });
  };
  for (const choice of choiceRecords) {
    for (const name of choice.flags) {
      const flag = ensureFlag(name);
      flag.producerIds.push(choice.contentId);
      addFlagEdge(choice.contentId, flag.id, "produce");
    }
  }
  for (const content of allContents) {
    for (const name of content.requirement?.flags || []) {
      const flag = ensureFlag(name);
      flag.consumerIds.push(content.id);
      addFlagEdge(flag.id, content.id, "unlock");
    }
  }
  for (const flag of Array.from(flagMap.values())) {
    if (!flag.name.startsWith("bad-end") && !flag.name.startsWith("true-end")) continue;
    const ending = flag.name.startsWith("bad-end") ? "bad" : "true";
    const id = contentNodeId("runtime", ending, flag.name);
    const label = ending === "bad" ? "坏结局 Runtime" : "真结局 Runtime";
    const runtime = { id, kind: "runtime", entityId: ending, parentId: flag.name, accountId: "", fullLabel: label, label: shortLabel(label), requirement: { flags: [flag.name] }, target: targetFor("runtime", { id: ending }), projectOrder: allContents.length };
    allContents.push(runtime);
    contentById.set(id, runtime);
    flag.consumerIds.push(id);
    addFlagEdge(flag.id, id, "unlock");
  }
  for (const flag of flagMap.values()) {
    flag.producerIds = unique(flag.producerIds);
    flag.consumerIds = unique(flag.consumerIds);
  }
  const involvedContentIds = new Set(Array.from(flagEdges.values()).flatMap((edge) => [edge.from, edge.to]).filter((id) => id.startsWith("content:")));
  const flagGraph = addFlagLayout({
    flags: Array.from(flagMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    contents: allContents.filter((item) => involvedContentIds.has(item.id)).sort((a, b) => a.projectOrder - b.projectOrder),
    edges: Array.from(flagEdges.values()), cycles: [], diagnostics: []
  });

  for (const flag of flagGraph.flags) {
    if (!flag.producerIds.length) flagGraph.diagnostics.push(diagnostic("error", "FLAG_WITHOUT_PRODUCER", `Flag “${flag.name}” 被依赖，但没有可产生它的内容。`, [flag.id, ...flag.consumerIds], contentById.get(flag.consumerIds[0])?.target));
    if (!flag.consumerIds.length) flagGraph.diagnostics.push(diagnostic("info", "FLAG_WITHOUT_CONSUMER", `Flag “${flag.name}” 会被产生，但没有内容依赖它。`, [flag.id, ...flag.producerIds], contentById.get(flag.producerIds[0])?.target));
  }
  for (const cycle of flagGraph.cycles) {
    const labels = cycle.nodeIds.map((id) => id.startsWith("flag:") ? id.slice(5) : contentById.get(id)?.label).filter(Boolean);
    const target = cycle.nodeIds.map((id) => contentById.get(id)?.target).find(Boolean);
    flagGraph.diagnostics.push(diagnostic("warning", "FLAG_DEPENDENCY_CYCLE", `Flag 依赖成环：${labels.join(" → ")}`, cycle.nodeIds, target));
  }

  const reachableContentIds = new Set();
  const activeChoiceIds = new Set();
  const reachableFlags = new Set();
  const laneScores = new Map();
  const firstReachScore = new Map();
  const scoreOf = (laneId) => laneScores.get(laneId) || 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const content of allContents.filter((item) => item.kind !== "runtime")) {
      if (reachableContentIds.has(content.id)) continue;
      if (content.parentContentId && !reachableContentIds.has(content.parentContentId)) continue;
      const req = content.requirement;
      if (req?.flags.some((flag) => !reachableFlags.has(flag))) continue;
      if (req?.score !== undefined) {
        const laneId = scoreLaneId(req.scoreScope, req.accountId);
        if (scoreOf(laneId) < req.score) continue;
        firstReachScore.set(content.id, scoreOf(laneId));
      }
      reachableContentIds.add(content.id);
      changed = true;
    }
    for (const choice of choiceRecords) {
      if (activeChoiceIds.has(choice.id) || !reachableContentIds.has(choice.contentId)) continue;
      activeChoiceIds.add(choice.id);
      for (const flag of choice.flags) reachableFlags.add(flag);
      if (choice.maxScore > 0) {
        const laneId = scoreLaneId(choice.scope, choice.accountId);
        laneScores.set(laneId, scoreOf(laneId) + choice.maxScore);
      }
      changed = true;
    }
  }

  const laneMap = new Map();
  const ensureLane = (scope, accountId = "") => {
    const id = scoreLaneId(scope, accountId);
    if (!laneMap.has(id)) laneMap.set(id, { id, scope, accountId: scope === "account" ? accountId : "", label: scope === "global" ? "全局" : `账号：${accountId}`, sources: [], requirements: [], reachableMax: scoreOf(id) });
    return laneMap.get(id);
  };
  for (const choice of choiceRecords.filter((item) => item.hasScoreEffect)) {
    const lane = ensureLane(choice.scope, choice.accountId);
    lane.sources.push({
      id: `score-source:${choice.conversationId}:${choice.messageId}`, contentId: choice.contentId,
      conversationId: choice.conversationId, messageId: choice.messageId, label: choice.content.label,
      fullLabel: choice.content.fullLabel, maxScore: choice.maxScore, reachable: activeChoiceIds.has(choice.id), target: choice.content.target
    });
  }
  const scoreDiagnostics = [];
  for (const content of allContents.filter((item) => item.kind !== "runtime" && item.requirement?.score !== undefined)) {
    const req = content.requirement;
    const lane = ensureLane(req.scoreScope, req.accountId);
    const id = `score-require:${content.kind}:${content.parentId || "root"}:${content.entityId}`;
    const forwardMax = firstReachScore.has(content.id) ? firstReachScore.get(content.id) : scoreOf(lane.id);
    const requirement = {
      id, contentId: content.id, kind: content.kind, entityId: content.entityId, parentId: content.parentId,
      label: content.label, fullLabel: content.fullLabel, requiredScore: req.score, forwardMax,
      reachable: reachableContentIds.has(content.id), sufficient: forwardMax >= req.score, target: content.target
    };
    lane.requirements.push(requirement);
    if (req.score <= 0) scoreDiagnostics.push(diagnostic("info", "ALWAYS_TRUE_SCORE", `${lane.label}得分 ≥ ${req.score} 是恒真或冗余条件。`, [id], content.target));
    if (forwardMax < req.score) scoreDiagnostics.push(diagnostic("error", "UNREACHABLE_FORWARD_SCORE", `${lane.label}中的“${content.label}”需要 ${req.score} 分，前向最多 ${forwardMax} 分。`, [id, content.id], content.target));
    if (forwardMax < req.score && forwardMax === 0 && Array.from(laneMap.values()).some((other) => other.id !== lane.id && other.reachableMax > 0)) {
      scoreDiagnostics.push(diagnostic("warning", "SCORE_SCOPE_MISMATCH", `${lane.label}没有可达得分，但其他泳道存在得分来源。`, [id], content.target));
    }
  }
  const accountNames = new Map((project.participants || []).map((person) => [person.id, person.name]));
  const lanes = Array.from(laneMap.values()).map((lane) => ({
    ...lane,
    label: lane.scope === "global" ? "全局" : `账号：${accountNames.get(lane.accountId) || lane.accountId}`,
    sources: lane.sources.sort((a, b) => (contentById.get(a.contentId)?.projectOrder || 0) - (contentById.get(b.contentId)?.projectOrder || 0)),
    requirements: lane.requirements.sort((a, b) => (contentById.get(a.contentId)?.projectOrder || 0) - (contentById.get(b.contentId)?.projectOrder || 0))
  })).sort((a, b) => a.scope === b.scope ? a.label.localeCompare(b.label, "zh-CN") : a.scope === "global" ? -1 : 1);

  const scoreGraph = { lanes, diagnostics: scoreDiagnostics, reachableFlags: Array.from(reachableFlags).sort() };
  return { flagGraph, scoreGraph, diagnostics: [...flagGraph.diagnostics, ...scoreGraph.diagnostics] };
}

export function filterFlagDependencyGraph(graph, filters = {}) {
  const kind = filters.kind || "all";
  const query = String(filters.flagQuery || "").trim().toLowerCase();
  const riskOnly = Boolean(filters.riskOnly);
  const riskIds = new Set(graph.diagnostics.flatMap((item) => item.nodeIds));
  let contents = graph.contents.filter((item) => kind === "all" || item.kind === kind);
  let flags = graph.flags.filter((item) => !query || item.name.toLowerCase().includes(query));
  if (riskOnly) {
    contents = contents.filter((item) => riskIds.has(item.id));
    flags = flags.filter((item) => riskIds.has(item.id));
  }
  const contentIds = new Set(contents.map((item) => item.id));
  const flagIds = new Set(flags.map((item) => item.id));
  let edges = graph.edges.filter((edge) => (contentIds.has(edge.from) && flagIds.has(edge.to)) || (flagIds.has(edge.from) && contentIds.has(edge.to)));
  const connectedIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  if (kind !== "all" || query || riskOnly) {
    contents = contents.filter((item) => connectedIds.has(item.id) || riskIds.has(item.id));
    flags = flags.filter((item) => connectedIds.has(item.id) || riskIds.has(item.id));
  }
  const visibleIds = new Set([...contents.map((item) => item.id), ...flags.map((item) => item.id)]);
  edges = edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));
  return {
    ...graph, contents, flags, edges,
    cycles: graph.cycles.filter((cycle) => cycle.nodeIds.some((id) => visibleIds.has(id))),
    diagnostics: graph.diagnostics.filter((item) => item.nodeIds.some((id) => visibleIds.has(id)))
  };
}

export function filterScoreDependencyGraph(graph, filters = {}) {
  const laneFilter = filters.lane || "all";
  const kind = filters.kind || "all";
  const riskOnly = Boolean(filters.riskOnly);
  const riskIds = new Set(graph.diagnostics.flatMap((item) => item.nodeIds));
  const lanes = graph.lanes.filter((lane) => laneFilter === "all" || lane.id === laneFilter).map((lane) => ({
    ...lane,
    requirements: lane.requirements.filter((item) => (kind === "all" || item.kind === kind) && (!riskOnly || riskIds.has(item.id))),
    sources: lane.sources.filter((item) => !riskOnly || !item.reachable || riskIds.has(item.id))
  })).filter((lane) => lane.sources.length || lane.requirements.length);
  const visibleIds = new Set(lanes.flatMap((lane) => [...lane.sources.map((item) => item.id), ...lane.requirements.map((item) => item.id)]));
  return { ...graph, lanes, diagnostics: graph.diagnostics.filter((item) => item.nodeIds.some((id) => visibleIds.has(id))) };
}
