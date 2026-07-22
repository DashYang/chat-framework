import yaml from "js-yaml";

import { createDiagnostic } from "./diagnostics.js";
import { parseChatMarkdown } from "./parser.js";
import { dirnameProjectPath, resolveProjectPath } from "./project-path.js";
import { MemoryProjectSource } from "./project-source.js";

export const AUTHORING_SPEC_VERSION = "3.0";
export const STUDIO_DEMO_PROJECT_ID = "studio-feature-demo";
const LEGACY_AUTHORING_SPEC_VERSION = "2.0";
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
    statusBarCarrier: "中国移动",
    selfId: "me",
    participants: [
      { id: "me", name: "我", avatar: "", bio: "", identityTimeline: [] },
      { id: "friend", name: "朋友", avatar: "", bio: "", identityTimeline: [] }
    ],
    conversations: [{
      id: "main",
      title: "朋友",
      type: "single",
      selfId: "me",
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
    }],
    socialPosts: [],
    articles: [],
    documents: [],
    story: { enabled: false, accountOrder: ["me"], title: "", favicon: "", resetInfo: "", resetAccount: "", endInfo: "" },
    assets: []
  };
}

function demoSvgDataUrl(label, background, foreground = "#ffffff") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" rx="36" fill="${background}"/><circle cx="320" cy="162" r="82" fill="${foreground}" opacity=".18"/><text x="320" y="190" text-anchor="middle" font-family="sans-serif" font-size="72" font-weight="700" fill="${foreground}">${label}</text><text x="320" y="310" text-anchor="middle" font-family="sans-serif" font-size="28" fill="${foreground}" opacity=".86">Chat Framework Studio</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Canonical Studio project that exercises every authoring capability exposed by
 * the visual editor. Keep this project and its coverage test in sync whenever a
 * Studio feature is added.
 */
