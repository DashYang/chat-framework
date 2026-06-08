import { articlePageCss, imageViewerCss } from "./article-markdown.js";

const wechatCss = `
:root {
  --bg: #ececec;
  --header-bg: #f6f6f6;
  --text: #222;
  --muted: #7a7a7a;
  --incoming: #ffffff;
  --outgoing: #95ec69;
  --card-bg: #f8f8f8;
}
* { box-sizing: border-box; }
body { margin: 0; background: linear-gradient(180deg,#f7f7f7,#e9e9e9); color: var(--text); font-family: "PingFang SC", "Helvetica Neue", sans-serif; }
.chat { max-width: 840px; margin: 0 auto; min-height: 100vh; background: var(--bg); }
.header { position: sticky; top: 0; z-index: 2; padding: 12px 16px; background: var(--header-bg); border-bottom: 1px solid #ddd; }
.header h1 { font-size: 16px; margin: 0; }
.header p { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
.timeline { padding: 18px 14px 30px; }
.msg { display: grid; grid-template-columns: 42px 1fr; gap: 10px; margin-bottom: 14px; }
.msg.self { grid-template-columns: 1fr 42px; }
.avatar-btn { border: none; padding: 0; background: transparent; cursor: pointer; width: 42px; height: 42px; border-radius: 8px; }
.avatar { width: 42px; height: 42px; border-radius: 8px; object-fit: cover; background: #ddd; }
.msg-main { width: fit-content; max-width: 76%; }
.msg.self .msg-main { margin-left: auto; }
.meta { font-size: 12px; color: var(--muted); margin: 0 0 4px; }
.msg.self .meta { text-align: right; }
.bubble { display: inline-block; max-width: 100%; border-radius: 10px; padding: 10px 12px; background: var(--incoming); box-shadow: 0 1px 1px rgba(0,0,0,.04); line-height: 1.45; word-break: break-word; white-space: pre-wrap; }
.msg.self .bubble { background: var(--outgoing); }
.bubble.media { padding: 4px; background: transparent; box-shadow: none; }
.recall-tip { font-size: 12px; color: var(--muted); text-align: center; padding: 4px 0; }
.quote { margin-bottom: 8px; background: rgba(0,0,0,0.06); border-left: 3px solid rgba(0,0,0,0.18); border-radius: 6px; padding: 6px 8px; font-size: 12px; color: #333; }
.img { max-width: min(320px, 100%); border-radius: 8px; display: block; }
.img-caption { margin-top: 6px; font-size: 13px; line-height: 1.4; }
.voice-btn { border:none; background:transparent; padding:0; font:inherit; color:inherit; cursor:pointer; display:flex; align-items:center; gap:8px; }
.voice-icon { font-size: 12px; color:#3b3b3b; }
.voice-duration { font-size: 13px; color:#3b3b3b; min-width: 26px; text-align:left; }
.voice-btn.playing .voice-icon { color: #07c160; }
.card { display: block; border-radius: 8px; background: var(--card-bg); padding: 9px; text-decoration: none; color: inherit; }
.card-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.card-desc { font-size: 12px; color: var(--muted); margin-bottom: 8px; }
.card-footer { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }
.article-card { border:none; display:block; width:100%; text-align:left; cursor:pointer; border-radius:8px; background:#f8f8f8; padding:9px; }
.article-title { font-size:14px; font-weight:600; line-height:1.4; }
.article-meta { margin-top:4px; font-size:11px; color:var(--muted); }
.article-cover { width:100%; margin-top:8px; border-radius:6px; max-height:150px; object-fit:cover; background:#ddd; }
.article-summary { margin-top:7px; font-size:12px; color:#4c4c4c; line-height:1.45; }
.contact-card { width:min(240px,100%); box-sizing:border-box; border-radius:8px; background:#f8f8f8; padding:10px; display:flex; gap:9px; align-items:center; }
.contact-card > div { min-width:0; flex:1; }
.contact-avatar { width:42px; height:42px; border-radius:8px; object-fit:cover; background:#ddd; }
.contact-name { font-size:14px; font-weight:600; word-break:break-word; }
.contact-nick { margin-top:2px; font-size:11px; color:var(--muted); word-break:break-word; }
.contact-bio { margin-top:6px; font-size:12px; color:#4c4c4c; line-height:1.35; white-space:normal; word-break:break-word; }
a.inline-link { color: #576b95; }
.mention { display:inline-block; padding:0 5px; border-radius:5px; color:#576b95; background:rgba(87,107,149,.14); border:1px solid rgba(87,107,149,.22); font-weight:700; line-height:1.25; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
.profile-modal { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,.35); z-index: 20; }
.profile-modal.show { display: flex; }
.profile-card { width: min(320px, 100%); background: #fff; border-radius: 12px; padding: 14px; box-shadow: 0 12px 30px rgba(0,0,0,.2); }
.profile-head { display:flex; gap:10px; align-items:center; margin-bottom:10px; }
.profile-avatar { width:50px; height:50px; border-radius:8px; object-fit:cover; background:#ddd; }
.profile-name { font-size:16px; font-weight:600; }
.profile-item { font-size:13px; color:#444; line-height:1.45; margin-top:4px; word-break:break-word; }
.profile-close { margin-top: 12px; width: 100%; border:none; border-radius:8px; background:#f2f2f2; padding:8px 0; cursor:pointer; }
.article-modal { position: fixed; inset: 0; background:#fff; z-index: 30; display:none; overflow-y:auto; }
.article-modal.show { display:block; }
.article-header { position: sticky; top: 0; background:rgba(255,255,255,.96); backdrop-filter:blur(10px); border-bottom:1px solid #ececec; height:46px; display:flex; align-items:center; padding:0 10px; }
.article-back { border:none; background:transparent; font-size:14px; color:#444; cursor:pointer; padding:6px 8px; }
.article-body { padding:18px 18px 36px; max-width:680px; margin:0 auto; --article-h1-size:22px; --article-h2-size:20px; --article-h3-size:18px; --article-heading-color:#1f1f1f; --article-heading-line-height:1.35; --article-heading-shadow:none; --article-heading-border:none; --article-heading-padding-bottom:0; --article-sub-color:#8f8f8f; --article-text-size:16px; --article-text-line-height:1.8; --article-text-color:#222; --article-text-shadow:none; --article-paragraph-color:#222; --article-link-color:#576b95; --article-link-decoration:none; --article-code-font:"SF Mono","Menlo","Consolas",monospace; --article-code-bg:#f6f6f6; --article-code-border:none; --article-code-radius:4px; --article-code-color:#d14; --article-pre-bg:#f6f8fa; --article-pre-border:none; --article-pre-radius:8px; --article-pre-color:#24292f; --article-pre-shadow:none; --article-blockquote-bg:#f7f7f7; --article-blockquote-border:#d0d0d0; --article-blockquote-color:#555; --article-inline-image-bg:#ddd; --article-inline-image-border:none; --article-page-image-bg:#ddd; --article-page-image-border:none; --article-image-radius:8px; }
${articlePageCss}
${imageViewerCss}
`;

