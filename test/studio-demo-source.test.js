import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileDocumentProject, compileFolderProject } from "../src/compiler.js";
import { NodeProjectSource } from "../src/node-project-source.js";
import { studioDemoFiles } from "../src/studio-demo-source.generated.js";

const projectDir = path.resolve("examples/studio-demo");
const textExtensions = new Set([".md", ".yml", ".yaml", ".svg", ".txt", ".json"]);

function collectFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(absolute);
    const relative = path.relative(projectDir, absolute).replaceAll(path.sep, "/");
    const value = textExtensions.has(path.extname(entry.name).toLowerCase())
      ? fs.readFileSync(absolute, "utf8")
      : new Uint8Array(fs.readFileSync(absolute));
    return [[relative, value]];
  });
}

test("generated Studio Demo source matches the canonical YAML/Markdown project", () => {
  const canonical = Object.fromEntries(collectFiles(projectDir).sort(([a], [b]) => a.localeCompare(b)));
  assert.deepEqual(studioDemoFiles, canonical);
  assert.equal(studioDemoFiles["assets/noise_bgm.wav"] instanceof Uint8Array, true);
});

test("canonical Studio Demo project compiles directly from its folder", () => {
  const source = new NodeProjectSource();
  const hub = compileFolderProject({ source, inputDir: "examples/studio-demo", title: "最后一碗海龟汤" });
  const settings = compileDocumentProject({
    source,
    inputPath: "examples/studio-demo/documents/case-settings.yml",
    outputPath: "dist/case-settings.html"
  });
  const timeline = compileDocumentProject({
    source,
    inputPath: "examples/studio-demo/documents/case-timeline.yml",
    outputPath: "dist/case-timeline.html"
  });

  assert.deepEqual(hub.diagnostics, []);
  assert.equal(hub.metadata.conversationCount, 4);
  assert.deepEqual(settings.diagnostics, []);
  assert.equal(settings.metadata.documentType, "settings");
  assert.deepEqual(timeline.diagnostics, []);
  assert.equal(timeline.metadata.documentType, "timeline");
});
