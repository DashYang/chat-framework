import fs from "fs";
import path from "path";
import { parseSimpleYaml } from "./yaml.js";
import { parseChatMarkdown } from "./parser.js";
import { resolveQuotes, resolveTimes } from "./time.js";
import { annotateConversationMentions } from "./mentions.js";
import { parseMarkdownArticle, renderArticleMarkdown } from "./article-renderer.js";

/**
 * Read UTF-8 text from disk.
 *
 * @param {string} filePath - Absolute or relative file path.
 * @returns {string} File content.
 *
 * @example
 * const text = readText('/tmp/a.md')
 */
export function readText(filePath) {
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Validate sender IDs and message IDs in one conversation.
 *
 * @param {Array<Record<string, unknown>>} messages - Parsed messages.
 * @param {{ users?: Record<string, unknown> }} profiles - Profiles config.
 * @returns {void}
 * @throws {Error} When duplicate ids or unknown sender exists.
 *
 * @example
 * validateMessages(messages, profiles)
 */
export function validateMessages(messages, profiles, context = {}) {
  const ids = new Set();
  for (const m of messages) {
    if (ids.has(m.id)) throw new Error(`Duplicate message id: ${m.id}`);
    ids.add(m.id);
    if (!profiles.users?.[m.senderId]) {
      throw new Error(buildUnknownSenderMessage(m.senderId, profiles, context));
    }
  }
}

function formatPathForError(filePath) {
  if (!filePath) return "";
  const rel = path.relative(process.cwd(), filePath);
  if (!rel || rel.startsWith("..")) return filePath;
  return rel;
}

function buildUnknownSenderMessage(senderId, profiles, context = {}) {
  const knownSenderIds = Object.keys(profiles.users || {}).sort((a, b) => a.localeCompare(b, "zh-CN"));
  const shownSenderIds = knownSenderIds.slice(0, 8);
  const suffix = knownSenderIds.length > shownSenderIds.length ? ", ..." : "";
  const profilePath = context.profilePath ? formatPathForError(context.profilePath) : "the configured profiles source";
  const profileSource = context.profileIsDirectory
    ? `profile file names in ${profilePath}`
    : `profile ids in ${profilePath}`;
  const fixHint = context.profileIsDirectory
    ? `Fix: add a profile file named "${senderId}.yml" in ${profilePath}, or change the markdown sender id to an existing profile id.`
    : `Fix: add a profile entry keyed by "${senderId}" in ${profilePath}, or change the markdown sender id to an existing profile id.`;
  const knownHint = shownSenderIds.length
    ? ` Known sender ids: ${shownSenderIds.join(", ")}${suffix}`
    : "";
  return `Unknown sender "${senderId}". Sender ids must match ${profileSource}. ${fixHint}${knownHint}`;
}

function parseIdentityReference(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T00:00:00`
    : text.replace(" ", "T");
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? null : time;
}

function normalizeIdentityTimeline(timeline) {
  const out = [];
  for (const [effectiveAt, identity] of Object.entries(timeline || {})) {
    if (!identity || typeof identity !== "object" || Array.isArray(identity)) continue;
    const effectiveAtMs = parseIdentityReference(effectiveAt);
    if (effectiveAtMs === null) continue;
    out.push({
      effectiveAt,
      effectiveAtMs,
      name: Object.prototype.hasOwnProperty.call(identity, "name") ? String(identity.name || "") : undefined,
      bio: Object.prototype.hasOwnProperty.call(identity, "bio") ? String(identity.bio || "") : undefined,
      avatar: Object.prototype.hasOwnProperty.call(identity, "avatar") ? String(identity.avatar || "") : undefined
    });
  }
  out.sort((a, b) => a.effectiveAtMs - b.effectiveAtMs);
  return out;
}

function hasNonEmptyIdentityTimeline(timeline) {
  if (!timeline) return false;
  if (Array.isArray(timeline)) return timeline.length > 0;
  if (typeof timeline !== "object") return false;
  return Object.keys(timeline).length > 0;
}

function validateRawProfile(id, profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return;
  if (Object.prototype.hasOwnProperty.call(profile, "name") && hasNonEmptyIdentityTimeline(profile.identityTimeline)) {
    throw new Error(`Profile "${id}" violates the exclusivity rule: profile.name and identityTimeline cannot coexist.`);
  }
  if (profile.identityTimeline !== undefined && (typeof profile.identityTimeline !== "object" || Array.isArray(profile.identityTimeline))) {
    throw new Error(`Profile "${id}" has invalid identityTimeline. It must be a date-keyed object, e.g. identityTimeline: { "2024-01-01": { name: "Alice" } }.`);
  }
  const misplaced = Object.keys(profile).filter((key) => /^\d{4}-\d{2}-\d{2}/.test(key));
  if (misplaced.length && !profile.identityTimeline) {
    throw new Error(`Profile "${id}" has date keys outside identityTimeline: ${misplaced.slice(0, 3).join(", ")}. Move them under profile.identityTimeline.`);
  }
}

export function resolveProfileIdentity(user, referenceTime) {
  const refMs = parseIdentityReference(referenceTime) ?? Date.now();
  let name = user?.name || user?.id || "";
  let bio = user?.bio || "";
  let avatar = user?.avatar || "";
  const timeline = Array.isArray(user?.identityTimeline) ? user.identityTimeline : [];
  for (const entry of timeline) {
    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.effectiveAtMs !== "number" || entry.effectiveAtMs > refMs) continue;
    if (entry.name !== undefined) name = entry.name;
    if (entry.bio !== undefined) bio = entry.bio;
    if (entry.avatar !== undefined) avatar = entry.avatar;
  }
  return { name, bio, avatar };
}

function resolveStaticProfileName(user) {
  if (!user) return "";
  return user.__hasExplicitName ? String(user.name || "").trim() : "";
}

function hasTimelineProfileName(user) {
  const timeline = Array.isArray(user?.identityTimeline) ? user.identityTimeline : [];
  return timeline.some((entry) => entry && String(entry.name || "").trim());
}

function formatSingleChatTitleError({ selfId, peerId, selfProfile, peerProfile }) {
  const aliasTitle = String(selfProfile?.aliases?.contacts?.[peerId] || "").trim();
  const explicitName = resolveStaticProfileName(peerProfile);
  const timelineNames = (Array.isArray(peerProfile?.identityTimeline) ? peerProfile.identityTimeline : [])
    .map((entry) => String(entry?.name || "").trim())
    .filter(Boolean);
  return [
    `single chat title cannot be inferred for peer "${peerId}".`,
    `Checked sources: aliases.contacts.${peerId}=${aliasTitle ? JSON.stringify(aliasTitle) : "(missing)"}, profile.name=${explicitName ? JSON.stringify(explicitName) : "(missing)"}, identityTimeline.name=${timelineNames.length ? timelineNames.join(", ") : "(missing)"}.`,
    `Fix: add chat.title, set aliases.contacts.${peerId} on self "${selfId}", or define profile.name / identityTimeline.name for "${peerId}".`
  ].join(" ");
}

function normalizeUserProfile(id, parsed) {
  const profile = parsed.profile || parsed || {};
  validateRawProfile(id, profile);
  const explicitName = Object.prototype.hasOwnProperty.call(profile, "name") ? String(profile.name || "").trim() : "";
  const officialArticles = profile.officialArticles || {};
  const rawArticleRefs = Array.isArray(officialArticles)
    ? officialArticles.map((x) => String(x))
    : Object.keys(officialArticles).map((x) => String(x));
  const defaultView = ["chat", "doc", "social"].includes(profile.defaultView)
    ? profile.defaultView
    : "chat";
  const out = {
    name: explicitName || id,
    id,
    avatar: profile.avatar || "",
    bio: profile.bio || "",
    nickName: profile.nickName || profile.name || id,
    identityTimeline: normalizeIdentityTimeline(profile.identityTimeline),
    aliases: {
      selfInGroups: profile.aliases?.selfInGroups || {},
      contacts: profile.aliases?.contacts || {}
    },
    moments: profile.moments || {},
    officialArticles: rawArticleRefs.map(normalizeArticleRef),
    chatFiles: Array.isArray(profile.chatFiles) ? profile.chatFiles.map((x) => String(x)) : [],
    groupChats: profile.groupChats || {},
    defaultView
  };
  Object.defineProperty(out, "__rawOfficialArticleRefs", {
    value: rawArticleRefs,
    enumerable: false
  });
  Object.defineProperty(out, "__hasExplicitName", {
    value: Boolean(explicitName),
    enumerable: false
  });
  return out;
}

const ARTICLE_FILE_EXT_RE = /\.(ya?ml|md|markdown)$/i;

function articleIdFromFileName(fileName) {
  return path.basename(String(fileName || "")).replace(ARTICLE_FILE_EXT_RE, "");
}

function normalizeArticle(id, parsed) {
  const article = parsed.article || {};
  const images = Array.isArray(article.images) ? article.images : (article.images ? [article.images] : []);
  const text = article.markdown || article.body || article.text || article.content || "";
  return {
    id,
    title: article.title || id,
    author: article.author || "",
    publishAt: article.publishAt || article.time || "",
    cover: article.cover || "",
    summary: article.summary || article.desc || "",
    text,
    html: article.html || renderArticleMarkdown(text),
    images
  };
}

function normalizeArticleRef(ref) {
  const value = String(ref || "").trim();
  if (!value) return "";
  return isExplicitArticleFileRef(value)
    ? articleIdFromFileName(value)
    : value;
}

function loadProfilesFromDirectory(dirPath) {
  const users = {};
  const files = fs
    .readdirSync(dirPath)
    .filter((name) => /\.(ya?ml)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "zh-CN"));

  for (const fileName of files) {
    const id = fileName.replace(/\.(ya?ml)$/i, "");
    const parsed = parseSimpleYaml(readText(path.join(dirPath, fileName)));
    users[id] = normalizeUserProfile(id, parsed);
  }

  return { users };
}

export function loadProfiles(profilePath) {
  const stat = fs.statSync(profilePath);
  if (stat.isDirectory()) {
    return loadProfilesFromDirectory(profilePath);
  }

  const parsed = parseSimpleYaml(readText(profilePath));
  const usersRaw = parsed.users || parsed;
  const users = {};
  for (const [id, profile] of Object.entries(usersRaw || {})) {
    users[id] = normalizeUserProfile(id, profile);
  }
  return { users };
}

function loadArticlesFromDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return {};
  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) return {};
  const articles = {};
  const sources = {};
  const files = fs
    .readdirSync(dirPath)
    .filter((name) => ARTICLE_FILE_EXT_RE.test(name))
    .sort((a, b) => a.localeCompare(b, "zh-CN"));

  for (const fileName of files) {
    const id = articleIdFromFileName(fileName);
    if (Object.prototype.hasOwnProperty.call(articles, id)) {
      throw new Error(`Duplicate article id "${id}" from ${sources[id]} and ${path.join(dirPath, fileName)}. Fix: keep only one .md/.yml article file per id, or rename one file.`);
    }
    const filePath = path.join(dirPath, fileName);
    articles[id] = loadArticleFromFile(filePath, id);
    sources[id] = filePath;
  }
  return articles;
}

function isExplicitArticleFileRef(ref) {
  return ARTICLE_FILE_EXT_RE.test(String(ref || "").trim());
}

function firstMarkdownHeading(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  for (const line of lines) {
    const match = line.match(/^#\s+(.+?)\s*$/);
    if (match) return match[1].trim();
  }
  return "";
}

function normalizeMarkdownArticle(articleKey, raw) {
  const { data, content } = parseMarkdownArticle(raw);
  const article = data.article && typeof data.article === "object"
    ? data.article
    : data;
  const parsed = {
    article: {
      ...article,
      title: article.title || firstMarkdownHeading(content) || articleKey,
      markdown: content
    }
  };
  return normalizeArticle(articleKey, parsed);
}

function loadArticleFromFile(filePath, articleKey) {
  const raw = readText(filePath);
  if (/\.(md|markdown)$/i.test(filePath)) {
    return normalizeMarkdownArticle(articleKey, raw);
  }
  const parsed = parseSimpleYaml(raw);
  return normalizeArticle(articleKey, parsed);
}

function mergeExplicitOfficialArticles(target, profiles, baseDir) {
  const users = profiles?.users || {};
  for (const user of Object.values(users)) {
    const refs = Array.isArray(user?.__rawOfficialArticleRefs)
      ? user.__rawOfficialArticleRefs
      : (Array.isArray(user?.officialArticles) ? user.officialArticles : []);
    for (const rawRef of refs) {
      const ref = String(rawRef || "").trim();
      if (!ref || !isExplicitArticleFileRef(ref)) continue;
      const articleId = normalizeArticleRef(ref);
      if (Object.prototype.hasOwnProperty.call(target, articleId)) continue;
      const filePath = path.resolve(baseDir, ref);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw new Error(`Official article file not found: ${ref}. Fix: check profile.officialArticles path relative to the build input folder, or use an existing article id.`);
      }
      target[articleId] = loadArticleFromFile(filePath, articleId);
    }
  }
}

function mergeDocLinkCardArticles(target, messages, resourceRootDir) {
  for (const msg of messages) {
    if (msg.kind !== "link-card") continue;
    const card = msg.linkCard || {};
    const docPath = (card.doc || card.ref || "").trim();
    if (!docPath || !isExplicitArticleFileRef(docPath)) continue;
    const articleId = normalizeArticleRef(docPath);
    if (Object.prototype.hasOwnProperty.call(target, articleId)) continue;
    const filePath = path.resolve(resourceRootDir, docPath);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new Error(`link-card doc file not found: ${docPath}. Fix: check [link-card] doc/ref path relative to the markdown resource root.`);
    }
    target[articleId] = loadArticleFromFile(filePath, articleId);
  }
}

/**
 * Load one markdown chat file with linked YAML config and normalized messages.
 *
 * @param {string} markdownPath - Path to chat markdown file.
 * @returns {{
 *   sourceFile: string,
 *   frontmatter: Record<string, unknown>,
 *   profiles: Record<string, unknown>,
 *   chat: Record<string, unknown>,
 *   messages: Array<Record<string, unknown>>
 * }} Full conversation payload.
 *
 * @example
 * const conv = loadConversationFromMarkdown('examples/chat.md')
 */
export function loadConversationFromMarkdown(markdownPath, options = {}) {
  try {
    const rootDir = path.dirname(markdownPath);
    const resourceRootDir = options.resourceRootDir
      ? path.resolve(options.resourceRootDir)
      : rootDir;
    const md = readText(markdownPath);
    const parsed = parseChatMarkdown(md);

    const profilePath = options.profilePath
      ? path.resolve(options.profilePath)
      : path.resolve(rootDir, parsed.frontmatter.profiles || "profiles.yml");
    const chatPath = options.chatPath
      ? path.resolve(options.chatPath)
      : (parsed.frontmatter.chat ? path.resolve(rootDir, parsed.frontmatter.chat) : "");

    const articlesPath = options.articlesPath
      ? path.resolve(options.articlesPath)
      : path.resolve(rootDir, parsed.frontmatter.articles || "articles");
    const profiles = options.profiles || loadProfiles(profilePath);
    const profileStat = fs.statSync(profilePath);
    const articles = loadArticlesFromDirectory(articlesPath);
    mergeExplicitOfficialArticles(articles, profiles, resourceRootDir);
    mergeDocLinkCardArticles(articles, parsed.messages, resourceRootDir);
    const chatWrap = chatPath ? parseSimpleYaml(readText(chatPath)) : {};
    const chat = normalizeChat(chatWrap.chat || {}, parsed.messages, profiles, options.selfId);

    validateMessages(parsed.messages, profiles, {
      profilePath,
      profileIsDirectory: profileStat.isDirectory()
    });
    annotateConversationMentions({
      messages: parsed.messages,
      profiles,
      articles,
      chat,
      sourceFile: formatPathForError(markdownPath)
    });
    const withTime = resolveTimes(parsed.messages);
    const messages = resolveQuotes(withTime);

    return {
      sourceFile: markdownPath,
      frontmatter: parsed.frontmatter,
      profiles,
      articles,
      chat,
      messages
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`[${formatPathForError(markdownPath)}] ${reason}`);
  }
}

function normalizeChat(chat, messages, profiles, selfId) {
  const out = { ...chat };
  const participants = Array.from(new Set(messages.map((m) => String(m.senderId))));
  const inferredType = participants.length > 2 ? "group" : "single";
  const type = out.type || inferredType;
  out.type = type;
  out.self = out.self || selfId || "";
  if (!out.self) throw new Error("chat.self is required (or provide selfId from profile)");
  if (!profiles.users?.[out.self]) throw new Error(`chat.self not found in profiles: ${out.self}`);
  if (!participants.includes(out.self)) {
    throw new Error(`chat.self is not a sender in messages: ${out.self}`);
  }

  if (type === "single") {
    const peers = participants.filter((id) => id !== out.self);
    out.peer = peers[0] || out.self;
    if (peers.length > 1) {
      throw new Error(`single chat can only contain one peer, got: ${peers.join(", ")}`);
    }
    if (!out.title) {
      const selfProfile = profiles.users?.[out.self] || {};
      const peerProfile = profiles.users?.[out.peer] || {};
      const aliasTitle = String(selfProfile.aliases?.contacts?.[out.peer] || "").trim();
      const profileTitle = resolveStaticProfileName(peerProfile);
      const hasStageIdentityTitle = hasTimelineProfileName(peerProfile);
      out.title = aliasTitle || profileTitle;
      out.titleSource = aliasTitle ? "alias" : (profileTitle ? "profile.name" : "");
      if (!out.title && hasStageIdentityTitle) {
        out.titleUsesStageIdentity = true;
        out.titleSource = "identityTimeline";
      }
      if (!out.title && !hasStageIdentityTitle) {
        throw new Error(formatSingleChatTitleError({
          selfId: out.self,
          peerId: out.peer,
          selfProfile,
          peerProfile
        }));
      }
    } else {
      out.titleSource = "chat.title";
    }
  } else {
    if (!out.title) throw new Error("group chat requires chat.title");
    const groupAvatar = out.groupInfo?.avatar || out.avatar || "";
    out.groupInfo = { avatar: groupAvatar };
  }

  return out;
}