const paperCss = `
:root { --bg:#fbf7ef; --ink:#2f2a24; --muted:#7c6f62; --incoming:#fffaf2; --outgoing:#efe3cf; }
body { margin:0; font-family:"Source Han Serif SC","Noto Serif SC",serif; background: radial-gradient(circle at top,#fff,#f3e8d7); color:var(--ink); }
.chat { max-width: 860px; margin:0 auto; min-height:100vh; background: var(--bg); border-left:1px solid #e7dcc9; border-right:1px solid #e7dcc9; }
.header { padding:14px 18px; border-bottom:1px solid #e7dcc9; }
.timeline { padding:18px; }
.msg{display:grid;grid-template-columns:44px 1fr;gap:10px;margin-bottom:14px}.msg.self{grid-template-columns:1fr 44px}
.avatar-btn{border:none;padding:0;background:transparent;cursor:pointer;width:44px;height:44px;border-radius:2px}
.msg-main{width:fit-content;max-width:78%}.msg.self .msg-main{margin-left:auto}.meta{font-size:12px;color:var(--muted)}.msg.self .meta{text-align:right}
.bubble{display:inline-block;max-width:100%;padding:10px 12px;border-radius:4px;background:var(--incoming);border:1px solid #e4d7c1;white-space:pre-wrap}.msg.self .bubble{background:var(--outgoing)}
.bubble.media{padding:4px;background:transparent;border:none}
.recall-tip{font-size:12px;color:var(--muted);text-align:center;padding:4px 0}
.quote{padding:6px 8px;margin-bottom:8px;border-left:2px solid #a48a6f;background:#f8efdf;font-size:12px}
.avatar{width:44px;height:44px;border-radius:2px;object-fit:cover;background:#ddd}
.img{max-width:min(320px,100%);display:block;border:1px solid #dac8ac}
.img-caption{margin-top:6px;font-size:13px;line-height:1.4}
.voice-btn{border:none;background:transparent;padding:0;font:inherit;color:inherit;cursor:pointer;display:flex;align-items:center;gap:8px}
.voice-icon{font-size:12px;color:#3b3b3b}.voice-duration{font-size:13px;color:#3b3b3b;min-width:26px;text-align:left}.voice-btn.playing .voice-icon{color:#5f513f}
.card{display:block;padding:8px;border:1px solid #dac8ac;background:#fff4e3;text-decoration:none;color:inherit}
.card-title{font-weight:700}.card-desc,.card-footer{font-size:12px;color:var(--muted)}
.article-card{border:1px solid #dac8ac;display:block;width:100%;text-align:left;cursor:pointer;padding:8px;background:#fff4e3;border-radius:4px}
.article-title{font-size:14px;font-weight:700;line-height:1.4}.article-meta{margin-top:4px;font-size:11px;color:var(--muted)}
.article-cover{width:100%;margin-top:8px;border:1px solid #dac8ac;max-height:150px;object-fit:cover}.article-summary{margin-top:7px;font-size:12px;color:#4c4c4c;line-height:1.45}
.contact-card{width:min(240px,100%);box-sizing:border-box;padding:9px;border:1px solid #dac8ac;background:#fff4e3;border-radius:4px;display:flex;gap:9px;align-items:center}.contact-card>div{min-width:0;flex:1}
.contact-avatar{width:42px;height:42px;border-radius:4px;object-fit:cover;background:#ddd}.contact-name{font-size:14px;font-weight:700}
.contact-nick{margin-top:2px;font-size:11px;color:var(--muted);word-break:break-word}.contact-bio{margin-top:6px;font-size:12px;color:#4c4c4c;line-height:1.35;white-space:normal;word-break:break-word}
.mention{display:inline-block;padding:0 5px;border-radius:5px;color:#6b5842;background:rgba(107,88,66,.14);border:1px solid rgba(107,88,66,.24);font-weight:700;line-height:1.25;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.profile-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.35);z-index:20}
.profile-modal.show{display:flex}
.profile-card{width:min(320px,100%);background:#fffef9;border-radius:8px;padding:14px;box-shadow:0 12px 30px rgba(0,0,0,.2);border:1px solid #e4d7c1}
.profile-head{display:flex;gap:10px;align-items:center;margin-bottom:10px}.profile-avatar{width:50px;height:50px;border-radius:4px;object-fit:cover;background:#ddd}
.profile-name{font-size:16px;font-weight:700}.profile-item{font-size:13px;color:#444;line-height:1.45;margin-top:4px;word-break:break-word}
.profile-close{margin-top:12px;width:100%;border:1px solid #dac8ac;border-radius:6px;background:#f8efdf;padding:8px 0;cursor:pointer}
.article-modal{position:fixed;inset:0;background:#fffef9;z-index:30;display:none;overflow-y:auto}
.article-modal.show{display:block}.article-header{position:sticky;top:0;background:#fffef9;border-bottom:1px solid #e4d7c1;height:46px;display:flex;align-items:center;padding:0 10px}
.article-back{border:none;background:transparent;font-size:14px;color:#444;cursor:pointer;padding:6px 8px}
.article-body{padding:14px 14px 30px;--article-h1-size:22px;--article-h2-size:20px;--article-h3-size:18px;--article-heading-color:#2f2a24;--article-heading-line-height:1.35;--article-heading-shadow:none;--article-heading-border:none;--article-heading-padding-bottom:0;--article-sub-color:#8f8f8f;--article-text-size:16px;--article-text-line-height:1.8;--article-text-color:#222;--article-text-shadow:none;--article-paragraph-color:#222;--article-link-color:#6b5842;--article-link-decoration:none;--article-code-font:"SF Mono","Menlo","Consolas",monospace;--article-code-bg:#f8efdf;--article-code-border:1px solid #dac8ac;--article-code-radius:4px;--article-code-color:#6b5842;--article-pre-bg:#fff4e3;--article-pre-border:1px solid #dac8ac;--article-pre-radius:4px;--article-pre-color:#2f2a24;--article-pre-shadow:none;--article-blockquote-bg:#f8efdf;--article-blockquote-border:#a48a6f;--article-blockquote-color:#5f513f;--article-inline-image-bg:#ddd;--article-inline-image-border:1px solid #dac8ac;--article-page-image-bg:#ddd;--article-page-image-border:1px solid #dac8ac;--article-image-radius:4px}
${articlePageCss}
${imageViewerCss}
`;

