import matter from "gray-matter";
import MarkdownIt from "markdown-it";

const articleMarkdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false
});

const defaultLinkOpen = articleMarkdown.renderer.rules.link_open
  || ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
const defaultImage = articleMarkdown.renderer.rules.image
  || ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

function attrSet(token, name, value) {
  const existing = token.attrIndex(name);
  if (existing < 0) token.attrPush([name, value]);
  else token.attrs[existing][1] = value;
}

function attrJoin(token, name, value) {
  const existing = token.attrIndex(name);
  if (existing < 0) token.attrPush([name, value]);
  else token.attrs[existing][1] = `${token.attrs[existing][1]} ${value}`;
}

function safeMarkdownLink(raw) {
  const value = String(raw || "").trim();
  if (!value) return "#";
  const normalized = articleMarkdown.normalizeLink(value);
  return articleMarkdown.validateLink(normalized) ? normalized : "#";
}

articleMarkdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = token.attrGet("href");
  if (href) attrSet(token, "href", safeMarkdownLink(href));
  attrSet(token, "target", "_blank");
  attrSet(token, "rel", "noreferrer");
  return defaultLinkOpen(tokens, idx, options, env, self);
};

articleMarkdown.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = safeMarkdownLink(token.attrGet("src"));
  attrSet(token, "src", src);
  attrSet(token, "data-preview-src", src);
  attrJoin(token, "class", "previewable-image");
  return defaultImage(tokens, idx, options, env, self);
};

export function renderArticleMarkdown(markdown) {
  const html = articleMarkdown.render(String(markdown || ""));
  return `<div class="article-markdown">${html}</div>`;
}

export function parseMarkdownArticle(raw) {
  const parsed = matter(String(raw || ""));
  return {
    data: parsed.data && typeof parsed.data === "object" ? parsed.data : {},
    content: parsed.content || ""
  };
}