export function createStudioDemoProject() {
  return {
    schemaVersion: AUTHORING_SPEC_VERSION,
    id: STUDIO_DEMO_PROJECT_ID,
    title: "Studio 全功能 Demo",
    theme: "wechat",
    statusBarCarrier: "中国移动",
    selfId: "me",
    participants: [
      { id: "me", name: "我", avatar: "asset:avatar-me", bio: "当前账号 · 可在参与者面板编辑资料", identityTimeline: [] },
      { id: "friend", name: "小满", avatar: "asset:avatar-friend", bio: "朋友 · 展示接收方消息与资料卡", identityTimeline: [
        { id: "friend-2026", effectiveAt: "2026-01-01", name: "小满", avatar: "asset:avatar-friend", bio: "Phase 5 身份时间线：初识" },
        { id: "friend-2027", effectiveAt: "2027-01-01", name: "满编辑", avatar: "asset:avatar-editor", bio: "一年后的新身份" }
      ] },
      { id: "editor", name: "编辑部", avatar: "asset:avatar-editor", bio: "群聊成员、朋友圈作者与文章作者", identityTimeline: [] }
    ],
    conversations: [{
      id: "main",
      title: "Studio 功能演示",
      type: "single",
      selfId: "me",
      messages: [
        {
          id: "welcome",
          senderId: "friend",
          timeRaw: "2026-01-01 10:00:00",
          kind: "text",
          text: "欢迎来到全功能 Demo。消息流默认显示一行摘要，点击任一消息可展开详情；访问 https://example.com 可以测试自动链接。",
          quoteId: "",
          recallDelaySec: 0
        },
        {
          id: "reply",
          senderId: "me",
          timeRaw: "+1m",
          kind: "text",
          text: "这条消息展示发送方气泡和引用前序消息。",
          quoteId: "welcome",
          recallDelaySec: 0
        },
        {
          id: "photo",
          senderId: "friend",
          timeRaw: "+1m",
          kind: "image",
          text: "",
          imageSource: "asset:demo-image",
          caption: "本地资产图片与图片说明",
          quoteId: "",
          recallDelaySec: 0
        },
        {
          id: "card",
          senderId: "friend",
          timeRaw: "+1m",
          kind: "link-card",
          text: "",
          linkCard: {
            url: "https://example.com/chat-framework",
            title: "链接卡片功能",
            desc: "包含标题、摘要、站点和本地封面资产。",
            image: "asset:demo-image",
            site: "example.com"
          },
          quoteId: "",
          recallDelaySec: 0
        },
        {
          id: "recall",
          senderId: "me",
          timeRaw: "+1m",
          kind: "text",
          text: "这条消息会在 3 秒后撤回。",
          quoteId: "",
          recallDelaySec: 3
        },
        {
          id: "status",
          senderId: "me",
          timeRaw: "+1m",
          kind: "status",
          text: "状态消息会居中显示，不带头像和气泡",
          quoteId: "",
          recallDelaySec: 0,
          requireFlags: ["demo-continued", "demo-second-check"]
        },
        {
          id: "choice-demo",
          senderId: "friend",
          timeRaw: "+1m",
          kind: "choice",
          text: "",
          quoteId: "",
          recallDelaySec: 0,
          choice: { prompt: "继续探索完整 Demo？", speakerId: "me", scope: "account", options: [
            { id: "continue", label: "继续", text: "继续看看。", score: 2, flags: ["demo-continued", "true-end-demo"] },
            { id: "later", label: "稍后", text: "稍后再看。", score: 0, flags: ["bad-end-demo"] }
          ] }
        },
        {
          id: "cycle-demo",
          senderId: "friend",
          timeRaw: "+1m",
          kind: "choice",
          text: "",
          quoteId: "",
          recallDelaySec: 0,
          requireFlags: ["demo-cycle"],
          choice: { prompt: "这个选项演示循环依赖诊断", speakerId: "me", scope: "account", options: [
            { id: "cycle", label: "循环", text: "这条路径无法自行启动。", score: 0, flags: ["demo-cycle"] },
            { id: "leave", label: "离开", text: "返回其他路径。", score: 0, flags: [] }
          ] }
        }
      ]
    }, {
      id: "team",
      title: "完整创作群",
      type: "group",
      selfId: "me",
      requireScore: 2,
      requireFlags: ["demo-continued"],
      requireScope: "account",
      messages: [{
        id: "team-welcome",
        senderId: "editor",
        timeRaw: "2026-01-02 09:00:00",
        kind: "text",
        text: "第二个会话展示多会话 Hub、群聊入口与阶段推进。",
        quoteId: "",
        recallDelaySec: 0
      }, {
        id: "team-reply",
        senderId: "me",
        timeRaw: "+1m",
        kind: "text",
        text: "会话、社交和文章现在都在同一个 Studio 项目里。",
        quoteId: "team-welcome",
        recallDelaySec: 0
      }, {
        id: "global-choice",
        senderId: "editor",
        timeRaw: "+1m",
        kind: "choice",
        text: "",
        quoteId: "",
        recallDelaySec: 0,
        choice: { prompt: "是否解锁全局文章线？", speakerId: "me", scope: "global", options: [
          { id: "unlock", label: "解锁", text: "解锁全局文章线。", score: 1, flags: ["global-route"] },
          { id: "skip", label: "跳过", text: "暂时跳过。", score: 0, flags: [] }
        ] }
      }]
    }],
    socialPosts: [{
      id: "moment-demo",
      authorId: "friend",
      publishAt: "2026-01-01 10:05:00",
      text: "这是由 Social Editor 管理的朋友圈，支持文字和多张图片。",
      images: ["asset:demo-image"],
      requireScore: 0,
      requireFlags: [],
      requireScope: "account"
    }],
    articles: [{
      id: "article-demo",
      authorId: "editor",
      publishAt: "2026-01-01 09:30:00",
      title: "Phase 6：完整互动作品闭环",
      cover: "asset:demo-image",
      summary: "由 Article Editor 创建，正文使用 Markdown。",
      body: "# Studio Phase 6\n\n人物、会话、朋友圈、文章、资料库和剧情规则共享稳定 ID 与图片资产。\n\n- 多会话 Hub\n- Social / Article Editor\n- 人物身份时间线与资料库\n- 选择分支、条件和账号推进\n- 完整静态网站导出",
      images: ["asset:demo-image"],
      requireScore: 1,
      requireFlags: ["global-route"],
      requireScope: "global"
    }],
    documents: [{
      id: "world-guide",
      type: "settings",
      title: "Studio 设定集",
      items: [{ id: "studio", name: "创作工作台", image: "asset:demo-image", time: "", description: "通过可视化编辑器生成开放的 Markdown/YAML 项目。", participantIds: [] }]
    }, {
      id: "story-timeline",
      type: "timeline",
      title: "功能时间线",
      items: [{ id: "phase-6", name: "", image: "asset:demo-image", time: "Phase 6", description: "人物、内容、规则和静态网站形成完整闭环。", participantIds: ["me", "friend", "editor"] }]
    }],
    story: { enabled: true, accountOrder: ["me", "friend", "editor"], title: "Studio 全功能 Demo", favicon: "asset:avatar-me", resetInfo: "重新开始这一段故事", resetAccount: "me", endInfo: "你已体验 Studio 的全部功能。" },
    assets: [
      { id: "avatar-me", fileName: "avatar-me.svg", mimeType: "image/svg+xml", dataUrl: demoSvgDataUrl("我", "#07c160") },
      { id: "avatar-friend", fileName: "avatar-friend.svg", mimeType: "image/svg+xml", dataUrl: demoSvgDataUrl("满", "#576b95") },
      { id: "avatar-editor", fileName: "avatar-editor.svg", mimeType: "image/svg+xml", dataUrl: demoSvgDataUrl("编", "#b45f4d") },
      { id: "demo-image", fileName: "studio-demo.svg", mimeType: "image/svg+xml", dataUrl: demoSvgDataUrl("DEMO", "#6f5bd3") }
    ]
  };
}

