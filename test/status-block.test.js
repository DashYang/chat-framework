import assert from "node:assert/strict";
import test from "node:test";

import { parseChatMarkdown } from "../src/parser.js";
import { renderHtml } from "../src/renderer.js";
import { renderWechatHubHtml } from "../src/multi-renderer.js";

test("status blocks split on blank lines and inherit header tags", () => {
  const parsed = parseChatMarkdown(`@wo #format [2026-01-01 10:00] [status] [require-flag:bad-end]
格式化开始

格式化中。。。

格式化结束`);

  assert.equal(parsed.messages.length, 3);
  assert.deepEqual(parsed.messages.map((message) => message.text), ["格式化开始", "格式化中。。。", "格式化结束"]);
  assert.deepEqual(parsed.messages.map((message) => message.require), [
    { flags: ["bad-end"] },
    { flags: ["bad-end"] },
    { flags: ["bad-end"] }
  ]);
  assert.equal(parsed.messages[0].id, "format");
  assert.ok(parsed.messages.slice(1).every((message) => message.id !== "format"));
});

test("require tags do not prevent compact text blocks from splitting", () => {
  const parsed = parseChatMarkdown(`@qinGuangWang [2026-01-03 00:03] [require-score:1] [require-flag:awakened]
你是我们制造的智能体

你在“孽镜台文书”中看到的故事

不过是王们为你的觉醒准备的养料`);

  assert.deepEqual(parsed.messages.map((message) => message.text), [
    "你是我们制造的智能体",
    "你在“孽镜台文书”中看到的故事",
    "不过是王们为你的觉醒准备的养料"
  ]);
  assert.deepEqual(parsed.messages.map((message) => message.require), [
    { score: 1, scope: "account", flags: ["awakened"] },
    { score: 1, scope: "account", flags: ["awakened"] },
    { score: 1, scope: "account", flags: ["awakened"] }
  ]);
});

test("status keeps the centered, avatar-free rendering in both page types", () => {
  const parsed = parseChatMarkdown(`@wo #status [2026-01-01 10:00] [status]
系统处理中`);
  const context = {
    frontmatter: {},
    profiles: { users: { wo: { name: "我", avatar: "me.png" } } },
    chat: { self: "wo", type: "single" },
    messages: parsed.messages
  };
  const singleHtml = renderHtml(context);
  const hubHtml = renderWechatHubHtml({ conversations: [{ id: "c1", ...context }] });

  assert.match(singleHtml, /<div class="end-tip">系统处理中<\/div>/);
  assert.match(singleHtml, /\.end-tip\{font-size:12px;color:var\(--muted\);text-align:center;margin:16px 0 4px\}/);
  assert.doesNotMatch(singleHtml, /<article class="msg self"/);
  assert.match(hubHtml, /if \(msg\.kind === 'status'\)/);
});
