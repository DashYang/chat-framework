import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { compileDocumentProject } from "./compiler.js";
import { requireBuildResult } from "./diagnostics.js";
import { NodeProjectSource } from "./node-project-source.js";

export function buildDocument(inputYaml, outputHtml) {
  const result = requireBuildResult(compileDocumentProject({
    source: new NodeProjectSource(),
    inputPath: path.resolve(inputYaml),
    outputPath: path.resolve(outputHtml)
  }));
  fs.mkdirSync(path.dirname(outputHtml), { recursive: true });
  fs.writeFileSync(outputHtml, result.html, "utf-8");
  console.log(`Built document: ${outputHtml}`);
  console.log(`Type: ${result.metadata.documentType}; entries: ${result.metadata.itemCount}`);
  return result;
}

function main() {
  try {
    const [inputYaml, outputHtml] = process.argv.slice(2);
    if (!inputYaml || !outputHtml) {
      console.error("Usage: node src/build-document.js <input.yml> <output.html>");
      process.exit(1);
    }
    buildDocument(inputYaml, outputHtml);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[build-error] ${reason}`);
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main();
}
