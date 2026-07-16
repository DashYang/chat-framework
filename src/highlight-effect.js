export const HIGHLIGHT_EFFECT_DURATION_MS = 2300;

export const highlightEffectCss = `
.chat,.phone{--highlight-fg:var(--text,var(--ink,#222));position:relative}
.highlight-effect{position:fixed;z-index:180;display:none;align-items:center;justify-content:center;overflow:hidden;pointer-events:none;color:var(--highlight-fg,var(--text,var(--ink,#222)));background:transparent;isolation:isolate}
.highlight-effect.active{display:flex;animation:highlightShake 2.18s linear forwards}
.highlight-effect-text{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;padding-left:.25em;font-size:clamp(44px,18vw,96px);font-weight:700;letter-spacing:.32em;line-height:1.15;text-align:center;opacity:0;text-shadow:var(--highlight-text-shadow,none);will-change:transform,opacity;transform:translateZ(0) scale(.7)}
.highlight-effect-flash-white,.highlight-effect-flash-black{position:absolute;inset:0;z-index:3;opacity:0;will-change:opacity;transform:translateZ(0)}
.highlight-effect-flash-white{background:var(--highlight-flash-white,#fff)}
.highlight-effect-flash-black{z-index:4;background:#000}
.highlight-effect-vignette{position:absolute;inset:0;z-index:5;background:radial-gradient(circle at center,transparent 42%,rgba(0,0,0,.28) 72%,rgba(0,0,0,.82) 100%)}
.highlight-effect.active .highlight-effect-text{animation:highlightScare 2.18s cubic-bezier(.13,.9,.2,1) forwards}
.highlight-effect.active .highlight-effect-flash-white{animation:highlightWhiteFlash 2.18s linear forwards}
.highlight-effect.active .highlight-effect-flash-black{animation:highlightBlackFlash 2.18s linear forwards}
.highlight-msg .bubble{--highlight-bubble-outline:rgba(0,0,0,.06)}
[data-theme="iterms"] .highlight-effect,.iterms .highlight-effect{--highlight-text-shadow:0 0 8px rgba(0,255,65,.5)}
@keyframes highlightScare{0%{opacity:0;transform:translateZ(0) scale(.76) translateY(12px);letter-spacing:.45em}18%{opacity:.72;transform:translateZ(0) scale(.9) translateY(0);letter-spacing:.38em}32%{opacity:1;transform:translateZ(0) scale(.98);letter-spacing:.32em}52%{opacity:1;transform:translateZ(0) scale(1.08);letter-spacing:.26em}62%{opacity:1;transform:translateZ(0) scale(1.22);letter-spacing:.18em}70%{opacity:1;transform:translateZ(0) scale(7.2) rotate(-1deg);letter-spacing:-.06em}77%{opacity:.95;transform:translateZ(0) scale(10.5) rotate(1deg);letter-spacing:-.16em}88%{opacity:.08;transform:translateZ(0) scale(12.5)}100%{opacity:0;transform:translateZ(0) scale(12.5)}}
@keyframes highlightWhiteFlash{0%,68%{opacity:0}72%{opacity:.72}75%{opacity:0}100%{opacity:0}}
@keyframes highlightBlackFlash{0%,76%{opacity:0}80%{opacity:.7}86%{opacity:0}100%{opacity:0}}
@keyframes highlightShake{0%,64%,92%,100%{transform:translate3d(0,0,0)}70%{transform:translate3d(-2px,2px,0)}74%{transform:translate3d(3px,-2px,0)}78%{transform:translate3d(-3px,-1px,0)}84%{transform:translate3d(2px,2px,0)}}
@media (prefers-reduced-motion:reduce){.highlight-effect.active,.highlight-effect.active .highlight-effect-text,.highlight-effect.active .highlight-effect-flash-white,.highlight-effect.active .highlight-effect-flash-black{animation-duration:1s}.highlight-effect.active{animation-name:none}.highlight-effect-text{letter-spacing:.2em}}
`;

