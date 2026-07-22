import assert from "node:assert/strict";
import test from "node:test";

import { buildDependencyGraph, filterFlagDependencyGraph, filterScoreDependencyGraph } from "../src/dependency-graph.js";
import { createStarterProject, createStudioDemoProject } from "../src/format-sdk.js";

function choice(id, { score = 0, flags = [], scope = "account", requireScore, requireFlags = [] } = {}) {
  return {
    id, senderId: "friend", timeRaw: "+1m", kind: "choice", text: "", quoteId: "", recallDelaySec: 0,
    ...(requireScore !== undefined ? { requireScore, requireScope: scope } : {}),
    ...(requireFlags.length ? { requireFlags } : {}),
    choice: { prompt: `选择题 ${id} 的完整标题`, speakerId: "me", scope, options: [
      { id: "yes", label: "Yes", text: "Yes", score, flags },
      { id: "no", label: "No", text: "No", score: score < 0 ? score : 0, flags: [] }
    ] }
  };
}

function text(id, requireScore, scope = "account", requireFlags = []) {
  return { id, senderId: "friend", timeRaw: "+1m", kind: "text", text: `需要解锁的长内容 ${id}`, quoteId: "", recallDelaySec: 0, requireScore, requireScope: scope, requireFlags };
}

test("dependency model separates compact Flag graph and score lanes", () => {
  const model = buildDependencyGraph(createStudioDemoProject());

  assert.equal(model.flagGraph.flags.some((item) => item.name === "demo-continued"), true);
  assert.equal(model.flagGraph.edges.some((item) => item.kind === "produce"), true);
  assert.equal(model.flagGraph.edges.some((item) => item.kind === "unlock"), true);
  assert.equal(model.flagGraph.contents.every((item) => Array.from(item.label).length <= 10), true);
  assert.equal(model.flagGraph.cycles.length > 0, true);
  assert.equal(model.scoreGraph.lanes.some((item) => item.id === "score:account:me"), true);
  assert.equal(model.scoreGraph.lanes.some((item) => item.id === "score:global"), true);
  assert.equal(Object.hasOwn(model, "conditions"), false);
});

test("Flag production edges merge duplicate option grants and runtime endings remain consumers", () => {
  const project = createStarterProject();
  const message = choice("ending", { flags: ["bad-end-demo"] });
  message.choice.options[1].flags = ["bad-end-demo"];
  project.conversations[0].messages.push(message);
  const graph = buildDependencyGraph(project).flagGraph;
  const production = graph.edges.filter((item) => item.kind === "produce" && item.to === "flag:bad-end-demo");

  assert.equal(production.length, 1);
  assert.equal(graph.contents.some((item) => item.kind === "runtime" && item.fullLabel === "坏结局 Runtime"), true);
  assert.equal(graph.edges.some((item) => item.from === "flag:bad-end-demo" && item.to.includes("content:runtime")), true);
});

test("Flag graph detects self and cross-content cycles with SCC", () => {
  const selfProject = createStarterProject();
  selfProject.conversations[0].messages.push(choice("self", { flags: ["self-made"], requireFlags: ["self-made"] }));
  const selfGraph = buildDependencyGraph(selfProject).flagGraph;
  assert.equal(selfGraph.cycles.length, 1);
  assert.equal(selfGraph.diagnostics.some((item) => item.code === "FLAG_DEPENDENCY_CYCLE"), true);
  assert.equal(selfGraph.edges.filter((item) => item.cyclic).length, 2);

  const crossProject = createStarterProject();
  crossProject.conversations[0].messages.push(
    choice("a", { flags: ["flag-a"], requireFlags: ["flag-b"] }),
    choice("b", { flags: ["flag-b"], requireFlags: ["flag-a"] })
  );
  const crossGraph = buildDependencyGraph(crossProject).flagGraph;
  assert.equal(crossGraph.cycles.some((item) => item.nodeIds.length === 4), true);
});

