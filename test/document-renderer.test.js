import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import test from "node:test";

import { buildDocument } from "../src/build-document.js";
import { parseDocumentYaml } from "../src/document-loader.js";
import { renderDocumentHtml } from "../src/document-renderer.js";

const paths = {
  inputPath: "/project/content/characters.yml",
  outputPath: "/project/dist/characters.html"
};

test("characters document parses multiple entries and renders markdown fields", () => {
  const document = parseDocumentYaml(`
type: characters
title: 人物介绍
items:
  - avatar: ./assets/zhou.png
    name: 周正
    identity: "**联络员** / 观察者"
    status: "**存活**"
    description: |
      退伍后成为**联络员**。

      | 字段 | 内容 |
      | --- | --- |
      | 状态 | 正常 |

      ![证件](./assets/card.png)
  - avatar: https://example.com/feng.png
    name: 冯全
    identity: 资深观察者
    status: 失踪
    description: |
      第二个人物。
`, paths);

  assert.equal(document.theme, "iterms");
  assert.equal(document.items.length, 2);
  assert.equal(document.items[0].avatar, "../content/assets/zhou.png");
  assert.match(document.items[0].identityHtml, /<strong>联络员<\/strong>/);
  assert.match(document.items[0].statusHtml, /<strong>存活<\/strong>/);
  assert.match(document.items[0].descriptionHtml, /<table>/);
  assert.match(document.items[0].descriptionHtml, /src="\.\.\/content\/assets\/card\.png"/);

  const html = renderDocumentHtml(document);
  assert.match(html, /class="document-card character-card"/);
  assert.match(html, /周正/);
  assert.match(html, /class="document-number">01<\/span>/);
  assert.match(html, /max-width:560px/);
  assert.doesNotMatch(html, /ENTRIES/);
  assert.match(html, /installImageViewer\(\)/);
});

test("settings document renders records and disables raw HTML", () => {
  const document = parseDocumentYaml(`
type: settings
theme: paper
headerIndex: "SET-07"
footerText: "> SETTINGS ARCHIVED"
items:
  - image: ./assets/noise.png
    name: 噪燃
    description: |
      具有**扩散性**。

      <script>alert("x")</script>
`, {
    inputPath: "/project/content/settings.yml",
    outputPath: "/project/dist/settings.html"
  });

  assert.equal(document.theme, "paper");
  assert.equal(document.headerIndex, "SET-07");
  assert.equal(document.footerText, "> SETTINGS ARCHIVED");
  assert.match(document.items[0].descriptionHtml, /<strong>扩散性<\/strong>/);
  assert.doesNotMatch(document.items[0].descriptionHtml, /<script>/);
  assert.match(document.items[0].descriptionHtml, /&lt;script&gt;/);
  const html = renderDocumentHtml(document);
  assert.match(html, /class="document-card setting-card"/);
  assert.match(html, /class="document-index">SET-07<\/div>/);
  assert.match(html, /&gt; SETTINGS ARCHIVED/);
});

test("empty headerIndex and footerText hide their regions", () => {
  const document = parseDocumentYaml(`
type: settings
headerIndex: ""
footerText: ""
items:
  - image: https://example.com/noise.png
    name: 噪燃
    description: 简介
`, paths);

  const html = renderDocumentHtml(document);
  assert.doesNotMatch(html, /class="document-index"/);
  assert.doesNotMatch(html, /class="document-footer"/);
});

test("timeline document supports entries with and without images and multiple participants", () => {
  const document = parseDocumentYaml(`
type: timeline
items:
  - image: ./assets/1963.png
    time: "**1963**"
    description: 焦原沟事件。
    participants: [周正, 冯全]
  - time: 未来
    description: 扬戬计划推进。
    participants:
      - 周正
`, {
    inputPath: "/project/content/timeline.yml",
    outputPath: "/project/dist/timeline.html"
  });

  assert.equal(document.items[0].participants.length, 2);
  assert.equal(document.items[1].image, "");
  const html = renderDocumentHtml(document);
  assert.match(html, /timeline-card"/);
  assert.match(html, /timeline-card no-image"/);
  assert.equal((html.match(/<img class="previewable-image document-timeline-image"/g) || []).length, 1);
  assert.match(html, /<strong>1963<\/strong>/);
});

test("document validation identifies the failing item and field", () => {
  assert.throws(
    () => parseDocumentYaml(`
type: characters
items:
  - name: 周正
    identity: 观察者
    status: 存活
    description: 简介
`, paths),
    /items\[0\]\.avatar must be a string/
  );
  assert.throws(
    () => parseDocumentYaml("type: unknown\nitems: [{}]\n", paths),
    /type must be one of/
  );
  assert.throws(
    () => parseDocumentYaml("type: settings\nitems: []\n", paths),
    /items must contain at least one entry/
  );
  assert.throws(
    () => parseDocumentYaml(`
type: timeline
items:
  - time: "1963"
    description: 事件
    participants: []
`, paths),
    /participants must be a non-empty array/
  );
});

test("buildDocument writes a standalone HTML page", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-framework-document-"));
  const inputPath = path.join(tempDir, "settings.yml");
  const outputPath = path.join(tempDir, "dist", "settings.html");
  fs.mkdirSync(path.join(tempDir, "assets"));
  fs.writeFileSync(path.join(tempDir, "assets", "noise.png"), "image", "utf-8");
  fs.writeFileSync(inputPath, `
type: settings
items:
  - image: ./assets/noise.png
    name: 噪燃
    description: "**重点设定**"
`, "utf-8");

  buildDocument(inputPath, outputPath);

  assert.equal(fs.existsSync(outputPath), true);
  const html = fs.readFileSync(outputPath, "utf-8");
  assert.match(html, /<!doctype html>/);
  assert.match(html, /重点设定/);
  assert.match(html, /src="\.\.\/assets\/noise\.png"/);
  const scripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g), (match) => match[1]);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0]));
});
