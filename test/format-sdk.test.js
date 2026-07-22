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
  assert.equal(project.documents.some((document) => document.type === "settings"), true);
  assert.equal(project.documents.some((document) => document.type === "timeline"), true);
  assert.equal(project.participants.some((participant) => participant.identityTimeline.length > 1), true);
  assert.equal(project.story.enabled, true);

  const serialized = serializeAuthoringProject(project, { assetMode: "inline" });
  assert.deepEqual(serialized.diagnostics, []);
  assert.match(serialized.files["conversations/main.md"], /\[image\]/);
  assert.match(serialized.files["conversations/main.md"], /\[link-card\]/);
  assert.match(serialized.files["conversations/main.md"], /\[status\]/);
  assert.match(serialized.files["conversations/main.md"], /\[choice\]/);
  assert.match(serialized.files["conversations/main.md"], /\[require-flag:demo-continued\].*\[require-flag:demo-second-check\]/);
  assert.match(serialized.files["conversations/main.md"], /\[quote:welcome\]/);
  assert.match(serialized.files["conversations/main.md"], /\[recall:\+3s\]/);
  assert.match(serialized.files["ui.yml"], /carrier: 中国移动/);
  assert.match(serialized.files["profiles.yml"], /identityTimeline:/);
  assert.match(serialized.files["story.yml"], /accountOrder:/);
  assert.equal(Object.hasOwn(serialized.files, "documents/world-guide.yml"), true);

  const result = compileFolderProject({
    source: projectFilesToSource(serialized.files),
    inputDir: serialized.entryPath,
    title: project.title
  });
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.metadata.conversationCount, project.conversations.length);
  assert.equal(result.metadata.conversations[0].profiles.users.friend.moments["moment-demo"].text.includes("Social Editor"), true);
  assert.equal(result.metadata.conversations[0].articles["article-demo"].title, project.articles[0].title);
  assert.match(result.html, /moments-view/);
  assert.match(result.html, /contacts-view/);

  const documentResult = compileDocumentProject({
    source: projectFilesToSource(serialized.files),
    inputPath: "documents/story-timeline.yml",
    outputPath: "documents/story-timeline.html"
  });
  assert.deepEqual(documentResult.diagnostics, []);
  assert.equal(documentResult.metadata.documentType, "timeline");
});

test("Format SDK serializes a visual project into a compilable chat-framework project", () => {
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

test("Format SDK round-trips complete Phase 6 content and runtime configuration", () => {
  const project = createStudioDemoProject();
  const serialized = serializeAuthoringProject(project, { assetMode: "files" });
  const imported = parseAuthoringProject(projectFilesToSource(serialized.files));

  assert.equal(imported.schemaVersion, "3.0");
  assert.equal(imported.statusBarCarrier, "中国移动");
  assert.deepEqual(imported.conversations.map((conversation) => conversation.id), ["main", "team"]);
  assert.equal(imported.conversations[1].requireScore, 2);
  assert.deepEqual(imported.conversations[1].requireFlags, ["demo-continued"]);
  assert.equal(imported.socialPosts[0].authorId, "friend");
  assert.equal(imported.socialPosts[0].text, project.socialPosts[0].text);
  assert.equal(imported.socialPosts[0].requireScore, 0);
  assert.equal(imported.articles[0].authorId, "editor");
  assert.equal(imported.articles[0].body, project.articles[0].body);
  assert.equal(imported.articles[0].requireScope, "global");
  assert.deepEqual(imported.articles[0].requireFlags, ["global-route"]);
  assert.match(imported.articles[0].cover, /^asset:/);
  assert.equal(imported.participants[1].identityTimeline.length, 2);
  assert.deepEqual(imported.conversations[0].messages.find((message) => message.kind === "choice").choice.options[0].flags, ["demo-continued", "true-end-demo"]);
  assert.deepEqual(imported.conversations[0].messages.find((message) => message.id === "status").requireFlags, ["demo-continued", "demo-second-check"]);
  assert.deepEqual(imported.documents.map((document) => document.type), ["settings", "timeline"]);
  assert.deepEqual(imported.documents[1].items[0].participantIds, ["me", "friend", "editor"]);
  assert.deepEqual(imported.story.accountOrder, ["me", "friend", "editor"]);
  assert.equal(imported.story.resetAccount, "me");
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
