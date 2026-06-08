const MENTION_CHAR_RE = /[A-Za-z0-9_\-\u4e00-\u9fa5]/;

function cleanName(value) {
  const name = String(value || "").trim();
  if (!name || name.includes("@")) return "";
  return name;
}

function addName(names, value) {
  const name = cleanName(value);
  if (name) names.add(name);
}

function formatKnownMentions(index) {
  const names = (index?.names || []).slice(0, 8);
  const suffix = (index?.names || []).length > names.length ? ", ..." : "";
  return names.length ? `${names.join(", ")}${suffix}` : "(none)";
}

/**
 * Build all valid @mention names for a conversation.
 *
 * @param {{ users?: Record<string, unknown> }} profiles - Normalized profiles.
 * @param {{ self?: string }} chat - Normalized chat config.
 * @returns {{ names: string[] }}
 */
export function buildMentionIndex(profiles, chat = {}) {
  const names = new Set();
  const users = profiles?.users || {};

  for (const [id, user] of Object.entries(users)) {
    addName(names, id);
    addName(names, user?.name);
    addName(names, user?.nickName);
    for (const entry of (Array.isArray(user?.identityTimeline) ? user.identityTimeline : [])) {
      addName(names, entry?.name);
    }
  }

  const self = users[chat?.self];
  const aliases = self?.aliases || {};
  for (const value of Object.values(aliases.contacts || {})) addName(names, value);
  for (const value of Object.values(aliases.selfInGroups || {})) addName(names, value);

  return {
    names: Array.from(names).sort((a, b) => b.length - a.length || a.localeCompare(b, "zh-CN"))
  };
}

function readMentionToken(text, start) {
  let end = start;
  while (end < text.length && MENTION_CHAR_RE.test(text[end])) end += 1;
  return text.slice(start, end);
}

function buildUnknownMentionMessage(raw, index, context = {}) {
  const place = [
    context.sourceFile,
    context.messageId ? `message ${context.messageId}` : "",
    context.articleId ? `article ${context.articleId}` : "",
    context.momentId ? `moment ${context.momentId}` : "",
    context.field ? `field ${context.field}` : ""
  ].filter(Boolean).join(" ");
  const prefix = place ? `${place}: ` : "";
  return `${prefix}Unknown mention "${raw}". Known mentions include: ${formatKnownMentions(index)}. ` +
    "If this name only appears in a [contact-card], add/ref a real profile or alias; contact-card name/nickName is display text, not a mention identity.";
}

/**
 * Find and validate all @mentions in one plain-text field.
 *
 * @param {string} value - Raw text.
 * @param {{ names: string[] }} index - Mention index from buildMentionIndex().
 * @param {Record<string, string>} [context] - Error context.
 * @returns {Array<{ start: number, end: number, name: string, text: string }>}
 */
export function annotateTextMentions(value, index, context = {}) {
  const text = String(value || "");
  if (!text.includes("@")) return [];

  const ranges = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== "@") continue;
    const next = text[i + 1] || "";
    if (!MENTION_CHAR_RE.test(next)) continue;

    const rest = text.slice(i + 1);
    const name = (index.names || []).find((candidate) => rest.startsWith(candidate));
    if (!name) {
      const token = readMentionToken(text, i + 1);
      throw new Error(buildUnknownMentionMessage(`@${token}`, index, context));
    }

    const end = i + 1 + name.length;
    ranges.push({
      start: i,
      end,
      name,
      text: text.slice(i, end)
    });
    i = end - 1;
  }
  return ranges;
}

function annotateField(target, field, mentionField, index, context) {
  if (!target || !Object.prototype.hasOwnProperty.call(target, field)) return;
  const ranges = annotateTextMentions(target[field], index, { ...context, field });
  if (ranges.length) target[mentionField] = ranges;
  else if (Object.prototype.hasOwnProperty.call(target, mentionField)) delete target[mentionField];
}

/**
 * Annotate all user-visible text fields that render through formatText().
 *
 * @param {{
 *   messages?: Array<Record<string, unknown>>,
 *   profiles?: { users?: Record<string, unknown> },
 *   articles?: Record<string, unknown>,
 *   chat?: Record<string, unknown>,
 *   sourceFile?: string
 * }} input - Conversation payload.
 * @returns {void}
 */
export function annotateConversationMentions(input) {
  const index = buildMentionIndex(input.profiles, input.chat);
  for (const message of (input.messages || [])) {
    const messageContext = { sourceFile: input.sourceFile, messageId: message.id };
    annotateField(message, "text", "mentions", index, messageContext);
    if (message.linkCard) {
      annotateField(message.linkCard, "desc", "descMentions", index, messageContext);
      annotateField(message.linkCard, "summary", "summaryMentions", index, messageContext);
    }
    if (message.articleCard) {
      annotateField(message.articleCard, "summary", "summaryMentions", index, messageContext);
    }
  }

  for (const [articleId, article] of Object.entries(input.articles || {})) {
    annotateField(article, "summary", "summaryMentions", index, {
      sourceFile: input.sourceFile,
      articleId
    });
  }

  for (const [profileId, user] of Object.entries(input.profiles?.users || {})) {
    for (const [momentId, moment] of Object.entries(user?.moments || {})) {
      annotateField(moment, "text", "mentions", index, {
        sourceFile: input.sourceFile,
        momentId: `${profileId}.${momentId}`
      });
    }
  }
}
