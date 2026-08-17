import assert from "node:assert/strict";
import test from "node:test";

import { renderWechatHubHtml } from "../src/multi-renderer.js";

test("hub defaults to the built-in heartbeat BGM", () => {
  const html = renderWechatHubHtml({ conversations: [] });

  assert.match(html, /"bgm":\{"type":"heartbeat","src":""\}/);
  assert.match(html, /createOscillator\(\)/);
});

test("hub loops configured audio and ignores heartbeat level changes", () => {
  const html = renderWechatHubHtml({
    conversations: [],
    ui: { bgm: { type: "audio", src: "https://media.example.test/story.mp3" } }
  });

  assert.match(html, /"bgm":\{"type":"audio","src":"https:\/\/media\.example\.test\/story\.mp3"\}/);
  assert.match(html, /customAudio = new Audio\(backgroundAudioConfig\.src\)/);
  assert.match(html, /customAudio\.loop = true/);
  assert.match(html, /function applyLevel\(n\) \{\s+if \(usesCustomAudio\(\)\) return;/);
  assert.match(html, /if \(audio\?\.paused\) audio\.play\(\)\.catch\(\(\) => \{\}\)/);
  assert.match(html, /chat-maker:studio-playback/);
  assert.match(html, /event\.data\.action === 'pause'\) heartbeatEngine\.stop\(\)/);
  assert.match(html, /event\.data\.action === 'resume'/);
});

test("Studio editor previews never start BGM", () => {
  const html = renderWechatHubHtml({
    conversations: [],
    ui: { bgm: { type: "audio", src: "https://media.example.test/story.mp3" } },
    preview: { kind: "conversation", conversationId: "main", entityId: "main" }
  });

  assert.doesNotMatch(html, /chat-maker:studio-playback/);
  assert.doesNotMatch(html, /heartbeatEngine\.start\(\);\s+document\.addEventListener\('click', function resumeHeartbeat/);
});