export function normalizeAuthoringProject(project) {
  const normalized = structuredClone(project || {});
  if (!Array.isArray(normalized.conversations)) {
    normalized.conversations = normalized.conversation ? [{
      ...normalized.conversation,
      selfId: normalized.conversation.selfId || normalized.selfId || ""
    }] : [];
  }
  delete normalized.conversation;
  normalized.conversations = normalized.conversations.map((conversation, index) => ({
    ...conversation,
    id: conversation.id || `conversation-${index + 1}`,
    title: conversation.title || `会话 ${index + 1}`,
    type: conversation.type === "group" ? "group" : "single",
    selfId: conversation.selfId || normalized.selfId || "",
    messages: Array.isArray(conversation.messages) ? conversation.messages : []
  }));
  normalized.socialPosts = Array.isArray(normalized.socialPosts) ? normalized.socialPosts : [];
  normalized.articles = Array.isArray(normalized.articles) ? normalized.articles : [];
  normalized.participants = (Array.isArray(normalized.participants) ? normalized.participants : []).map((participant) => ({
    ...participant,
    identityTimeline: Array.isArray(participant.identityTimeline) ? participant.identityTimeline : []
  }));
  normalized.documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  normalized.story = {
    enabled: Boolean(normalized.story?.enabled),
    accountOrder: Array.isArray(normalized.story?.accountOrder) ? normalized.story.accountOrder : [normalized.selfId].filter(Boolean),
    title: String(normalized.story?.title || ""),
    favicon: String(normalized.story?.favicon || ""),
    resetInfo: String(normalized.story?.resetInfo || ""),
    resetAccount: String(normalized.story?.resetAccount || ""),
    endInfo: String(normalized.story?.endInfo || "")
  };
  normalized.statusBarCarrier = String(normalized.statusBarCarrier || "中国移动");
  normalized.assets = Array.isArray(normalized.assets) ? normalized.assets : [];
  if (normalized.schemaVersion === LEGACY_AUTHORING_SPEC_VERSION || !normalized.schemaVersion) {
    normalized.schemaVersion = AUTHORING_SPEC_VERSION;
  }
  return normalized;
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
  project = normalizeAuthoringProject(project);
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

  const conversations = project.conversations;
  if (!conversations.length) diagnostics.push(fieldDiagnostic("CONVERSATIONS_REQUIRED", "至少需要一个会话", "conversations", "conversations"));
  const conversationIds = new Set();
  for (const conversation of conversations) {
    const conversationId = String(conversation?.id || "").trim();
    if (!ID_RE.test(conversationId)) diagnostics.push(fieldDiagnostic("INVALID_CONVERSATION_ID", "会话 ID 格式无效", conversationId, "id"));
    else if (conversationIds.has(conversationId)) diagnostics.push(fieldDiagnostic("DUPLICATE_CONVERSATION_ID", `会话 ID 重复：${conversationId}`, conversationId, "id"));
    conversationIds.add(conversationId);
    if (!participantIds.has(String(conversation.selfId || ""))) diagnostics.push(fieldDiagnostic("INVALID_CONVERSATION_SELF", "会话账号必须引用参与者", conversationId, "selfId"));
    const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
    if (!messages.length) diagnostics.push(fieldDiagnostic("MESSAGES_REQUIRED", "每个会话至少需要一条消息", conversationId, "messages"));
    const messageIds = new Set();
    messages.forEach((message, index) => {
      const id = String(message?.id || "").trim();
      if (!ID_RE.test(id)) diagnostics.push(fieldDiagnostic("INVALID_MESSAGE_ID", "消息 ID 格式无效", id, "id"));
      else if (messageIds.has(id)) diagnostics.push(fieldDiagnostic("DUPLICATE_MESSAGE_ID", `消息 ID 重复：${id}`, id, "id"));
      if (!participantIds.has(String(message?.senderId || ""))) diagnostics.push(fieldDiagnostic("UNKNOWN_SENDER", "请选择有效的消息发送者", id, "senderId"));
      const time = String(message?.timeRaw || "").trim();
      if (index === 0 && !ABS_TIME_RE.test(time)) diagnostics.push(fieldDiagnostic("FIRST_TIME_ABSOLUTE", "第一条消息必须填写绝对时间", id, "timeRaw"));
      else if (time && !ABS_TIME_RE.test(time) && !REL_TIME_RE.test(time)) diagnostics.push(fieldDiagnostic("INVALID_TIME", "时间应为绝对时间或 +1m 形式", id, "timeRaw"));
      if (message?.quoteId && !messageIds.has(String(message.quoteId))) diagnostics.push(fieldDiagnostic("INVALID_QUOTE", "引用必须指向同一会话内的前序消息", id, "quoteId"));
      if (["text", "status"].includes(message?.kind) && !String(message?.text || "").trim()) diagnostics.push(fieldDiagnostic("MESSAGE_TEXT_REQUIRED", "消息内容不能为空", id, "text"));
      if (message?.kind === "image" && !String(message?.imageSource || "").trim()) diagnostics.push(fieldDiagnostic("IMAGE_REQUIRED", "请选择图片或填写图片网址", id, "imageSource"));
      if (message?.kind === "link-card" && !String(message?.linkCard?.url || "").trim()) diagnostics.push(fieldDiagnostic("LINK_URL_REQUIRED", "链接卡片网址不能为空", id, "linkCard.url"));
      if (message?.requireScore !== undefined && !Number.isFinite(Number(message.requireScore))) diagnostics.push(fieldDiagnostic("INVALID_REQUIRE_SCORE", "消息条件分数必须是数字", id, "requireScore"));
      if (message?.kind === "choice") {
        const options = Array.isArray(message.choice?.options) ? message.choice.options : [];
        if (!String(message.choice?.prompt || "").trim()) diagnostics.push(fieldDiagnostic("CHOICE_PROMPT_REQUIRED", "选择题问题不能为空", id, "choice.prompt"));
        if (!participantIds.has(String(message.choice?.speakerId || ""))) diagnostics.push(fieldDiagnostic("UNKNOWN_CHOICE_SPEAKER", "选择题回复者必须引用人物", id, "choice.speakerId"));
        if (options.length < 2) diagnostics.push(fieldDiagnostic("CHOICE_OPTIONS_REQUIRED", "选择题至少需要两个选项", id, "choice.options"));
        const optionIds = new Set();
        for (const option of options) {
          if (!ID_RE.test(String(option.id || "")) || optionIds.has(option.id)) diagnostics.push(fieldDiagnostic("INVALID_CHOICE_OPTION_ID", "选择项 ID 必须有效且唯一", id, "choice.options"));
          if (!String(option.label || "").trim()) diagnostics.push(fieldDiagnostic("CHOICE_LABEL_REQUIRED", "选择项文案不能为空", id, "choice.options"));
          optionIds.add(option.id);
        }
      }
      messageIds.add(id);
    });
    if (conversation.requireScore !== undefined && !Number.isFinite(Number(conversation.requireScore))) diagnostics.push(fieldDiagnostic("INVALID_REQUIRE_SCORE", "会话条件分数必须是数字", conversationId, "requireScore"));
  }
  const socialIds = new Set();
  for (const post of project.socialPosts) {
    const id = String(post?.id || "").trim();
    if (!ID_RE.test(id) || socialIds.has(id)) diagnostics.push(fieldDiagnostic("INVALID_SOCIAL_ID", "朋友圈 ID 必须有效且唯一", id, "id"));
    if (!participantIds.has(String(post?.authorId || ""))) diagnostics.push(fieldDiagnostic("UNKNOWN_SOCIAL_AUTHOR", "朋友圈作者必须引用参与者", id, "authorId"));
    if (!ABS_TIME_RE.test(String(post?.publishAt || ""))) diagnostics.push(fieldDiagnostic("INVALID_PUBLISH_TIME", "发布时间必须是绝对时间", id, "publishAt"));
    if (!String(post?.text || "").trim() && !(post?.images || []).length) diagnostics.push(fieldDiagnostic("SOCIAL_CONTENT_REQUIRED", "朋友圈需要文字或图片", id, "text"));
    if (post.requireScore !== undefined && !Number.isFinite(Number(post.requireScore))) diagnostics.push(fieldDiagnostic("INVALID_REQUIRE_SCORE", "条件分数必须是数字", id, "requireScore"));
    socialIds.add(id);
  }
  const articleIds = new Set();
  for (const article of project.articles) {
    const id = String(article?.id || "").trim();
    if (!ID_RE.test(id) || articleIds.has(id)) diagnostics.push(fieldDiagnostic("INVALID_ARTICLE_ID", "文章 ID 必须有效且唯一", id, "id"));
    if (!participantIds.has(String(article?.authorId || ""))) diagnostics.push(fieldDiagnostic("UNKNOWN_ARTICLE_AUTHOR", "文章作者必须引用参与者", id, "authorId"));
    if (!ABS_TIME_RE.test(String(article?.publishAt || ""))) diagnostics.push(fieldDiagnostic("INVALID_PUBLISH_TIME", "发布时间必须是绝对时间", id, "publishAt"));
    if (!String(article?.title || "").trim()) diagnostics.push(fieldDiagnostic("ARTICLE_TITLE_REQUIRED", "文章标题不能为空", id, "title"));
    if (article.requireScore !== undefined && !Number.isFinite(Number(article.requireScore))) diagnostics.push(fieldDiagnostic("INVALID_REQUIRE_SCORE", "条件分数必须是数字", id, "requireScore"));
    articleIds.add(id);
  }
  for (const participant of participants) {
    const timelineIds = new Set();
    const effectiveTimes = new Set();
    for (const entry of participant.identityTimeline || []) {
      if (!ID_RE.test(String(entry.id || "")) || timelineIds.has(entry.id)) diagnostics.push(fieldDiagnostic("INVALID_TIMELINE_ID", "身份时间线 ID 必须有效且唯一", entry.id, "id"));
      if (!/^\d{4}-\d{2}-\d{2}/.test(String(entry.effectiveAt || ""))) diagnostics.push(fieldDiagnostic("INVALID_TIMELINE_TIME", "身份生效时间必须以 YYYY-MM-DD 开始", entry.id, "effectiveAt"));
      if (!String(entry.name || "").trim()) diagnostics.push(fieldDiagnostic("TIMELINE_NAME_REQUIRED", "身份名称不能为空", entry.id, "name"));
      if (effectiveTimes.has(entry.effectiveAt)) diagnostics.push(fieldDiagnostic("DUPLICATE_TIMELINE_TIME", "同一人物的身份生效时间不能重复", entry.id, "effectiveAt"));
      timelineIds.add(entry.id);
      effectiveTimes.add(entry.effectiveAt);
    }
  }
  const documentIds = new Set();
  for (const document of project.documents) {
    if (!ID_RE.test(String(document.id || "")) || documentIds.has(document.id)) diagnostics.push(fieldDiagnostic("INVALID_DOCUMENT_ID", "资料库文档 ID 必须有效且唯一", document.id, "id"));
    if (!document.items?.length) diagnostics.push(fieldDiagnostic("DOCUMENT_ITEMS_REQUIRED", "资料库文档至少需要一个条目", document.id, "items"));
    for (const item of document.items || []) {
      for (const participantId of item.participantIds || []) if (!participantIds.has(participantId)) diagnostics.push(fieldDiagnostic("UNKNOWN_TIMELINE_PARTICIPANT", `时间线引用了不存在的人物：${participantId}`, item.id, "participantIds"));
    }
    documentIds.add(document.id);
  }
  if (project.story.enabled) {
    const order = project.story.accountOrder || [];
    if (!order.length) diagnostics.push(fieldDiagnostic("STORY_ORDER_REQUIRED", "剧情至少需要一个账号", "story", "accountOrder"));
    for (const id of order) if (!participantIds.has(id)) diagnostics.push(fieldDiagnostic("UNKNOWN_STORY_ACCOUNT", `剧情账号不存在：${id}`, "story", "accountOrder"));
    if (project.story.resetInfo && !project.story.resetAccount) diagnostics.push(fieldDiagnostic("RESET_ACCOUNT_REQUIRED", "填写坏结局提示时必须选择重置起点", "story", "resetAccount"));
    if (project.story.resetAccount && !order.includes(project.story.resetAccount)) diagnostics.push(fieldDiagnostic("INVALID_RESET_ACCOUNT", "坏结局重置账号必须在推进顺序中", "story", "resetAccount"));
  }
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

function serializeRequirement(item) {
  const hasScore = item.requireScore !== undefined && item.requireScore !== null && item.requireScore !== "";
  const flags = Array.isArray(item.requireFlags) ? item.requireFlags.map(String).map((flag) => flag.trim()).filter(Boolean) : [];
  if (!hasScore && !flags.length) return undefined;
  return {
    ...(hasScore ? { score: Number(item.requireScore) } : {}),
    ...(flags.length ? { flags } : {}),
    scope: item.requireScope === "global" ? "global" : "account"
  };
}

function serializeMessage(project, message, assetMode, files) {
  const tags = [];
  if (message.timeRaw) tags.push(`[${message.timeRaw}]`);
  if (message.quoteId) tags.push(`[quote:${message.quoteId}]`);
  if (message.kind === "image") tags.push("[image]");
  if (message.kind === "link-card") tags.push("[link-card]");
  if (message.kind === "status") tags.push("[status]");
  if (message.kind === "choice") tags.push("[choice]");
  if (message.requireScore !== undefined && message.requireScore !== null && message.requireScore !== "") tags.push(`[require-score:${Number(message.requireScore)}${message.requireScope === "global" ? ":global" : ""}]`);
  for (const flag of (message.requireFlags || []).filter(Boolean)) tags.push(`[require-flag:${flag}]`);
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
  } else if (message.kind === "choice") {
    const choice = message.choice || {};
    body = yamlText({ prompt: choice.prompt || "请选择", ...(choice.speakerId ? { speaker: choice.speakerId } : {}), scope: choice.scope === "global" ? "global" : "account", options: Object.fromEntries((choice.options || []).map((option) => [option.id, { label: option.label, text: option.text, score: Number(option.score || 0), ...(option.flags?.length ? { flags: option.flags } : {}) }])) }).trimEnd();
  }
  return `${header}\n${body}`;
}

