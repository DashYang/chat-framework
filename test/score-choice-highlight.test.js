import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { highlightEffectRuntimeSource } from "../src/highlight-effect.js";
import { loadConversationFromMarkdown } from "../src/load-conversation.js";
import { parseChatMarkdown } from "../src/parser.js";
import { renderHtml } from "../src/renderer.js";
import { renderWechatHubHtml } from "../src/multi-renderer.js";

test("single-page renderer displays choice prompt and options", () => {
  const parsed = parseChatMarkdown(`@system #c1 [2026-01-01 10:00] [choice]
prompt: Pick one
options:
  a:
    label: Alpha
  b:
    label: Beta`);
  const html = renderHtml({
    frontmatter: {},
    profiles: { users: { system: { name: "System" } } },
    chat: { self: "system", type: "single" },
    messages: parsed.messages
  });

  assert.match(html, /Pick one/);
  assert.match(html, /Alpha/);
  assert.match(html, /Beta/);
  assert.match(html, /chat-framework:choice/);
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  scripts.forEach((match) => new Function(match[1]));
});

test("choice uses one top-level speaker for all option replies", () => {
  const parsed = parseChatMarkdown(`@system #c1 [2026-01-01 10:00] [choice]
prompt: Pick one
speaker: alice
options:
  a:
    label: Alpha
    text: Alpha reply
  b: Beta`);

  assert.deepEqual(parsed.messages[0].choice.options[0], {
    id: "a", label: "Alpha", text: "Alpha reply", score: 0
  });
  assert.equal(parsed.messages[0].choice.speaker, "alice");
  assert.equal(parsed.messages[0].choice.options[1].text, "Beta");
});

test("selected choices render both the original prompt and the speaker reply", () => {
  const html = renderWechatHubHtml({
    conversations: [{
      id: "c1",
      self: "wo",
      chat: { self: "wo", type: "single" },
      profiles: { users: { QinGuangWang: { name: "秦广王" }, wo: { name: "我" } } },
      messages: [{
        id: "c1",
        senderId: "QinGuangWang",
        kind: "choice",
        choice: {
          prompt: "你有问题吗？",
          speaker: "wo",
          options: [{ id: "no", label: "没有问题", text: "没有问题", score: 0 }]
        }
      }]
    }]
  });

  assert.match(html, /--prompt/);
  assert.match(html, /--reply/);
  assert.match(html, /return renderMessage\(promptMessage, conv, opts\) \+ renderMessage\(replyMessage, conv, opts\)/);
});

test("status messages keep their centered, avatar-free rendering", () => {
  const parsed = parseChatMarkdown(`@alice #s1 [2026-01-01 10:00] [status]
第一行
第二行`);
  const html = renderHtml({
    frontmatter: {},
    profiles: { users: { alice: { name: "Alice", avatar: "alice.png" } } },
    chat: { self: "bob", type: "single" },
    messages: parsed.messages
  });

  assert.match(html, /<div class="end-tip">第一行\n第二行<\/div>/);
  assert.doesNotMatch(html, /data-display-name="Alice"/);
  assert.doesNotMatch(html, /<article class="msg">/);
});

test("highlight runtime queues effects while one is active", () => {
  const source = highlightEffectRuntimeSource();
  assert.match(source, /queue\.push\(value\)/);
  assert.match(source, /const next = queue\.shift\(\)/);
  assert.match(source, /function afterIdle\(callback\)/);
  assert.match(source, /if \(playHighlightEffect\(text, root\)\)/);
});

test("a recalled compact text block splits into independently recalled bubbles", () => {
  const parsed = parseChatMarkdown(`@Mark [2086-01-03 06:00:00] [recall:+12s]
既然杨戬能识别到干扰

也能感到害怕

杨戬的子民

@Mark [highlight] [recall:+3s]
请拯救人类!`);

  assert.equal(parsed.messages.length, 4);
  assert.deepEqual(parsed.messages.slice(0, 3).map((message) => message.text), [
    "既然杨戬能识别到干扰",
    "也能感到害怕",
    "杨戬的子民"
  ]);
  assert.deepEqual(parsed.messages.slice(0, 3).map((message) => message.recall.delayMs), [12000, 12000, 12000]);
  assert.equal(parsed.messages[0].timeRaw, "2086-01-03 06:00:00");
  assert.equal(parsed.messages[1].timeRaw, undefined);
  assert.equal(parsed.messages[3].kind, "highlight");

  const html = renderWechatHubHtml({ conversations: [] });
  assert.match(html, /highlight\.afterIdle\(\(\) => applyRecall\(conversationId, msg, conv\)\)/);
});

test("invalid require scores fail the build instead of unlocking content", () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-framework-require-"));
  const chatPath = path.join(fixtureDir, "chat.yml");
  fs.writeFileSync(chatPath, `chat:
  type: group
  self: alice
  require:
    score: four
`);

  try {
    assert.throws(
      () => loadConversationFromMarkdown(path.resolve("examples/chat.md"), {
        chatPath,
        profilePath: path.resolve("examples/profiles.yml")
      }),
      /Invalid require score: four/
    );
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test("single-chat frontmatter accepts score and flag requirements", () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-framework-frontmatter-require-"));
  const markdownPath = path.join(fixtureDir, "chat.md");
  const profilesPath = path.join(fixtureDir, "profiles.yml");
  fs.writeFileSync(profilesPath, `users:
  alice:
    name: Alice
  bob:
    name: Bob
`);
  fs.writeFileSync(markdownPath, `---
profiles: "./profiles.yml"
require:
  score: 3
  flag: "met_bob"
  scope: global
---
@alice #m1 [2026-01-01 10:00]
Hi

@bob #m2 [+1m]
Hello
`);

  try {
    const conversation = loadConversationFromMarkdown(markdownPath, { selfId: "alice" });
    assert.deepEqual(conversation.chat.require, {
      score: 3,
      flags: ["met_bob"],
      scope: "global"
    });
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});
