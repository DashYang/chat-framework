import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { createStarterProject, nextEntityId, parseAuthoringProject, projectFilesToSource, serializeAuthoringProject } from "../../src/format-sdk.js";
import { listProjects, loadProject, removeProject, saveProject } from "./storage";
import type { Asset, AuthoringProject, Diagnostic, Message, MessageKind, Participant, ProjectSummary } from "./types";

type Panel = "messages" | "participants" | "project" | "files";
type MobileView = "projects" | "editor" | "preview";
type WorkerResult = { requestId: number; html?: string; diagnostics: Diagnostic[]; files?: Record<string, string | Uint8Array> };

const clone = <T,>(value: T): T => structuredClone(value);
const projectFactory = (): AuthoringProject => createStarterProject() as AuthoringProject;

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

export default function App() {
  const [project, setProjectState] = useState<AuthoringProject>(() => projectFactory());
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [panel, setPanel] = useState<Panel>("messages");
  const [mobileView, setMobileView] = useState<MobileView>("editor");
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [files, setFiles] = useState<Record<string, string | Uint8Array>>({});
  const [saveStatus, setSaveStatus] = useState("本地草稿");
  const [undoStack, setUndoStack] = useState<AuthoringProject[]>([]);
  const [redoStack, setRedoStack] = useState<AuthoringProject[]>([]);
  const [draggedMessage, setDraggedMessage] = useState("");
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const latestResult = useRef(0);
  const importRef = useRef<HTMLInputElement>(null);

  const refreshProjects = useCallback(async () => setProjects(await listProjects()), []);

  useEffect(() => {
    const boot = async () => {
      const rows = await listProjects();
      if (rows[0]) {
        const saved = await loadProject(rows[0].id);
        if (saved) setProjectState(saved);
      } else {
        const starter = projectFactory();
        setProjectState(starter);
        await saveProject(starter);
      }
      await refreshProjects();
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
    setSaveStatus("保存中…");
    const timer = window.setTimeout(async () => {
      await saveProject(project);
      setSaveStatus("已保存");
      await refreshProjects();
    }, 450);
    const previewTimer = window.setTimeout(() => {
      const next = ++requestId.current;
      workerRef.current?.postMessage({ requestId: next, project });
    }, 320);
    return () => { window.clearTimeout(timer); window.clearTimeout(previewTimer); };
  }, [project, refreshProjects]);

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
    if (!window.confirm(`删除“${project.title}”的本地草稿？此操作无法撤销。`)) return;
    await removeProject(project.id);
    const rows = await listProjects();
    const next = rows[0] ? await loadProject(rows[0].id) : projectFactory();
    if (next) { await saveProject(next); setProjectState(next); }
    await refreshProjects();
  };

  const addMessage = (kind: MessageKind) => update((draft) => {
    const ids = draft.conversation.messages.map((message) => message.id);
    const message: Message = {
      id: nextEntityId("m", ids), senderId: draft.selfId, timeRaw: "+1m", kind,
      text: kind === "status" ? "状态更新" : "", quoteId: "", recallDelaySec: 0
    };
    if (kind === "image") { message.imageSource = ""; message.caption = ""; }
    if (kind === "link-card") message.linkCard = { url: "https://", title: "", desc: "", image: "", site: "" };
    draft.conversation.messages.push(message);
  });

  const patchMessage = (id: string, patch: Partial<Message>) => update((draft) => {
    const target = draft.conversation.messages.find((message) => message.id === id);
    if (target) Object.assign(target, patch);
  });

  const reorderMessage = (targetId: string) => {
    if (!draggedMessage || draggedMessage === targetId) return;
    update((draft) => {
      const messages = draft.conversation.messages;
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

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setMobileView("projects")}><span>CF</span> Chat Framework Studio</button>
      <div className="top-actions">
        <button className="icon-button" onClick={undo} disabled={!undoStack.length} title="撤销">↶</button>
        <button className="icon-button" onClick={redo} disabled={!redoStack.length} title="重做">↷</button>
        <span className="save-state">● {saveStatus}</span>
        <button onClick={() => importRef.current?.click()}>导入项目</button>
        <button onClick={() => void exportPackage()}>导出项目</button>
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
          <span className="project-monogram">{item.title.slice(0, 1) || "聊"}</span><span><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleString()}</small></span>
        </button>)}
      </div>
      <div className="rail-actions"><button onClick={() => void duplicateProject()}>复制作品</button><button className="danger" onClick={() => void deleteProject()}>删除</button></div>
    </aside>

    <main className={`editor-pane mobile-${mobileView}`}>
      <div className="editor-title">
        <div><span className="eyebrow">当前作品</span><input value={project.title} onChange={(event) => update((draft) => { draft.title = event.target.value; })} /></div>
        <span className={errorCount ? "diagnostic-badge error" : "diagnostic-badge"}>{errorCount ? `${errorCount} 个问题` : "格式有效"}</span>
      </div>
      <div className="panel-tabs">
        {(["messages", "participants", "project", "files"] as Panel[]).map((item) => <button key={item} className={panel === item ? "active" : ""} onClick={() => setPanel(item)}>{({ messages: "消息", participants: "参与者", project: "外观与会话", files: "生成文件" })[item]}</button>)}
      </div>
      <div className="editor-scroll">
        {diagnostics.length > 0 && <div className="diagnostics"><strong>诊断</strong>{diagnostics.map((item, index) => <button key={`${item.code}-${index}`} onClick={() => item.entityId && document.getElementById(`entity-${item.entityId}`)?.scrollIntoView({ behavior: "smooth" })}><span>{item.severity === "error" ? "!" : "i"}</span>{item.message}</button>)}</div>}
        {panel === "messages" && <MessagesPanel project={project} diagnostics={diagnostics} addMessage={addMessage} patchMessage={patchMessage} update={update} addAsset={addAsset} draggedMessage={draggedMessage} setDraggedMessage={setDraggedMessage} reorderMessage={reorderMessage} />}
        {panel === "participants" && <ParticipantsPanel project={project} diagnostics={diagnostics} update={update} addAsset={addAsset} />}
        {panel === "project" && <ProjectPanel project={project} diagnostics={diagnostics} update={update} />}
        {panel === "files" && <FilesPanel files={fileEntries} />}
      </div>
    </main>

    <section className={`preview-pane mobile-${mobileView}`}>
      <div className="preview-heading"><div><span className="live-dot" />实时预览</div><button onClick={() => setPreviewHtml((html) => `${html} `)}>刷新</button></div>
      <div className="phone-stage"><div className="phone-frame"><div className="phone-camera" /><iframe title="作品预览" sandbox="allow-scripts allow-forms allow-popups" srcDoc={previewHtml} /></div></div>
      <p className="preview-note">预览由真实 Markdown/YAML 和共享编译器生成</p>
    </section>
  </div>;
}

