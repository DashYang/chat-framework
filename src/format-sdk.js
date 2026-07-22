import yaml from "js-yaml";

import { createDiagnostic } from "./diagnostics.js";
import { parseChatMarkdown } from "./parser.js";
import { dirnameProjectPath, resolveProjectPath } from "./project-path.js";
import { MemoryProjectSource } from "./project-source.js";

export const AUTHORING_SPEC_VERSION = "2.0";
const ABS_TIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/;
const REL_TIME_RE = /^\+\d+[smhd]$/;
const ID_RE = /^[\w-]+$/;

function randomId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8)
    || Math.random().toString(36).slice(2, 10);
  return `${prefix}-${suffix}`;
}

export function createStarterProject() {
  return {
    schemaVersion: AUTHORING_SPEC_VERSION,
    id: randomId("project"),
    title: "未命名聊天作品",
    theme: "wechat",
    selfId: "me",
    participants: [
      { id: "me", name: "我", avatar: "", bio: "" },
      { id: "friend", name: "朋友", avatar: "", bio: "" }
    ],
    conversation: {
      id: "main",
      title: "朋友",
      type: "single",
      messages: [
        {
          id: "m1",
          senderId: "friend",
          timeRaw: "2026-01-01 10:00:00",
          kind: "text",
          text: "你好，这是第一条消息。",
          quoteId: "",
          recallDelaySec: 0
        },
        {
          id: "m2",
          senderId: "me",
          timeRaw: "+1m",
          kind: "text",
          text: "现在可以直接在左侧编辑我。",
          quoteId: "",
          recallDelaySec: 0
        }
      ]
    },
    assets: []
  };
}

function fieldDiagnostic(code, message, entityId, field) {
  return createDiagnostic({
    severity: "error",
    code,
    message,
    path: "conversations/main.md",
    entityId,
    field
  });
}

export function validateAuthoringProject(project) {
  const diagnostics = [];
  if (!project || typeof project !== "object") {
    return [createDiagnostic({ code: "PROJECT_REQUIRED", message: "项目数据为空" })];
  }
  if (project.schemaVersion !== AUTHORING_SPEC_VERSION) {
    diagnostics.push(createDiagnostic({
      code: "UNSUPPORTED_SPEC_VERSION",
      message: `不支持的项目版本：${project.schemaVersion || "未设置"}`,
      path: "project.yml",
      field: "schemaVersion"
    }));
  }
  if (!String(project.title || "").trim()) {
    diagnostics.push(createDiagnostic({ code: "TITLE_REQUIRED", message: "作品标题不能为空", path: "project.yml", field: "title" }));
  }
  const participants = Array.isArray(project.participants) ? project.participants : [];
  if (participants.length < 2) {
    diagnostics.push(createDiagnostic({ code: "PARTICIPANTS_REQUIRED", message: "一个会话至少需要两名参与者", path: "profiles.yml", field: "participants" }));
  }
  const participantIds = new Set();
  for (const participant of participants) {
    const id = String(participant?.id || "").trim();
    if (!ID_RE.test(id)) {
      diagnostics.push(fieldDiagnostic("INVALID_PARTICIPANT_ID", "参与者 ID 只能包含字母、数字、下划线和连字符", id, "id"));
    } else if (participantIds.has(id)) {
      diagnostics.push(fieldDiagnostic("DUPLICATE_PARTICIPANT_ID", `参与者 ID 重复：${id}`, id, "id"));
    }
    participantIds.add(id);
    if (!String(participant?.name || "").trim()) {
      diagnostics.push(fieldDiagnostic("PARTICIPANT_NAME_REQUIRED", "参与者名称不能为空", id, "name"));
    }
  }
  if (!participantIds.has(String(project.selfId || ""))) {
    diagnostics.push(fieldDiagnostic("INVALID_SELF", "当前账号必须是会话参与者", String(project.selfId || ""), "selfId"));
  }

  const messages = Array.isArray(project.conversation?.messages) ? project.conversation.messages : [];
  if (!messages.length) {
    diagnostics.push(fieldDiagnostic("MESSAGES_REQUIRED", "至少需要一条消息", project.conversation?.id || "main", "messages"));
  }
  const messageIds = new Set();
  messages.forEach((message, index) => {
    const id = String(message?.id || "").trim();
    if (!ID_RE.test(id)) diagnostics.push(fieldDiagnostic("INVALID_MESSAGE_ID", "消息 ID 格式无效", id, "id"));
    else if (messageIds.has(id)) diagnostics.push(fieldDiagnostic("DUPLICATE_MESSAGE_ID", `消息 ID 重复：${id}`, id, "id"));
    if (!participantIds.has(String(message?.senderId || ""))) {
      diagnostics.push(fieldDiagnostic("UNKNOWN_SENDER", "请选择有效的消息发送者", id, "senderId"));
    }
    const time = String(message?.timeRaw || "").trim();
    if (index === 0 && !ABS_TIME_RE.test(time)) {
      diagnostics.push(fieldDiagnostic("FIRST_TIME_ABSOLUTE", "第一条消息必须填写绝对时间", id, "timeRaw"));
    } else if (time && !ABS_TIME_RE.test(time) && !REL_TIME_RE.test(time)) {
      diagnostics.push(fieldDiagnostic("INVALID_TIME", "时间应为绝对时间或 +1m 形式", id, "timeRaw"));
    }
    if (message?.quoteId && !messageIds.has(String(message.quoteId))) {
      diagnostics.push(fieldDiagnostic("INVALID_QUOTE", "引用必须指向前面的消息", id, "quoteId"));
    }
    if (["text", "status"].includes(message?.kind) && !String(message?.text || "").trim()) {
      diagnostics.push(fieldDiagnostic("MESSAGE_TEXT_REQUIRED", "消息内容不能为空", id, "text"));
    }
    if (message?.kind === "image" && !String(message?.imageSource || "").trim()) {
      diagnostics.push(fieldDiagnostic("IMAGE_REQUIRED", "请选择图片或填写图片网址", id, "imageSource"));
    }
    if (message?.kind === "link-card" && !String(message?.linkCard?.url || "").trim()) {
      diagnostics.push(fieldDiagnostic("LINK_URL_REQUIRED", "链接卡片网址不能为空", id, "linkCard.url"));
    }
    messageIds.add(id);
  });
  return diagnostics;
}

