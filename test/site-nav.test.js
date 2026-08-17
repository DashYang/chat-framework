import assert from "node:assert/strict";
import test from "node:test";

import { createStarterProject, serializeAuthoringProject, studioProjectPersistKey } from "../src/format-sdk.js";
import { addCompletionGatedLibraryNav, chatMakerProgressEventName } from "../src/site-nav.js";

test("exported site library navigation stays hidden until a true ending is completed", () => {
  const html = addCompletionGatedLibraryNav("<!doctype html><body><main>story</main></body>", {
    href: "library.html",
    label: "资料库 ↗",
    persistKey: studioProjectPersistKey("turtle-soup")
  });

  assert.match(html, /\.cm-site-nav\{[^}]*display:none/);
  assert.match(html, /\.cm-site-nav\.is-unlocked\{display:block\}/);
  assert.match(html, /trueEndingHandled/);
  assert.match(html, /startsWith\('true-end'\)/);
  assert.match(html, /chat-maker:progress/);
  assert.match(html, /href="library\.html"/);
});

test("Studio serialization and completion-gated navigation share one persistence key", () => {
  const project = createStarterProject();
  project.id = "demo project";
  const serialized = serializeAuthoringProject(project, { assetMode: "files" });
  const persistKey = studioProjectPersistKey(project.id);

  assert.match(serialized.files["ui.yml"], new RegExp(`persistKey: ${persistKey}`));
  assert.equal(chatMakerProgressEventName(), "chat-maker:progress");
});
