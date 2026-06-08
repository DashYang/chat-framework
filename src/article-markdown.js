export const articlePageCss = `
.article-body{background:var(--article-body-bg,transparent);border:var(--article-body-border,none);border-radius:var(--article-body-radius,0);box-shadow:var(--article-body-shadow,none)}
.article-page-title{margin:0;font-size:var(--article-h1-size,22px);font-weight:700;line-height:var(--article-heading-line-height,1.35);letter-spacing:var(--article-title-letter-spacing,0);text-transform:var(--article-title-transform,none);color:var(--article-heading-color,#1f1f1f);text-shadow:var(--article-heading-shadow,none);border-bottom:var(--article-heading-border,none);padding-bottom:var(--article-heading-padding-bottom,0)}
.article-page-sub{margin-top:8px;font-size:12px;letter-spacing:var(--article-sub-letter-spacing,0);text-transform:var(--article-sub-transform,none);color:var(--article-sub-color,#8f8f8f)}
.article-page-cover{width:100%;margin-top:12px;border-radius:var(--article-image-radius,8px);border:var(--article-page-image-border,none);background:var(--article-page-image-bg,#ddd)}
.article-page-text{margin-top:14px;font-size:var(--article-text-size,16px);line-height:var(--article-text-line-height,1.8);color:var(--article-text-color,#222);word-break:break-word;text-shadow:var(--article-text-shadow,none)}
.article-page-text .article-markdown{display:block;background:var(--article-markdown-bg,transparent);border:var(--article-markdown-border,none);border-top:var(--article-markdown-border-top,none);border-radius:var(--article-markdown-radius,0);box-shadow:var(--article-markdown-shadow,none);padding:var(--article-markdown-padding,0);padding-top:var(--article-markdown-padding-top,0)}
.article-page-text .article-markdown>:first-child{margin-top:0}
.article-page-text .article-markdown>:last-child{margin-bottom:0}
.article-page-text h1,.article-page-text h2,.article-page-text h3{margin:22px 0 10px;line-height:var(--article-heading-line-height,1.35);color:var(--article-heading-color,#1f1f1f);text-shadow:var(--article-heading-shadow,none);border-bottom:var(--article-heading-border,none);padding-bottom:var(--article-heading-padding-bottom,0)}
.article-page-text h1{font-size:var(--article-h1-size,22px)}
.article-page-text h2{font-size:var(--article-h2-size,20px)}
.article-page-text h3{font-size:var(--article-h3-size,18px)}
.article-page-text p{margin:0 0 12px;color:var(--article-paragraph-color,var(--article-text-color,#222))}
.article-page-text blockquote{margin:14px 0;padding:10px 12px;border-left:3px solid var(--article-blockquote-border,#d0d0d0);background:var(--article-blockquote-bg,#f7f7f7);color:var(--article-blockquote-color,#555)}
.article-page-text ul,.article-page-text ol{margin:0 0 12px 20px;padding:0}
.article-page-text li{margin:4px 0}
.article-page-text li>ul,.article-page-text li>ol{margin-top:4px;margin-bottom:4px}
.article-page-text hr{border:none;border-top:1px solid var(--article-hr-color,var(--article-blockquote-border,#d0d0d0));margin:18px 0}
.article-page-text del{color:var(--article-del-color,var(--article-sub-color,#8f8f8f))}
.article-page-text table{display:block;width:100%;overflow-x:auto;border-collapse:collapse;margin:14px 0;font-size:.94em}
.article-page-text th,.article-page-text td{border:1px solid var(--article-table-border,var(--article-blockquote-border,#d0d0d0));padding:8px 10px;text-align:left;vertical-align:top;white-space:nowrap}
.article-page-text th{background:var(--article-table-head-bg,var(--article-blockquote-bg,#f7f7f7));color:var(--article-heading-color,#1f1f1f);font-weight:700}
.article-page-text td{background:var(--article-table-cell-bg,transparent)}
.article-page-text input[type="checkbox"]{margin-right:6px;vertical-align:-1px}
.article-page-text img{width:100%;margin:10px 0;border-radius:var(--article-image-radius,8px);border:var(--article-inline-image-border,none);background:var(--article-inline-image-bg,#ddd)}
.article-page-text a{color:var(--article-link-color,#576b95);text-decoration:var(--article-link-decoration,none);text-underline-offset:var(--article-link-underline-offset,0)}
.article-page-text code{font-family:var(--article-code-font,"SF Mono","Menlo","Consolas",monospace);font-size:.9em;background:var(--article-code-bg,#f6f6f6);border:var(--article-code-border,none);border-radius:var(--article-code-radius,4px);padding:1px 4px;color:var(--article-code-color,#d14)}
.article-page-text pre{overflow:auto;margin:14px 0;padding:12px;border:var(--article-pre-border,none);border-radius:var(--article-pre-radius,8px);background:var(--article-pre-bg,#f6f8fa);color:var(--article-pre-color,#24292f);line-height:1.55;box-shadow:var(--article-pre-shadow,none)}
.article-page-text pre code{padding:0;background:transparent;border:none;color:inherit}
.article-page-images{margin-top:12px;display:grid;gap:8px}
.article-page-images img{width:100%;border-radius:var(--article-image-radius,8px);border:var(--article-page-image-border,none);background:var(--article-page-image-bg,#ddd)}
`;

