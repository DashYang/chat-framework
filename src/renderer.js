import { themes } from "./themes.js";
import { imageViewerRuntimeSource } from "./article-markdown.js";
import { highlightEffectRuntimeSource } from "./highlight-effect.js";

const choiceCss = `
.choice-panel{display:flex;flex-direction:column;gap:8px;min-width:190px;white-space:normal}
.choice-prompt{font-size:14px;line-height:1.45;color:var(--text,var(--ink,#222))}
.choice-option{width:100%;border:1px solid var(--line,#ddd);background:#f7f7f7;border-radius:8px;padding:8px 10px;text-align:left;color:#222;cursor:pointer;font-size:14px;line-height:1.35}
.choice-option.selected{border-color:var(--green,#07c160);background:#eefbf3;color:#047a3c;font-weight:600}
.choice-option:disabled{cursor:default;opacity:.86}
[data-theme="iterms"] .choice-option{background:#0a0d14;border-color:#18351d;border-radius:2px;color:var(--text);font-family:var(--mono)}
[data-theme="iterms"] .choice-option.selected{background:#0d1a12;border-color:var(--accent);color:var(--accent);box-shadow:0 0 8px rgba(0,255,65,.16)}
`;

const statusCss = `
.end-tip{font-size:12px;color:var(--muted);text-align:center;margin:16px 0 4px}
`;

const WECHAT_EMOJI_MAP = {
  微笑: "🙂",
  撇嘴: "😒",
  色: "😍",
  发呆: "😳",
  得意: "😎",
  流泪: "😢",
  害羞: "☺️",
  闭嘴: "🤐",
  睡: "😴",
  大哭: "😭",
  尴尬: "😅",
  发怒: "😠",
  调皮: "😜",
  呲牙: "😁",
  惊讶: "😮",
  难过: "😞",
  酷: "😎",
  冷汗: "😓",
  抓狂: "😫",
  吐: "🤮",
  偷笑: "🤭",
  愉快: "😄",
  白眼: "🙄",
  傲慢: "😤",
  困: "🥱",
  惊恐: "😱",
  憨笑: "😄",
  悠闲: "😌",
  咒骂: "🤬",
  疑问: "❓",
  嘘: "🤫",
  晕: "😵",
  衰: "🥴",
  骷髅: "💀",
  敲打: "👊",
  再见: "👋",
  擦汗: "😓",
  抠鼻: "👃",
  鼓掌: "👏",
  坏笑: "😏",
  左哼哼: "😤",
  右哼哼: "😤",
  哈欠: "🥱",
  鄙视: "😒",
  委屈: "🥺",
  快哭了: "🥹",
  阴险: "😈",
  亲亲: "😘",
  吓: "😨",
  可怜: "🥺",
  菜刀: "🔪",
  西瓜: "🍉",
  啤酒: "🍺",
  咖啡: "☕",
  蛋糕: "🍰",
  玫瑰: "🌹",
  凋谢: "🥀",
  爱心: "❤️",
  心碎: "💔",
  强: "👍",
  弱: "👎",
  握手: "🤝",
  胜利: "✌️",
  抱拳: "🙏",
  勾引: "👉",
  拳头: "👊",
  OK: "👌",
  跳跳: "💃",
  发抖: "🫨",
  怄火: "😤",
  转圈: "🌀",
  捂脸: "🤦",
  奸笑: "😏",
  机智: "🧠",
  皱眉: "😣",
  耶: "✌️",
  旺柴: "🐶",
  社会社会: "😎",
  吃瓜: "🍉",
  加油: "💪",
  汗: "😓",
  天啊: "😱",
  Emm: "😶",
  让我看看: "👀",
  叹气: "😮‍💨",
  苦涩: "😖",
  裂开: "🫠"
};

/**
 * Escape HTML special chars to prevent markup injection.
 *
 * @param {string} [s=""] - Input text.
 * @returns {string} Escaped HTML string.
 *
 * @example
 * escapeHtml('<b>x</b>') // => '&lt;b&gt;x&lt;/b&gt;'
 */