function MessagesPanel({ project, diagnostics, addMessage, patchMessage, update, addAsset, draggedMessage, setDraggedMessage, reorderMessage }: {
  project: AuthoringProject; diagnostics: Diagnostic[]; addMessage: (kind: MessageKind) => void; patchMessage: (id: string, patch: Partial<Message>) => void;
  update: (recipe: (draft: AuthoringProject) => void) => void; addAsset: (file: File) => Promise<string>; draggedMessage: string; setDraggedMessage: (id: string) => void; reorderMessage: (id: string) => void;
}) {
  return <div>
    <div className="section-heading"><div><h2>消息流</h2><p>拖拽卡片调整阅读顺序，所有引用使用稳定消息 ID。</p></div><div className="add-menu">{(["text", "image", "link-card", "status"] as MessageKind[]).map((kind) => <button key={kind} onClick={() => addMessage(kind)}>＋ {({ text: "文字", image: "图片", "link-card": "链接", status: "状态" })[kind]}</button>)}</div></div>
    <div className="message-list">
      {project.conversation.messages.map((message, index) => <article id={`entity-${message.id}`} key={message.id} draggable className={`message-card ${draggedMessage === message.id ? "dragging" : ""}`} onDragStart={() => setDraggedMessage(message.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderMessage(message.id)}>
        <div className="card-index"><span>⋮⋮</span>{String(index + 1).padStart(2, "0")}</div>
        <div className="card-body">
          <div className="field-row three">
            <label>发送者<select value={message.senderId} onChange={(event) => patchMessage(message.id, { senderId: event.target.value })}>{project.participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><FieldError diagnostics={diagnostics} entityId={message.id} field="senderId" /></label>
            <label>时间<input value={message.timeRaw} onChange={(event) => patchMessage(message.id, { timeRaw: event.target.value })} /><FieldError diagnostics={diagnostics} entityId={message.id} field="timeRaw" /></label>
            <label>类型<select value={message.kind} onChange={(event) => patchMessage(message.id, { kind: event.target.value as MessageKind })}><option value="text">文字</option><option value="image">图片</option><option value="link-card">链接卡片</option><option value="status">状态</option></select></label>
          </div>
          {(message.kind === "text" || message.kind === "status") && <label>内容<textarea rows={3} value={message.text} onChange={(event) => patchMessage(message.id, { text: event.target.value })} /><FieldError diagnostics={diagnostics} entityId={message.id} field="text" /></label>}
          {message.kind === "image" && <><label>图片地址<input value={message.imageSource || ""} placeholder="https://… 或选择本地图片" onChange={(event) => patchMessage(message.id, { imageSource: event.target.value })} /><FieldError diagnostics={diagnostics} entityId={message.id} field="imageSource" /></label><label className="file-button">选择本地图片<input hidden type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) patchMessage(message.id, { imageSource: await addAsset(file) }); }} /></label><label>图片说明<input value={message.caption || ""} onChange={(event) => patchMessage(message.id, { caption: event.target.value })} /></label></>}
          {message.kind === "link-card" && <div className="link-fields"><label>网址<input value={message.linkCard?.url || ""} onChange={(event) => patchMessage(message.id, { linkCard: { ...message.linkCard!, url: event.target.value } })} /><FieldError diagnostics={diagnostics} entityId={message.id} field="linkCard.url" /></label><label>标题<input value={message.linkCard?.title || ""} onChange={(event) => patchMessage(message.id, { linkCard: { ...message.linkCard!, title: event.target.value } })} /></label><label>摘要<textarea rows={2} value={message.linkCard?.desc || ""} onChange={(event) => patchMessage(message.id, { linkCard: { ...message.linkCard!, desc: event.target.value } })} /></label><label>站点<input value={message.linkCard?.site || ""} onChange={(event) => patchMessage(message.id, { linkCard: { ...message.linkCard!, site: event.target.value } })} /></label></div>}
          <div className="field-row two"><label>引用前序消息<select value={message.quoteId} onChange={(event) => patchMessage(message.id, { quoteId: event.target.value })}><option value="">不引用</option>{project.conversation.messages.slice(0, index).map((item) => <option key={item.id} value={item.id}>{item.id} · {item.text?.slice(0, 24) || item.kind}</option>)}</select><FieldError diagnostics={diagnostics} entityId={message.id} field="quoteId" /></label><label>撤回延迟（秒）<input type="number" min="0" value={message.recallDelaySec || 0} onChange={(event) => patchMessage(message.id, { recallDelaySec: Number(event.target.value) })} /></label></div>
        </div>
        <button className="remove-button" title="删除消息" onClick={() => update((draft) => { draft.conversation.messages = draft.conversation.messages.filter((item) => item.id !== message.id); draft.conversation.messages.forEach((item) => { if (item.quoteId === message.id) item.quoteId = ""; }); })}>×</button>
      </article>)}
    </div>
  </div>;
}