export const imageViewerCss = `
img[data-preview-src]{cursor:zoom-in}
.image-viewer{position:fixed;inset:0;z-index:220;display:none;background:rgba(0,0,0,.88);touch-action:none;overflow:hidden}
.image-viewer.show{display:block}
.image-viewer-stage{position:absolute;inset:0;overflow:hidden;cursor:grab;touch-action:none}
.image-viewer-stage.dragging{cursor:grabbing}
.image-viewer-img{position:absolute;top:50%;left:50%;max-width:none;max-height:none;user-select:none;-webkit-user-drag:none;transform-origin:center center;will-change:transform}
.image-viewer-close{position:absolute;top:14px;right:14px;z-index:2;border:1px solid rgba(255,255,255,.25);border-radius:999px;background:rgba(20,20,20,.72);color:#fff;width:38px;height:38px;font-size:20px;line-height:1;cursor:pointer}
.image-viewer-status{position:absolute;left:14px;bottom:14px;z-index:2;border-radius:999px;background:rgba(20,20,20,.72);color:#fff;font-size:12px;padding:6px 10px;pointer-events:none}
[data-theme="iterms"] .image-viewer{background:rgba(0,8,5,.92)}
[data-theme="iterms"] .image-viewer-close,[data-theme="iterms"] .image-viewer-status{background:#0d1a12;border:1px solid #173020;color:#7CFF8F}
`;

export function articleMarkdownRuntimeSource() {
  return `
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
        return '<div class="article-markdown">' + html.join('') + '</div>';
      }`;
}

