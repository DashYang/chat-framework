import assert from "node:assert/strict";
import test from "node:test";

import { renderWechatHubHtml } from "../src/multi-renderer.js";

function hubRuntime(html) {
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .find((source) => source.includes("function requestConversationExit"));
}

test("hub excludes the actively playing conversation from the chat badge", () => {
  const html = renderWechatHubHtml({ conversations: [] });
  const runtime = hubRuntime(html);

  assert.ok(runtime);
  assert.match(runtime, /const activeConversationId = detailView\.style\.display === 'flex' && activePlayback && !activePlayback\.finished/);
  assert.match(runtime, /&& c\.id !== activeConversationId/);
  assert.match(runtime, /activePlayback = playback;\s*updateUnreadBadges\(\);/);
});

test("hub guards every in-app exit while conversation playback is active", () => {
  const html = renderWechatHubHtml({ conversations: [] });
  const runtime = hubRuntime(html);

  assert.match(html, /id="skip-confirm"/);
  assert.match(html, />继续对话<\/button>/);
  assert.match(html, />跳过对话<\/button>/);
  assert.match(runtime, /backBtn\.addEventListener\('click', \(\) => requestConversationExit\(showChatList\)\)/);
  assert.match(runtime, /tabChat\.addEventListener\('click', \(\) => requestConversationExit\(showChatList\)\)/);
  assert.match(runtime, /tabContacts\.addEventListener\('click', \(\) => requestConversationExit\(showContacts\)\)/);
  assert.match(runtime, /tabMoments\.addEventListener\('click', \(\) => requestConversationExit\(showMoments\)\)/);
  assert.match(runtime, /tabMe\.addEventListener\('click', \(\) => requestConversationExit\(showAccountView\)\)/);
});

test("hub skip flow consumes remaining messages and blocks unresolved choices", () => {
  const html = renderWechatHubHtml({ conversations: [] });
  const runtime = hubRuntime(html);

  assert.match(runtime, /function hasUnresolvedPlaybackChoice\(\)/);
  assert.match(runtime, /message\.kind === 'choice' && !selectedChoiceId\(conv\.id, message\)/);
  assert.match(runtime, /skipConfirmBtn\.disabled = blockedByChoice/);
  assert.match(runtime, /for \(let index = playback\.current; index < playback\.stageMessages\.length; index \+= 1\)/);
  assert.match(runtime, /messagePlayedMap\[messagePlayedKey\(playback\.conversationId, message\.id\)\] = true/);
  assert.match(runtime, /finishConversation\(playback\.conversationId\)/);
  assert.match(runtime, /if \(!badEndingInProgress && !trueEndingInProgress && typeof navigate === 'function'\) navigate\(\)/);
  assert.doesNotThrow(() => new Function(runtime));
});

test("cancelling skip confirmation resumes unfinished playback", () => {
  const runtime = hubRuntime(renderWechatHubHtml({ conversations: [] }));

  assert.match(runtime, /function closeSkipConfirm\(options\)[\s\S]*?if \(opts\.resume !== false\) resumeConversationPlayback\(\)/);
  assert.match(runtime, /if \(skipCancel\) skipCancel\.addEventListener\('click', closeSkipConfirm\)/);
  assert.match(runtime, /schedulePlayback\(activePlayback\.playNext, 250\)/);
});
