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

test("every article entry resets its shared reader scroll position", () => {
  const singleHtml = renderHtml({
    frontmatter: {},
    profiles: { users: { alice: { name: "Alice" } } },
    chat: { self: "alice", type: "single" },
    messages: []
  });
  const hubHtml = renderWechatHubHtml({ conversations: [] });

  assert.match(singleHtml, /articleModal\.scrollTop = 0/);
  assert.equal((hubHtml.match(/articleModal\.scrollTop = 0/g) || []).length, 2);
});
