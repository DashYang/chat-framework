import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import JSZip from "jszip";

import {
  collectBuildFiles,
  packageStudioBuild,
  validateItchBuild
} from "../scripts/build-studio-itch.js";

function createBuildFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-maker-studio-itch-"));
  const buildDir = path.join(tempDir, "studio");
  const outputPath = path.join(tempDir, "studio-itch.zip");
  fs.mkdirSync(path.join(buildDir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(buildDir, "index.html"), `<!doctype html>
<script type="module" src="./assets/index.js"></script>
<link rel="stylesheet" href="./assets/index.css">
`);
  fs.writeFileSync(path.join(buildDir, "assets", "index.js"), "console.log('studio');");
  fs.writeFileSync(path.join(buildDir, "assets", "index.css"), "body { margin: 0; }");
  fs.writeFileSync(path.join(buildDir, "assets", "preview.worker.js"), "self.onmessage = () => {};");
  return { tempDir, buildDir, outputPath };
}

test("Studio itch packager writes the build at the ZIP root", async () => {
  const fixture = createBuildFixture();
  const result = await packageStudioBuild(fixture);
  const zip = await JSZip.loadAsync(fs.readFileSync(fixture.outputPath));
  const names = Object.keys(zip.files).sort();

  assert.equal(result.fileCount, 4);
  assert.equal(fs.existsSync(fixture.outputPath), true);
  assert.equal(names.includes("index.html"), true);
  assert.equal(names.includes("studio/index.html"), false);
  assert.equal(names.includes("assets/index.js"), true);
  assert.equal(names.includes("assets/index.css"), true);
  assert.equal(names.includes("assets/preview.worker.js"), true);
  assert.doesNotMatch(await zip.file("index.html").async("string"), /(?:src|href)=["']\/assets\//);
});

test("Studio itch validator requires a root index and relative runtime assets", () => {
  assert.throws(
    () => validateItchBuild([{ archivePath: "assets/index.js", size: 1 }], ""),
    /require index\.html at the ZIP root/
  );

  assert.throws(
    () => validateItchBuild([
      { archivePath: "index.html", size: 10 },
      { archivePath: "assets/index.js", size: 1 }
    ], '<script src="/assets/index.js"></script>'),
    /must use a relative path/
  );

  assert.throws(
    () => validateItchBuild([
      { archivePath: "index.html", size: 10 }
    ], '<link rel="stylesheet" href="./assets/missing.css">'),
    /runtime asset is missing/
  );
});

test("Studio itch validator enforces path and size limits", () => {
  const files = [
    { archivePath: "index.html", size: 4 },
    { archivePath: `assets/${"a".repeat(20)}.js`, size: 8 }
  ];

  assert.throws(
    () => validateItchBuild(files, "<main></main>", {
      maxFiles: 10,
      maxPathCharacters: 15,
      maxFileBytes: 100,
      maxTotalBytes: 100
    }),
    /Path exceeds 15 characters/
  );

  assert.throws(
    () => validateItchBuild(files, "<main></main>", {
      maxFiles: 10,
      maxPathCharacters: 100,
      maxFileBytes: 6,
      maxTotalBytes: 100
    }),
    /File exceeds 6 bytes/
  );

  assert.throws(
    () => validateItchBuild(files, "<main></main>", {
      maxFiles: 10,
      maxPathCharacters: 100,
      maxFileBytes: 100,
      maxTotalBytes: 10
    }),
    /Build exceeds 10 uncompressed bytes/
  );

  assert.throws(
    () => validateItchBuild(files, "<main></main>", {
      maxFiles: 1,
      maxPathCharacters: 100,
      maxFileBytes: 100,
      maxTotalBytes: 100
    }),
    /allows at most 1 files/
  );
});

test("Studio itch file collection rejects symbolic links", (t) => {
  const fixture = createBuildFixture();
  const linkPath = path.join(fixture.buildDir, "linked.js");
  try {
    fs.symlinkSync(path.join(fixture.buildDir, "assets", "index.js"), linkPath);
  } catch (error) {
    if (error && ["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
      t.skip("Symbolic links are unavailable in this environment");
      return;
    }
    throw error;
  }
  assert.throws(() => collectBuildFiles(fixture.buildDir), /cannot contain symbolic links/);
});