function escapeHtml(s = "") {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(data) {
  return JSON.stringify(data)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

/**
 * Convert plain URLs in text to clickable anchors.
 *
 * @param {string} text - Plain text content.
 * @returns {string} HTML with URL anchors.
 *
 * @example
 * linkify('visit https://example.com')
 */
function linkify(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a class="inline-link" href="$1" target="_blank" rel="noreferrer">$1</a>');
}

/**
 * Convert WeChat emoji aliases like [微笑] into Unicode emoji.
 *
 * @param {string} text - Plain text content.
 * @returns {string} Text with converted emoji.
 */
function emojify(text) {
  return String(text || "").replace(/\[([^\[\]]+)\]/g, (m, key) => WECHAT_EMOJI_MAP[key] || m);
}

/**
 * Format plain message text to final HTML.
 *
 * @param {string} text - Plain text.
 * @param {Array<{ start: number, end: number }>} [mentions] - Build-time mention ranges.
 * @returns {string} HTML fragment.
 */
function formatText(text, mentions = []) {
  const source = String(text || "");
  const ranges = Array.isArray(mentions) ? mentions : [];
  if (!ranges.length) return linkify(emojify(source));

  let html = "";
  let cursor = 0;
  for (const range of ranges) {
    const start = Math.max(0, Math.min(Number(range.start), source.length));
    const end = Math.max(start, Math.min(Number(range.end), source.length));
    if (start < cursor || end <= start) continue;
    html += linkify(emojify(source.slice(cursor, start)));
    html += `<span class="mention">${escapeHtml(source.slice(start, end))}</span>`;
    cursor = end;
  }
  html += linkify(emojify(source.slice(cursor)));
  return html;
}

/**
 * Format duration seconds for voice bubble label.
 *
 * @param {number | undefined} sec - Seconds.
 * @returns {string} Label text.
 */
function formatVoiceDuration(sec) {
  const n = Number(sec || 0);
  return n > 0 ? `${n}"` : "语音";
}

function articleKeyFromDoc(doc) {
  if (!doc) return "";
  const s = String(doc).trim();
  if (!/\.(ya?ml|md|markdown)$/i.test(s)) return s;
  const parts = s.split("/");
  const base = parts[parts.length - 1];
  return base.replace(/\.(ya?ml|md|markdown)$/i, "");
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

function resolveEffectiveProfileName(user, referenceTime = Date.now()) {
  const refMs = parseIdentityReference(referenceTime) ?? Date.now();
  let name = user?.name || "";
  const timeline = Array.isArray(user?.identityTimeline) ? user.identityTimeline : [];
  for (const entry of timeline) {
    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.effectiveAtMs !== "number" || entry.effectiveAtMs > refMs) continue;
    if (entry.name !== undefined) name = entry.name;
  }
  return name;
}

function resolveDisplayName(senderId, ctx, isSelf = false) {
  const user = ctx.profiles.users[senderId] || {};
  const selfId = ctx.chat?.self;
  const selfProfile = ctx.profiles.users[selfId] || {};
  
  if (ctx.chat?.type === "group" && isSelf) {
    return selfProfile.aliases?.selfInGroups?.[ctx.chat.title] || resolveEffectiveProfileName(selfProfile) || senderId;
  }
  return selfProfile.aliases?.contacts?.[senderId] || resolveEffectiveProfileName(user) || senderId;
}

function renderQuote(q, ctx) {
  const sender = resolveDisplayName(q.senderId, ctx, q.senderId === ctx.chat?.self);
  return `<div class="quote"><div>${escapeHtml(sender)} · ${escapeHtml(q.timeText || "")}</div><div>${escapeHtml(q.snippet || "")}</div></div>`;
}

/**
 * Render message payload content by kind.
 *
 * @param {Record<string, unknown>} m - Message object.
 * @returns {string} Message content HTML.
 *
 * @example
 * renderContent({ kind:'image', imageUrl:'https://...' })
 */
function resolveArticleCard(m, ctx) {
  const a = m.articleCard || {};
  const refId = articleKeyFromDoc(a.refId || "");
  if (!refId) return a;
  const fromRepo = ctx.articles?.[refId] || {};
  return {
    refId,
    title: fromRepo.title || a.title || "",
    author: fromRepo.author || a.author || "",
    cover: fromRepo.cover || a.cover || "",
    summary: fromRepo.summary || a.summary || "",
    summaryMentions: fromRepo.summaryMentions || a.summaryMentions || [],
    text: fromRepo.text || a.text || "",
    html: fromRepo.html || a.html || "",
    images: Array.isArray(fromRepo.images) ? fromRepo.images : (a.images || []),
    publishAt: fromRepo.publishAt || ""
  };
}

function resolveContactCard(m, ctx) {
  const raw = m.contactCard || {};
  const fromProfile = raw.refId ? (ctx.profiles?.users?.[raw.refId] || {}) : {};
  return {
    refId: raw.refId || "",
    name: fromProfile.name || raw.name || raw.refId || "",
    nickName: fromProfile.nickName || raw.nickName || fromProfile.name || raw.name || raw.refId || "",
    avatar: fromProfile.avatar || raw.avatar || "",
    bio: fromProfile.bio || raw.bio || ""
  };
}

function renderContent(m, ctx) {
  if (m.kind === "image") {
    const caption = m.text ? `<div class="img-caption">${formatText(m.text, m.mentions)}</div>` : "";
    return `<img class="img" src="${escapeHtml(m.imageUrl || "")}" data-preview-src="${escapeHtml(m.imageUrl || "")}" alt="image"/>${caption}`;
  }
  if (m.kind === "voice") {
    const caption = m.text ? `<div class="img-caption">${formatText(m.text, m.mentions)}</div>` : "";
    return `<button class="voice-btn" type="button" data-audio-url="${escapeHtml(m.audioUrl || "")}">
      <span class="voice-icon">▶</span>
      <span class="voice-duration">${escapeHtml(formatVoiceDuration(m.durationSec))}</span>
    </button>${caption}`;
  }
  if (m.kind === "link-card") {
    const c = m.linkCard || {};
    const doc = (c.doc || c.ref || "").trim();
    if (doc) {
      const articleKey = articleKeyFromDoc(doc);
      const hasRepoArticle = Object.prototype.hasOwnProperty.call(ctx.articles || {}, articleKey);
      const fromRepo = hasRepoArticle ? (ctx.articles?.[articleKey] || {}) : {};
      const a = {
        title: fromRepo.title || c.title || articleKey,
        author: fromRepo.author || "",
        cover: fromRepo.cover || "",
        summary: fromRepo.summary || c.desc || c.summary || "",
        summaryMentions: fromRepo.summaryMentions || c.descMentions || c.summaryMentions || [],
        text: fromRepo.text || "",
        html: fromRepo.html || "",
        images: Array.isArray(fromRepo.images) ? fromRepo.images : [],
        publishAt: fromRepo.publishAt || ""
      };
      const cover = a.cover ? `<img class="article-cover" src="${escapeHtml(a.cover)}" alt="cover"/>` : "";
      const summary = a.summary ? `<div class="article-summary">${formatText(a.summary, a.summaryMentions)}</div>` : "";
      const articleAttrs = hasRepoArticle
        ? `data-article-id="${escapeHtml(articleKey || "")}"`
        : `data-title="${escapeHtml(a.title || "")}"
        data-author="${escapeHtml(a.author || "")}"
        data-cover="${escapeHtml(a.cover || "")}"
        data-text="${escapeHtml(a.text || "")}"
        data-html="${escapeHtml(a.html || "")}"
        data-images="${escapeHtml((a.images || []).join(","))}"`;
      return `<button class="article-card" type="button"
        ${articleAttrs}>
        <div class="article-title">${escapeHtml(a.title || "文档")}</div>
        <div class="article-meta">${escapeHtml(a.author || "")}</div>
        ${cover}
        ${summary}
      </button>`;
    }
    return `<a class="card" href="${escapeHtml(c.url || "#")}" target="_blank" rel="noreferrer">
      <div class="card-title">${escapeHtml(c.title || c.url || "链接")}</div>
      <div class="card-desc">${escapeHtml(c.desc || "")}</div>
      <div class="card-footer"><span>${escapeHtml(c.site || "")}</span><span>链接卡片</span></div>
    </a>`;
  }
  if (m.kind === "article-card") {
    const a = resolveArticleCard(m, ctx);
    const cover = a.cover ? `<img class="article-cover" src="${escapeHtml(a.cover)}" alt="cover"/>` : "";
    const summary = a.summary ? `<div class="article-summary">${formatText(a.summary, a.summaryMentions)}</div>` : "";
    const hasRepoArticle = !!a.refId && Object.prototype.hasOwnProperty.call(ctx.articles || {}, a.refId);
    const articleAttrs = hasRepoArticle
      ? `data-article-id="${escapeHtml(a.refId || "")}"`
      : `data-title="${escapeHtml(a.title || "")}"
      data-author="${escapeHtml(a.author || "")}"
      data-cover="${escapeHtml(a.cover || "")}"
      data-text="${escapeHtml(a.text || "")}"
      data-html="${escapeHtml(a.html || "")}"
      data-images="${escapeHtml((a.images || []).join(","))}"`;
    return `<button class="article-card" type="button"
      ${articleAttrs}>
      <div class="article-title">${escapeHtml(a.title || "文章")}</div>
      <div class="article-meta">${escapeHtml(a.author || "")}</div>
      ${cover}
      ${summary}
    </button>`;
  }
  if (m.kind === "contact-card") {
    const c = resolveContactCard(m, ctx);
    return `<div class="contact-card">
      <img class="contact-avatar" src="${escapeHtml(c.avatar || "")}" alt="contact"/>
      <div>
        <div class="contact-name">${escapeHtml(c.name || "")}</div>
        <div class="contact-nick">${escapeHtml(c.nickName ? `昵称：${c.nickName}` : "")}</div>
        <div class="contact-bio">${escapeHtml(c.bio || "")}</div>
      </div>
    </div>`;
  }
  if (m.kind === "choice") {
    const choice = m.choice || {};
    const options = Array.isArray(choice.options) ? choice.options : [];
    return `<div class="choice-panel" data-choice-id="${escapeHtml(m.id || "")}">
      <div class="choice-prompt">${escapeHtml(choice.prompt || "")}</div>
      ${options.map((option) => `<button class="choice-option" type="button" data-choice-option="${escapeHtml(option.id || "")}">${escapeHtml(option.label || "")}</button>`).join("")}
    </div>`;
  }
  return `<div>${formatText(m.text || "", m.mentions)}</div>`;
}

/**
 * Render one message row.
 *
 * @param {Record<string, unknown>} m - Message object.
 * @param {{ profiles: { users: Record<string, any> }, chat: { self?: string } }} ctx - Render context.
 * @returns {string} Message row HTML.
 *
 * @example
 * renderMessage(message, { profiles, chat })
 */
function renderMessage(m, ctx) {
  if (m.kind === "status") {
    return `<div class="end-tip">${formatText(m.text || "", m.mentions)}</div>`;
  }
  const u = ctx.profiles.users[m.senderId] || { name: m.senderId, avatar: "" };
  const selfId = ctx.chat.self;
  const displayName = resolveDisplayName(m.senderId, ctx, m.senderId === selfId);
  const isCardMessage = m.kind === "link-card" || m.kind === "article-card" || m.kind === "contact-card" || m.kind === "choice";
  const cls = (m.senderId === selfId ? "msg self" : "msg") + (isCardMessage ? " card-msg" : "") + (m.kind === "highlight" ? " highlight-msg" : "");
  const highlightAttr = m.kind === "highlight" ? ` data-highlight-text="${escapeHtml(m.text || "")}"` : "";
  const avatar = `<button class="avatar-btn" type="button"
      data-user-id="${escapeHtml(m.senderId)}"
      data-display-name="${escapeHtml(displayName || u.nickName || u.name || m.senderId)}"
      data-avatar="${escapeHtml(u.avatar || "")}">
      <img class="avatar" src="${escapeHtml(u.avatar || "")}" alt="${escapeHtml(u.name || m.senderId)}"/>
    </button>`;
  const quote = m.quote ? renderQuote(m.quote, ctx) : "";
  const bubbleClass = (m.kind === "image" || m.kind === "voice") ? "bubble media" : "bubble";
  const recallText = m.senderId === selfId ? "你撤回了一条消息" : `${displayName || m.senderId} 撤回了一条消息`;
  const body = m.recall
    ? `<div class="recall-tip">${escapeHtml(recallText)}</div>`
    : `<div class="${bubbleClass}">${quote}${renderContent(m, ctx)}</div>`;
  const main = `<div class="msg-main"><p class="meta">${escapeHtml(displayName || m.senderId)} · ${escapeHtml(m.timeText)}</p>${body}</div>`;
  return `<article class="${cls}"${highlightAttr}>${m.senderId === selfId ? `${main}${avatar}` : `${avatar}${main}`}</article>`;
}

/**
 * Render a single conversation page HTML.
 *
 * @param {{
 *  frontmatter: Record<string, unknown>,
 *  profiles: { users: Record<string, any> },
 *  chat: Record<string, any>,
 *  messages: Array<Record<string, unknown>>
 * }} ctx - Full render context.
 * @returns {string} Full HTML document.
 *
 * @example
 * const html = renderHtml({ frontmatter, profiles, chat, messages })
 */
export function renderHtml(ctx) {
  const themeId = ctx.frontmatter.theme || "wechat";
  const theme = themes[themeId] || themes.wechat;
  const profileUsers = safeJson(ctx.profiles?.users || {});
  const articleRepo = safeJson(ctx.articles || {});

  const chatTitle = ctx.chat.title || ctx.frontmatter.title || "聊天记录";
  const subtitle = ctx.chat.type === "group"
    ? `群聊 · ${ctx.chat.title || "未命名群"}`
    : `单聊 · ${resolveDisplayName(ctx.chat.peer, ctx) || ctx.chat.peer || ""}`;

  const messages = ctx.messages.map((m) => renderMessage(m, ctx)).join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(chatTitle)}</title>
  <style>${theme.css}${choiceCss}${statusCss}</style>
</head>
<body data-theme="${escapeHtml(themeId)}">
  <main class="chat">
    <header class="header">
      <h1>${escapeHtml(chatTitle)}</h1>
      <p>${escapeHtml(subtitle)}</p>
    </header>
    <section class="timeline">
      ${messages}
    </section>
  </main>
  <aside id="profile-modal" class="profile-modal" aria-hidden="true">
    <div class="profile-card">
      <div class="profile-head">
        <img id="profile-avatar" class="profile-avatar" src="" alt="avatar" />
        <div id="profile-name" class="profile-name"></div>
      </div>
      <div id="profile-wechat" class="profile-item"></div>
      <div id="profile-bio" class="profile-item"></div>
      <button id="profile-close" class="profile-close" type="button">关闭</button>
    </div>
  </aside>
  <aside id="article-modal" class="article-modal" aria-hidden="true">
    <header class="article-header">
      <button id="article-back" class="article-back" type="button">返回</button>
    </header>
    <div class="article-body">
      <h1 id="article-title" class="article-page-title"></h1>
      <div id="article-sub" class="article-page-sub"></div>
      <img id="article-cover" class="article-page-cover" src="" alt="cover"/>
      <div id="article-text" class="article-page-text"></div>
      <div id="article-images" class="article-page-images"></div>
    </div>
  </aside>
  <aside id="image-viewer" class="image-viewer" aria-hidden="true">
    <button id="image-viewer-close" class="image-viewer-close" type="button" aria-label="关闭">×</button>
    <div id="image-viewer-stage" class="image-viewer-stage">
      <img id="image-viewer-img" class="image-viewer-img" src="" alt="image"/>
    </div>
    <div id="image-viewer-status" class="image-viewer-status">100%</div>
  </aside>
  <script>
    (() => {
      const profileUsers = ${profileUsers};
      const articleRepo = ${articleRepo};
      const modal = document.getElementById('profile-modal');
      const avatar = document.getElementById('profile-avatar');
      const nameEl = document.getElementById('profile-name');
      const wechatEl = document.getElementById('profile-wechat');
      const bioEl = document.getElementById('profile-bio');
      const closeBtn = document.getElementById('profile-close');
      const articleModal = document.getElementById('article-modal');
      const articleBack = document.getElementById('article-back');
      const articleTitle = document.getElementById('article-title');
      const articleSub = document.getElementById('article-sub');
      const articleCover = document.getElementById('article-cover');
      const articleText = document.getElementById('article-text');
      const articleImages = document.getElementById('article-images');
      const avatarBtns = Array.from(document.querySelectorAll('.avatar-btn'));
      const voiceBtns = Array.from(document.querySelectorAll('.voice-btn'));
      const articleBtns = Array.from(document.querySelectorAll('.article-card'));
      const choicePanels = Array.from(document.querySelectorAll('.choice-panel[data-choice-id]'));

      function parseIdentityReference(raw) {
        if (!raw) return null;
        const text = String(raw).trim();
        if (!text) return null;
        const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
          ? text + 'T00:00:00'
          : text.replace(' ', 'T');
        const time = new Date(normalized).getTime();
        return Number.isNaN(time) ? null : time;
      }
      function resolveActiveProfile(user, referenceTime) {
        const refMs = parseIdentityReference(referenceTime) ?? Date.now();
        let resolvedName = user?.name || user?.id || '';
        let resolvedBio = user?.bio || '';
        let resolvedAvatar = user?.avatar || '';
        const timeline = Array.isArray(user?.identityTimeline) ? user.identityTimeline : [];
        timeline.forEach((entry) => {
          if (!entry || typeof entry.effectiveAtMs !== 'number' || entry.effectiveAtMs > refMs) return;
          if (entry.name !== undefined) resolvedName = entry.name;
          if (entry.bio !== undefined) resolvedBio = entry.bio;
          if (entry.avatar !== undefined) resolvedAvatar = entry.avatar;
        });
        return { name: resolvedName, bio: resolvedBio, avatar: resolvedAvatar };
      }

      function esc(s) {
        return String(s || '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      }
      function safeMarkdownUrl(raw) {
        const value = String(raw || '').trim();
        if (/^(https?:)?\\/\\//i.test(value) || value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) return value;
        return '#';
      }
      function renderMarkdownInline(raw) {
        let html = esc(raw || '');
        html = html.replace(/\\x60([^\\x60]+)\\x60/g, '<code>$1</code>');
        html = html.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, (_m, alt, url) => (
          '<img class="previewable-image" src="' + esc(safeMarkdownUrl(url)) + '" data-preview-src="' + esc(safeMarkdownUrl(url)) + '" alt="' + esc(alt) + '"/>'
        ));
        html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, (_m, text, url) => (
          '<a href="' + esc(safeMarkdownUrl(url)) + '" target="_blank" rel="noreferrer">' + text + '</a>'
        ));
        html = html.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
        html = html.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
        return html;
      }
      function renderMarkdown(markdown) {
        const lines = String(markdown || '').replace(/\\r\\n/g, '\\n').split('\\n');
        const html = [];
        let paragraph = [];
        let list = [];
        let quote = [];
        let code = [];
        let inCode = false;
        function flushParagraph() {
          if (!paragraph.length) return;
          html.push('<p>' + renderMarkdownInline(paragraph.join(' ')) + '</p>');
          paragraph = [];
        }
        function flushList() {
          if (!list.length) return;
          html.push('<ul>' + list.map((item) => '<li>' + renderMarkdownInline(item) + '</li>').join('') + '</ul>');
          list = [];
        }
        function flushQuote() {
          if (!quote.length) return;
          html.push('<blockquote>' + quote.map((line) => '<p>' + renderMarkdownInline(line) + '</p>').join('') + '</blockquote>');
          quote = [];
        }
        function flushAll() {
          flushParagraph();
          flushList();
          flushQuote();
        }
        function flushCode() {
          if (!code.length) return;
          html.push('<pre><code>' + esc(code.join('\\n')) + '</code></pre>');
          code = [];
        }
        for (const rawLine of lines) {
          if (rawLine.trim().startsWith('\\x60\\x60\\x60')) {
            if (inCode) {
              flushCode();
              inCode = false;
            } else {
              flushAll();
              inCode = true;
            }
            continue;
          }
          if (inCode) {
            code.push(rawLine);
            continue;
          }
          const line = rawLine.trim();
          if (!line) {
            flushAll();
            continue;
          }
          const heading = line.match(/^(#{1,3})\\s+(.+)$/);
          if (heading) {
            flushAll();
            const level = heading[1].length;
            html.push('<h' + level + '>' + renderMarkdownInline(heading[2]) + '</h' + level + '>');
            continue;
          }
          if (/^>\\s?/.test(line)) {
            flushParagraph();
            flushList();
            quote.push(line.replace(/^>\\s?/, ''));
            continue;
          }
          if (/^[-*]\\s+/.test(line)) {
            flushParagraph();
            flushQuote();
            list.push(line.replace(/^[-*]\\s+/, ''));
            continue;
          }
          if (/^!\\[[^\\]]*\\]\\([^)]+\\)$/.test(line)) {
            flushAll();
            html.push(renderMarkdownInline(line));
            continue;
          }
          flushList();
          flushQuote();
          paragraph.push(line);
        }
        flushAll();
        flushCode();
        return html.join('');
      }

      function openProfile(btn) {
        const userId = btn.dataset.userId || '';
        const displayName = btn.dataset.displayName || btn.dataset.nickName || '';
        const user = profileUsers[userId] || {};
        const resolved = resolveActiveProfile(user, new Date().toISOString());
        avatar.src = resolved.avatar || btn.dataset.avatar || user.avatar || '';
        nameEl.textContent = resolved.name || displayName || userId;
        wechatEl.textContent = '昵称：' + (displayName || resolved.name || '未设置');
        bioEl.textContent = '简介：' + (resolved.bio || '无');
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
      }
      function closeProfile() {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
      }
      function articleFromButton(btn) {
        const articleId = btn.dataset.articleId || '';
        const repoArticle = articleId ? (articleRepo[articleId] || {}) : {};
        return {
          title: repoArticle.title || btn.dataset.title || '',
          author: repoArticle.author || btn.dataset.author || '',
          publishRaw: repoArticle.publishAt || btn.dataset.publishRaw || '',
          cover: repoArticle.cover || btn.dataset.cover || '',
          text: repoArticle.text || btn.dataset.text || '',
          html: repoArticle.html || btn.dataset.html || '',
          images: Array.isArray(repoArticle.images) ? repoArticle.images : (btn.dataset.images || '').split(',').filter(Boolean)
        };
      }
      function openArticle(btn) {
        const article = articleFromButton(btn);
        articleTitle.textContent = article.title;
        articleSub.textContent = [article.author, article.publishRaw].filter(Boolean).join(' · ');
        articleCover.style.display = article.cover ? 'block' : 'none';
        articleCover.src = article.cover || '';
        if (article.cover) articleCover.dataset.previewSrc = article.cover;
        else articleCover.removeAttribute('data-preview-src');
        articleText.innerHTML = article.html || renderMarkdown(article.text);
        articleImages.innerHTML = (article.images || []).map((url) => '<img src="' + esc(url) + '" data-preview-src="' + esc(url) + '" alt="image"/>').join('');
        articleModal.classList.add('show');
        articleModal.scrollTop = 0;
        articleModal.setAttribute('aria-hidden', 'false');
      }
      function closeArticle() {
        articleModal.classList.remove('show');
        articleModal.setAttribute('aria-hidden', 'true');
      }

      avatarBtns.forEach((btn) => {
        btn.addEventListener('click', () => openProfile(btn));
      });
      closeBtn.addEventListener('click', closeProfile);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeProfile();
      });
      articleBtns.forEach((btn) => {
        btn.addEventListener('click', () => openArticle(btn));
      });
      articleBack.addEventListener('click', closeArticle);

      let activeAudio = null;
      let activeBtn = null;

      function setVoiceBtnState(btn, playing) {
        if (!btn) return;
        const icon = btn.querySelector('.voice-icon');
        btn.classList.toggle('playing', !!playing);
        if (icon) icon.textContent = playing ? '▮▮' : '▶';
      }
      function clearAudioState() {
        if (activeAudio) {
          activeAudio.pause();
          activeAudio = null;
        }
        setVoiceBtnState(activeBtn, false);
        activeBtn = null;
      }

      voiceBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const src = btn.dataset.audioUrl || '';
          if (!src) return;

          if (activeBtn === btn && activeAudio && !activeAudio.paused) {
            clearAudioState();
            return;
          }

          clearAudioState();
          const audio = new Audio(src);
          activeAudio = audio;
          activeBtn = btn;
          setVoiceBtnState(btn, true);

          audio.addEventListener('ended', clearAudioState);
          audio.play().catch(() => {
            clearAudioState();
          });
        });
      });

      choicePanels.forEach((panel) => {
        const choiceId = panel.dataset.choiceId || '';
        const storageKey = 'chat-framework:choice:' + location.pathname + ':' + choiceId;
        const applyChoice = (optionId) => {
          panel.querySelectorAll('.choice-option').forEach((btn) => {
            btn.classList.toggle('selected', btn.dataset.choiceOption === optionId);
            btn.disabled = true;
          });
        };
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) applyChoice(saved);
        } catch (_) {
          // Storage can be unavailable for local files or privacy-restricted pages.
        }
        panel.addEventListener('click', (event) => {
          const btn = event.target.closest('.choice-option');
          if (!btn || btn.disabled) return;
          const optionId = btn.dataset.choiceOption || '';
          if (!optionId) return;
          applyChoice(optionId);
          try { localStorage.setItem(storageKey, optionId); } catch (_) {}
        });
      });
${imageViewerRuntimeSource()}
${highlightEffectRuntimeSource()}
      installImageViewer();
      installHighlightAutoTrigger(document.querySelector('.chat'));
    })();
  </script>
</body>
</html>`;
}
