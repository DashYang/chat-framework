import assert from "node:assert/strict";
import test from "node:test";

import { validateStoryConfig } from "../src/build-folder.js";
import { renderWechatHubHtml } from "../src/multi-renderer.js";

test("bad-ending story config requires a reset account in account order", () => {
  assert.doesNotThrow(() => validateStoryConfig({ accountOrder: ["wo"] }));
  assert.throws(
    () => validateStoryConfig({ accountOrder: ["wo"], resetInfo: "前缘尽灭，再入轮回" }),
    /story\.resetAccount is required/
  );
  assert.throws(
    () => validateStoryConfig({ accountOrder: ["wo"], resetAccount: "other" }),
    /must be an account/
  );
  assert.throws(
    () => validateStoryConfig({ accountOrder: ["wo"], resetAccount: "wo", resetInfo: 1 }),
    /resetInfo must be a string/
  );
  assert.throws(
    () => validateStoryConfig({}, [{ messages: [{ kind: "choice", choice: { options: [{ flag: "bad-end-1" }] } }] }]),
    /resetAccount is required/
  );
  assert.throws(() => validateStoryConfig({ title: 1 }), /story\.title must be a string/);
  assert.throws(() => validateStoryConfig({ favicon: 1 }), /story\.favicon must be a string/);
});

test("hub uses optional story branding in the document head", () => {
  const html = renderWechatHubHtml({
    title: "folder-default",
    story: { title: "我的互动故事", favicon: "assets/game-icon.png?x=1&y=2" },
    conversations: []
  });

  assert.match(html, /<title>我的互动故事<\/title>/);
  assert.match(html, /<link rel="icon" href="assets\/game-icon\.png\?x=1&amp;y=2" \/>/);
  assert.doesNotMatch(renderWechatHubHtml({ title: "folder-default", conversations: [] }), /<link rel="icon"/);
});

test("true-ending config accepts true-end flags without a reset account", () => {
  assert.doesNotThrow(() => validateStoryConfig(
    { accountOrder: ["wo"], endInfo: "尘埃落定。" },
    [{ messages: [{ kind: "choice", choice: { options: [{ flag: "true-end-1" }] } }] }]
  ));
  assert.throws(
    () => validateStoryConfig({ endInfo: 1 }),
    /endInfo must be a string/
  );
});

test("hub runtime contains bad-ending completion, reset, and configured notice flow", () => {
  const html = renderWechatHubHtml({
    story: { accountOrder: ["wo", "later"], resetAccount: "wo", resetInfo: "前缘尽灭，再入轮回" },
    conversations: []
  });

  assert.match(html, /bad-ending-overlay/);
  assert.match(html, /function badEndingContentComplete\(flag\)/);
  assert.match(html, /function markMessagePlayed\(conversationId, message\)/);
  assert.match(html, /messagePlayedMap/);
  assert.match(html, /function resetProgressFrom\(resetAccount, options\)/);
  assert.match(html, /function startBadEndingIfReady\(\)/);
  assert.match(html, /unlockAllAccounts/);
  assert.match(html, /pointer-events:auto/);
  assert.match(html, /phone\.inert = true/);
  assert.match(html, /markMessagePlayed\(conversationId, msg\);[\s\S]*?if \(startBadEndingIfReady\(\)\) return;/);
  assert.match(html, /resetInfo/);
  assert.match(html, /饮用孟婆汤/);
  assert.match(html, /饮用孟婆汤忘却“' \+ name \+ '”的旧事/);
  assert.match(html, />饮用<\/button>/);
  const runtimeScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .find((source) => source.includes("function startBadEndingIfReady"));
  assert.doesNotThrow(() => new Function(runtimeScript));
});

test("hub runtime contains true-ending notice, persistence, and continuation flow", () => {
  const html = renderWechatHubHtml({
    story: { accountOrder: ["wo"], endInfo: "尘埃落定。" },
    conversations: []
  });

  assert.match(html, /true-ending-confirm/);
  assert.match(html, /function configuredEndInfo\(\)/);
  assert.match(html, /function trueEndingContentComplete\(flag\)/);
  assert.match(html, /function startTrueEndingIfReady\(\)/);
  assert.match(html, /function continueTrueEnding\(\)/);
  assert.match(html, /trueEndingHandled/);
  assert.match(html, /trueEndingPending/);
  assert.match(html, /function registerTrueEndingPending\(flags, conversationId, messageId\)/);
  assert.match(html, /return 'global\|' \+ String\(flag \|\| ''\)/);
  assert.match(html, /function markTrueEndingSourceSeen\(source\)/);
  assert.match(html, /function hydrateTrueEndingPending\(\)/);
  assert.match(html, /function clearTrueEndingHandled\(accountIdsToReset\)/);
  assert.match(html, /clearTrueEndingHandled\(resetAccounts\);/);
  assert.match(html, /endInfo/);
  assert.match(html, />继续<\/button>/);
  assert.match(html, /showAccountView\(\);[\s\S]*?phone\.inert = false/);
});

test("true-ending runtime scopes pending endings to their source account and marks the source conversation seen", () => {
  const html = renderWechatHubHtml({ conversations: [] });

  assert.match(html, /String\(source\?\.accountId \|\| ''\) === String\(activeAccountId\)/);
  assert.match(html, /delete trueEndingPending\[flag\];[\s\S]*?markTrueEndingSourceSeen\(source\);/);
  assert.match(html, /stageSeenMap\[stageSeenKey\]\[source\.conversationId\] = true;/);
  assert.match(html, /registerTrueEndingPending\(option\.flags \?\? option\.flag, conversationId, messageId\);/);
  assert.match(html, /maybeAdvanceStage\(\);\s*if \(trueEndingInProgress\) return;/);
});

test("hub runtime stably pins conversations with current-stage content", () => {
  const html = renderWechatHubHtml({ conversations: [] });

  assert.match(html, /hasNewContent: hasNewMessagesOnDay\(conversation, stage\)/);
  assert.match(html, /Number\(b\.hasNewContent\) - Number\(a\.hasNewContent\) \|\| a\.index - b\.index/);
});

test("hub completion and status progress use consumed content units", () => {
  const html = renderWechatHubHtml({ conversations: [] });

  assert.match(html, /function collectConsumableContentForAccount\(accountId\)/);
  assert.match(html, /type: 'chat',[\s\S]*?consumed: \(\) => hasMessagePlayed/);
  assert.match(html, /type: 'article',[\s\S]*?consumed: \(\) => !!getArticleSeen/);
  assert.match(html, /type: 'moment',[\s\S]*?consumed: \(\) => !!getMomentSeen/);
  assert.match(html, /const consumed = units\.filter\(\(unit\) => unit\.consumed\(\)\)\.length/);
  assert.match(html, /collectConsumableContentForAccount\(activeAccountId\)\.every\(\(unit\) => unit\.consumed\(\)\)/);
  assert.match(html, /已解锁 ' \+ accountIds\.filter\(\(id\) => isAccountUnlocked\(id\)\)\.length/);
});
