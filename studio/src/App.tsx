import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { compileDocumentProject, compileFolderProject } from "../../src/compiler.js";
import { createStarterProject, createStudioDemoProject, nextEntityId, parseAuthoringProject, projectFilesToSource, serializeAuthoringProject, STUDIO_DEMO_PROJECT_ID } from "../../src/format-sdk.js";
import { listProjects, loadProject, removeProject, saveProject, syncBuiltinProject } from "./storage";
import DependencyGraphPanel from "./DependencyGraphPanel";
import type { GraphNavigationTarget } from "./DependencyGraphPanel";
import type { Article, Asset, AuthoringProject, Conversation, Diagnostic, LibraryDocument, Message, MessageKind, Participant, ProjectSummary, Requirement, SocialPost } from "./types";

type Panel = "conversations" | "social" | "articles" | "participants" | "library" | "story" | "dependencies" | "project" | "files";
type MobileView = "projects" | "editor" | "preview";
type WorkerResult = { requestId: number; html?: string; diagnostics: Diagnostic[]; files?: Record<string, string | Uint8Array> };
type FocusRequest = GraphNavigationTarget & { token: number };

const clone = <T,>(value: T): T => structuredClone(value);
const projectFactory = (): AuthoringProject => createStarterProject() as AuthoringProject;
const demoProjectFactory = (): AuthoringProject => createStudioDemoProject() as AuthoringProject;

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string, fallback: string) {
  return value.trim().replace(/[^\p{L}\p{N}_.-]+/gu, "-").replace(/^-|-$/g, "") || fallback;
}

