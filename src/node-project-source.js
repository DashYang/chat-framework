import fs from "fs";

import { normalizeProjectPath } from "./project-path.js";

function nativePath(filePath) {
  return normalizeProjectPath(filePath);
}

export class NodeProjectSource {
  exists(filePath) {
    return fs.existsSync(nativePath(filePath));
  }

  stat(filePath) {
    return fs.statSync(nativePath(filePath));
  }

  list(dirPath) {
    return fs.readdirSync(nativePath(dirPath), { withFileTypes: true })
      .map((entry) => ({
        name: entry.name,
        path: normalizeProjectPath(`${dirPath}/${entry.name}`),
        type: entry.isDirectory() ? "directory" : "file"
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }

  readText(filePath) {
    return fs.readFileSync(nativePath(filePath), "utf-8");
  }

  readBinary(filePath) {
    return new Uint8Array(fs.readFileSync(nativePath(filePath)));
  }
}
