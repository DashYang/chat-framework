function stripReadableText(value) {
  return String(value || "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[./\w-]+\.(?:png|jpe?g|gif|webp|svg|mp3|wav|m4a|ya?ml|md|markdown)\b/gi, "")
    .replace(/\s+/g, "");
}

function countText(value) {
  return Array.from(stripReadableText(value).trim()).length;
}

function addText(parts, value) {
  const n = countText(value);
  if (n > 0) parts.count += n;
}

function articleRefsForUser(user) {
  return Array.isArray(user?.officialArticles || user?.articles)
    ? (user.officialArticles || user.articles).map((x) => String(x))
    : Object.keys(user?.officialArticles || user?.articles || {});
}

function firstTimelineName(user) {
  const timeline = Array.isArray(user?.identityTimeline) ? [...user.identityTimeline] : [];
  timeline.sort((a, b) => Number(a?.effectiveAtMs || 0) - Number(b?.effectiveAtMs || 0));
  const first = timeline.find((entry) => String(entry?.name || "").trim());
  return String(first?.name || "").trim();
}

function toStageKey(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  const direct = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2})(?::\d{2}(?::\d{2})?)?)?$/);
  if (direct) return direct[1] + " " + (direct[2] || "00") + ":00";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
}

function countMessageText(message, articles = {}) {
  const parts = { count: 0 };
  addText(parts, message?.text);
  if (message?.linkCard) {
    addText(parts, message.linkCard.title);
    addText(parts, message.linkCard.desc || message.linkCard.summary);
  }
  if (message?.articleCard) {
    const ref = message.articleCard.refId || "";
    const article = ref ? articles[ref] || {} : {};
    addText(parts, article.title || message.articleCard.title);
    addText(parts, article.summary || message.articleCard.summary);
  }
  if (message?.contactCard) {
    addText(parts, message.contactCard.name);
    addText(parts, message.contactCard.nickName);
    addText(parts, message.contactCard.bio);
  }
  return parts.count;
}

function countArticleText(article) {
  const parts = { count: 0 };
  addText(parts, article?.title);
  addText(parts, article?.summary || article?.desc);
  addText(parts, article?.text || article?.markdown || article?.body || article?.content);
  return parts.count;
}

function resolveMomentAuthorText(moment, owner, users) {
  const author = moment?.author;
  if (!author) return firstTimelineName(owner) || owner?.name || owner?.id || "";
  if (typeof author === "string") {
    const value = author.trim();
    if (value.startsWith("@")) {
      const id = value.slice(1).trim();
      const user = users?.[id] || {};
      return firstTimelineName(user) || user.name || id;
    }
    return value;
  }
  if (typeof author === "object") {
    const id = String(author.refId || author.ref || author.id || author.profileId || author.userId || "").replace(/^@/, "");
    const user = id ? users?.[id] || {} : {};
    return author.name || firstTimelineName(user) || user.name || id;
  }
  return "";
}

function countMomentText(moment, owner, users) {
  const parts = { count: 0 };
  addText(parts, resolveMomentAuthorText(moment, owner, users));
  addText(parts, moment?.text);
  return parts.count;
}

function buildAccountReport(accountId, conversations) {
  const report = { chat: 0, docs: 0, social: 0, total: 0 };
  const articleIds = new Set();
  const momentIds = new Set();
  let accountUser = null;
  let accountUsers = {};

  for (const conv of conversations) {
    const users = conv.profiles?.users || {};
    if (users[accountId] && !accountUser) {
      accountUser = users[accountId];
      accountUsers = users;
    }
    if (String(conv.chat?.self || "") === String(accountId)) {
      for (const message of conv.messages || []) {
        report.chat += countMessageText(message, conv.articles || {});
      }
    }
  }

  if (accountUser) {
    for (const ref of articleRefsForUser(accountUser)) articleIds.add(String(ref));
    for (const conv of conversations) {
      if (!conv.profiles?.users?.[accountId]) continue;
      for (const articleId of articleIds) {
        report.docs += countArticleText(conv.articles?.[articleId]);
      }
      break;
    }
    for (const [key, moment] of Object.entries(accountUser.moments || {})) {
      const id = String(moment?.id || key);
      if (momentIds.has(id)) continue;
      momentIds.add(id);
      report.social += countMomentText(moment, accountUser, accountUsers);
    }
  }

  report.total = report.chat + report.docs + report.social;
  return report;
}

