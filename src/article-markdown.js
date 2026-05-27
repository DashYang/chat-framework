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
.article-page-text ul{margin:0 0 12px 20px;padding:0}
.article-page-text li{margin:4px 0}
.article-page-text img{width:100%;margin:10px 0;border-radius:var(--article-image-radius,8px);border:var(--article-inline-image-border,none);background:var(--article-inline-image-bg,#ddd)}
.article-page-text a{color:var(--article-link-color,#576b95);text-decoration:var(--article-link-decoration,none);text-underline-offset:var(--article-link-underline-offset,0)}
.article-page-text code{font-family:var(--article-code-font,"SF Mono","Menlo","Consolas",monospace);font-size:.9em;background:var(--article-code-bg,#f6f6f6);border:var(--article-code-border,none);border-radius:var(--article-code-radius,4px);padding:1px 4px;color:var(--article-code-color,#d14)}
.article-page-text pre{overflow:auto;margin:14px 0;padding:12px;border:var(--article-pre-border,none);border-radius:var(--article-pre-radius,8px);background:var(--article-pre-bg,#f6f8fa);color:var(--article-pre-color,#24292f);line-height:1.55;box-shadow:var(--article-pre-shadow,none)}
.article-page-text pre code{padding:0;background:transparent;border:none;color:inherit}
.article-page-images{margin-top:12px;display:grid;gap:8px}
.article-page-images img{width:100%;border-radius:var(--article-image-radius,8px);border:var(--article-page-image-border,none);background:var(--article-page-image-bg,#ddd)}
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
          '<img src="' + esc(safeMarkdownUrl(url)) + '" alt="' + esc(alt) + '"/>'
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