function ParticipantsPanel({ project, diagnostics, update, addAsset }: { project: AuthoringProject; diagnostics: Diagnostic[]; update: (recipe: (draft: AuthoringProject) => void) => void; addAsset: (file: File) => Promise<string> }) {
  const patch = (id: string, value: Partial<Participant>) => update((draft) => { const target = draft.participants.find((item) => item.id === id); if (target) Object.assign(target, value); });
  return <div><div className="section-heading"><div><h2>参与者</h2><p>ID 是跨文件引用的稳定标识，创建后建议不要修改。</p></div><button onClick={() => update((draft) => { const id = nextEntityId("person", draft.participants.map((item) => item.id)); draft.participants.push({ id, name: "新角色", avatar: "", bio: "" }); })}>＋ 添加参与者</button></div>
    <div className="participant-grid">{project.participants.map((person) => <article className="participant-card" id={`entity-${person.id}`} key={person.id}><div className="avatar-preview">{person.avatar ? <img src={person.avatar.startsWith("asset:") ? project.assets.find((item) => `asset:${item.id}` === person.avatar)?.dataUrl : person.avatar} /> : person.name.slice(0, 1)}</div><div className="participant-fields"><div className="field-row two"><label>显示名<input value={person.name} onChange={(event) => patch(person.id, { name: event.target.value })} /><FieldError diagnostics={diagnostics} entityId={person.id} field="name" /></label><label>稳定 ID<input value={person.id} onChange={(event) => update((draft) => { const old = person.id; const target = draft.participants.find((item) => item.id === old); if (!target) return; target.id = event.target.value; if (draft.selfId === old) draft.selfId = event.target.value; draft.conversation.messages.forEach((message) => { if (message.senderId === old) message.senderId = event.target.value; }); })} /><FieldError diagnostics={diagnostics} entityId={person.id} field="id" /></label></div><label>头像网址<input value={person.avatar} placeholder="https://… 或选择本地图片" onChange={(event) => patch(person.id, { avatar: event.target.value })} /></label><label className="file-button">上传头像<input hidden type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) patch(person.id, { avatar: await addAsset(file) }); }} /></label><label>简介<textarea rows={2} value={person.bio} onChange={(event) => patch(person.id, { bio: event.target.value })} /></label></div>{project.participants.length > 2 && <button className="remove-button" onClick={() => update((draft) => { draft.participants = draft.participants.filter((item) => item.id !== person.id); })}>×</button>}</article>)}</div></div>;
}

