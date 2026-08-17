import assert from "node:assert/strict";
import test from "node:test";

import { compileDocumentProject, compileFolderProject } from "../src/compiler.js";
import {
  createStarterProject,
  createStudioDemoProject,
  normalizeAuthoringProject,
  parseAuthoringProject,
  projectFilesToSource,
  serializeAuthoringProject,
  validateAuthoringProject
} from "../src/format-sdk.js";

test("Studio v2 single-conversation drafts migrate to the Phase 4 model", () => {
  const migrated = normalizeAuthoringProject({
    schemaVersion: "2.0",
    id: "legacy",
    title: "Legacy",
    theme: "wechat",
    selfId: "me",
    participants: [{ id: "me", name: "我" }, { id: "friend", name: "朋友" }],
    conversation: { id: "main", title: "朋友", type: "single", messages: [] },
    assets: []
  });

  assert.equal(migrated.schemaVersion, "3.0");
  assert.equal(migrated.conversations[0].selfId, "me");
  assert.deepEqual(migrated.socialPosts, []);
  assert.deepEqual(migrated.articles, []);
  assert.deepEqual(migrated.documents, []);
  assert.equal(migrated.story.enabled, false);
  assert.deepEqual(migrated.participants[0].identityTimeline, []);
  assert.equal(Object.hasOwn(migrated, "conversation"), false);
});

