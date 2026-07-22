import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { compileFolderProject } from "./compiler.js";
import { requireBuildResult } from "./diagnostics.js";
import { formatBuildReport } from "./build-report.js";
import { NodeProjectSource } from "./node-project-source.js";
export { validateStoryConfig } from "./story-config.js";

/**
 * Build a single WeChat-like hub page from all markdown chats in a folder.
 *
 * @param {string} inputDir - Folder containing multiple chat markdown files.
 * @param {string} outputHtml - Output HTML path.
 * @returns {Record<string, unknown>} Structured build result.
 */
export function buildFolder(inputDir, outputHtml) {
  const result = requireBuildResult(compileFolderProject({
    source: new NodeProjectSource(),
    inputDir
  }));

  fs.mkdirSync(path.dirname(outputHtml), { recursive: true });
  fs.writeFileSync(outputHtml, result.html, "utf-8");
  console.log(`Built: ${outputHtml}`);
  console.log(`Loaded conversations: ${result.metadata.conversationCount}`);
  console.log(formatBuildReport(result.metadata.report));
  return result;
}

function main() {
  try {
    const [inputDir, outputHtml] = process.argv.slice(2);
    if (!inputDir || !outputHtml) {
      console.error("Usage: node src/build-folder.js <input-folder> <output.html>");
      console.error("Folder-build root semantics: profiles/, profiles.yml, ui.yml, story.yml, chatFiles, and groupChats resolve from the provided inputDir.");
      process.exit(1);
    }
    buildFolder(inputDir, outputHtml);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[build-folder-error] ${reason}`);
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main();
}
