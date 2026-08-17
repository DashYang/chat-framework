import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";
import { build as viteBuild } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

export const STUDIO_BUILD_DIR = path.join(projectRoot, "dist", "studio");
export const ITCH_OUTPUT_PATH = path.join(projectRoot, "dist", "chat-maker-studio-itch.zip");
export const ITCH_LIMITS = Object.freeze({
  maxFiles: 1_000,
  maxPathCharacters: 240,
  maxTotalBytes: 500 * 1024 * 1024,
  maxFileBytes: 200 * 1024 * 1024
});

function toArchivePath(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

export function collectBuildFiles(rootDir) {
  const files = [];

  function visit(dirPath) {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const filePath = path.join(dirPath, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Studio itch build cannot contain symbolic links: ${toArchivePath(rootDir, filePath)}`);
      }
      if (entry.isDirectory()) {
        visit(filePath);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`Unsupported Studio build entry: ${toArchivePath(rootDir, filePath)}`);
      }
      files.push({
        archivePath: toArchivePath(rootDir, filePath),
        filePath,
        size: fs.statSync(filePath).size
      });
    }
  }

  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    throw new Error(`Studio build directory not found: ${rootDir}`);
  }
  visit(rootDir);
  return files.sort((a, b) => a.archivePath.localeCompare(b.archivePath));
}

function htmlRuntimeReferences(indexHtml) {
  const references = [];
  for (const match of indexHtml.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    references.push(match[1]);
  }
  for (const match of indexHtml.matchAll(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    if (/\.css(?:[?#]|$)/i.test(match[1])) references.push(match[1]);
  }
  return references;
}

function normalizedReferencePath(reference) {
  const clean = reference.split(/[?#]/, 1)[0];
  const withoutDot = clean.startsWith("./") ? clean.slice(2) : clean;
  return path.posix.normalize(withoutDot);
}

export function validateItchBuild(files, indexHtml, limits = ITCH_LIMITS) {
  const errors = [];
  const paths = new Set(files.map((file) => file.archivePath));

  if (!paths.has("index.html")) {
    errors.push("itch.io HTML builds require index.html at the ZIP root");
  }
  if (files.length > limits.maxFiles) {
    errors.push(`itch.io allows at most ${limits.maxFiles} files; build contains ${files.length}`);
  }

  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
    if (Array.from(file.archivePath).length > limits.maxPathCharacters) {
      errors.push(`Path exceeds ${limits.maxPathCharacters} characters: ${file.archivePath}`);
    }
    if (file.size > limits.maxFileBytes) {
      errors.push(`File exceeds ${limits.maxFileBytes} bytes: ${file.archivePath}`);
    }
  }
  if (totalBytes > limits.maxTotalBytes) {
    errors.push(`Build exceeds ${limits.maxTotalBytes} uncompressed bytes: ${totalBytes}`);
  }

  for (const reference of htmlRuntimeReferences(indexHtml)) {
    if (/^(?:\/|[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) {
      errors.push(`Studio runtime asset must use a relative path: ${reference}`);
      continue;
    }
    const resolved = normalizedReferencePath(reference);
    if (resolved === ".." || resolved.startsWith("../") || !paths.has(resolved)) {
      errors.push(`Studio runtime asset is missing from the build: ${reference}`);
    }
  }

  if (errors.length) {
    throw new Error(`Invalid itch.io Studio build:\n- ${errors.join("\n- ")}`);
  }
  return { fileCount: files.length, totalBytes };
}

export async function packageStudioBuild({
  buildDir = STUDIO_BUILD_DIR,
  outputPath = ITCH_OUTPUT_PATH,
  limits = ITCH_LIMITS
} = {}) {
  const files = collectBuildFiles(buildDir);
  const indexEntry = files.find((file) => file.archivePath === "index.html");
  const indexHtml = indexEntry ? fs.readFileSync(indexEntry.filePath, "utf8") : "";
  const summary = validateItchBuild(files, indexHtml, limits);
  const zip = new JSZip();
  const zipDate = new Date("2000-01-01T00:00:00.000Z");

  for (const file of files) {
    zip.file(file.archivePath, fs.readFileSync(file.filePath), {
      binary: true,
      createFolders: false,
      date: zipDate
    });
  }

  const archive = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "UNIX"
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tempPath, archive);
    fs.renameSync(tempPath, outputPath);
  } finally {
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath);
  }
  return { ...summary, outputPath, archiveBytes: archive.byteLength };
}

export async function buildStudioItch() {
  await viteBuild({
    configFile: path.join(projectRoot, "studio", "vite.config.ts"),
    base: "./"
  });
  return packageStudioBuild();
}

async function main() {
  const result = await buildStudioItch();
  console.log(`Built itch.io Studio package: ${result.outputPath}`);
  console.log(`Files: ${result.fileCount}`);
  console.log(`Uncompressed size: ${result.totalBytes} bytes`);
  console.log(`ZIP size: ${result.archiveBytes} bytes`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(`[studio-itch-error] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