test("Studio built-in demo covers every visual authoring capability", () => {
  const project = createStudioDemoProject();
  const messages = project.conversations.flatMap((conversation) => conversation.messages);

  assert.deepEqual(new Set(messages.map((message) => message.kind)), new Set(["text", "image", "link-card", "status", "choice"]));
  assert.equal(messages.some((message) => message.senderId === project.selfId), true);
  assert.equal(messages.some((message) => message.senderId !== project.selfId), true);
  assert.equal(messages.some((message) => message.quoteId), true);
  assert.equal(messages.some((message) => message.recallDelaySec > 0), true);
  assert.equal(project.participants.every((participant) => participant.avatar && participant.bio), true);
  assert.equal(project.assets.length > 0, true);
  assert.equal(project.conversations.length > 1, true);
  assert.equal(project.socialPosts.length > 0, true);
  assert.equal(project.articles.length > 0, true);
  assert.equal(project.articles.some((article) => article.requireScore && article.requireFlags?.includes("case-open")), true);
  assert.equal(project.conversations.some((conversation) => conversation.requireScore && conversation.requireFlags?.includes("case-open")), true);
  assert.equal(project.documents.some((document) => document.type === "settings"), true);
  assert.equal(project.documents.some((document) => document.type === "timeline"), true);
  assert.equal(project.participants.some((participant) => participant.identityTimeline.length > 1), true);
  assert.equal(project.story.enabled, true);
  assert.deepEqual(project.story.accountOrder, ["waiter", "survivor", "solver"]);
  assert.equal(project.story.accountOrder.every((id) => project.conversations.some((conversation) => conversation.selfId === id)), true);
  assert.equal(project.conversations.every((conversation) => project.story.accountOrder.includes(conversation.selfId)), true);
  assert.equal(project.socialPosts.every((post) => project.story.accountOrder.includes(post.authorId)), true);
  assert.equal(project.articles.every((article) => project.story.accountOrder.includes(article.authorId)), true);
  const answer = project.conversations.find((conversation) => conversation.id === "answer");
  assert.equal(answer.messages.length, 1);
  assert.equal(answer.messages[0].kind, "choice");
  assert.equal(answer.messages[0].choice.prompt, "男人喝到真正的海龟汤后，为什么会死亡？");
  assert.deepEqual(answer.messages[0].choice.options.map((option) => option.flags), [
    ["true-end-soup"],
    ["bad-end-soup"],
    ["bad-end-soup"]
  ]);
  assert.equal(project.bgmMode, "audio");
  assert.match(project.bgmSource, /^asset:/);
  assert.equal(project.assets.some((asset) => asset.fileName === "noise_bgm.wav" && asset.mimeType === "audio/wav"), true);
  assert.equal(project.assets.some((asset) => asset.mimeType === "image/svg+xml"), true);

  const serialized = serializeAuthoringProject(project, { assetMode: "inline" });
  assert.deepEqual(serialized.diagnostics, []);
  assert.match(serialized.files["ui.yml"], /data:audio\/wav;base64,/);
  assert.match(serialized.files["conversations/incident.md"], /\[image\]/);
  assert.match(serialized.files["conversations/evidence.md"], /\[link-card\]/);
  assert.match(serialized.files["conversations/incident.md"], /\[status\]/);
  assert.match(serialized.files["conversations/answer.md"], /\[choice\]/);
  assert.match(serialized.files["conversations/incident.md"], /\[require-flag:case-open\]/);
  assert.match(serialized.files["conversations/incident.md"], /\[quote:case-open\]/);
  assert.match(serialized.files["conversations/memory.md"], /\[recall:\+3s\]/);
  assert.match(serialized.files["ui.yml"], /carrier: 中国移动/);
  assert.match(serialized.files["ui.yml"], /bgm:\s+type: audio\s+src: >-\s+data:audio\/wav;base64,/);
  assert.match(serialized.files["profiles.yml"], /identityTimeline:/);
  assert.match(serialized.files["story.yml"], /resetAccount: solver/);
  assert.match(serialized.files["story.yml"], /accountOrder:/);
  assert.equal(Object.hasOwn(serialized.files, "documents/case-settings.yml"), true);

  const result = compileFolderProject({
    source: projectFilesToSource(serialized.files),
    inputDir: serialized.entryPath,
    title: project.title
  });
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.metadata.conversationCount, project.conversations.length);
  assert.equal(result.metadata.report.accountIds.every((id) => result.metadata.report.accounts.some((account) => account.id === id)), true);
  assert.equal(result.metadata.conversations[0].profiles.users.waiter.moments["closing-notice"].text.includes("暂停营业"), true);
  assert.equal(result.metadata.conversations[0].articles["rescue-clipping"].title, project.articles[0].title);
  assert.match(result.metadata.conversations[0].profiles.users.waiter.avatar, /^data:image\/svg\+xml;base64,/);
  assert.match(result.html, /moments-view/);
  assert.match(result.html, /contacts-view/);
  assert.match(result.html, /"bgm":\{"type":"audio","src":"data:audio\/wav;base64,/);

  const packaged = serializeAuthoringProject(project, { assetMode: "files" });
  const packagedResult = compileFolderProject({
    source: projectFilesToSource(packaged.files),
    inputDir: packaged.entryPath,
    title: project.title
  });
  assert.deepEqual(packagedResult.diagnostics, []);
  assert.equal(packagedResult.metadata.conversations[0].profiles.users.waiter.avatar, "assets/avatar-waiter.svg");
  assert.equal(packagedResult.metadata.conversations[0].messages.find((message) => message.id === "receipt").imageUrl, "assets/restaurant-receipt.svg");
  assert.equal(packagedResult.metadata.conversations[0].articles["rescue-clipping"].cover, "assets/old-newspaper.svg");
  assert.deepEqual(packagedResult.metadata.conversations[0].articles["rescue-clipping"].images, ["assets/island-map.svg"]);

  const documentResult = compileDocumentProject({
    source: projectFilesToSource(serialized.files),
    inputPath: "documents/case-timeline.yml",
    outputPath: "documents/case-timeline.html"
  });
  assert.deepEqual(documentResult.diagnostics, []);
  assert.equal(documentResult.metadata.documentType, "timeline");
});

test("Studio preview targets bypass authoring visibility without leaking into normal exports", () => {
  const project = createStudioDemoProject();
  const serialized = serializeAuthoringProject(project, { assetMode: "inline" });
  const compile = (preview) => compileFolderProject({
    source: projectFilesToSource(serialized.files),
    inputDir: serialized.entryPath,
    title: project.title,
    ...(preview ? { preview } : {})
  });

  const normal = compile();
  assert.doesNotMatch(normal.html, /studioPreview|studio-preview-notice|编辑预览 · 已忽略时间与解锁条件/);

  const messagePreview = compile({ kind: "message", conversationId: "evidence", entityId: "archive-link" });
  assert.deepEqual(messagePreview.diagnostics, []);
  assert.match(messagePreview.html, /"studioPreview":\{"kind":"message","conversationId":"conv-2","entityId":"archive-link"\}/);
  assert.match(messagePreview.html, /编辑预览 · 已忽略时间与解锁条件/);
  assert.match(messagePreview.html, /requirementText\('对话条件', conv\.chat\?\.require\)/);
  assert.match(messagePreview.html, /requirementText\('消息条件', targetMessage\?\.require\)/);

  const articlePreview = compile({ kind: "article", entityId: "rescue-clipping" });
  assert.deepEqual(articlePreview.diagnostics, []);
  assert.match(articlePreview.html, /"studioPreview":\{"kind":"article","conversationId":"","entityId":"rescue-clipping"\}/);
  assert.match(articlePreview.html, /requirementText\('文章条件', item\.require\)/);
  assert.match(articlePreview.html, /localStorage\.removeItem\(persistKey\)/);

  const socialPreview = compile({ kind: "social", entityId: "closing-notice" });
  assert.deepEqual(socialPreview.diagnostics, []);
  assert.match(socialPreview.html, /"studioPreview":\{"kind":"social","conversationId":"","entityId":"closing-notice"\}/);
  assert.match(socialPreview.html, /requirementText\('社交条件', originalRequire\)/);
  assert.match(socialPreview.html, /showMoments\(\)/);
});

test("Format SDK serializes a visual project into a compilable chat-maker project", () => {
  const project = createStarterProject();
  project.conversations[0].messages.push({
    id: "m3",
    senderId: "friend",
    timeRaw: "+2m",
    kind: "link-card",
    linkCard: {
      url: "https://example.com",
      title: "Example",
      desc: "A generated card",
      image: "",
      site: "example.com"
    },
    quoteId: "m1",
    recallDelaySec: 3
  });

  const serialized = serializeAuthoringProject(project, { assetMode: "inline" });
  assert.deepEqual(serialized.diagnostics, []);
  assert.equal(Object.keys(serialized.files).includes("chats/main.yml"), true);
  assert.equal(Object.keys(serialized.files).includes("ui.yml"), true);
  assert.match(serialized.files["conversations/main.md"], /\[link-card\]/);
  assert.match(serialized.files["conversations/main.md"], /\[quote:m1\]/);
  assert.match(serialized.files["conversations/main.md"], /\[recall:\+3s\]/);

  const result = compileFolderProject({
    source: projectFilesToSource(serialized.files),
    inputDir: serialized.entryPath,
    title: project.title
  });
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.html, /<!doctype html>/i);
  assert.equal(result.metadata.conversations[0].messages[2].linkCard.desc, "A generated card");
});