function escapeHtmlText(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function FieldError({ diagnostics, entityId, field }: { diagnostics: Diagnostic[]; entityId?: string; field: string }) {
  const item = diagnostics.find((diagnostic) => diagnostic.field === field && (!entityId || diagnostic.entityId === entityId));
  return item ? <small className="field-error">{item.message}</small> : null;
}

function EditorSummary({ title, tag, tagTone = "neutral", summary, expanded, onToggle }: { title: string; tag?: string; tagTone?: "neutral" | "active" | "empty"; summary?: string; expanded: boolean; onToggle: () => void }) {
  return <button type="button" className="editor-summary" aria-expanded={expanded} onClick={onToggle}>
    <strong>{title}</strong>
    {tag && <span className={`editor-summary-tag ${tagTone}`}>{tag}</span>}
    {summary && <span className="editor-summary-text">{summary}</span>}
    <span className="message-expand-icon" aria-hidden="true">⌄</span>
  </button>;
}

export default function App() {
  const [project, setProjectState] = useState<AuthoringProject>(() => demoProjectFactory());
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<Panel>("conversations");
  const [activeConversationId, setActiveConversationId] = useState("main");
  const [mobileView, setMobileView] = useState<MobileView>("editor");
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [files, setFiles] = useState<Record<string, string | Uint8Array>>({});
  const [saveStatus, setSaveStatus] = useState("本地草稿");
  const [undoStack, setUndoStack] = useState<AuthoringProject[]>([]);
  const [redoStack, setRedoStack] = useState<AuthoringProject[]>([]);
  const [draggedMessage, setDraggedMessage] = useState("");
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const latestResult = useRef(0);
  const importRef = useRef<HTMLInputElement>(null);

  const refreshProjects = useCallback(async () => setProjects(await listProjects()), []);
  const activeConversation = project.conversations.find((conversation) => conversation.id === activeConversationId) || project.conversations[0];

  useEffect(() => {
    if (!project.conversations.some((conversation) => conversation.id === activeConversationId)) {
      setActiveConversationId(project.conversations[0]?.id || "");
    }
  }, [activeConversationId, project.conversations]);

  useEffect(() => {
    const boot = async () => {
      await syncBuiltinProject(demoProjectFactory());
      const rows = await listProjects();
      const saved = rows[0] ? await loadProject(rows[0].id) : null;
      setProjectState(saved || demoProjectFactory());
      await refreshProjects();
      setReady(true);
    };
    void boot();
  }, [refreshProjects]);

  useEffect(() => {
    workerRef.current = new Worker(new URL("./preview.worker.ts", import.meta.url), { type: "module" });
    workerRef.current.onmessage = (event: MessageEvent<WorkerResult>) => {
      if (event.data.requestId < latestResult.current) return;
      latestResult.current = event.data.requestId;
      setDiagnostics(event.data.diagnostics || []);
      if (event.data.files) setFiles(event.data.files);
      if (event.data.html) setPreviewHtml(event.data.html);
    };
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (!ready) return;
    setSaveStatus("保存中…");
    const timer = window.setTimeout(async () => {
      if (project.id === STUDIO_DEMO_PROJECT_ID) {
        setSaveStatus("内置 Demo · 复制后编辑");
      } else {
        await saveProject(project);
        setSaveStatus("已保存");
        await refreshProjects();
      }
    }, 450);
    const previewTimer = window.setTimeout(() => {
      const next = ++requestId.current;
      workerRef.current?.postMessage({ requestId: next, project });
    }, 320);
    return () => { window.clearTimeout(timer); window.clearTimeout(previewTimer); };
  }, [project, ready, refreshProjects]);

  const update = useCallback((recipe: (draft: AuthoringProject) => void) => {
    setProjectState((current) => {
      const draft = clone(current);
      recipe(draft);
      setUndoStack((items) => [...items.slice(-49), clone(current)]);
      setRedoStack([]);
      return draft;
    });
  }, []);

  const undo = useCallback(() => {
    setUndoStack((items) => {
      const previous = items.at(-1);
      if (!previous) return items;
      setProjectState((current) => { setRedoStack((redo) => [...redo, clone(current)]); return clone(previous); });
      return items.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((items) => {
      const next = items.at(-1);
      if (!next) return items;
      setProjectState((current) => { setUndoStack((undoItems) => [...undoItems, clone(current)]); return clone(next); });
      return items.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      event.shiftKey ? redo() : undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [redo, undo]);

  const selectProject = async (id: string) => {
    const loaded = await loadProject(id);
    if (!loaded) return;
    setProjectState(loaded);
    setUndoStack([]);
    setRedoStack([]);
    setMobileView("editor");
  };

  const newProject = async () => {
    const next = projectFactory();
    await saveProject(next);
    setProjectState(next);
    setUndoStack([]);
    setRedoStack([]);
    await refreshProjects();
  };

  const duplicateProject = async () => {
    const next = clone(project);
    next.id = `project-${crypto.randomUUID().slice(0, 8)}`;
    next.title = `${project.title} 副本`;
    await saveProject(next);
    setProjectState(next);
    await refreshProjects();
  };

  const deleteProject = async () => {
    if (project.id === STUDIO_DEMO_PROJECT_ID) return;
    if (!window.confirm(`删除“${project.title}”的本地草稿？此操作无法撤销。`)) return;
    await removeProject(project.id);
    const rows = await listProjects();
    const next = rows[0] ? await loadProject(rows[0].id) : projectFactory();
    if (next) { await saveProject(next); setProjectState(next); }
    await refreshProjects();
  };

  const addMessage = (kind: MessageKind) => update((draft) => {
    const conversation = draft.conversations.find((item) => item.id === activeConversationId);
    if (!conversation) return;
    const ids = conversation.messages.map((message) => message.id);
    const message: Message = {
      id: nextEntityId("m", ids), senderId: draft.selfId, timeRaw: "+1m", kind,
      text: kind === "status" ? "状态更新" : "", quoteId: "", recallDelaySec: 0
    };
    if (kind === "image") { message.imageSource = ""; message.caption = ""; }
    if (kind === "link-card") message.linkCard = { url: "https://", title: "", desc: "", image: "", site: "" };
    if (kind === "choice") message.choice = { prompt: "请选择", speakerId: draft.selfId, scope: "account", options: [{ id: "option-a", label: "选项 A", text: "选项 A", score: 0, flags: [] }, { id: "option-b", label: "选项 B", text: "选项 B", score: 0, flags: [] }] };
    conversation.messages.push(message);
  });

  const patchMessage = (id: string, patch: Partial<Message>) => update((draft) => {
    const target = draft.conversations.find((item) => item.id === activeConversationId)?.messages.find((message) => message.id === id);
    if (target) Object.assign(target, patch);
  });

  const reorderMessage = (targetId: string) => {
    if (!draggedMessage || draggedMessage === targetId) return;
    update((draft) => {
      const messages = draft.conversations.find((item) => item.id === activeConversationId)?.messages;
      if (!messages) return;
      const from = messages.findIndex((message) => message.id === draggedMessage);
      const to = messages.findIndex((message) => message.id === targetId);
      if (from < 0 || to < 0) return;
      messages.splice(to, 0, messages.splice(from, 1)[0]);
    });
    setDraggedMessage("");
  };

  const addAsset = async (file: File): Promise<string> => {
    const id = `asset-${crypto.randomUUID().slice(0, 8)}`;
    const asset: Asset = { id, fileName: file.name, mimeType: file.type || "application/octet-stream", dataUrl: await fileToDataUrl(file) };
    update((draft) => { draft.assets.push(asset); });
    return `asset:${id}`;
  };

  const exportHtml = () => previewHtml && downloadBlob(new Blob([previewHtml], { type: "text/html;charset=utf-8" }), `${safeFileName(project.title, "chat")}.html`);

  const exportPackage = async () => {
    const result = serializeAuthoringProject(project, { assetMode: "files" });
    if (result.diagnostics.length) { setDiagnostics(result.diagnostics as Diagnostic[]); return; }
    const zip = new JSZip();
    Object.entries(result.files).forEach(([path, value]) => zip.file(path, value));
    downloadBlob(await zip.generateAsync({ type: "blob" }), `${safeFileName(project.title, "chat-project")}.zip`);
  };

  const exportWebsite = async () => {
    const serialized = serializeAuthoringProject(project, { assetMode: "files" });
    if (serialized.diagnostics.length) { setDiagnostics(serialized.diagnostics as Diagnostic[]); return; }
    const source = projectFilesToSource(serialized.files);
    const hub = compileFolderProject({ source, inputDir: "", title: project.title });
    if (!("html" in hub)) { setDiagnostics(hub.diagnostics as Diagnostic[]); return; }
    const zip = new JSZip();
    const siteNavCss = `<style>.cf-site-nav{position:fixed;right:14px;bottom:76px;z-index:9999;padding:9px 12px;border-radius:999px;background:#16765b;color:white!important;text-decoration:none;font:600 12px system-ui;box-shadow:0 6px 20px #0003}</style>`;
    const withSiteNav = (html: string, href: string, label: string) => html.replace("</body>", `${siteNavCss}<a class="cf-site-nav" href="${href}">${label}</a></body>`);
    zip.file("index.html", withSiteNav(hub.html!, "library.html", "资料库 ↗"));
    Object.entries(serialized.files).filter(([path]) => path.startsWith("assets/")).forEach(([path, value]) => zip.file(path, value));
    for (const document of project.documents) {
      const inputPath = `documents/${document.id}.yml`;
      const outputPath = `documents/${document.id}.html`;
      const result = compileDocumentProject({ source, inputPath, outputPath });
      if (!("html" in result)) { setDiagnostics(result.diagnostics as Diagnostic[]); return; }
      zip.file(outputPath, withSiteNav(result.html!, "../library.html", "← 资料库"));
    }
    const links = project.documents.map((document) => `<li><a href="documents/${document.id}.html">${escapeHtmlText(document.title)}</a></li>`).join("");
    const siteTitle = escapeHtmlText(project.title);
    zip.file("library.html", `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${siteTitle} · 资料库</title><style>body{max-width:720px;margin:40px auto;padding:20px;font:16px/1.7 system-ui;background:#f5f3ed;color:#27251f}a{color:#16765b}li{margin:12px 0}</style><h1>${siteTitle} · 资料库</h1><p><a href="index.html">← 返回作品</a></p><ul>${links || "<li>暂无资料</li>"}</ul>`);
    downloadBlob(await zip.generateAsync({ type: "blob" }), `${safeFileName(project.title, "chat-site")}-site.zip`);
  };

  const importPackage = async (file: File) => {
    try {
      const zip = await JSZip.loadAsync(file);
      const importedFiles: Record<string, string | Uint8Array> = {};
      await Promise.all(Object.values(zip.files).filter((entry) => !entry.dir).map(async (entry) => {
        const textFile = /\.(?:md|ya?ml)$/i.test(entry.name);
        importedFiles[entry.name] = await entry.async(textFile ? "string" : "uint8array");
      }));
      const imported = parseAuthoringProject(projectFilesToSource(importedFiles)) as AuthoringProject;
      if (projects.some((item) => item.id === imported.id)) imported.id = `project-${crypto.randomUUID().slice(0, 8)}`;
      await saveProject(imported);
      setProjectState(imported);
      setUndoStack([]);
      setRedoStack([]);
      await refreshProjects();
    } catch (error) {
      setDiagnostics([{ severity: "error", code: "IMPORT_FAILED", message: error instanceof Error ? error.message : String(error) }]);
    }
  };

  const errorCount = diagnostics.filter((item) => item.severity === "error").length;
  const fileEntries = useMemo(() => Object.entries(files).sort(([a], [b]) => a.localeCompare(b)), [files]);
  const navigateFromGraph = (target: GraphNavigationTarget) => {
    setPanel(target.panel);
    if (target.conversationId) setActiveConversationId(target.conversationId);
    setFocusRequest({ ...target, token: Date.now() });
  };

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setMobileView("projects")}><span>CF</span> Chat Framework Studio</button>
      <div className="top-actions">
        <button className="icon-button" onClick={undo} disabled={!undoStack.length} title="撤销">↶</button>
        <button className="icon-button" onClick={redo} disabled={!redoStack.length} title="重做">↷</button>
        <span className="save-state">● {saveStatus}</span>
        <button onClick={() => importRef.current?.click()}>导入项目</button>
        <button onClick={() => void exportPackage()}>导出项目</button>
        <button onClick={() => void exportWebsite()}>导出网站</button>
        <button className="primary" onClick={exportHtml} disabled={!previewHtml}>下载 HTML</button>
        <input ref={importRef} hidden type="file" accept=".zip,application/zip" onChange={(event) => event.target.files?.[0] && void importPackage(event.target.files[0])} />
      </div>
    </header>

    <nav className="mobile-tabs">
      {(["projects", "editor", "preview"] as MobileView[]).map((view) => <button key={view} className={mobileView === view ? "active" : ""} onClick={() => setMobileView(view)}>{view === "projects" ? "作品" : view === "editor" ? "编辑" : "预览"}</button>)}
    </nav>

    <aside className={`project-rail mobile-${mobileView}`}>
      <div className="rail-heading"><strong>我的作品</strong><button className="round-button" onClick={() => void newProject()}>＋</button></div>
      <div className="project-list">
        {projects.map((item) => <button key={item.id} className={`project-card ${item.id === project.id ? "active" : ""}`} onClick={() => void selectProject(item.id)}>
          <span className="project-monogram">{item.title.slice(0, 1) || "聊"}</span><span><strong>{item.title}</strong><small>{item.id === STUDIO_DEMO_PROJECT_ID ? "内置基线 · 刷新恢复最新版" : new Date(item.updatedAt).toLocaleString()}</small></span>
        </button>)}
      </div>
      <div className="rail-actions"><button onClick={() => void duplicateProject()}>{project.id === STUDIO_DEMO_PROJECT_ID ? "复制 Demo 后编辑" : "复制作品"}</button><button className="danger" disabled={project.id === STUDIO_DEMO_PROJECT_ID} onClick={() => void deleteProject()}>删除</button></div>
    </aside>

    <main className={`editor-pane mobile-${mobileView}`}>
      <div className="editor-title">
        <div><span className="eyebrow">当前作品</span><strong className="editor-project-name">{project.title}</strong></div>
        <span className={errorCount ? "diagnostic-badge error" : "diagnostic-badge"}>{errorCount ? `${errorCount} 个问题` : "格式有效"}</span>
      </div>
      <div className="panel-tabs">
        {(["conversations", "social", "articles", "participants", "library", "story", "dependencies", "project", "files"] as Panel[]).map((item) => <button key={item} className={panel === item ? "active" : ""} onClick={() => setPanel(item)}>{({ conversations: "对话", social: "朋友圈", articles: "文章", participants: "人物", library: "资料库", story: "剧情", dependencies: "依赖图", project: "外观", files: "生成文件" })[item]}</button>)}
      </div>
      <div className="editor-scroll">
        {diagnostics.length > 0 && <div className="diagnostics"><strong>诊断</strong>{diagnostics.map((item, index) => <button key={`${item.code}-${index}`} onClick={() => item.entityId && document.getElementById(`entity-${item.entityId}`)?.scrollIntoView({ behavior: "smooth" })}><span>{item.severity === "error" ? "!" : "i"}</span>{item.message}</button>)}</div>}
        {panel === "conversations" && activeConversation && <ConversationsPanel project={project} conversation={activeConversation} activeConversationId={activeConversation.id} setActiveConversationId={setActiveConversationId} diagnostics={diagnostics} addMessage={addMessage} patchMessage={patchMessage} update={update} addAsset={addAsset} draggedMessage={draggedMessage} setDraggedMessage={setDraggedMessage} reorderMessage={reorderMessage} focusRequest={focusRequest} />}
        {panel === "social" && <SocialPanel project={project} update={update} addAsset={addAsset} focusRequest={focusRequest} />}
        {panel === "articles" && <ArticlesPanel project={project} update={update} addAsset={addAsset} focusRequest={focusRequest} />}
        {panel === "participants" && <ParticipantsPanel project={project} diagnostics={diagnostics} update={update} addAsset={addAsset} />}
        {panel === "library" && <LibraryPanel project={project} update={update} addAsset={addAsset} />}
        {panel === "story" && <StoryPanel project={project} update={update} />}
        {panel === "dependencies" && <DependencyGraphPanel project={project} onNavigate={navigateFromGraph} />}
        {panel === "project" && <ProjectPanel project={project} diagnostics={diagnostics} update={update} />}
        {panel === "files" && <FilesPanel files={fileEntries} />}
      </div>
    </main>

    <section className={`preview-pane mobile-${mobileView}`}>
      <div className="preview-heading"><div><span className="live-dot" />实时预览</div><button onClick={() => setPreviewHtml((html) => `${html} `)}>刷新</button></div>
      <div className="phone-stage"><div className="phone-frame"><iframe title="作品预览" sandbox="allow-scripts allow-forms allow-popups" srcDoc={previewHtml} /></div></div>
      <p className="preview-note">预览由真实 Markdown/YAML 和共享编译器生成</p>
    </section>
  </div>;
}

function ConversationsPanel({ project, conversation, activeConversationId, setActiveConversationId, diagnostics, addMessage, patchMessage, update, addAsset, draggedMessage, setDraggedMessage, reorderMessage, focusRequest }: {
  project: AuthoringProject; conversation: Conversation; activeConversationId: string; setActiveConversationId: (id: string) => void; diagnostics: Diagnostic[];
  addMessage: (kind: MessageKind) => void; patchMessage: (id: string, patch: Partial<Message>) => void;
  update: (recipe: (draft: AuthoringProject) => void) => void; addAsset: (file: File) => Promise<string>; draggedMessage: string; setDraggedMessage: (id: string) => void; reorderMessage: (id: string) => void; focusRequest: FocusRequest | null;
}) {
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [requirementExpanded, setRequirementExpanded] = useState(false);
  useEffect(() => { setSettingsExpanded(false); setRequirementExpanded(false); }, [conversation.id, project.id]);
  useEffect(() => {
    if (focusRequest?.panel === "conversations" && focusRequest.entityId === conversation.id) setRequirementExpanded(true);
  }, [conversation.id, focusRequest]);
  const addConversation = () => {
    const id = nextEntityId("conversation", project.conversations.map((item) => item.id));
    update((draft) => { draft.conversations.push({ id, title: "新对话", type: "single", selfId: draft.selfId, messages: [{ id: "m1", senderId: draft.selfId, timeRaw: "2026-01-01 10:00:00", kind: "text", text: "第一条消息", quoteId: "", recallDelaySec: 0 }] }); });
    setActiveConversationId(id);
  };
  const patchConversation = (patch: Partial<Conversation>) => update((draft) => {
    const target = draft.conversations.find((item) => item.id === activeConversationId);
    if (target) Object.assign(target, patch);
  });
  const requirementFlags = conversation.requireFlags || [];
  const hasRequirement = conversation.requireScore !== undefined || requirementFlags.length > 0;
  const requirementSummary = [
    conversation.requireScore !== undefined ? `${conversation.requireScope === "global" ? "全局" : "当前账号"}得分 ≥ ${conversation.requireScore}` : "",
    requirementFlags.length ? `Flags：${requirementFlags.join(" + ")}` : ""
  ].filter(Boolean).join(" · ");
  const selfName = project.participants.find((person) => person.id === conversation.selfId)?.name || conversation.selfId;
  return <div>
    <div className="section-heading"><div><h2>对话</h2><p>共享人物库下可创建单聊、群聊和多个对话，名称与右侧预览保持一致。</p></div><button onClick={addConversation}>＋ 添加对话</button></div>
    <div className="content-switcher">{project.conversations.map((item) => <button key={item.id} className={item.id === activeConversationId ? "active" : ""} onClick={() => setActiveConversationId(item.id)}><strong>{item.title}</strong><small>{item.type === "group" ? "群聊" : "单聊"} · {item.messages.length} 条</small></button>)}</div>
    <div className={`module-settings collapsible-editor ${settingsExpanded ? "expanded" : "collapsed"}`}>
      <EditorSummary title="对话设置" tag={conversation.type === "group" ? "群聊" : "单聊"} summary={`当前账号：${selfName} · ${conversation.messages.length} 条消息`} expanded={settingsExpanded} onToggle={() => setSettingsExpanded((value) => !value)} />
      {settingsExpanded && <div className="editor-details field-row three">
        <label>对话标题<input value={conversation.title} onChange={(event) => patchConversation({ title: event.target.value })} /></label>
        <label>对话类型<select value={conversation.type} onChange={(event) => patchConversation({ type: event.target.value as Conversation["type"] })}><option value="single">单聊</option><option value="group">群聊</option></select></label>
        <label>当前账号<select value={conversation.selfId} onChange={(event) => patchConversation({ selfId: event.target.value })}>{project.participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      </div>}
    </div>
    <div className={`module-settings requirement-card ${requirementExpanded ? "expanded" : "collapsed"}`}>
      <EditorSummary title="对话解锁规则" tag={hasRequirement ? "有解锁条件" : "无解锁条件"} tagTone={hasRequirement ? "active" : "empty"} summary={hasRequirement ? requirementSummary : undefined} expanded={requirementExpanded} onToggle={() => setRequirementExpanded((value) => !value)} />
      {requirementExpanded && <div className="editor-details"><RequirementFields item={conversation} onChange={(value) => patchConversation(value)} /></div>}
    </div>
    {project.conversations.length > 1 && <button className="inline-danger" onClick={() => { const next = project.conversations.find((item) => item.id !== conversation.id); if (next) setActiveConversationId(next.id); update((draft) => { draft.conversations = draft.conversations.filter((item) => item.id !== conversation.id); }); }}>删除当前对话</button>}
    <MessagesPanel project={project} conversation={conversation} diagnostics={diagnostics} addMessage={addMessage} patchMessage={patchMessage} update={update} addAsset={addAsset} draggedMessage={draggedMessage} setDraggedMessage={setDraggedMessage} reorderMessage={reorderMessage} focusRequest={focusRequest} />
  </div>;
}

function MessagesPanel({ project, conversation, diagnostics, addMessage, patchMessage, update, addAsset, draggedMessage, setDraggedMessage, reorderMessage, focusRequest }: {
  project: AuthoringProject; conversation: Conversation; diagnostics: Diagnostic[]; addMessage: (kind: MessageKind) => void; patchMessage: (id: string, patch: Partial<Message>) => void;
  update: (recipe: (draft: AuthoringProject) => void) => void; addAsset: (file: File) => Promise<string>; draggedMessage: string; setDraggedMessage: (id: string) => void; reorderMessage: (id: string) => void; focusRequest: FocusRequest | null;
}) {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(() => new Set());
  useEffect(() => setExpandedMessages(new Set()), [conversation.id, project.id]);
  useEffect(() => {
    if (focusRequest?.panel !== "conversations" || focusRequest.conversationId !== conversation.id || !conversation.messages.some((message) => message.id === focusRequest.entityId)) return;
    setExpandedMessages((current) => new Set(current).add(focusRequest.entityId));
    requestAnimationFrame(() => document.getElementById(`entity-${focusRequest.entityId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [conversation.id, conversation.messages, focusRequest]);
  const kindLabels: Record<MessageKind, string> = { text: "文字", image: "图片", "link-card": "链接", status: "状态", choice: "选择" };
  const summaryFor = (message: Message) => {
    const value = message.kind === "image"
      ? message.caption || message.imageSource || "未选择图片"
      : message.kind === "link-card"
        ? message.linkCard?.title || message.linkCard?.desc || message.linkCard?.url || "未填写链接卡片"
        : message.kind === "choice"
          ? message.choice?.prompt || "未填写选择题"
          : message.text || "未填写内容";
    return value.replace(/\s+/g, " ").trim();
  };
  const toggleMessage = (id: string) => setExpandedMessages((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const addAndExpand = (kind: MessageKind) => {
    const id = nextEntityId("m", conversation.messages.map((message) => message.id));
    addMessage(kind);
    setExpandedMessages((current) => new Set(current).add(id));
  };
  return <div>
    <div className="section-heading"><div><h2>消息流</h2><p>点击消息行展开详情；拖拽左侧手柄调整阅读顺序。</p></div><div className="add-menu">{(["text", "image", "link-card", "status", "choice"] as MessageKind[]).map((kind) => <button key={kind} onClick={() => addAndExpand(kind)}>＋ {kindLabels[kind]}</button>)}</div></div>
    <div className="message-list">
      {conversation.messages.map((message, index) => {
        const expanded = expandedMessages.has(message.id);
        const hasError = diagnostics.some((diagnostic) => diagnostic.severity === "error" && diagnostic.entityId === message.id);
        return <article id={`entity-${message.id}`} key={message.id} draggable className={`message-card ${expanded ? "expanded" : "collapsed"} ${hasError ? "has-error" : ""} ${draggedMessage === message.id ? "dragging" : ""}`} onDragStart={() => setDraggedMessage(message.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderMessage(message.id)}>
        <div className="card-index"><span>⋮⋮</span>{String(index + 1).padStart(2, "0")}</div>
        <div className="card-body">
          <button type="button" className="message-summary" aria-expanded={expanded} onClick={() => toggleMessage(message.id)}>
            <span className={`message-kind kind-${message.kind}`}>{kindLabels[message.kind]}</span>
            <span className="message-summary-text">{summaryFor(message)}</span>
            {hasError && <span className="message-error-mark" title="此消息存在问题">!</span>}
            <span className="message-expand-icon" aria-hidden="true">⌄</span>
          </button>
          {expanded && <div className="message-details">
          <div className="field-row three">
            <label>发送者<select value={message.senderId} onChange={(event) => patchMessage(message.id, { senderId: event.target.value })}>{project.participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><FieldError diagnostics={diagnostics} entityId={message.id} field="senderId" /></label>
            <label>时间<input value={message.timeRaw} onChange={(event) => patchMessage(message.id, { timeRaw: event.target.value })} /><FieldError diagnostics={diagnostics} entityId={message.id} field="timeRaw" /></label>
            <label>类型<select value={message.kind} onChange={(event) => patchMessage(message.id, { kind: event.target.value as MessageKind })}><option value="text">文字</option><option value="image">图片</option><option value="link-card">链接卡片</option><option value="status">状态</option><option value="choice">选择分支</option></select></label>
          </div>
          {(message.kind === "text" || message.kind === "status") && <label>内容<textarea rows={3} value={message.text} onChange={(event) => patchMessage(message.id, { text: event.target.value })} /><FieldError diagnostics={diagnostics} entityId={message.id} field="text" /></label>}
          {message.kind === "image" && <><label>图片地址<input value={message.imageSource || ""} placeholder="https://… 或选择本地图片" onChange={(event) => patchMessage(message.id, { imageSource: event.target.value })} /><FieldError diagnostics={diagnostics} entityId={message.id} field="imageSource" /></label><label className="file-button">选择本地图片<input hidden type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) patchMessage(message.id, { imageSource: await addAsset(file) }); }} /></label><label>图片说明<input value={message.caption || ""} onChange={(event) => patchMessage(message.id, { caption: event.target.value })} /></label></>}
          {message.kind === "link-card" && <div className="link-fields"><label>网址<input value={message.linkCard?.url || ""} onChange={(event) => patchMessage(message.id, { linkCard: { ...message.linkCard!, url: event.target.value } })} /><FieldError diagnostics={diagnostics} entityId={message.id} field="linkCard.url" /></label><label>标题<input value={message.linkCard?.title || ""} onChange={(event) => patchMessage(message.id, { linkCard: { ...message.linkCard!, title: event.target.value } })} /></label><label>摘要<textarea rows={2} value={message.linkCard?.desc || ""} onChange={(event) => patchMessage(message.id, { linkCard: { ...message.linkCard!, desc: event.target.value } })} /></label><label>站点<input value={message.linkCard?.site || ""} onChange={(event) => patchMessage(message.id, { linkCard: { ...message.linkCard!, site: event.target.value } })} /></label></div>}
          {message.kind === "choice" && <ChoiceEditor message={message} patchMessage={patchMessage} participants={project.participants} />}
          <div className="field-row two"><label>引用前序消息<select value={message.quoteId} onChange={(event) => patchMessage(message.id, { quoteId: event.target.value })}><option value="">不引用</option>{conversation.messages.slice(0, index).map((item) => <option key={item.id} value={item.id}>{item.id} · {item.text?.slice(0, 24) || item.kind}</option>)}</select><FieldError diagnostics={diagnostics} entityId={message.id} field="quoteId" /></label><label>撤回延迟（秒）<input type="number" min="0" value={message.recallDelaySec || 0} onChange={(event) => patchMessage(message.id, { recallDelaySec: Number(event.target.value) })} /></label></div>
          <RequirementFields item={message} onChange={(value) => patchMessage(message.id, value)} />
          </div>}
        </div>
        <button className="remove-button" title="删除消息" onClick={() => update((draft) => { const target = draft.conversations.find((item) => item.id === conversation.id); if (!target) return; target.messages = target.messages.filter((item) => item.id !== message.id); target.messages.forEach((item) => { if (item.quoteId === message.id) item.quoteId = ""; }); })}>×</button>
      </article>;
      })}
    </div>
  </div>;
}

function RequirementFields({ item, onChange }: { item: Requirement; onChange: (value: Partial<Requirement>) => void }) {
  return <div className="field-row three"><label>条件分数<input type="number" placeholder="不限制" value={item.requireScore ?? ""} onChange={(event) => onChange({ requireScore: event.target.value === "" ? undefined : Number(event.target.value) })} /></label><label>条件范围<select value={item.requireScope || "account"} onChange={(event) => onChange({ requireScope: event.target.value as "account" | "global" })}><option value="account">当前账号</option><option value="global">全局</option></select></label><label>条件 Flags<input value={(item.requireFlags || []).join(", ")} placeholder="flag-a, flag-b" onChange={(event) => onChange({ requireFlags: event.target.value.split(",").map((flag) => flag.trim()).filter(Boolean) })} /></label></div>;
}

function ChoiceEditor({ message, patchMessage, participants }: { message: Message; patchMessage: (id: string, patch: Partial<Message>) => void; participants: Participant[] }) {
  const choice = message.choice || { prompt: "请选择", speakerId: participants[0]?.id || "", scope: "account" as const, options: [] };
  const patchChoice = (value: Partial<NonNullable<Message["choice"]>>) => patchMessage(message.id, { choice: { ...choice, ...value } });
  return <div className="choice-editor"><div className="field-row three"><label>问题<input value={choice.prompt} onChange={(event) => patchChoice({ prompt: event.target.value })} /></label><label>回复者<select value={choice.speakerId} onChange={(event) => patchChoice({ speakerId: event.target.value })}>{participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>计分范围<select value={choice.scope} onChange={(event) => patchChoice({ scope: event.target.value as "account" | "global" })}><option value="account">当前账号</option><option value="global">全局</option></select></label></div><div className="choice-options">{choice.options.map((option, index) => <div className="choice-option" key={`${option.id}-${index}`}><input aria-label="选项 ID" value={option.id} onChange={(event) => patchChoice({ options: choice.options.map((item, i) => i === index ? { ...item, id: event.target.value } : item) })} /><input aria-label="按钮文案" value={option.label} onChange={(event) => patchChoice({ options: choice.options.map((item, i) => i === index ? { ...item, label: event.target.value } : item) })} /><input aria-label="回复文本" value={option.text} onChange={(event) => patchChoice({ options: choice.options.map((item, i) => i === index ? { ...item, text: event.target.value } : item) })} /><input aria-label="得分" type="number" value={option.score} onChange={(event) => patchChoice({ options: choice.options.map((item, i) => i === index ? { ...item, score: Number(event.target.value) } : item) })} /><input aria-label="Flags" placeholder="flags" value={option.flags.join(", ")} onChange={(event) => patchChoice({ options: choice.options.map((item, i) => i === index ? { ...item, flags: event.target.value.split(",").map((flag) => flag.trim()).filter(Boolean) } : item) })} /><button className="remove-button" onClick={() => patchChoice({ options: choice.options.filter((_, i) => i !== index) })}>×</button></div>)}</div><button className="inline-button" onClick={() => patchChoice({ options: [...choice.options, { id: `option-${choice.options.length + 1}`, label: `选项 ${choice.options.length + 1}`, text: "", score: 0, flags: [] }] })}>＋ 添加选项</button></div>;
}

function SocialPanel({ project, update, addAsset, focusRequest }: { project: AuthoringProject; update: (recipe: (draft: AuthoringProject) => void) => void; addAsset: (file: File) => Promise<string>; focusRequest: FocusRequest | null }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => setExpanded(new Set()), [project.id]);
  useEffect(() => {
    if (focusRequest?.panel !== "social" || !project.socialPosts.some((item) => item.id === focusRequest.entityId)) return;
    setExpanded((current) => new Set(current).add(focusRequest.entityId));
    requestAnimationFrame(() => document.getElementById(`entity-${focusRequest.entityId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [focusRequest, project.socialPosts]);
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const patch = (id: string, value: Partial<SocialPost>) => update((draft) => { const target = draft.socialPosts.find((item) => item.id === id); if (target) Object.assign(target, value); });
  const add = () => {
    const id = nextEntityId("moment", project.socialPosts.map((item) => item.id));
    update((draft) => { draft.socialPosts.push({ id, authorId: draft.selfId, publishAt: "2026-01-01 10:00:00", text: "新的朋友圈", images: [] }); });
    setExpanded((current) => new Set(current).add(id));
  };
  return <div><div className="section-heading"><div><h2>朋友圈</h2><p>默认显示作者与正文摘要，点击后查看和编辑完整内容。</p></div><button onClick={add}>＋ 添加朋友圈</button></div>
    <div className="module-list">{project.socialPosts.map((post) => { const open = expanded.has(post.id); const author = project.participants.find((person) => person.id === post.authorId)?.name || post.authorId; return <article className={`settings-card compact-module-card ${open ? "expanded" : "collapsed"}`} id={`entity-${post.id}`} key={post.id}><button type="button" className="message-summary" aria-expanded={open} onClick={() => toggle(post.id)}><span className="message-kind kind-social">朋友圈</span><span className="summary-author">{author}</span><span className="message-summary-text">{post.text.replace(/\s+/g, " ").trim() || `${post.images.length} 张图片`}</span><span className="message-expand-icon">⌄</span></button>{open && <div className="compact-module-details"><div className="field-row two"><label>作者<select value={post.authorId} onChange={(event) => patch(post.id, { authorId: event.target.value })}>{project.participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>发布时间<input value={post.publishAt} onChange={(event) => patch(post.id, { publishAt: event.target.value })} /></label></div><label>正文<textarea rows={4} value={post.text} onChange={(event) => patch(post.id, { text: event.target.value })} /></label><label>图片（每行一个 URL 或 asset 引用）<textarea rows={3} value={post.images.join("\n")} onChange={(event) => patch(post.id, { images: event.target.value.split(/\n+/).map((item) => item.trim()).filter(Boolean) })} /></label><RequirementFields item={post} onChange={(value) => patch(post.id, value)} /><div className="module-card-actions"><label className="file-button">添加本地图片<input hidden type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) patch(post.id, { images: [...post.images, await addAsset(file)] }); }} /></label><button className="inline-danger" onClick={() => update((draft) => { draft.socialPosts = draft.socialPosts.filter((item) => item.id !== post.id); })}>删除朋友圈</button></div></div>}</article>; })}</div>
  </div>;
}

function ArticlesPanel({ project, update, addAsset, focusRequest }: { project: AuthoringProject; update: (recipe: (draft: AuthoringProject) => void) => void; addAsset: (file: File) => Promise<string>; focusRequest: FocusRequest | null }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => setExpanded(new Set()), [project.id]);
  useEffect(() => {
    if (focusRequest?.panel !== "articles" || !project.articles.some((item) => item.id === focusRequest.entityId)) return;
    setExpanded((current) => new Set(current).add(focusRequest.entityId));
    requestAnimationFrame(() => document.getElementById(`entity-${focusRequest.entityId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [focusRequest, project.articles]);
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const patch = (id: string, value: Partial<Article>) => { if (value.id !== undefined && value.id !== id) setExpanded((current) => { const next = new Set(current); if (next.delete(id)) next.add(value.id!); return next; }); update((draft) => { const target = draft.articles.find((item) => item.id === id); if (target) Object.assign(target, value); }); };
  const add = () => { const id = nextEntityId("article", project.articles.map((item) => item.id)); update((draft) => { draft.articles.push({ id, authorId: draft.selfId, publishAt: "2026-01-01 09:00:00", title: "新文章", cover: "", summary: "", body: "# 新文章\n\n从这里开始写正文。", images: [] }); }); setExpanded((current) => new Set(current).add(id)); };
  return <div><div className="section-heading"><div><h2>文章</h2><p>默认显示标题、作者与摘要，点击后编辑 Markdown 正文和完整属性。</p></div><button onClick={add}>＋ 添加文章</button></div>
    <div className="module-list">{project.articles.map((article) => { const open = expanded.has(article.id); const author = project.participants.find((person) => person.id === article.authorId)?.name || article.authorId; const summary = article.summary || article.body.replace(/[#*_>`\[\]]/g, " ").replace(/\s+/g, " ").trim(); return <article className={`settings-card article-editor-card compact-module-card ${open ? "expanded" : "collapsed"}`} id={`entity-${article.id}`} key={article.id}><button type="button" className="message-summary" aria-expanded={open} onClick={() => toggle(article.id)}><span className="message-kind kind-article">文章</span><strong className="summary-title">{article.title}</strong><span className="summary-author">{author}</span><span className="message-summary-text">{summary || "暂无摘要"}</span><span className="message-expand-icon">⌄</span></button>{open && <div className="compact-module-details"><div className="field-row two"><label>标题<input value={article.title} onChange={(event) => patch(article.id, { title: event.target.value })} /></label><label>稳定 ID<input value={article.id} onChange={(event) => patch(article.id, { id: event.target.value })} /></label></div><div className="field-row two"><label>作者<select value={article.authorId} onChange={(event) => patch(article.id, { authorId: event.target.value })}>{project.participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>发布时间<input value={article.publishAt} onChange={(event) => patch(article.id, { publishAt: event.target.value })} /></label></div><label>摘要<textarea rows={2} value={article.summary} onChange={(event) => patch(article.id, { summary: event.target.value })} /></label><label>封面<input value={article.cover} placeholder="https://… 或 asset:…" onChange={(event) => patch(article.id, { cover: event.target.value })} /></label><label className="file-button">上传封面<input hidden type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) patch(article.id, { cover: await addAsset(file) }); }} /></label><label>Markdown 正文<textarea className="markdown-editor" rows={12} value={article.body} onChange={(event) => patch(article.id, { body: event.target.value })} /></label><label>附图（每行一个 URL 或 asset 引用）<textarea rows={3} value={article.images.join("\n")} onChange={(event) => patch(article.id, { images: event.target.value.split(/\n+/).map((item) => item.trim()).filter(Boolean) })} /></label><RequirementFields item={article} onChange={(value) => patch(article.id, value)} /><div className="module-card-actions"><label className="file-button">添加附图<input hidden type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) patch(article.id, { images: [...article.images, await addAsset(file)] }); }} /></label><button className="inline-danger" onClick={() => update((draft) => { draft.articles = draft.articles.filter((item) => item.id !== article.id); })}>删除文章</button></div></div>}</article>; })}</div>
  </div>;
}

function ParticipantsPanel({ project, diagnostics, update, addAsset }: { project: AuthoringProject; diagnostics: Diagnostic[]; update: (recipe: (draft: AuthoringProject) => void) => void; addAsset: (file: File) => Promise<string> }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => setExpanded(new Set()), [project.id]);
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const patch = (id: string, value: Partial<Participant>) => update((draft) => { const target = draft.participants.find((item) => item.id === id); if (target) Object.assign(target, value); });
  const avatarUrl = (person: Participant) => person.avatar.startsWith("asset:") ? project.assets.find((item) => `asset:${item.id}` === person.avatar)?.dataUrl : person.avatar;
  const rename = (old: string, value: string) => { setExpanded((current) => { const next = new Set(current); if (next.delete(old)) next.add(value); return next; }); update((draft) => { const target = draft.participants.find((item) => item.id === old); if (!target) return; target.id = value; if (draft.selfId === old) draft.selfId = value; draft.conversations.forEach((conversation) => { if (conversation.selfId === old) conversation.selfId = value; conversation.messages.forEach((message) => { if (message.senderId === old) message.senderId = value; if (message.choice?.speakerId === old) message.choice.speakerId = value; }); }); draft.socialPosts.forEach((post) => { if (post.authorId === old) post.authorId = value; }); draft.articles.forEach((article) => { if (article.authorId === old) article.authorId = value; }); draft.documents.forEach((document) => document.items.forEach((item) => { item.participantIds = item.participantIds.map((id) => id === old ? value : id); })); draft.story.accountOrder = draft.story.accountOrder.map((id) => id === old ? value : id); if (draft.story.resetAccount === old) draft.story.resetAccount = value; }); };
  const add = () => { const id = nextEntityId("person", project.participants.map((item) => item.id)); update((draft) => { draft.participants.push({ id, name: "新角色", avatar: "", bio: "", identityTimeline: [] }); }); setExpanded((current) => new Set(current).add(id)); };
  return <div><div className="section-heading"><div><h2>人物</h2><p>默认显示头像、名称与简介，点击后编辑完整档案和身份时间线。</p></div><button onClick={add}>＋ 添加人物</button></div><div className="participant-grid">{project.participants.map((person) => { const open = expanded.has(person.id); return <article className={`participant-card compact-module-card ${open ? "expanded" : "collapsed"}`} id={`entity-${person.id}`} key={person.id}><button type="button" className="message-summary participant-summary" aria-expanded={open} onClick={() => toggle(person.id)}><span className="summary-avatar">{person.avatar ? <img src={avatarUrl(person)} /> : person.name.slice(0, 1)}</span><span className="message-kind kind-person">人物</span><strong className="summary-title">{person.name}</strong><span className="message-summary-text">{person.bio || (person.identityTimeline.length ? `${person.identityTimeline.length} 段身份时间线` : "暂无简介")}</span><span className="message-expand-icon">⌄</span></button>{open && <div className="compact-module-details participant-fields"><div className="field-row two"><label>基准显示名<input value={person.name} onChange={(event) => patch(person.id, { name: event.target.value })} /><FieldError diagnostics={diagnostics} entityId={person.id} field="name" /></label><label>稳定 ID<input value={person.id} onChange={(event) => rename(person.id, event.target.value)} /><FieldError diagnostics={diagnostics} entityId={person.id} field="id" /></label></div><label>基准头像<input value={person.avatar} placeholder="https://… 或选择本地图片" onChange={(event) => patch(person.id, { avatar: event.target.value })} /></label><label className="file-button">上传头像<input hidden type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) patch(person.id, { avatar: await addAsset(file) }); }} /></label><label>基准简介<textarea rows={2} value={person.bio} onChange={(event) => patch(person.id, { bio: event.target.value })} /></label><div className="timeline-editor"><div className="subsection-heading"><strong>身份时间线</strong><button className="inline-button" onClick={() => update((draft) => { const target = draft.participants.find((item) => item.id === person.id); target?.identityTimeline.push({ id: `${person.id}-identity-${(target.identityTimeline.length || 0) + 1}`, effectiveAt: "2026-01-01", name: person.name, avatar: person.avatar, bio: person.bio }); })}>＋ 添加身份</button></div>{person.identityTimeline.map((entry, index) => <div className="identity-row" key={entry.id}><input aria-label="生效日期" value={entry.effectiveAt} onChange={(event) => update((draft) => { const target = draft.participants.find((item) => item.id === person.id)?.identityTimeline[index]; if (target) target.effectiveAt = event.target.value; })} /><input aria-label="身份名称" value={entry.name} onChange={(event) => update((draft) => { const target = draft.participants.find((item) => item.id === person.id)?.identityTimeline[index]; if (target) target.name = event.target.value; })} /><input aria-label="身份头像" placeholder="头像" value={entry.avatar} onChange={(event) => update((draft) => { const target = draft.participants.find((item) => item.id === person.id)?.identityTimeline[index]; if (target) target.avatar = event.target.value; })} /><input aria-label="身份简介" placeholder="简介" value={entry.bio} onChange={(event) => update((draft) => { const target = draft.participants.find((item) => item.id === person.id)?.identityTimeline[index]; if (target) target.bio = event.target.value; })} /><button className="remove-button" onClick={() => update((draft) => { const target = draft.participants.find((item) => item.id === person.id); if (target) target.identityTimeline = target.identityTimeline.filter((_, i) => i !== index); })}>×</button></div>)}</div>{project.participants.length > 2 && <button className="inline-danger" onClick={() => update((draft) => { draft.participants = draft.participants.filter((item) => item.id !== person.id); })}>删除人物</button>}</div>}</article>; })}</div></div>;
}

