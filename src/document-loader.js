import yaml from "js-yaml";

import { renderArticleMarkdown, renderArticleMarkdownInline } from "./article-renderer.js";
import {
  dirnameProjectPath,
  relativeProjectPath,
  resolveProjectPath
} from "./project-path.js";
import { assertProjectSource } from "./project-source.js";

const DOCUMENT_TYPES = new Set(["characters", "settings", "timeline"]);
const THEMES = new Set(["wechat", "paper", "iterms"]);
const DEFAULT_TITLES = {
  characters: "人物介绍",
  settings: "设定",
  timeline: "时间线"
};
const DEFAULT_HEADER_INDEXES = {
  characters: "01",
  settings: "02",
  timeline: "03"
};

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(inputPath, message) {
  throw new Error(`${inputPath}: ${message}`);
}

function requireString(item, field, inputPath, index, { allowEmpty = false } = {}) {
  if (typeof item[field] !== "string") {
    fail(inputPath, `items[${index}].${field} must be a string`);
  }
  const value = item[field].trim();
  if (!allowEmpty && !value) {
    fail(inputPath, `items[${index}].${field} is required`);
  }
  return value;
}

function isExternalOrAbsoluteUrl(value) {
  return /^[a-z][a-z\d+.-]*:/i.test(value)
    || value.startsWith("//")
    || value.startsWith("/")
    || value.startsWith("#");
}

function splitPathSuffix(value) {
  const match = String(value).match(/^([^?#]*)([?#].*)?$/);
  return {
    pathname: match?.[1] || "",
    suffix: match?.[2] || ""
  };
}

export function rebaseDocumentAsset(raw, inputPath, outputPath) {
  const value = String(raw || "").trim();
  if (!value || isExternalOrAbsoluteUrl(value)) return value;
  const { pathname, suffix } = splitPathSuffix(value);
  if (!pathname) return value;
  const absolute = resolveProjectPath(dirnameProjectPath(inputPath), pathname);
  let relative = relativeProjectPath(dirnameProjectPath(outputPath), absolute);
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative + suffix;
}

function normalizeBase(raw, inputPath) {
  if (!isObject(raw)) fail(inputPath, "document root must be a YAML object");
  if (typeof raw.type !== "string" || !DOCUMENT_TYPES.has(raw.type)) {
    fail(inputPath, `type must be one of: ${Array.from(DOCUMENT_TYPES).join(", ")}`);
  }
  if (raw.title !== undefined && typeof raw.title !== "string") {
    fail(inputPath, "title must be a string");
  }
  if (raw.theme !== undefined && (typeof raw.theme !== "string" || !THEMES.has(raw.theme))) {
    fail(inputPath, `theme must be one of: ${Array.from(THEMES).join(", ")}`);
  }
  if (raw.headerIndex !== undefined && !["string", "number"].includes(typeof raw.headerIndex)) {
    fail(inputPath, "headerIndex must be a string or number");
  }
  if (raw.footerText !== undefined && typeof raw.footerText !== "string") {
    fail(inputPath, "footerText must be a string");
  }
  if (!Array.isArray(raw.items)) fail(inputPath, "items must be an array");
  if (!raw.items.length) fail(inputPath, "items must contain at least one entry");
  return {
    type: raw.type,
    title: String(raw.title || DEFAULT_TITLES[raw.type]),
    theme: raw.theme || "iterms",
    headerIndex: raw.headerIndex === undefined
      ? DEFAULT_HEADER_INDEXES[raw.type]
      : String(raw.headerIndex),
    footerText: raw.footerText === undefined ? "> END OF FILE" : raw.footerText
  };
}

function markdownOptions(inputPath, outputPath) {
  return {
    resolveImageUrl: (url) => rebaseDocumentAsset(url, inputPath, outputPath)
  };
}

function normalizeCharacter(item, inputPath, outputPath, index) {
  const avatar = requireString(item, "avatar", inputPath, index);
  const name = requireString(item, "name", inputPath, index);
  const identity = requireString(item, "identity", inputPath, index);
  const status = requireString(item, "status", inputPath, index);
  const description = requireString(item, "description", inputPath, index);
  const mdOptions = markdownOptions(inputPath, outputPath);
  return {
    avatar: rebaseDocumentAsset(avatar, inputPath, outputPath),
    name,
    identityHtml: renderArticleMarkdownInline(identity, mdOptions),
    statusHtml: renderArticleMarkdownInline(status, mdOptions),
    descriptionHtml: renderArticleMarkdown(description, mdOptions)
  };
}

function normalizeSetting(item, inputPath, outputPath, index) {
  const image = requireString(item, "image", inputPath, index);
  const name = requireString(item, "name", inputPath, index);
  const description = requireString(item, "description", inputPath, index);
  return {
    image: rebaseDocumentAsset(image, inputPath, outputPath),
    name,
    descriptionHtml: renderArticleMarkdown(
      description,
      markdownOptions(inputPath, outputPath)
    )
  };
}

function normalizeTimeline(item, inputPath, outputPath, index) {
  const time = requireString(item, "time", inputPath, index);
  const description = requireString(item, "description", inputPath, index);
  const image = item.image === undefined
    ? ""
    : requireString(item, "image", inputPath, index, { allowEmpty: true });
  if (!Array.isArray(item.participants) || !item.participants.length) {
    fail(inputPath, `items[${index}].participants must be a non-empty array of names`);
  }
  const participants = item.participants.map((participant, participantIndex) => {
    if (typeof participant !== "string" || !participant.trim()) {
      fail(inputPath, `items[${index}].participants[${participantIndex}] must be a non-empty string`);
    }
    return participant.trim();
  });
  const mdOptions = markdownOptions(inputPath, outputPath);
  return {
    image: rebaseDocumentAsset(image, inputPath, outputPath),
    timeHtml: renderArticleMarkdownInline(time, mdOptions),
    descriptionHtml: renderArticleMarkdown(description, mdOptions),
    participants
  };
}

export function parseDocumentYaml(rawYaml, { inputPath = "document.yml", outputPath = "document.html" } = {}) {
  let parsed;
  try {
    parsed = yaml.safeLoad(String(rawYaml || ""));
  } catch (error) {
    const wrapped = new Error(`${inputPath}: invalid YAML: ${error.message}`);
    wrapped.mark = error.mark;
    throw wrapped;
  }
  const base = normalizeBase(parsed, inputPath);
  const normalizeItem = base.type === "characters"
    ? normalizeCharacter
    : base.type === "settings"
      ? normalizeSetting
      : normalizeTimeline;
  const items = parsed.items.map((item, index) => {
    if (!isObject(item)) fail(inputPath, `items[${index}] must be an object`);
    return normalizeItem(item, inputPath, outputPath, index);
  });
  return { ...base, items };
}

export function loadDocumentYaml(inputPath, outputPath, options = {}) {
  const source = assertProjectSource(options.source);
  const absoluteInput = resolveProjectPath(".", inputPath);
  const absoluteOutput = resolveProjectPath(".", outputPath);
  const raw = source.readText(absoluteInput);
  return parseDocumentYaml(raw, {
    inputPath: absoluteInput,
    outputPath: absoluteOutput
  });
}
