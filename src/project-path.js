function splitRoot(value) {
  const input = String(value || "").replaceAll("\\", "/");
  const drive = input.match(/^([A-Za-z]:)(?:\/|$)/);
  if (drive) {
    return { root: `${drive[1]}/`, rest: input.slice(drive[0].length) };
  }
  if (input.startsWith("/")) return { root: "/", rest: input.slice(1) };
  return { root: "", rest: input };
}

export function normalizeProjectPath(value) {
  const { root, rest } = splitRoot(value);
  const parts = [];
  for (const part of rest.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length && parts[parts.length - 1] !== "..") parts.pop();
      else if (!root) parts.push(part);
      continue;
    }
    parts.push(part);
  }
  const body = parts.join("/");
  if (root === "/") return body ? `/${body}` : "/";
  if (root) return body ? `${root}${body}` : root;
  return body || ".";
}

export function isAbsoluteProjectPath(value) {
  const { root } = splitRoot(value);
  return Boolean(root);
}

export function resolveProjectPath(base, ...segments) {
  let current = String(base || ".");
  for (const segment of segments) {
    const next = String(segment || "");
    if (!next) continue;
    current = isAbsoluteProjectPath(next) ? next : `${current}/${next}`;
  }
  return normalizeProjectPath(current);
}

export function dirnameProjectPath(value) {
  const normalized = normalizeProjectPath(value);
  const { root, rest } = splitRoot(normalized);
  const parts = rest.split("/").filter(Boolean);
  parts.pop();
  if (!parts.length) return root || ".";
  return `${root}${parts.join("/")}`;
}

export function basenameProjectPath(value) {
  const normalized = normalizeProjectPath(value);
  const { rest } = splitRoot(normalized);
  const parts = rest.split("/").filter(Boolean);
  return parts.at(-1) || "";
}

export function relativeProjectPath(fromDir, targetPath) {
  const from = splitRoot(normalizeProjectPath(fromDir));
  const target = splitRoot(normalizeProjectPath(targetPath));
  if (from.root.toLowerCase() !== target.root.toLowerCase()) {
    return normalizeProjectPath(targetPath);
  }
  const fromParts = from.rest.split("/").filter(Boolean);
  const targetParts = target.rest.split("/").filter(Boolean);
  let shared = 0;
  while (shared < fromParts.length
    && shared < targetParts.length
    && fromParts[shared] === targetParts[shared]) {
    shared += 1;
  }
  const result = [
    ...Array(fromParts.length - shared).fill(".."),
    ...targetParts.slice(shared)
  ].join("/");
  return result || ".";
}
