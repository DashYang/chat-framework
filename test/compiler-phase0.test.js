import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  compileDocumentProject,
  compileFolderProject,
  compileSingleProject
} from "../src/compiler.js";
import { NodeProjectSource } from "../src/node-project-source.js";
import {
  normalizeProjectPath,
  relativeProjectPath,
  resolveProjectPath
} from "../src/project-path.js";
import { MemoryProjectSource } from "../src/project-source.js";

const singleFiles = {
  "chat.md": `---
title: Phase 0 Demo
profiles: ./profiles.yml
chat: ./chat.yml
theme: wechat
---
@alice #m1 [2026-01-01 10:00:00]
Hello

@bob #m2 [+1m]
Hi
`,
  "profiles.yml": `users:
  alice:
    name: Alice
  bob:
    name: Bob
`,
  "chat.yml": `chat:
  type: single
  self: alice
  title: Bob
`
};

test("shared compiler renders a single conversation from MemoryProjectSource", () => {
  const result = compileSingleProject({
    source: new MemoryProjectSource(singleFiles),
    inputPath: "chat.md"
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.metadata.kind, "single");
  assert.match(result.html, /<title>Bob<\/title>/);
  assert.match(result.html, /Hello/);
  assert.match(result.html, /Hi/);
});

test("shared compiler renders a folder hub from MemoryProjectSource", () => {
  const result = compileFolderProject({
    source: new MemoryProjectSource({
      "hub/01-chat.md": singleFiles["chat.md"],
      "hub/profiles.yml": singleFiles["profiles.yml"],
      "hub/chat.yml": singleFiles["chat.yml"],
      "hub/ui.yml": "ui:\n  theme: wechat\n"
    }),
    inputDir: "hub"
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.metadata.kind, "folder");
  assert.equal(result.metadata.conversationCount, 1);
  assert.match(result.html, /id="chat-data"/);
  assert.match(result.html, /"title":"Bob"/);
});

test("shared compiler renders a collection document from MemoryProjectSource", () => {
  const result = compileDocumentProject({
    source: new MemoryProjectSource({
      "documents/settings.yml": `type: settings
items:
  - image: ../assets/noise.png
    name: Noise
    description: "**Important** setting"
`,
      "assets/noise.png": new Uint8Array([1, 2, 3])
    }),
    inputPath: "documents/settings.yml",
    outputPath: "dist/settings.html"
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.metadata.documentType, "settings");
  assert.match(result.html, /Noise/);
  assert.match(result.html, /<strong>Important<\/strong>/);
  assert.match(result.html, /\.\.\/assets\/noise\.png/);
});

test("compiler failures return structured diagnostics and no html", () => {
  const result = compileSingleProject({
    source: new MemoryProjectSource({
      ...singleFiles,
      "chat.md": singleFiles["chat.md"].replace("@bob", "@unknown")
    }),
    inputPath: "chat.md"
  });

  assert.equal(result.html, undefined);
  assert.equal(result.diagnostics.length, 1);
  assert.deepEqual(
    Object.keys(result.diagnostics[0]).sort(),
    ["code", "message", "path", "severity"].sort()
  );
  assert.equal(result.diagnostics[0].severity, "error");
  assert.equal(result.diagnostics[0].code, "BUILD_FAILED");
  assert.equal(result.diagnostics[0].path, "chat.md");
  assert.match(result.diagnostics[0].message, /Unknown sender "unknown"/);
});

test("YAML compiler diagnostics include source location when available", () => {
  const result = compileDocumentProject({
    source: new MemoryProjectSource({
      "documents/broken.yml": "type: settings\nitems:\n  - name: [broken\n"
    }),
    inputPath: "documents/broken.yml",
    outputPath: "dist/broken.html"
  });

  assert.equal(result.html, undefined);
  assert.equal(result.diagnostics[0].path, "documents/broken.yml");
  assert.equal(Number.isInteger(result.diagnostics[0].line), true);
  assert.equal(Number.isInteger(result.diagnostics[0].column), true);
});

test("memory and Node project sources produce identical single-page output", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-framework-source-parity-"));
  try {
    for (const [fileName, contents] of Object.entries(singleFiles)) {
      fs.writeFileSync(path.join(tempDir, fileName), contents, "utf-8");
    }
    const memoryResult = compileSingleProject({
      source: new MemoryProjectSource(singleFiles),
      inputPath: "chat.md"
    });
    const nodeResult = compileSingleProject({
      source: new NodeProjectSource(),
      inputPath: path.join(tempDir, "chat.md")
    });

    assert.deepEqual(memoryResult.diagnostics, []);
    assert.deepEqual(nodeResult.diagnostics, []);
    assert.equal(nodeResult.html, memoryResult.html);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("compiler core and core loaders do not import filesystem modules", () => {
  for (const filePath of [
    "src/compiler.js",
    "src/load-conversation.js",
    "src/document-loader.js"
  ]) {
    const source = fs.readFileSync(path.resolve(filePath), "utf-8");
    assert.doesNotMatch(source, /from ["'](?:node:)?fs["']/);
    assert.doesNotMatch(source, /require\(["'](?:node:)?fs["']\)/);
  }
});

test("project paths resolve consistently without Node path", () => {
  assert.equal(normalizeProjectPath("project/./chat/../profiles/alice.yml"), "project/profiles/alice.yml");
  assert.equal(resolveProjectPath("project/chats", "../profiles/alice.yml"), "project/profiles/alice.yml");
  assert.equal(
    relativeProjectPath("/project/dist", "/project/content/assets/avatar.png"),
    "../content/assets/avatar.png"
  );
});
