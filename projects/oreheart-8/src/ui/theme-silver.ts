/**
 * Ken (Oct 30): "silvery UI, not gold, with fancier buttons: a border with a gem in it".
 * The gem-frame buttons (theme-silver.css) draw Brush's 1400x240 button picture as a border image whose
 * gem caps must keep their shape on wide and narrow buttons. CSS cannot read an element's own height,
 * so this keeps `--sv-h` (the button's height in px) on every button; the CSS sizes the caps from it.
 * Setting a custom property never changes the size, so the observer cannot loop; it is only set when it changes.
 */
const SEL = '.btn, .mb-btn, .o-menu';

export function startSilverFrames(root: Element = document.documentElement): void {
  if (typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return;
  const last = new WeakMap<Element, string>();
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      const b = (e as any).borderBoxSize?.[0];
      const h = b ? b.blockSize : el.getBoundingClientRect().height;
      const v = Math.round(h) + 'px';
      if (h > 0 && last.get(el) !== v) { last.set(el, v); el.style.setProperty('--sv-h', v); }
    }
  });
  const seen = new WeakSet<Element>();
  // not inside a match: there the HUD buttons take their height from the owner layout (--ph) in CSS, and observing
  // them every frame slowed the match down (measured: 43 -> 23 fps in a phone-size headless match)
  const watch = (el: Element) => { if (!seen.has(el) && !el.closest('.match')) { seen.add(el); ro.observe(el); } };
  const scan = (n: Node) => {
    if (n.nodeType !== 1) return;
    const el = n as Element;
    if (el.matches(SEL)) watch(el);
    el.querySelectorAll(SEL).forEach(watch);
  };
  scan(root);
  new MutationObserver((muts) => { for (const m of muts) m.addedNodes.forEach(scan); }).observe(root, { childList: true, subtree: true });
}