function LibraryPanel({ project, update, addAsset }: { project: AuthoringProject; update: (recipe: (draft: AuthoringProject) => void) => void; addAsset: (file: File) => Promise<string> }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => setExpanded(new Set()), [project.id]);
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const patchDocument = (id: string, value: Partial<LibraryDocument>) => update((draft) => { const target = draft.documents.find((item) => item.id === id); if (target) Object.assign(target, value); });
  const renameDocument = (oldId: string, id: string) => {
    setExpanded((current) => { const next = new Set(current); if (next.delete(oldId)) next.add(id); return next; });
    patchDocument(oldId, { id });
  };
  const add = () => {
    const id = nextEntityId("document", project.documents.map((item) => item.id));
    update((draft) => { draft.documents.push({ id, type: "settings", title: "新设定集", items: [{ id: `${id}-item-1`, name: "新设定", image: "", time: "", description: "填写设定说明。", participantIds: [] }] }); });
    setExpanded((current) => new Set(current).add(id));
  };
  return <div>
    <div className="section-heading"><div><h2>资料库与时间线</h2><p>设定集与事件时间线可作为独立页面导出；时间线参与者始终引用人物 ID。</p></div><button onClick={add}>＋ 添加文档</button></div>
    <div className="module-list">{project.documents.map((document) => {
      const open = expanded.has(document.id);
      return <article className={`settings-card compact-module-card ${open ? "expanded" : "collapsed"}`} key={document.id}>
        <EditorSummary title={document.title} tag={document.type === "timeline" ? "时间线" : "设定集"} summary={`${document.items.length} 个条目 · ${document.id}`} expanded={open} onToggle={() => toggle(document.id)} />
        {open && <div className="compact-module-details">
          <div className="field-row three"><label>标题<input value={document.title} onChange={(event) => patchDocument(document.id, { title: event.target.value })} /></label><label>稳定 ID<input value={document.id} onChange={(event) => renameDocument(document.id, event.target.value)} /></label><label>类型<select value={document.type} onChange={(event) => patchDocument(document.id, { type: event.target.value as LibraryDocument["type"] })}><option value="settings">设定集</option><option value="timeline">时间线</option></select></label></div>
          <div className="library-items">{document.items.map((item, index) => <div className="library-item" key={item.id}>{document.type === "settings" ? <label>名称<input value={item.name} onChange={(event) => update((draft) => { const target = draft.documents.find((row) => row.id === document.id)?.items[index]; if (target) target.name = event.target.value; })} /></label> : <label>时间<input value={item.time} onChange={(event) => update((draft) => { const target = draft.documents.find((row) => row.id === document.id)?.items[index]; if (target) target.time = event.target.value; })} /></label>}<label>图片<input value={item.image} placeholder="URL 或 asset:…" onChange={(event) => update((draft) => { const target = draft.documents.find((row) => row.id === document.id)?.items[index]; if (target) target.image = event.target.value; })} /></label><label className="file-button">上传图片<input hidden type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const reference = await addAsset(file); update((draft) => { const target = draft.documents.find((row) => row.id === document.id)?.items[index]; if (target) target.image = reference; }); }} /></label>{document.type === "timeline" && <label>参与人物<select multiple value={item.participantIds} onChange={(event) => update((draft) => { const target = draft.documents.find((row) => row.id === document.id)?.items[index]; if (target) target.participantIds = Array.from(event.target.selectedOptions, (option) => option.value); })}>{project.participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}<label>Markdown 描述<textarea rows={4} value={item.description} onChange={(event) => update((draft) => { const target = draft.documents.find((row) => row.id === document.id)?.items[index]; if (target) target.description = event.target.value; })} /></label><button className="inline-danger" onClick={() => update((draft) => { const target = draft.documents.find((row) => row.id === document.id); if (target) target.items = target.items.filter((_, i) => i !== index); })}>删除条目</button></div>)}</div>
          <div className="module-card-actions"><button className="inline-button" onClick={() => update((draft) => { const target = draft.documents.find((row) => row.id === document.id); if (!target) return; target.items.push({ id: `${target.id}-item-${target.items.length + 1}`, name: "新设定", image: "", time: "新节点", description: "填写描述。", participantIds: target.type === "timeline" ? [draft.selfId] : [] }); })}>＋ 添加条目</button><button className="inline-danger" onClick={() => update((draft) => { draft.documents = draft.documents.filter((item) => item.id !== document.id); })}>删除文档</button></div>
        </div>}
      </article>;
    })}</div>
  </div>;
}

