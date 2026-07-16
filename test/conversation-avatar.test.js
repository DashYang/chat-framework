import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { renderWechatHubHtml } from "../src/multi-renderer.js";

function runtimeFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing runtime function: ${name}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated runtime function: ${name}`);
}

function listAvatarResolver() {
  const html = renderWechatHubHtml({ conversations: [] });
  const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .find((source) => source.includes("function conversationListAvatar"));
  assert.ok(script, "hub runtime contains conversation list avatar resolver");

  const context = { activeAccountId: "me" };
  const source = [
    runtimeFunction(script, "parseIdentityReference"),
    runtimeFunction(script, "resolveEffectiveProfile"),
    runtimeFunction(script, "getPeerId"),
    runtimeFunction(script, "conversationListAvatar")
  ].join("\n");
  vm.runInNewContext(source, context);
  return context.conversationListAvatar;
}

test("hub list avatar follows a single-chat peer identity timeline at the current stage", () => {
  const resolveAvatar = listAvatarResolver();
  const conversation = {
    self: "me",
    avatar: "build-time.png",
    chat: { type: "single", peer: "mark" },
    messages: [{ senderId: "mark" }],
    profiles: {
      users: {
        mark: {
          identityTimeline: [
            { effectiveAtMs: new Date("2026-01-01T00:00:00").getTime(), avatar: "old.png" },
            { effectiveAtMs: new Date("2026-02-01T00:00:00").getTime(), avatar: "new.png" }
          ]
        }
      }
    }
  };

  assert.equal(resolveAvatar(conversation, "2026-01-15 09:00"), "old.png");
  assert.equal(resolveAvatar(conversation, "2026-02-15 09:00"), "new.png");
});

test("hub list avatar preserves group and static-avatar fallbacks", () => {
  const resolveAvatar = listAvatarResolver();
  const staticSingle = {
    self: "me",
    avatar: "build-time.png",
    chat: { type: "single", peer: "mark" },
    messages: [{ senderId: "mark" }],
    profiles: { users: { mark: { avatar: "static.png" } } }
  };
  const group = {
    avatar: "build-time-group.png",
    chat: { type: "group", avatar: "chat-group.png", groupInfo: { avatar: "group.png" } },
    profiles: { users: {} }
  };

  assert.equal(resolveAvatar(staticSingle, "2026-02-15 09:00"), "static.png");
  assert.equal(resolveAvatar(group, "2026-02-15 09:00"), "group.png");
});