function yamlText(value) {
  return yaml.safeDump(value, { noRefs: true, lineWidth: 120, sortKeys: false, flowLevel: 6 });
}

export function serializeAuthoringProject(project, options = {}) {
  project = normalizeAuthoringProject(project);
  const diagnostics = validateAuthoringProject(project);
  if (diagnostics.some((item) => item.severity === "error")) {
    return { files: {}, entryPath: "", target: "folder", diagnostics };
  }
  const assetMode = options.assetMode === "files" ? "files" : "inline";
  const files = {};
  const users = {};
  for (const participant of project.participants) {
    const conversations = project.conversations.filter((conversation) => conversation.selfId === participant.id);
    const moments = {};
    for (const post of project.socialPosts.filter((item) => item.authorId === participant.id)) {
      moments[post.id] = {
        publishAt: post.publishAt,
        author: `@${post.authorId}`,
        text: post.text,
        ...(post.images?.length ? { images: post.images.map((image) => resolveMedia(project, image, assetMode, files)) } : {}),
        ...(serializeRequirement(post) ? { require: serializeRequirement(post) } : {})
      };
    }
    const timeline = Object.fromEntries((participant.identityTimeline || []).map((entry) => [entry.effectiveAt, {
      name: entry.name,
      ...(entry.avatar ? { avatar: resolveMedia(project, entry.avatar, assetMode, files) } : {}),
      ...(entry.bio ? { bio: entry.bio } : {})
    }]));
    users[participant.id] = {
      ...(Object.keys(timeline).length ? { identityTimeline: timeline } : { name: participant.name }),
      ...(!Object.keys(timeline).length && participant.avatar ? { avatar: resolveMedia(project, participant.avatar, assetMode, files) } : {}),
      ...(!Object.keys(timeline).length && participant.bio ? { bio: participant.bio } : {}),
      ...(Object.keys(moments).length ? { moments } : {}),
      ...(project.articles.some((article) => article.authorId === participant.id)
        ? { officialArticles: project.articles.filter((article) => article.authorId === participant.id).map((article) => `./articles/${article.id}.md`) }
        : {}),
      ...(conversations.length ? { chatFiles: conversations.map((conversation) => `conversations/${conversation.id}.md`) } : {}),
      ...(conversations.length ? { groupChats: Object.fromEntries(conversations.map((conversation) => [`conversations/${conversation.id}.md`, `chats/${conversation.id}.yml`])) } : {})
    };
  }
  files["project.yml"] = yamlText({
    specVersion: AUTHORING_SPEC_VERSION,
    project: {
      id: project.id,
      title: project.title,
      target: "hub",
      conversations: project.conversations.map((conversation) => ({ id: conversation.id, file: `conversations/${conversation.id}.md`, chat: `chats/${conversation.id}.yml` })),
      documents: project.documents.map((document) => ({ id: document.id, file: `documents/${document.id}.yml`, type: document.type }))
    }
  });
  files["profiles.yml"] = yamlText({ users });
  files["ui.yml"] = yamlText({ ui: { statusBar: { carrier: project.statusBarCarrier || "中国移动" }, topTitle: project.title, theme: project.theme, persistKey: `chat_framework_studio_${sanitizeFileName(project.id, "project")}` } });
  for (const conversation of project.conversations) {
    const chatPath = `chats/${conversation.id}.yml`;
    files[chatPath] = yamlText({ chat: { type: conversation.type, self: conversation.selfId, title: conversation.title, ...(serializeRequirement(conversation) ? { require: serializeRequirement(conversation) } : {}) } });
    const frontmatter = yamlText({
      title: conversation.title,
      profiles: "../profiles.yml",
      chat: `../${chatPath}`,
      articles: "../articles",
      theme: project.theme,
      specVersion: AUTHORING_SPEC_VERSION
    }).trimEnd();
    const messages = conversation.messages.map((message) => serializeMessage(project, message, assetMode, files)).join("\n\n");
    files[`conversations/${conversation.id}.md`] = `---\n${frontmatter}\n---\n\n${messages}\n`;
  }
  for (const article of project.articles) {
    const author = project.participants.find((participant) => participant.id === article.authorId);
    const frontmatter = yamlText({
      publishAt: article.publishAt,
      title: article.title,
      author: author?.name || article.authorId,
      ...(article.cover ? { cover: resolveMedia(project, article.cover, assetMode, files, "../") } : {}),
      ...(article.summary ? { summary: article.summary } : {}),
      ...(article.images?.length ? { images: article.images.map((image) => resolveMedia(project, image, assetMode, files, "../")) } : {}),
      ...(serializeRequirement(article) ? { require: serializeRequirement(article) } : {})
    }).trimEnd();
    files[`articles/${article.id}.md`] = `---\n${frontmatter}\n---\n\n${String(article.body || "").trim()}\n`;
  }
  for (const document of project.documents) {
    files[`documents/${document.id}.yml`] = yamlText({
      type: document.type,
      title: document.title,
      theme: project.theme,
      items: document.items.map((item) => document.type === "settings" ? {
        image: resolveMedia(project, item.image, assetMode, files, "../"), name: item.name, description: item.description
      } : {
        ...(item.image ? { image: resolveMedia(project, item.image, assetMode, files, "../") } : {}), time: item.time, description: item.description,
        participants: item.participantIds.map((id) => project.participants.find((participant) => participant.id === id)?.name || id)
      })
    });
  }
  if (project.story.enabled) files["story.yml"] = yamlText({ story: {
    accountOrder: project.story.accountOrder,
    ...(project.story.title ? { title: project.story.title } : {}),
    ...(project.story.favicon ? { favicon: resolveMedia(project, project.story.favicon, assetMode, files) } : {}),
    ...(project.story.resetInfo ? { resetInfo: project.story.resetInfo } : {}),
    ...(project.story.resetAccount ? { resetAccount: project.story.resetAccount } : {}),
    ...(project.story.endInfo ? { endInfo: project.story.endInfo } : {})
  } });
  return { files, entryPath: "", target: "folder", diagnostics: [] };
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

function parseMarkdownDocument(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { data: {}, content: text };
  const end = text.indexOf("\n---\n", 4);
  if (end < 0) return { data: {}, content: text };
  return { data: yaml.safeLoad(text.slice(4, end)) || {}, content: text.slice(end + 5).trim() };
}

export function parseAuthoringProject(source) {
  const manifest = parseYamlFile(source, "project.yml");
  const manifestVersion = String(manifest.specVersion || "");
  if (![AUTHORING_SPEC_VERSION, LEGACY_AUTHORING_SPEC_VERSION].includes(manifestVersion)) {
    throw new Error(`Unsupported project specVersion: ${manifest.specVersion || "missing"}`);
  }
  const profilesWrap = parseYamlFile(source, "profiles.yml");
  const assets = [];
  const assetIds = new Map();
  const participants = Object.entries(profilesWrap.users || {}).map(([id, profile]) => {
    const timeline = Object.entries(profile?.identityTimeline || {}).map(([effectiveAt, entry], index) => ({
      id: `${id}-identity-${index + 1}`,
      effectiveAt,
      name: String(entry?.name || id),
      avatar: resolveImportAsset(source, entry?.avatar || "", ".", assets, assetIds),
      bio: String(entry?.bio || "")
    })).sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt));
    return {
      id,
      name: String(profile?.name || timeline[0]?.name || id),
      avatar: resolveImportAsset(source, profile?.avatar || timeline[0]?.avatar || "", ".", assets, assetIds),
      bio: String(profile?.bio || timeline[0]?.bio || ""),
      identityTimeline: timeline
    };
  });
  const configuredConversations = Array.isArray(manifest.project?.conversations)
    ? manifest.project.conversations
    : [{ id: "main", file: String(manifest.project?.entry || "conversations/main.md"), chat: "chat.yml" }];
  let theme = "wechat";
  const conversations = configuredConversations.map((entry, index) => {
    const entryPath = String(entry.file || `conversations/conversation-${index + 1}.md`);
    const parsed = parseChatMarkdown(source.readText(entryPath));
    theme = String(parsed.frontmatter?.theme || theme);
    const chatPath = String(entry.chat || "chat.yml");
    const chatWrap = source.exists(chatPath) ? parseYamlFile(source, chatPath) : {};
    const chat = chatWrap.chat || {};
    const messages = parsed.messages.map((message) => ({
      id: message.id,
      senderId: message.senderId,
      timeRaw: message.timeRaw || "",
      kind: message.kind,
      text: message.text || "",
      imageSource: message.kind === "image" ? resolveImportAsset(source, message.imageUrl || "", dirnameProjectPath(entryPath), assets, assetIds) : "",
      caption: message.kind === "image" ? String(message.text || "") : "",
      linkCard: message.kind === "link-card" ? { ...message.linkCard, image: resolveImportAsset(source, message.linkCard?.image || "", dirnameProjectPath(entryPath), assets, assetIds) } : undefined,
      quoteId: message.quote?.messageId || "",
      recallDelaySec: message.recall?.delayMs ? Math.round(message.recall.delayMs / 1000) : 0,
      ...(message.require?.score !== undefined ? { requireScore: Number(message.require.score) } : {}),
      requireFlags: Array.isArray(message.require?.flags) ? message.require.flags.map(String) : [],
      requireScope: message.require?.scope === "global" ? "global" : "account",
      ...(message.kind === "choice" ? { choice: {
        prompt: String(message.choice?.prompt || ""),
        speakerId: String(message.choice?.speaker || ""),
        scope: message.choice?.scope === "global" ? "global" : "account",
        options: (message.choice?.options || []).map((option) => ({ id: String(option.id), label: String(option.label || ""), text: String(option.text || option.label || ""), score: Number(option.score || 0), flags: Array.isArray(option.flags) ? option.flags.map(String) : [] }))
      } } : {})
    }));
    return {
      id: String(entry.id || `conversation-${index + 1}`),
      title: String(chat.title || parsed.frontmatter?.title || `会话 ${index + 1}`),
      type: chat.type === "group" ? "group" : "single",
      selfId: String(chat.self || participants[0]?.id || ""),
      messages,
      ...(chat.require?.score !== undefined ? { requireScore: Number(chat.require.score) } : {}),
      requireFlags: Array.isArray(chat.require?.flags) ? chat.require.flags.map(String) : (chat.require?.flag ? [String(chat.require.flag)] : []),
      requireScope: chat.require?.scope === "global" ? "global" : "account"
    };
  });
  const socialPosts = [];
  for (const [authorId, profile] of Object.entries(profilesWrap.users || {})) {
    for (const [id, post] of Object.entries(profile?.moments || {})) {
      socialPosts.push({
        id,
        authorId: String(post?.author || "").replace(/^@/, "") || authorId,
        publishAt: String(post?.publishAt || ""),
        text: String(post?.text || ""),
        images: (Array.isArray(post?.images) ? post.images : []).map((image) => resolveImportAsset(source, image, ".", assets, assetIds)),
        ...(post?.require?.score !== undefined ? { requireScore: Number(post.require.score) } : {}),
        requireFlags: Array.isArray(post?.require?.flags) ? post.require.flags.map(String) : (post?.require?.flag ? [String(post.require.flag)] : []),
        requireScope: post?.require?.scope === "global" ? "global" : "account"
      });
    }
  }
  const articleOwners = new Map();
  for (const [authorId, profile] of Object.entries(profilesWrap.users || {})) {
    for (const ref of (Array.isArray(profile?.officialArticles) ? profile.officialArticles : [])) {
      const id = String(ref).split("/").pop()?.replace(/\.(?:md|markdown|ya?ml)$/i, "") || String(ref);
      articleOwners.set(id, authorId);
    }
  }
  const articles = [];
  if (source.exists("articles") && source.stat("articles").isDirectory()) {
    for (const entry of source.list("articles").filter((item) => item.type === "file" && /\.md$/i.test(item.name))) {
      const id = entry.name.replace(/\.md$/i, "");
      const parsed = parseMarkdownDocument(source.readText(entry.path));
      articles.push({
        id,
        authorId: articleOwners.get(id) || participants[0]?.id || "",
        publishAt: String(parsed.data.publishAt || ""),
        title: String(parsed.data.title || id),
        cover: resolveImportAsset(source, parsed.data.cover || "", "articles", assets, assetIds),
        summary: String(parsed.data.summary || ""),
        body: parsed.content,
        images: (Array.isArray(parsed.data.images) ? parsed.data.images : []).map((image) => resolveImportAsset(source, image, "articles", assets, assetIds)),
        ...(parsed.data.require?.score !== undefined ? { requireScore: Number(parsed.data.require.score) } : {}),
        requireFlags: Array.isArray(parsed.data.require?.flags) ? parsed.data.require.flags.map(String) : (parsed.data.require?.flag ? [String(parsed.data.require.flag)] : []),
        requireScope: parsed.data.require?.scope === "global" ? "global" : "account"
      });
    }
  }
  const ui = source.exists("ui.yml") ? parseYamlFile(source, "ui.yml").ui || {} : {};
  const documents = [];
  for (const entry of (Array.isArray(manifest.project?.documents) ? manifest.project.documents : [])) {
    const filePath = String(entry.file || `documents/${entry.id}.yml`);
    if (!source.exists(filePath)) continue;
    const raw = parseYamlFile(source, filePath);
    const type = raw.type === "timeline" ? "timeline" : "settings";
    documents.push({
      id: String(entry.id || filePath.split("/").pop()?.replace(/\.ya?ml$/i, "") || "document"),
      type,
      title: String(raw.title || (type === "timeline" ? "时间线" : "设定")),
      items: (Array.isArray(raw.items) ? raw.items : []).map((item, index) => ({
        id: `${entry.id || "document"}-item-${index + 1}`,
        name: String(item?.name || ""),
        image: resolveImportAsset(source, item?.image || "", dirnameProjectPath(filePath), assets, assetIds),
        time: String(item?.time || ""),
        description: String(item?.description || ""),
        participantIds: (Array.isArray(item?.participants) ? item.participants : []).map((name) => participants.find((participant) => participant.name === name || participant.identityTimeline.some((timeline) => timeline.name === name))?.id || String(name))
      }))
    });
  }
  const storyRaw = source.exists("story.yml") ? parseYamlFile(source, "story.yml").story || {} : {};
  return normalizeAuthoringProject({
    schemaVersion: AUTHORING_SPEC_VERSION,
    id: String(manifest.project?.id || randomId("project")),
    title: String(manifest.project?.title || "未命名聊天作品"),
    theme: String(ui.theme || theme),
    statusBarCarrier: String(ui.statusBar?.carrier || "中国移动"),
    selfId: String(conversations[0]?.selfId || participants[0]?.id || ""),
    participants,
    conversations,
    socialPosts,
    articles,
    documents,
    story: {
      enabled: source.exists("story.yml"),
      accountOrder: Array.isArray(storyRaw.accountOrder) ? storyRaw.accountOrder.map(String) : [],
      title: String(storyRaw.title || ""),
      favicon: resolveImportAsset(source, storyRaw.favicon || "", ".", assets, assetIds),
      resetInfo: String(storyRaw.resetInfo || ""),
      resetAccount: String(storyRaw.resetAccount || ""),
      endInfo: String(storyRaw.endInfo || "")
    },
    assets
  });
}

export function nextEntityId(prefix, existingIds = []) {
  const used = new Set(existingIds.map(String));
  let index = 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}
