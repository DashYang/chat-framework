import { imageViewerRuntimeSource } from "./article-markdown.js";
import { themes } from "./themes.js";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderImage(src, className, alt) {
  return `<img class="${className}" src="${escapeHtml(src)}" data-preview-src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"/>`;
}

function renderCharacters(items) {
  return items.map((item, index) => `
    <article class="document-card character-card" data-index="${index}">
      <div class="document-image-cell">
        ${renderImage(item.avatar, "profile-avatar document-avatar", item.name)}
      </div>
      <div class="character-main">
        <div class="character-topline">
          <div class="character-heading">
            <h2>${escapeHtml(item.name)}</h2>
            <div class="document-inline article-page-text">${item.identityHtml}</div>
          </div>
          <div class="character-status">
            <span class="field-label">STATUS</span>
            <div class="document-inline article-page-text">${item.statusHtml}</div>
          </div>
        </div>
        <div class="document-description article-page-text">${item.descriptionHtml}</div>
      </div>
    </article>`).join("");
}

function renderSettings(items) {
  return items.map((item, index) => `
    <article class="document-card setting-card" data-index="${index}">
      <div class="document-image-cell">
        ${renderImage(item.image, "previewable-image document-setting-image", item.name)}
      </div>
      <div class="setting-main">
        <h2>${escapeHtml(item.name)}</h2>
        <div class="document-description article-page-text">${item.descriptionHtml}</div>
      </div>
    </article>`).join("");
}

function renderTimeline(items) {
  return items.map((item, index) => {
    const image = item.image
      ? `<div class="timeline-image">${renderImage(item.image, "previewable-image document-timeline-image", `时间节点 ${index + 1}`)}</div>`
      : "";
    const participants = item.participants
      .map((name) => `<span class="participant">${escapeHtml(name)}</span>`)
      .join("");
    return `
      <article class="document-card timeline-card${item.image ? "" : " no-image"}" data-index="${index}">
        <div class="timeline-time-cell">
          <div class="timeline-marker" aria-hidden="true"></div>
          <div class="timeline-time document-inline article-page-text">${item.timeHtml}</div>
        </div>
        <div class="timeline-content">
          <div class="document-description article-page-text">${item.descriptionHtml}</div>
          <div class="participants" aria-label="参与人物">
            <span class="field-label">参与人物</span>
            <div class="participant-list">${participants}</div>
          </div>
        </div>
        ${image}
      </article>`;
  }).join("");
}

function renderItems(document) {
  if (document.type === "characters") return renderCharacters(document.items);
  if (document.type === "settings") return renderSettings(document.items);
  return renderTimeline(document.items);
}