test("Flag diagnostics report missing and unused flags", () => {
  const project = createStarterProject();
  project.conversations[0].messages.push(
    choice("producer", { flags: ["unused"] }),
    { id: "consumer", senderId: "friend", timeRaw: "+1m", kind: "text", text: "Consumer", quoteId: "", recallDelaySec: 0, requireFlags: ["missing"] }
  );
  const codes = new Set(buildDependencyGraph(project).flagGraph.diagnostics.map((item) => item.code));
  assert.equal(codes.has("FLAG_WITHOUT_PRODUCER"), true);
  assert.equal(codes.has("FLAG_WITHOUT_CONSUMER"), true);
});

test("score fixed point unlocks chained sources and records each Require independently", () => {
  const project = createStarterProject();
  project.conversations[0].messages.push(
    choice("first", { score: 2 }),
    choice("second", { score: 3, requireScore: 2 }),
    text("target-a", 5),
    text("target-b", 5)
  );
  const lane = buildDependencyGraph(project).scoreGraph.lanes.find((item) => item.id === "score:account:me");

  assert.equal(lane.reachableMax, 5);
  assert.equal(lane.sources.every((item) => item.reachable), true);
  assert.equal(lane.requirements.filter((item) => item.requiredScore === 5).length, 2);
  assert.equal(lane.requirements.filter((item) => item.requiredScore === 5).every((item) => item.forwardMax === 5 && item.sufficient), true);
});

test("score sources locked by themselves or missing Flags do not count forward", () => {
  const selfProject = createStarterProject();
  selfProject.conversations[0].messages.push(choice("self-score", { score: 4, requireScore: 4 }));
  const selfModel = buildDependencyGraph(selfProject);
  const selfLane = selfModel.scoreGraph.lanes.find((item) => item.id === "score:account:me");
  assert.equal(selfLane.sources[0].reachable, false);
  assert.equal(selfLane.requirements[0].forwardMax, 0);
  assert.equal(selfModel.scoreGraph.diagnostics.some((item) => item.code === "UNREACHABLE_FORWARD_SCORE"), true);

  const flagProject = createStarterProject();
  flagProject.conversations[0].messages.push(choice("flag-locked", { score: 5, requireFlags: ["missing"] }), text("target", 1));
  const flagLane = buildDependencyGraph(flagProject).scoreGraph.lanes.find((item) => item.id === "score:account:me");
  assert.equal(flagLane.reachableMax, 0);
  assert.equal(flagLane.requirements.find((item) => item.entityId === "target").sufficient, false);
});

test("score lanes keep account and global sources separate and ignore negative maxima", () => {
  const project = createStarterProject();
  project.conversations[0].messages.push(
    choice("account", { score: 3 }),
    choice("global", { score: 5, scope: "global" }),
    choice("negative", { score: -4 }),
    text("account-target", 4),
    text("global-target", 5, "global")
  );
  const model = buildDependencyGraph(project);
  const account = model.scoreGraph.lanes.find((item) => item.id === "score:account:me");
  const global = model.scoreGraph.lanes.find((item) => item.id === "score:global");

  assert.equal(account.reachableMax, 3);
  assert.equal(global.reachableMax, 5);
  assert.equal(account.sources.find((item) => item.messageId === "negative").maxScore, 0);
  assert.equal(account.requirements.find((item) => item.entityId === "account-target").sufficient, false);
  assert.equal(global.requirements.find((item) => item.entityId === "global-target").sufficient, true);
});

test("Flag and score filters operate independently", () => {
  const model = buildDependencyGraph(createStudioDemoProject());
  const flags = filterFlagDependencyGraph(model.flagGraph, { kind: "message", flagQuery: "second-check" });
  const scores = filterScoreDependencyGraph(model.scoreGraph, { lane: "score:account:me", kind: "conversation" });

  assert.equal(flags.flags.map((item) => item.name).includes("demo-second-check"), true);
  assert.equal(flags.contents.every((item) => item.kind === "message"), true);
  assert.equal(scores.lanes.length, 1);
  assert.equal(scores.lanes[0].requirements.every((item) => item.kind === "conversation"), true);
  assert.equal(filterFlagDependencyGraph(model.flagGraph, { riskOnly: true }).diagnostics.length > 0, true);
});