export function highlightEffectRuntimeSource() {
  return `
      function installHighlightEffect(root) {
        const host = root || document.querySelector('.phone') || document.querySelector('.chat') || document.body;
        let overlay = host.querySelector(':scope > .highlight-effect');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'highlight-effect';
          overlay.setAttribute('aria-hidden', 'true');
          overlay.innerHTML = '<div class="highlight-effect-text"></div>'
            + '<div class="highlight-effect-flash-white"></div>'
            + '<div class="highlight-effect-flash-black"></div>'
            + '<div class="highlight-effect-vignette"></div>';
          host.appendChild(overlay);
        }
        const textEl = overlay.querySelector('.highlight-effect-text');
        let locked = false;
        let timer = null;
        const queue = [];
        const idleWaiters = [];

        function flushIdleWaiters() {
          if (locked || queue.length) return;
          while (idleWaiters.length) {
            const callback = idleWaiters.shift();
            callback();
          }
        }

        function syncBounds() {
          const rect = host === document.body
            ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
            : host.getBoundingClientRect();
          overlay.style.left = Math.max(0, rect.left) + 'px';
          overlay.style.top = Math.max(0, rect.top) + 'px';
          overlay.style.width = Math.max(0, Math.min(rect.width, window.innerWidth - Math.max(0, rect.left))) + 'px';
          overlay.style.height = Math.max(0, Math.min(rect.height, window.innerHeight - Math.max(0, rect.top))) + 'px';
        }

        function play(text) {
          const value = String(text || '').trim();
          if (!value) return false;
          if (locked) {
            queue.push(value);
            return true;
          }
          locked = true;
          window.clearTimeout(timer);
          textEl.textContent = value;
          syncBounds();
          overlay.classList.remove('active');
          void overlay.offsetWidth;
          overlay.classList.add('active');
          timer = window.setTimeout(() => {
            overlay.classList.remove('active');
            locked = false;
            const next = queue.shift();
            if (next) play(next);
            else flushIdleWaiters();
          }, ${HIGHLIGHT_EFFECT_DURATION_MS});
          return true;
        }

        function afterIdle(callback) {
          if (typeof callback !== 'function') return;
          if (!locked && !queue.length) {
            callback();
            return;
          }
          idleWaiters.push(callback);
        }

        window.addEventListener('resize', syncBounds);
        window.addEventListener('scroll', syncBounds, true);
        syncBounds();
        return { play, afterIdle, syncBounds, overlay };
      }

      function playHighlightEffect(text, root) {
        const api = window.__highlightEffectApi || installHighlightEffect(root);
        window.__highlightEffectApi = api;
        return api.play(text);
      }

      function triggerHighlightNode(node, root) {
        if (!node || node.dataset.highlightPlayed === 'true') return;
        const text = node.dataset.highlightText || node.textContent || '';
        if (playHighlightEffect(text, root)) {
          node.dataset.highlightPlayed = 'true';
        }
      }

      function installHighlightAutoTrigger(root) {
        const host = root || document.querySelector('.phone') || document.querySelector('.chat') || document.body;
        const api = installHighlightEffect(host);
        window.__highlightEffectApi = api;
        const seen = new WeakSet();
        const trigger = (node) => {
          if (!node || seen.has(node)) return;
          seen.add(node);
          triggerHighlightNode(node, host);
        };
        const nodes = Array.from(host.querySelectorAll('.highlight-msg[data-highlight-text]'));
        if (!nodes.length) return api;
        if (!('IntersectionObserver' in window)) {
          nodes.forEach(trigger);
          return api;
        }
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting || entry.intersectionRatio < 0.55) return;
            observer.unobserve(entry.target);
            trigger(entry.target);
          });
        }, { root: null, threshold: [0.55] });
        nodes.forEach((node) => observer.observe(node));
        return api;
      }`;
}
