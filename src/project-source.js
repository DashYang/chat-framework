import { normalizeProjectPath } from "./project-path.js";

export function assertProjectSource(source) {
  for (const method of ["exists", "stat", "list", "readText", "readBinary"]) {
    if (!source || typeof source[method] !== "function") {
      throw new TypeError(`ProjectSource.${method} is required`);
    }
  }
  return source;
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  return new TextEncoder().encode(String(value ?? ""));
}

export class MemoryProjectSource {
  constructor(files = {}) {
    this.files = new Map();
    for (const [filePath, value] of Object.entries(files)) {
      this.files.set(normalizeProjectPath(filePath), toBytes(value));
    }
  }

  exists(filePath) {
    const normalized = normalizeProjectPath(filePath);
    if (this.files.has(normalized)) return true;
    const prefix = normalized === "." ? "" : `${normalized}/`;
    return Array.from(this.files.keys()).some((key) => key.startsWith(prefix));
  }

  stat(filePath) {
    const normalized = normalizeProjectPath(filePath);
    if (this.files.has(normalized)) {
      return { isFile: () => true, isDirectory: () => false };
    }
    if (this.exists(normalized)) {
      return { isFile: () => false, isDirectory: () => true };
    }
    throw new Error(`Project source path not found: ${normalized}`);
  }

  list(dirPath) {
    const normalized = normalizeProjectPath(dirPath);
    if (!this.exists(normalized)) return [];
    const prefix = normalized === "." ? "" : `${normalized}/`;
    const entries = new Map();
    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const remainder = key.slice(prefix.length);
      const name = remainder.split("/")[0];
      if (!name) continue;
      const childPath = normalizeProjectPath(`${prefix}${name}`);
      entries.set(name, {
        name,
        path: childPath,
        type: remainder.includes("/") ? "directory" : "file"
      });
    }
    return Array.from(entries.values()).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }

  readText(filePath) {
    return new TextDecoder().decode(this.readBinary(filePath));
  }

  readBinary(filePath) {
    const normalized = normalizeProjectPath(filePath);
    const value = this.files.get(normalized);
    if (!value) throw new Error(`Project source file not found: ${normalized}`);
    return value.slice();
  }

  write(filePath, value) {
    const normalized = normalizeProjectPath(filePath);
    this.files.set(normalized, toBytes(value));
    return normalized;
  }

  delete(filePath) {
    const normalized = normalizeProjectPath(filePath);
    const prefix = `${normalized}/`;
    for (const key of this.files.keys()) {
      if (key === normalized || key.startsWith(prefix)) this.files.delete(key);
    }
  }
}