function StoryPanel({ project, update }: { project: AuthoringProject; update: (recipe: (draft: AuthoringProject) => void) => void }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [project.id]);
  const move = (index: number, offset: number) => update((draft) => { const next = index + offset; if (next < 0 || next >= draft.story.accountOrder.length) return; draft.story.accountOrder.splice(next, 0, draft.story.accountOrder.splice(index, 1)[0]); });
  const endingSummary = [project.story.resetAccount ? "坏结局已配置" : "无坏结局", project.story.endInfo ? "真结局已配置" : "无真结局"].join(" · ");
  return <div>
    <div className="section-heading"><div><h2>剧情与推进</h2><p>配置账号解锁顺序、阶段时间 Runtime，以及坏结局/真结局的统一提示。</p></div></div>
    <div className={`settings-card compact-module-card story-settings ${expanded ? "expanded" : "collapsed"}`}>
      <EditorSummary title={project.story.title || "剧情推进"} tag={project.story.enabled ? "已启用" : "未启用"} tagTone={project.story.enabled ? "active" : "empty"} summary={`${project.story.accountOrder.length} 个账号 · ${endingSummary}`} expanded={expanded} onToggle={() => setExpanded((value) => !value)} />
      {expanded && <div className="compact-module-details">
        <label className="toggle-row"><input type="checkbox" checked={project.story.enabled} onChange={(event) => update((draft) => { draft.story.enabled = event.target.checked; if (!draft.story.accountOrder.length) draft.story.accountOrder = [draft.selfId]; })} />启用剧情推进 Runtime</label>
        <div className="field-row two"><label>网页标题<input value={project.story.title} onChange={(event) => update((draft) => { draft.story.title = event.target.value; })} /></label><label>Favicon<input value={project.story.favicon} placeholder="URL 或 asset:…" onChange={(event) => update((draft) => { draft.story.favicon = event.target.value; })} /></label></div>
        <div><div className="subsection-heading"><strong>账号推进顺序</strong><select value="" onChange={(event) => { const id = event.target.value; if (id) update((draft) => { if (!draft.story.accountOrder.includes(id)) draft.story.accountOrder.push(id); }); }}><option value="">＋ 添加账号</option>{project.participants.filter((person) => !project.story.accountOrder.includes(person.id)).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div><div className="order-list">{project.story.accountOrder.map((id, index) => <div key={id}><span>{index + 1}</span><strong>{project.participants.find((person) => person.id === id)?.name || id}</strong><button onClick={() => move(index, -1)}>↑</button><button onClick={() => move(index, 1)}>↓</button><button className="inline-danger" onClick={() => update((draft) => { draft.story.accountOrder = draft.story.accountOrder.filter((item) => item !== id); })}>移除</button></div>)}</div></div>
        <div className="field-row two"><label>坏结局提示<textarea rows={3} value={project.story.resetInfo} onChange={(event) => update((draft) => { draft.story.resetInfo = event.target.value; })} /></label><label>重置起点<select value={project.story.resetAccount} onChange={(event) => update((draft) => { draft.story.resetAccount = event.target.value; })}><option value="">不配置坏结局</option>{project.story.accountOrder.map((id) => <option key={id} value={id}>{project.participants.find((person) => person.id === id)?.name || id}</option>)}</select></label></div>
        <label>真结局提示<textarea rows={3} value={project.story.endInfo} onChange={(event) => update((draft) => { draft.story.endInfo = event.target.value; })} /></label>
        <div className="contract-note"><strong>规则引用约定</strong><p>选择选项授予的 flags 可直接用于消息、对话、朋友圈和文章的解锁条件；以 bad-end / true-end 开头的 flag 会触发现有结局 Runtime。</p></div>
      </div>}
    </div>
  </div>;
}