test("Format SDK project packages support semantic round trips with assets", () => {
  const project = createStarterProject();
  project.assets.push({
    id: "asset-photo",
    fileName: "photo.png",
    mimeType: "image/png",
    dataUrl: "data:image/png;base64,AQID"
  });
  project.participants[1].avatar = "asset:asset-photo";
  project.conversations[0].messages.push({
    id: "m3",
    senderId: "friend",
    timeRaw: "+1m",
    kind: "image",
    imageSource: "asset:asset-photo",
    caption: "Local image",
    quoteId: "",
    recallDelaySec: 0
  });

  const serialized = serializeAuthoringProject(project, { assetMode: "files" });
  assert.deepEqual(serialized.diagnostics, []);
  assert.equal(serialized.files["assets/photo.png"] instanceof Uint8Array, true);
  assert.match(serialized.files["profiles.yml"], /\.\/assets\/photo\.png/);
  assert.match(serialized.files["conversations/main.md"], /\.\.\/assets\/photo\.png/);

  const imported = parseAuthoringProject(projectFilesToSource(serialized.files));
  assert.equal(imported.title, project.title);
  assert.equal(imported.participants.length, 2);
  assert.match(imported.participants[1].avatar, /^asset:/);
  assert.equal(imported.conversations[0].messages[2].kind, "image");
  assert.equal(imported.conversations[0].messages[2].caption, "Local image");
  assert.match(imported.conversations[0].messages[2].imageSource, /^asset:/);
  assert.equal(imported.assets.length, 1);
  assert.equal(imported.assets[0].dataUrl, "data:image/png;base64,AQID");
});

