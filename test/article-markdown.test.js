import assert from "node:assert/strict";
import test from "node:test";

import { renderArticleMarkdown } from "../src/article-renderer.js";
import { renderHtml } from "../src/renderer.js";
import { renderWechatHubHtml } from "../src/multi-renderer.js";

test("article bold text renders as a strong element", () => {
  const html = renderArticleMarkdown("普通文字和 **重点内容**");

  assert.match(html, /普通文字和 <strong>重点内容<\/strong>/);
  assert.doesNotMatch(html, /<strong>普通文字/);
});

test("every article entry shows the shared reader before resetting its scroll position", () => {
  const singleHtml = renderHtml({
    frontmatter: {},
    profiles: { users: { alice: { name: "Alice" } } },
    chat: { self: "alice", type: "single" },
    messages: []
  });
  const hubHtml = renderWechatHubHtml({ conversations: [] });
  const showThenReset = /articleModal\.classList\.add\('show'\);\s+articleModal\.scrollTop = 0/g;
  const resetWhileHidden = /articleModal\.scrollTop = 0;\s+articleModal\.classList\.add\('show'\)/g;

  assert.equal((singleHtml.match(showThenReset) || []).length, 1);
  assert.equal((hubHtml.match(showThenReset) || []).length, 2);
  assert.doesNotMatch(singleHtml, resetWhileHidden);
  assert.doesNotMatch(hubHtml, resetWhileHidden);
});