function ProjectPanel({ project, diagnostics, update }: { project: AuthoringProject; diagnostics: Diagnostic[]; update: (recipe: (draft: AuthoringProject) => void) => void }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [project.id]);
  const themeLabel = ({ wechat: "微信", paper: "纸张", iterms: "终端" } as Record<string, string>)[project.theme] || project.theme;
  const selfName = project.participants.find((person) => person.id === project.selfId)?.name || project.selfId;
  return <div>
    <div className="section-heading"><div><h2>外观与项目</h2><p>设置写入版本化项目文件，Hub、对话、朋友圈和文章共享。</p></div></div>
    <div className={`settings-card compact-module-card ${expanded ? "expanded" : "collapsed"}`}>
      <EditorSummary title={project.title} tag={themeLabel} summary={`默认账号：${selfName} · 运营商：${project.statusBarCarrier || "未设置"}`} expanded={expanded} onToggle={() => setExpanded((value) => !value)} />
      {expanded && <div className="compact-module-details">
        <label>作品标题<input value={project.title} onChange={(event) => update((draft) => { draft.title = event.target.value; })} /><FieldError diagnostics={diagnostics} field="title" /></label>
        <div className="field-row two"><label>主题<select value={project.theme} onChange={(event) => update((draft) => { draft.theme = event.target.value; })}><option value="wechat">微信</option><option value="paper">纸张</option><option value="iterms">终端</option></select></label><label>状态栏运营商<input value={project.statusBarCarrier} placeholder="中国移动" onChange={(event) => update((draft) => { draft.statusBarCarrier = event.target.value; })} /></label></div>
        <label>默认账号<select value={project.selfId} onChange={(event) => update((draft) => { draft.selfId = event.target.value; })}>{project.participants.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select><FieldError diagnostics={diagnostics} entityId={project.selfId} field="selfId" /></label>
        <div className="contract-note"><strong>公开格式契约 v{project.schemaVersion}</strong><p>预览和导出生成多对话目录、共享 profiles、朋友圈与 Markdown 文章，再交给 Folder Compiler。</p></div>
      </div>}
    </div>
  </div>;
}

function FilesPanel({ files }: { files: [string, string | Uint8Array][] }) {
  const [active, setActive] = useState("");
  const selected = files.find(([path]) => path === (active || files[0]?.[0]));
  return <div><div className="section-heading"><div><h2>生成文件</h2><p>这是 Studio 与 Node 渲染器之间真正交换的虚拟项目。</p></div></div><div className="file-browser"><nav>{files.map(([path]) => <button className={(active || files[0]?.[0]) === path ? "active" : ""} key={path} onClick={() => setActive(path)}>{path}</button>)}</nav><pre>{selected ? (typeof selected[1] === "string" ? selected[1] : `二进制资源 · ${selected[1].byteLength} bytes`) : "修正诊断后将显示生成文件。"}</pre></div></div>;
}