const documentCss = `
  .document-page.article-body {
    width:min(560px,calc(100% - 24px));
    max-width:560px;
    min-height:0;
    margin:12px auto;
    padding:0;
    color:var(--ink,var(--text,#222));
    overflow:hidden;
  }
  .document-header {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    min-height:44px;
    padding:8px 12px;
    border-bottom:1px solid var(--line,#dcdcdc);
  }
  .document-heading {
    display:flex;
    align-items:baseline;
    min-width:0;
    gap:8px;
  }
  .document-number {
    flex:0 0 auto;
    color:var(--article-heading-color,var(--accent,#07c160));
    font-size:15px;
    font-weight:700;
  }
  .document-title {
    margin:0;
    color:var(--article-heading-color,var(--ink,var(--text,#222)));
    font-size:17px;
    line-height:1.25;
    text-shadow:var(--article-heading-shadow,none);
    white-space:nowrap;
  }
  .document-type-label {
    min-width:0;
    color:var(--muted,#777);
    font-size:11px;
    letter-spacing:.07em;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .document-index {
    flex:0 0 auto;
    color:var(--muted,#777);
    font-size:13px;
  }
  .document-list { padding:0 12px; }
  .document-card {
    position:relative;
    border:0;
    border-bottom:1px solid var(--line,#ddd);
    background:transparent;
  }
  .document-card h2 {
    margin:0;
    color:var(--article-heading-color,var(--ink,var(--text,#222)));
    font-size:16px;
    line-height:1.3;
    font-weight:700;
  }
  .document-image-cell { min-width:0; }
  .document-avatar {
    display:block;
    width:88px;
    height:88px;
    border-radius:2px;
    border:var(--article-page-image-border,1px solid var(--line,#ddd));
    object-fit:cover;
    filter:saturate(.72) brightness(.82) sepia(.08);
  }
  .document-setting-image {
    display:block;
    width:82px;
    height:82px;
    margin:0;
    border-radius:2px;
    border:1px solid var(--line,#ddd);
    object-fit:cover;
    filter:saturate(.68) brightness(.78) sepia(.12);
  }
  .character-card {
    display:grid;
    grid-template-columns:88px minmax(0,1fr);
    align-items:start;
    gap:14px;
    padding:12px 0;
  }
  .character-main,.setting-main { min-width:0; }
  .character-topline {
    display:grid;
    grid-template-columns:minmax(0,1fr) auto;
    align-items:start;
    gap:10px;
  }
  .character-heading { min-width:0; }
  .character-heading .document-inline { margin-top:3px; }
  .character-status {
    min-width:58px;
    text-align:right;
  }
  .field-label {
    display:block;
    margin-bottom:3px;
    color:var(--muted,#777);
    font-size:9px;
    letter-spacing:.1em;
    text-transform:uppercase;
  }
  .document-inline.article-page-text {
    margin:0;
    font-size:12px;
    line-height:1.45;
  }
  .document-inline.article-page-text p { display:inline; margin:0; }
  .document-description.article-page-text {
    min-width:0;
    margin:5px 0 0;
    font-size:13px;
    line-height:1.55;
  }
  .document-description .article-markdown {
    border:none;
    border-top:none;
    background:transparent;
    box-shadow:none;
    padding:0;
  }
  .document-description .article-markdown p { margin-bottom:6px; }
  .setting-card {
    display:grid;
    grid-template-columns:82px minmax(0,1fr);
    align-items:center;
    gap:16px;
    min-height:108px;
    padding:12px 0;
  }
  .timeline-list { position:relative; padding-left:26px; }
  .timeline-list::before {
    content:"";
    position:absolute;
    top:35px;
    bottom:32px;
    left:18px;
    width:1px;
    background:var(--accent,#07c160);
    opacity:.55;
  }
  .timeline-card {
    display:grid;
    grid-template-columns:72px minmax(0,1fr) 155px;
    align-items:start;
    gap:12px;
    min-height:126px;
    padding:14px 0;
  }
  .timeline-card.no-image { grid-template-columns:72px minmax(0,1fr); }
  .timeline-time-cell { position:relative; min-width:0; }
  .timeline-marker {
    position:absolute;
    top:4px;
    left:-15px;
    width:10px;
    height:10px;
    border:2px solid var(--accent,#07c160);
    border-radius:50%;
    background:var(--article-body-bg,var(--bg,#fff));
    box-shadow:0 0 7px rgba(0,255,65,.28);
  }
  .timeline-time {
    color:var(--article-heading-color,var(--accent,#07c160));
    font-size:14px;
    font-weight:700;
  }
  .timeline-content { min-width:0; }
  .participants { margin-top:8px; }
  .participant-list { display:flex; flex-wrap:wrap; gap:4px; }
  .participant {
    display:inline-flex;
    align-items:center;
    min-height:20px;
    padding:2px 6px;
    border:1px solid var(--line,#ddd);
    color:var(--article-text-color,var(--ink,var(--text,#222)));
    font-size:10px;
  }
  .timeline-image { min-width:0; }
  .document-timeline-image {
    display:block;
    width:100%;
    height:96px;
    margin:0;
    border-radius:2px;
    border:1px solid var(--line,#ddd);
    object-fit:cover;
    filter:saturate(.62) brightness(.7) sepia(.12);
  }
  .document-footer {
    padding:11px 12px;
    color:var(--article-heading-color,var(--accent,#07c160));
    font-size:10px;
    letter-spacing:.06em;
  }
  [data-theme="iterms"] .document-page {
    --line:#173020;
    --article-heading-shadow:0 0 4px rgba(124,255,143,.24);
    --article-text-shadow:0 0 3px rgba(0,255,65,.12);
    background:#030806;
    border:1px solid #204726;
    box-shadow:inset 0 0 0 1px rgba(0,255,65,.025),0 0 24px rgba(0,255,65,.035);
  }
  [data-theme="iterms"] .document-card::after,
  [data-theme="iterms"] .document-page::after {
    content:"";
    position:absolute;
    inset:0;
    pointer-events:none;
    background:linear-gradient(transparent 50%,rgba(0,255,65,.012) 50%);
    background-size:100% 4px;
  }
  [data-theme="iterms"] .document-page { position:relative; }
  [data-theme="iterms"] .document-header {
    background:linear-gradient(90deg,rgba(0,255,65,.035),transparent 58%);
    box-shadow:0 1px 8px rgba(0,255,65,.025);
  }
  [data-theme="iterms"] .document-card {
    border-bottom-style:dashed;
    border-bottom-color:rgba(48,110,58,.32);
  }
  [data-theme="iterms"] .participant { background:#07100a; }
  [data-theme="wechat"] .document-page { --line:#ddd; background:#fff; }
  [data-theme="wechat"] .participant { border-radius:999px; background:#eefbf3; }
  [data-theme="paper"] .document-page { --line:#dac8ac; background:#fffaf2; }
  [data-theme="paper"] .participant { background:#f8efdf; border-radius:3px; }
  @media (max-width:580px) {
    .document-page.article-body {
      width:100%;
      min-height:100vh;
      margin:0;
      border-left:0;
      border-right:0;
    }
    .document-header { padding:8px 10px; }
    .document-list { padding-right:10px; padding-left:10px; }
    .timeline-list { padding-left:24px; }
    .timeline-list::before { left:17px; }
    .timeline-card {
      grid-template-columns:62px minmax(0,1fr) 118px;
      gap:8px;
    }
    .timeline-card.no-image { grid-template-columns:62px minmax(0,1fr); }
    .timeline-marker { left:-14px; }
    .document-timeline-image { height:84px; }
  }
  @media (max-width:420px) {
    .document-type-label { display:none; }
    .character-card { grid-template-columns:72px minmax(0,1fr); gap:10px; }
    .document-avatar { width:72px; height:72px; }
    .setting-card { grid-template-columns:68px minmax(0,1fr); gap:11px; }
    .document-setting-image { width:68px; height:68px; }
    .timeline-card,.timeline-card.no-image {
      grid-template-columns:58px minmax(0,1fr);
    }
    .timeline-image {
      grid-column:2;
    }
    .document-timeline-image { width:100%; height:auto; max-height:150px; }
  }
`;