function collectStageKeys(conversations) {
  const keys = new Set();
  for (const conv of conversations) {
    for (const message of conv.messages || []) {
      const key = toStageKey(message.timestamp || message.timeText || "");
      if (key) keys.add(key);
    }
    const users = conv.profiles?.users || {};
    for (const user of Object.values(users)) {
      for (const moment of Object.values(user?.moments || {})) {
        const key = toStageKey(moment?.publishAt || moment?.time || "");
        if (key) keys.add(key);
      }
      for (const ref of articleRefsForUser(user)) {
        const article = conv.articles?.[String(ref)];
        const key = toStageKey(article?.publishAt || article?.time || "");
        if (key) keys.add(key);
      }
    }
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function collectAccounts(conversations, story = {}) {
  const ids = new Set();
  for (const conv of conversations) {
    if (conv.chat?.self) ids.add(String(conv.chat.self));
  }
  const order = Array.isArray(story.accountOrder) ? story.accountOrder.map((x) => String(x)) : [];
  return [...order.filter((id) => ids.has(id)), ...Array.from(ids).filter((id) => !order.includes(id))];
}

function collectWarnings(conversations, ui = {}, story = {}) {
  const warnings = [];
  for (const conv of conversations) {
    if (conv.chat?.type === "single" && conv.chat?.titleUsesStageIdentity) {
      warnings.push(`${conv.sourceFile || conv.id || "conversation"}: single title uses stage-time identityTimeline.name`);
    }
  }
  if (story?.accountOrder && ui?.statusBar?.time) {
    warnings.push("ui.statusBar.time is only initial text; stage time overrides it at runtime.");
  }
  const referenced = new Set();
  const known = new Set();
  for (const conv of conversations) {
    for (const articleId of Object.keys(conv.articles || {})) known.add(articleId);
    for (const user of Object.values(conv.profiles?.users || {})) {
      for (const ref of articleRefsForUser(user)) referenced.add(String(ref));
    }
  }
  for (const id of known) {
    if (!referenced.has(id)) warnings.push(`article "${id}" is loaded but not referenced by any profile officialArticles.`);
  }
  return warnings;
}

export function createBuildReport({ conversations, ui = {}, story = {} }) {
  const accountIds = collectAccounts(conversations, story);
  const articleIds = new Set();
  const momentIds = new Set();
  for (const conv of conversations) {
    for (const id of Object.keys(conv.articles || {})) articleIds.add(id);
    for (const [userId, user] of Object.entries(conv.profiles?.users || {})) {
      for (const [momentId, moment] of Object.entries(user?.moments || {})) {
        momentIds.add(`${userId}|${moment?.id || momentId}`);
      }
    }
  }
  return {
    accountIds,
    conversationCount: conversations.length,
    articleCount: articleIds.size,
    momentCount: momentIds.size,
    stageCount: collectStageKeys(conversations).length,
    storyOrder: Array.isArray(story.accountOrder) ? story.accountOrder.map((x) => String(x)) : [],
    singleTitleSources: conversations
      .filter((conv) => conv.chat?.type === "single")
      .map((conv) => ({
        file: conv.sourceFile || "",
        self: conv.chat?.self || "",
        peer: conv.chat?.peer || "",
        source: conv.chat?.titleSource || (conv.chat?.titleUsesStageIdentity ? "identityTimeline" : "unknown")
      })),
    accounts: accountIds.map((id) => ({ id, counts: buildAccountReport(id, conversations) })),
    warnings: collectWarnings(conversations, ui, story)
  };
}

export function formatBuildReport(report) {
  const lines = [
    "Build report:",
    `  Accounts: ${report.accountIds.length}${report.storyOrder.length ? ` (story order: ${report.storyOrder.join(" -> ")})` : ""}`,
    `  Conversations: ${report.conversationCount}`,
    `  Articles: ${report.articleCount}`,
    `  Moments: ${report.momentCount}`,
    `  Stage hours: ${report.stageCount}`,
    "  Single chat titles:",
    ...(report.singleTitleSources.length
      ? report.singleTitleSources.map((row) => `    ${row.self} -> ${row.peer}: ${row.source}`)
      : ["    (none)"]),
    "  Text counts:"
  ];
  for (const row of report.accounts) {
    const c = row.counts;
    lines.push(`    ${row.id}: 聊天 ${c.chat} / 文档 ${c.docs} / 社交 ${c.social} / 总计 ${c.total}`);
  }
  if (report.warnings.length) {
    lines.push("  Warnings:");
    for (const warning of report.warnings) lines.push(`    - ${warning}`);
  }
  return lines.join("\n");
}