test("Format SDK exports percent-encoded SVG data URLs with charset parameters", () => {
  const project = createStarterProject();
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>海龟汤</text></svg>';
  project.assets.push({
    id: "asset-svg",
    fileName: "demo.svg",
    mimeType: "image/svg+xml",
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  });
  project.participants[1].avatar = "asset:asset-svg";

  const serialized = serializeAuthoringProject(project, { assetMode: "files" });
  const bytes = serialized.files["assets/demo.svg"];

  assert.equal(bytes instanceof Uint8Array, true);
  assert.equal(new TextDecoder().decode(bytes), svg);
});

test("Format SDK round-trips complete Phase 6 content and runtime configuration", () => {
  const project = createStudioDemoProject();
  const serialized = serializeAuthoringProject(project, { assetMode: "files" });
  const imported = parseAuthoringProject(projectFilesToSource(serialized.files));

  assert.equal(imported.schemaVersion, "3.0");
  assert.equal(imported.statusBarCarrier, "中国移动");
  assert.equal(imported.bgmMode, "audio");
  assert.match(imported.bgmSource, /^asset:/);
  assert.equal(imported.assets.some((asset) => asset.fileName === "noise_bgm.wav" && asset.mimeType === "audio/wav"), true);
  assert.equal(imported.assets.some((asset) => asset.mimeType === "image/svg+xml"), true);
  assert.deepEqual(imported.conversations.map((conversation) => conversation.id), ["incident", "evidence", "memory", "answer"]);
  assert.equal(imported.conversations[1].requireScore, 1);
  assert.equal(imported.conversations[1].requireScope, "global");
  assert.deepEqual(imported.conversations[1].requireFlags, ["case-open"]);
  assert.equal(imported.socialPosts[0].authorId, "waiter");
  assert.equal(imported.socialPosts[0].text, project.socialPosts[0].text);
  assert.equal(imported.socialPosts[0].requireScore, 1);
  assert.deepEqual(imported.socialPosts[0].requireFlags, ["case-open"]);
  assert.equal(imported.articles[0].authorId, "waiter");
  assert.equal(imported.articles[0].body, project.articles[0].body);
  assert.equal(imported.articles[0].requireScope, "global");
  assert.deepEqual(imported.articles[0].requireFlags, ["case-open"]);
  assert.match(imported.articles[0].cover, /^asset:/);
  assert.equal(imported.participants[1].identityTimeline.length, 2);
  assert.deepEqual(imported.conversations[0].messages.find((message) => message.kind === "choice").choice.options[0].flags, ["case-open"]);
  assert.deepEqual(imported.conversations[0].messages.find((message) => message.id === "case-status").requireFlags, ["case-open"]);
  assert.deepEqual(imported.conversations[3].messages[0].choice.options[0].flags, ["true-end-soup"]);
  assert.deepEqual(imported.documents.map((document) => document.type), ["settings", "timeline"]);
  assert.deepEqual(imported.documents[1].items[0].participantIds, ["survivor"]);
  assert.deepEqual(imported.story.accountOrder, ["waiter", "survivor", "solver"]);
  assert.equal(imported.story.resetAccount, "solver");
  assert.equal(imported.story.resetLabel, "重新调查");
  assert.equal(imported.story.resetConfirmText, "将重置最终答题进度；已经解锁的案件线索不会丢失。");
});

test("Format SDK validation maps errors to visual entities and fields", () => {
  const project = createStarterProject();
  project.conversations[0].messages[0].timeRaw = "+1m";
  project.conversations[0].messages[1].senderId = "missing";
  project.conversations[0].messages[1].quoteId = "future";

  const diagnostics = validateAuthoringProject(project);
  assert.equal(diagnostics.some((item) => item.code === "FIRST_TIME_ABSOLUTE" && item.entityId === "m1"), true);
  assert.equal(diagnostics.some((item) => item.code === "UNKNOWN_SENDER" && item.field === "senderId"), true);
  assert.equal(diagnostics.some((item) => item.code === "INVALID_QUOTE" && item.field === "quoteId"), true);
});

test("Format SDK validates custom BGM sources", () => {
  const project = createStarterProject();
  project.bgmMode = "audio";

  assert.equal(validateAuthoringProject(project).some((item) => item.code === "BGM_SOURCE_REQUIRED"), true);

  project.bgmSource = "asset:missing-audio";
  assert.equal(validateAuthoringProject(project).some((item) => item.code === "BGM_ASSET_NOT_FOUND"), true);
});
