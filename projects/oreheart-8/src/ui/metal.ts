// Round 4 (R4.5): every piece of visible text gets the metal look. This tags the nearest element of each text node with
// `data-metal="gold"` (default) or `"silver"` (flavor lines, secondary text); the CSS in style.css fills the letters
// with the gold / silver metal (texture on large lettering, a clean gradient on small text) and sets Cinzel or Tinos.
const SILVER = '.fl,.fc-flavor,.cv-flavor,.cv-tag,.m-silver-text,.m-silver-stat';
const LETTER = /[A-Za-z0-9]/;

function tagNode(n: Node) {
  const el = n.parentElement;
  if (!el || !LETTER.test(n.nodeValue || '')) return;
  if (el.closest('svg,canvas,script,style,textarea,input,noscript')) return;
  const silver = el.matches(SILVER);
  if (el.hasAttribute('data-metal')) { if (silver && el.dataset.metal !== 'silver') el.dataset.metal = 'silver'; return; }
  el.setAttribute('data-metal', silver ? 'silver' : 'gold');
}
function tagTree(root: Node) {
  if (root.nodeType === 3) return tagNode(root);
  if (root.nodeType !== 1 || (root as Element).matches?.('svg,canvas,script,style')) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) tagNode(n);
}

export function startMetal() {
  tagTree(document.body);
  // tag synchronously in the observer callback so text is never seen unstyled
  new MutationObserver((muts) => {
    for (const m of muts) { if (m.type === 'characterData') tagTree(m.target); else m.addedNodes.forEach((a) => { if (a.isConnected) tagTree(a); }); }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