const itermsCss = `
:root { --bg:#0a0d14; --ink:#33ff66; --muted:#6aaa70; --incoming:#141b22; --outgoing:#0e2a15; --accent:#00ff41; --glow:0 0 6px rgba(0,255,65,0.45); }
body { margin:0; font-family:"SF Mono","Menlo","Courier New",monospace; background:#05080d; color:var(--ink); }
.chat { max-width:860px; margin:0 auto; min-height:100vh; background:var(--bg); border-left:1px solid #173020; border-right:1px solid #173020; }
.header { padding:14px 18px; border-bottom:2px solid #173020; backdrop-filter:blur(8px); }
.header h1 { color:var(--accent); text-shadow:var(--glow); }
.header p { color:var(--muted); }
.timeline { padding:18px; }
.msg{display:grid;grid-template-columns:44px 1fr;gap:10px;margin-bottom:14px}.msg.self{grid-template-columns:1fr 44px}
.avatar-btn{border:none;padding:0;background:transparent;cursor:pointer;width:44px;height:44px;border-radius:2px}
.msg-main{width:fit-content;max-width:78%}.msg.self .msg-main{margin-left:auto}.meta{font-size:12px;color:var(--muted)}.msg.self .meta{text-align:right}
.bubble{display:inline-block;max-width:100%;padding:10px 12px;border-radius:2px;background:var(--incoming);border:1px solid #173020;white-space:pre-wrap;color:var(--ink);text-shadow:0 0 3px rgba(0,255,65,0.2)}.msg.self .bubble{background:var(--outgoing);border-color:#1a4020;color:#d0ffd0}
.bubble.media{padding:4px;background:transparent;border:none;text-shadow:none}
.recall-tip{font-size:12px;color:var(--muted);text-align:center;padding:4px 0}
.quote{padding:6px 8px;margin-bottom:8px;border-left:2px solid var(--accent);background:#0d1a12;font-size:12px;color:#a0e0a0;text-shadow:0 0 3px rgba(0,255,65,0.15)}
.avatar{width:44px;height:44px;border-radius:2px;object-fit:cover;background:#0d1a12}
.img{max-width:min(320px,100%);display:block;border:1px solid #1a4020}
.img-caption{margin-top:6px;font-size:13px;line-height:1.4;color:var(--ink)}
.voice-btn{border:none;background:transparent;padding:0;font:inherit;color:inherit;cursor:pointer;display:flex;align-items:center;gap:8px}
.voice-icon{font-size:12px;color:var(--accent)}.voice-duration{font-size:13px;color:var(--ink);min-width:26px;text-align:left}.voice-btn.playing .voice-icon{color:#fff}
.card{display:block;padding:8px;border:1px solid #173020;background:#0d1a12;text-decoration:none;color:var(--ink);text-shadow:0 0 3px rgba(0,255,65,0.15)}
.card-title{font-weight:700;color:var(--ink)}.card-desc,.card-footer{font-size:12px;color:var(--muted)}
.article-card{border:1px solid #173020;display:block;width:100%;text-align:left;cursor:pointer;padding:8px;background:#0d1a12;border-radius:2px;color:var(--ink)}
.article-title{font-size:14px;font-weight:700;line-height:1.4}.article-meta{margin-top:4px;font-size:11px;color:var(--muted)}
.article-cover{width:100%;margin-top:8px;border:1px solid #1a4020;max-height:150px;object-fit:cover}.article-summary{margin-top:7px;font-size:12px;color:var(--ink);line-height:1.45}
.contact-card{width:min(240px,100%);box-sizing:border-box;padding:9px;border:1px solid #173020;background:#0d1a12;border-radius:2px;display:flex;gap:9px;align-items:center;color:var(--ink)}.contact-card>div{min-width:0;flex:1}
.contact-avatar{width:42px;height:42px;border-radius:2px;object-fit:cover;background:#0d1a12}.contact-name{font-size:14px;font-weight:700}
.contact-nick{margin-top:2px;font-size:11px;color:var(--muted);word-break:break-word}.contact-bio{margin-top:6px;font-size:12px;color:var(--ink);line-height:1.35;white-space:normal;word-break:break-word}
.mention{display:inline-block;padding:0 5px;border-radius:5px;color:#7CFF8F;background:rgba(0,255,65,.14);border:1px solid rgba(0,255,65,.38);font-weight:700;line-height:1.25;text-shadow:0 0 5px rgba(0,255,65,0.5);box-decoration-break:clone;-webkit-box-decoration-break:clone}
a.inline-link{color:var(--accent)}
.profile-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,8,5,.75);z-index:20}
.profile-modal.show{display:flex}
.profile-card{width:min(320px,100%);background:#0a1016;border-radius:4px;padding:14px;box-shadow:0 0 20px rgba(0,255,65,.15);border:1px solid #173020}
.profile-head{display:flex;gap:10px;align-items:center;margin-bottom:10px}.profile-avatar{width:50px;height:50px;border-radius:2px;object-fit:cover;background:#0d1a12}
.profile-name{font-size:16px;font-weight:700;text-shadow:var(--glow)}.profile-item{font-size:13px;color:var(--ink);line-height:1.45;margin-top:4px;word-break:break-word}
.profile-close{margin-top:12px;width:100%;border:1px solid #173020;border-radius:4px;background:#0d1a12;padding:8px 0;cursor:pointer;color:var(--ink)}
.article-modal{position:fixed;inset:0;background:#05080d;z-index:30;display:none;overflow-y:auto}
.article-modal.show{display:block}.article-header{position:sticky;top:0;background:rgba(5,8,13,.96);border-bottom:2px solid #173020;height:46px;display:flex;align-items:center;padding:0 10px;box-shadow:0 1px 0 #0f2b18}
.article-back{border:none;background:transparent;font-size:14px;color:var(--accent);cursor:pointer;padding:6px 8px}
.article-body{padding:18px 18px 36px;max-width:760px;margin:0 auto;--article-body-bg:#05080d;--article-body-border:1px solid #173020;--article-body-radius:2px;--article-body-shadow:inset 0 0 0 1px rgba(124,255,143,.04),0 14px 32px rgba(0,0,0,.38);--article-h1-size:20px;--article-h2-size:18px;--article-h3-size:16px;--article-heading-color:#7CFF8F;--article-heading-line-height:1.35;--article-heading-shadow:none;--article-heading-border:1px solid #18351f;--article-heading-padding-bottom:6px;--article-title-letter-spacing:0;--article-title-transform:none;--article-sub-color:#78977e;--article-sub-letter-spacing:.04em;--article-sub-transform:uppercase;--article-text-size:15px;--article-text-line-height:1.78;--article-text-color:#c9f5d1;--article-text-shadow:none;--article-paragraph-color:#c9f5d1;--article-link-color:#7CFF8F;--article-link-decoration:underline;--article-link-underline-offset:3px;--article-code-font:"SF Mono","Menlo","Courier New",monospace;--article-code-bg:#101823;--article-code-border:1px solid #203444;--article-code-radius:2px;--article-code-color:#ffd866;--article-pre-bg:#03070a;--article-pre-border:1px solid #18351f;--article-pre-radius:2px;--article-pre-color:#d7ffe0;--article-pre-shadow:inset 0 0 0 1px rgba(124,255,143,.04);--article-blockquote-bg:#09160f;--article-blockquote-border:#6ee7b7;--article-blockquote-color:#a8d8b0;--article-hr-color:#173020;--article-del-color:#78977e;--article-table-border:#173020;--article-table-head-bg:#0b1710;--article-table-cell-bg:#050a07;--article-inline-image-bg:#07100a;--article-inline-image-border:1px solid #214b2c;--article-page-image-bg:#07100a;--article-page-image-border:1px solid #214b2c;--article-image-radius:2px;--article-markdown-bg:#07100a;--article-markdown-border:1px solid #132919;--article-markdown-border-top:1px solid #173020;--article-markdown-radius:2px;--article-markdown-shadow:inset 0 0 0 1px rgba(124,255,143,.03);--article-markdown-padding:14px 16px 16px}
${articlePageCss}
${imageViewerCss}
`;

export const themes = {
  wechat: { id: "wechat", css: wechatCss },
  paper: { id: "paper", css: paperCss },
  iterms: { id: "iterms", css: itermsCss }
};