function dataUrlToBytes(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return new Uint8Array();
  const payload = match[3] || "";
  if (match[2]) {
    const binary = globalThis.atob
      ? globalThis.atob(payload)
      : Buffer.from(payload, "base64").toString("binary");
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return new TextEncoder().encode(decodeURIComponent(payload));
}

function bytesToDataUrl(bytes, mimeType = "application/octet-stream") {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = globalThis.btoa
    ? globalThis.btoa(binary)
    : Buffer.from(bytes).toString("base64");
  return `data:${mimeType};base64,${encoded}`;
}

function sanitizeFileName(value, fallback) {
  const safe = String(value || "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || fallback;
}

function mimeFromPath(filePath) {
  const ext = String(filePath || "").split(".").pop()?.toLowerCase();
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" })[ext] || "application/octet-stream";
}

function assetPath(asset) {
  return `assets/${sanitizeFileName(asset.fileName, `${asset.id}.bin`)}`;
}

function resolveMedia(project, reference, assetMode, files, relativePrefix = "./") {
  const value = String(reference || "").trim();
  if (!value.startsWith("asset:")) return value;
  const id = value.slice("asset:".length);
  const asset = (project.assets || []).find((item) => item.id === id);
  if (!asset) return "";
  if (assetMode === "inline") return asset.dataUrl || "";
  const filePath = assetPath(asset);
  files[filePath] = dataUrlToBytes(asset.dataUrl);
  return `${relativePrefix}${filePath}`;
}

function singleLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function serializeMessage(project, message, assetMode, files) {
  const tags = [];
  if (message.timeRaw) tags.push(`[${message.timeRaw}]`);
  if (message.quoteId) tags.push(`[quote:${message.quoteId}]`);
  if (message.kind === "image") tags.push("[image]");
  if (message.kind === "link-card") tags.push("[link-card]");
  if (message.kind === "status") tags.push("[status]");
  if (Number(message.recallDelaySec) > 0) tags.push(`[recall:+${Math.round(Number(message.recallDelaySec))}s]`);
  const header = `@${message.senderId} #${message.id}${tags.length ? ` ${tags.join(" ")}` : ""}`;
  let body = String(message.text || "").trim();
  if (message.kind === "image") {
    body = [resolveMedia(project, message.imageSource, assetMode, files, "../"), String(message.caption || "").trim()]
      .filter(Boolean)
      .join("\n");
  } else if (message.kind === "link-card") {
    const card = message.linkCard || {};
    body = [
      `url: ${singleLine(card.url)}`,
      card.title ? `title: ${singleLine(card.title)}` : "",
      card.desc ? `desc: ${singleLine(card.desc)}` : "",
      card.image ? `image: ${resolveMedia(project, card.image, assetMode, files, "../")}` : "",
      card.site ? `site: ${singleLine(card.site)}` : ""
    ].filter(Boolean).join("\n");
  }
  return `${header}\n${body}`;
}

function yamlText(value) {
  return yaml.safeDump(value, { noRefs: true, lineWidth: 120, sortKeys: false });
}

export function serializeAuthoringProject(project, options = {}) {
  const diagnostics = validateAuthoringProject(project);
  if (diagnostics.some((item) => item.severity === "error")) {
    return { files: {}, entryPath: "conversations/main.md", diagnostics };
  }
  const assetMode = options.assetMode === "files" ? "files" : "inline";
  const files = {};
  const entryPath = "conversations/main.md";
  const users = {};
  for (const participant of project.participants) {
    users[participant.id] = {
      name: participant.name,
      ...(participant.avatar ? { avatar: resolveMedia(project, participant.avatar, assetMode, files) } : {}),
      ...(participant.bio ? { bio: participant.bio } : {})
    };
  }
  files["project.yml"] = yamlText({
    specVersion: AUTHORING_SPEC_VERSION,
    project: {
      id: project.id,
      title: project.title,
      entry: entryPath
    }
  });
  files["profiles.yml"] = yamlText({ users });
  files["chat.yml"] = yamlText({
    chat: {
      type: project.conversation.type || (project.participants.length > 2 ? "group" : "single"),
      self: project.selfId,
      title: project.conversation.title || project.title
    }
  });
  const frontmatter = yamlText({
    title: project.title,
    profiles: "../profiles.yml",
    chat: "../chat.yml",
    theme: project.theme,
    specVersion: AUTHORING_SPEC_VERSION
  }).trimEnd();
  const messages = project.conversation.messages
    .map((message) => serializeMessage(project, message, assetMode, files))
    .join("\n\n");
  files[entryPath] = `---\n${frontmatter}\n---\n\n${messages}\n`;
  return { files, entryPath, diagnostics: [] };
}

export function projectFilesToSource(files) {
  return new MemoryProjectSource(files);
}

function parseYamlFile(source, filePath) {
  const parsed = yaml.safeLoad(source.readText(filePath)) || {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath}: expected a YAML object`);
  }
  return parsed;
}

function resolveImportAsset(source, reference, baseDir, assets, assetIds) {
  const value = String(reference || "").trim();
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return value;
  const normalized = resolveProjectPath(baseDir, value);
  if (!source.exists(normalized) || !source.stat(normalized).isFile()) return value;
  if (assetIds.has(normalized)) return `asset:${assetIds.get(normalized)}`;
  const id = randomId("asset");
  assetIds.set(normalized, id);
  assets.push({
    id,
    fileName: normalized.split("/").pop() || `${id}.bin`,
    mimeType: mimeFromPath(normalized),
    dataUrl: bytesToDataUrl(source.readBinary(normalized), mimeFromPath(normalized))
  });
  return `asset:${id}`;
}

export function parseAuthoringProject(source) {
  const manifest = parseYamlFile(source, "project.yml");
  if (String(manifest.specVersion || "") !== AUTHORING_SPEC_VERSION) {
    throw new Error(`Unsupported project specVersion: ${manifest.specVersion || "missing"}`);
  }
  const entryPath = String(manifest.project?.entry || "conversations/main.md");
  const profilesWrap = parseYamlFile(source, "profiles.yml");
  const chatWrap = parseYamlFile(source, "chat.yml");
  const parsed = parseChatMarkdown(source.readText(entryPath));
  const assets = [];
  const assetIds = new Map();
  const participants = Object.entries(profilesWrap.users || {}).map(([id, profile]) => ({
    id,
    name: String(profile?.name || id),
    avatar: resolveImportAsset(source, profile?.avatar || "", ".", assets, assetIds),
    bio: String(profile?.bio || "")
  }));
  const messages = parsed.messages.map((message) => ({
    id: message.id,
    senderId: message.senderId,
    timeRaw: message.timeRaw || "",
    kind: message.kind,
    text: message.text || "",
    imageSource: message.kind === "image"
      ? resolveImportAsset(source, message.imageUrl || "", dirnameProjectPath(entryPath), assets, assetIds)
      : "",
    caption: message.kind === "image" ? String(message.text || "") : "",
    linkCard: message.kind === "link-card" ? {
      ...message.linkCard,
      image: resolveImportAsset(source, message.linkCard?.image || "", dirnameProjectPath(entryPath), assets, assetIds)
    } : undefined,
    quoteId: message.quote?.messageId || "",
    recallDelaySec: message.recall?.delayMs ? Math.round(message.recall.delayMs / 1000) : 0
  }));
  return {
    schemaVersion: AUTHORING_SPEC_VERSION,
    id: String(manifest.project?.id || randomId("project")),
    title: String(manifest.project?.title || parsed.frontmatter?.title || "未命名聊天作品"),
    theme: String(parsed.frontmatter?.theme || "wechat"),
    selfId: String(chatWrap.chat?.self || participants[0]?.id || ""),
    participants,
    conversation: {
      id: "main",
      title: String(chatWrap.chat?.title || manifest.project?.title || "聊天"),
      type: String(chatWrap.chat?.type || (participants.length > 2 ? "group" : "single")),
      messages
    },
    assets
  };
}

export function nextEntityId(prefix, existingIds = []) {
  const used = new Set(existingIds.map(String));
  let index = 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}