export function renderDocumentHtml(document) {
  const theme = themes[document.theme] || themes.iterms;
  const typeLabel = {
    characters: "CHARACTERS",
    settings: "SETTINGS",
    timeline: "TIMELINE"
  }[document.type];
  const typeNumber = {
    characters: "01",
    settings: "02",
    timeline: "03"
  }[document.type];
  const headerIndex = document.headerIndex === undefined ? typeNumber : String(document.headerIndex);
  const footerText = document.footerText === undefined ? "> END OF FILE" : String(document.footerText);
  const listClass = document.type === "timeline" ? "document-list timeline-list" : "document-list";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(document.title)}</title>
  <style>
${theme.css}
${documentCss}
  </style>
</head>
<body data-theme="${escapeHtml(theme.id)}">
  <main class="document-page article-body">
    <header class="document-header">
      <div class="document-heading">
        <span class="document-number">${typeNumber}</span>
        <h1 class="document-title">${escapeHtml(document.title)}</h1>
        <span class="document-type-label">/ ${typeLabel}</span>
      </div>
      ${headerIndex ? `<div class="document-index">${escapeHtml(headerIndex)}</div>` : ""}
    </header>
    <section class="${listClass}" aria-label="${escapeHtml(document.title)}">
      ${renderItems(document)}
    </section>
    ${footerText ? `<footer class="document-footer">${escapeHtml(footerText)}</footer>` : ""}
  </main>
  <aside id="image-viewer" class="image-viewer" aria-hidden="true">
    <button id="image-viewer-close" class="image-viewer-close" type="button" aria-label="关闭">×</button>
    <div id="image-viewer-stage" class="image-viewer-stage">
      <img id="image-viewer-img" class="image-viewer-img" src="" alt="image"/>
    </div>
    <div id="image-viewer-status" class="image-viewer-status">100%</div>
  </aside>
  <script>
    (() => {
${imageViewerRuntimeSource()}
      installImageViewer();
    })();
  </script>
</body>
</html>`;
}