function ProjectPanel({ project, diagnostics, update }: { project: AuthoringProject; diagnostics: Diagnostic[]; update: (recipe: (draft: AuthoringProject) => void) => void }) {
  return <div><div className="section-heading"><div><h2>外观与会话</h2><p>这些设置会写入版本化 YAML，而不是 Studio 私有状态。</p></div></div><div className="settings-card"><label>作品标题<input value={project.title} onChange={(event) => update((draft) => { draft.title = event.target.value; })} /><FieldError diagnostics={diagnostics} field="title" /></label><label>会话标题<input value={project.conversation.title} onChange={(event) => update((draft) => { draft.conversation.title = event.target.value; })} /></label><div className="field-row two"><label>主题<select value={project.theme} onChange={(event) => update((draft) => { draft.theme = event.target.value; })}><option value="wechat">微信</option><option value="paper">纸张</option><option value="iterms">终端</option></select></label><label>当前账号<select value={project.selfId} onChange={(event) => update((draft) => { draft.selfId = event.target.value; })}>{project.participants.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select><FieldError diagnostics={diagnostics} entityId={project.selfId} field="selfId" /></label></div><div className="contract-note"><strong>公开格式契约 v{project.schemaVersion}</strong><p>预览和导出都先生成 project.yml、profiles.yml、chat.yml 与 conversations/main.md，再交给共享编译器。</p></div></div></div>;
}

function FilesPanel({ files }: { files: [string, string | Uint8Array][] }) {
  const [active, setActive] = useState("");
  const selected = files.find(([path]) => path === (active || files[0]?.[0]));
  return <div><div className="section-heading"><div><h2>生成文件</h2><p>这是 Studio 与 Node 渲染器之间真正交换的虚拟项目。</p></div></div><div className="file-browser"><nav>{files.map(([path]) => <button className={(active || files[0]?.[0]) === path ? "active" : ""} key={path} onClick={() => setActive(path)}>{path}</button>)}</nav><pre>{selected ? (typeof selected[1] === "string" ? selected[1] : `二进制资源 · ${selected[1].byteLength} bytes`) : "修正诊断后将显示生成文件。"}</pre></div></div>;
}
