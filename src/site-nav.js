const PROGRESS_EVENT = "chat-maker:progress";

/**
 * Add a library link that remains hidden until the player has completed a true ending.
 *
 * The player owns the progress state. This small bridge reads the persisted state on
 * page load and listens for same-page progress updates emitted by the runtime.
 */
export function addCompletionGatedLibraryNav(html, { href, label, persistKey }) {
  const config = JSON.stringify({ href, label, persistKey, eventName: PROGRESS_EVENT }).replaceAll("<", "\\u003c");
  const addition = `<style>.cm-site-nav{position:fixed;right:14px;bottom:76px;z-index:80;display:none;padding:9px 12px;border-radius:999px;background:#16765b;color:white!important;text-decoration:none;font:600 12px system-ui;box-shadow:0 6px 20px #0003}.cm-site-nav.is-unlocked{display:block}</style><a class="cm-site-nav" href="${escapeAttribute(href)}">${escapeText(label)}</a><script>(()=>{const config=${config};const nav=document.currentScript.previousElementSibling;const completed=(state)=>Object.keys(state?.trueEndingHandled||{}).some((key)=>key.split('|').at(-1)?.startsWith('true-end'));const update=(value)=>nav?.classList.toggle('is-unlocked',value);try{update(completed(JSON.parse(localStorage.getItem(config.persistKey)||'{}')))}catch(_){update(false)}window.addEventListener(config.eventName,(event)=>update(event.detail?.trueEndingCompleted===true));})();</script>`;
  return html.replace("</body>", `${addition}</body>`);
}

export function chatMakerProgressEventName() {
  return PROGRESS_EVENT;
}

function escapeText(value) {
  return String(value).replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]);
}

function escapeAttribute(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}
