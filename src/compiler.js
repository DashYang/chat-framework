import { createBuildReport } from "./build-report.js";
import { diagnosticFromError } from "./diagnostics.js";
import { loadDocumentYaml } from "./document-loader.js";
import { renderDocumentHtml } from "./document-renderer.js";
import { loadConversationFromMarkdown, loadProfiles } from "./load-conversation.js";
import { buildConversationModels, renderWechatHubHtml } from "./multi-renderer.js";
import {
  basenameProjectPath,
  resolveProjectPath
} from "./project-path.js";
import { assertProjectSource } from "./project-source.js";
import { renderHtml } from "./renderer.js";
import { validateStoryConfig } from "./story-config.js";
import { parseSimpleYaml } from "./yaml.js";

function success(html, metadata = {}) {
  return { html, diagnostics: [], referencedAssets: [], metadata };
}

function failure(error, path, kind) {
  return {
    diagnostics: [diagnosticFromError(error, { path })],
    referencedAssets: [],
    metadata: { kind }
  };
}

export function compileSingleProject({ source, inputPath }) {
  try {
    assertProjectSource(source);
    const conversation = loadConversationFromMarkdown(inputPath, { source });
    const html = renderHtml({
      frontmatter: conversation.frontmatter,
      profiles: conversation.profiles,
      articles: conversation.articles,
      chat: conversation.chat,
      messages: conversation.messages
    });
    return success(html, {
      kind: "single",
      sourceFile: inputPath,
      conversation
    });
  } catch (error) {
    return failure(error, inputPath, "single");
  }
}

function listMarkdownFiles(source, inputDir) {
  return source.list(inputDir)
    .filter((entry) => entry.type === "file" && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.path)
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function findProfilesPath(source, inputDir) {
  const dirPath = resolveProjectPath(inputDir, "profiles");
  if (source.exists(dirPath) && source.stat(dirPath).isDirectory()) return dirPath;
  const filePath = resolveProjectPath(inputDir, "profiles.yml");
  if (source.exists(filePath) && source.stat(filePath).isFile()) return filePath;
  return "";
}

function findArticlesPath(source, inputDir) {
  const dirPath = resolveProjectPath(inputDir, "articles");
  if (source.exists(dirPath) && source.stat(dirPath).isDirectory()) return dirPath;
  return "";
}

function collectConversationEntriesFromProfiles(source, inputDir, profiles) {
  const rows = [];
  const articlesPath = findArticlesPath(source, inputDir);
  for (const [profileId, profile] of Object.entries(profiles.users || {})) {
    const chatFiles = Array.isArray(profile.chatFiles) ? profile.chatFiles : [];
    const groupChats = (profile.groupChats && typeof profile.groupChats === "object") ? profile.groupChats : {};
    for (const raw of chatFiles) {
      const rel = String(raw || "").trim();
      if (!rel) continue;
      const mdPath = resolveProjectPath(inputDir, rel);
      if (!source.exists(mdPath)) {
        throw new Error(`[profile:${profileId}] chat file not found: ${rel}. Fix: check profile.chatFiles path relative to the build input folder.`);
      }
      const mapped = groupChats[rel] || groupChats[basenameProjectPath(rel)] || "";
      const chatPath = mapped ? resolveProjectPath(inputDir, String(mapped)) : "";
      if (chatPath && !source.exists(chatPath)) {
        throw new Error(`[profile:${profileId}] group chat yml not found: ${mapped}. Fix: check profile.groupChats mapping, or remove it for single chats.`);
      }
      rows.push({ mdPath, selfId: profileId, chatPath, articlesPath });
    }
  }
  return rows;
}

function loadOptionalConfig(source, inputDir, fileName, rootKey) {
  const configPath = resolveProjectPath(inputDir, fileName);
  if (!source.exists(configPath)) return {};
  const parsed = parseSimpleYaml(source.readText(configPath));
  return parsed[rootKey] || {};
}

export function compileFolderProject({ source, inputDir }) {
  try {
    assertProjectSource(source);
    const profilesPath = findProfilesPath(source, inputDir);
    const profiles = profilesPath ? loadProfiles(profilesPath, { source }) : null;
    const profileEntries = profiles ? collectConversationEntriesFromProfiles(source, inputDir, profiles) : [];
    const fallbackMdFiles = listMarkdownFiles(source, inputDir);
    if (!profileEntries.length && fallbackMdFiles.length === 0) {
      throw new Error(`No chat sources found in folder: ${inputDir}`);
    }

    const sources = profileEntries.length
      ? profileEntries
      : fallbackMdFiles.map((mdPath) => ({
        mdPath,
        selfId: "",
        chatPath: "",
        profilePath: profilesPath || "",
        profiles
      }));

    const conversations = sources.map((entry) => loadConversationFromMarkdown(entry.mdPath, {
      source,
      selfId: entry.selfId || undefined,
      chatPath: entry.chatPath || undefined,
      profilePath: entry.profilePath || undefined,
      articlesPath: entry.articlesPath || undefined,
      resourceRootDir: inputDir,
      profiles
    }));
    const models = buildConversationModels(conversations);
    const title = basenameProjectPath(inputDir);
    const ui = loadOptionalConfig(source, inputDir, "ui.yml", "ui");
    const story = loadOptionalConfig(source, inputDir, "story.yml", "story");
    validateStoryConfig(story, models);
    const html = renderWechatHubHtml({ title, conversations: models, ui, story });
    const report = createBuildReport({ conversations, ui, story });
    return success(html, {
      kind: "folder",
      inputDir,
      conversationCount: conversations.length,
      conversations,
      ui,
      story,
      report
    });
  } catch (error) {
    return failure(error, inputDir, "folder");
  }
}

export function compileDocumentProject({ source, inputPath, outputPath }) {
  try {
    assertProjectSource(source);
    const document = loadDocumentYaml(inputPath, outputPath, { source });
    const html = renderDocumentHtml(document);
    return success(html, {
      kind: "document",
      inputPath,
      documentType: document.type,
      itemCount: document.items.length,
      document
    });
  } catch (error) {
    return failure(error, inputPath, "document");
  }
}