export function imageViewerRuntimeSource() {
  return `
      function installImageViewer() {
        const viewer = document.getElementById('image-viewer');
        const stage = document.getElementById('image-viewer-stage');
        const image = document.getElementById('image-viewer-img');
        const closeBtn = document.getElementById('image-viewer-close');
        const status = document.getElementById('image-viewer-status');
        if (!viewer || !stage || !image || !closeBtn || !status) return;
        const state = { scale: 1, x: 0, y: 0, naturalW: 1, naturalH: 1, fitScale: 1, pointers: new Map(), drag: null, pinch: null };
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        function updateStatus() {
          status.textContent = Math.round(state.scale * 100) + '%';
        }
        function renderImageTransform() {
          image.style.width = state.naturalW + 'px';
          image.style.height = state.naturalH + 'px';
          image.style.transform = 'translate(calc(-50% + ' + state.x + 'px), calc(-50% + ' + state.y + 'px)) scale(' + state.scale + ')';
          updateStatus();
        }
        function calculateFitScale() {
          const rect = stage.getBoundingClientRect();
          const fitW = Math.max(1, rect.width - 32) / Math.max(1, state.naturalW);
          const fitH = Math.max(1, rect.height - 96) / Math.max(1, state.naturalH);
          state.fitScale = clamp(Math.min(1, fitW, fitH), 0.25, 1);
        }
        function resetImagePosition() {
          state.scale = 1;
          state.x = 0;
          state.y = 0;
          calculateFitScale();
          renderImageTransform();
        }
        function setScale(nextScale) {
          state.scale = clamp(nextScale, 0.25, 4);
          renderImageTransform();
        }
        function openImageViewer(src, alt) {
          if (!src) return;
          state.pointers.clear();
          state.drag = null;
          state.pinch = null;
          image.alt = alt || 'image';
          image.onload = () => {
            state.naturalW = image.naturalWidth || 1;
            state.naturalH = image.naturalHeight || 1;
            resetImagePosition();
          };
          image.src = src;
          viewer.classList.add('show');
          viewer.setAttribute('aria-hidden', 'false');
          if (image.complete && image.naturalWidth) {
            state.naturalW = image.naturalWidth;
            state.naturalH = image.naturalHeight;
            resetImagePosition();
          }
        }
        function closeImageViewer() {
          viewer.classList.remove('show');
          viewer.setAttribute('aria-hidden', 'true');
          image.removeAttribute('src');
          state.pointers.clear();
        }
        function pointerDistance(a, b) {
          return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        }
        function pointerCenter(a, b) {
          return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
        }
        document.addEventListener('click', (event) => {
          const target = event.target.closest && event.target.closest('img[data-preview-src]');
          if (!target) return;
          event.preventDefault();
          event.stopPropagation();
          openImageViewer(target.dataset.previewSrc || target.currentSrc || target.src, target.alt || '');
        }, true);
        closeBtn.addEventListener('click', closeImageViewer);
        viewer.addEventListener('click', (event) => {
          if (event.target === viewer || event.target === stage) closeImageViewer();
        });
        window.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && viewer.classList.contains('show')) closeImageViewer();
        });
        stage.addEventListener('wheel', (event) => {
          if (!viewer.classList.contains('show')) return;
          event.preventDefault();
          const factor = event.deltaY < 0 ? 1.12 : 0.88;
          setScale(state.scale * factor);
        }, { passive: false });
        stage.addEventListener('dblclick', (event) => {
          event.preventDefault();
          const closeToOne = Math.abs(state.scale - 1) < 0.04;
          setScale(closeToOne ? state.fitScale : 1);
          state.x = 0;
          state.y = 0;
          renderImageTransform();
        });
        stage.addEventListener('pointerdown', (event) => {
          if (!viewer.classList.contains('show')) return;
          event.preventDefault();
          stage.setPointerCapture(event.pointerId);
          state.pointers.set(event.pointerId, event);
          stage.classList.add('dragging');
          if (state.pointers.size === 1) {
            state.drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: state.x, y: state.y };
            state.pinch = null;
          } else if (state.pointers.size === 2) {
            const points = Array.from(state.pointers.values());
            state.pinch = { distance: pointerDistance(points[0], points[1]), center: pointerCenter(points[0], points[1]), scale: state.scale, x: state.x, y: state.y };
          }
        });
        stage.addEventListener('pointermove', (event) => {
          if (!state.pointers.has(event.pointerId)) return;
          event.preventDefault();
          state.pointers.set(event.pointerId, event);
          if (state.pointers.size >= 2 && state.pinch) {
            const points = Array.from(state.pointers.values()).slice(0, 2);
            const nextDistance = pointerDistance(points[0], points[1]);
            const nextCenter = pointerCenter(points[0], points[1]);
            setScale(state.pinch.scale * (nextDistance / Math.max(1, state.pinch.distance)));
            state.x = state.pinch.x + (nextCenter.x - state.pinch.center.x);
            state.y = state.pinch.y + (nextCenter.y - state.pinch.center.y);
            renderImageTransform();
          } else if (state.drag && state.drag.id === event.pointerId) {
            state.x = state.drag.x + (event.clientX - state.drag.startX);
            state.y = state.drag.y + (event.clientY - state.drag.startY);
            renderImageTransform();
          }
        });
        function endPointer(event) {
          state.pointers.delete(event.pointerId);
          if (state.pointers.size === 0) {
            stage.classList.remove('dragging');
            state.drag = null;
            state.pinch = null;
          } else if (state.pointers.size === 1) {
            const remaining = Array.from(state.pointers.values())[0];
            state.drag = { id: remaining.pointerId, startX: remaining.clientX, startY: remaining.clientY, x: state.x, y: state.y };
            state.pinch = null;
          }
        }
        stage.addEventListener('pointerup', endPointer);
        stage.addEventListener('pointercancel', endPointer);
        window.addEventListener('resize', () => {
          if (!viewer.classList.contains('show')) return;
          calculateFitScale();
          renderImageTransform();
        });
      }`;
}
