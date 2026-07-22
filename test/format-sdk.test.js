import assert from "node:assert/strict";
import test from "node:test";

import { compileSingleProject } from "../src/compiler.js";
import {
  createStarterProject,
  parseAuthoringProject,
  projectFilesToSource,
  serializeAuthoringProject,
  validateAuthoringProject
} from "../src/format-sdk.js";

test("Format SDK serializes a visual project into a compilable chat-framework project", () => {
  const project = createStarterProject();
  project.conversation.messages.push({
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
  assert.deepEqual(Object.keys(serialized.files).sort(), [
    "chat.yml",
    "conversations/main.md",
    "profiles.yml",
    "project.yml"
  ]);
  assert.match(serialized.files["conversations/main.md"], /\[link-card\]/);
  assert.match(serialized.files["conversations/main.md"], /\[quote:m1\]/);
  assert.match(serialized.files["conversations/main.md"], /\[recall:\+3s\]/);

  const result = compileSingleProject({
    source: projectFilesToSource(serialized.files),
    inputPath: serialized.entryPath
  });
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.html, /<!doctype html>/i);
  assert.equal(result.metadata.conversation.messages[2].linkCard.desc, "A generated card");
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
  project.conversation.messages.push({
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
  assert.equal(imported.conversation.messages[2].kind, "image");
  assert.equal(imported.conversation.messages[2].caption, "Local image");
  assert.match(imported.conversation.messages[2].imageSource, /^asset:/);
  assert.equal(imported.assets.length, 1);
  assert.equal(imported.assets[0].dataUrl, "data:image/png;base64,AQID");
});

test("Format SDK validation maps errors to visual entities and fields", () => {
  const project = createStarterProject();
  project.conversation.messages[0].timeRaw = "+1m";
  project.conversation.messages[1].senderId = "missing";
  project.conversation.messages[1].quoteId = "future";

  const diagnostics = validateAuthoringProject(project);
  assert.equal(diagnostics.some((item) => item.code === "FIRST_TIME_ABSOLUTE" && item.entityId === "m1"), true);
  assert.equal(diagnostics.some((item) => item.code === "UNKNOWN_SENDER" && item.field === "senderId"), true);
  assert.equal(diagnostics.some((item) => item.code === "INVALID_QUOTE" && item.field === "quoteId"), true);
});
