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
  let queue: Node[] = [];
  let raf = 0;
  const flush = () => { raf = 0; const q = queue; queue = []; for (const n of q) if (n.isConnected) tagTree(n); };
  new MutationObserver((muts) => {
    for (const m of muts) { if (m.type === 'characterData') queue.push(m.target); else m.addedNodes.forEach((a) => queue.push(a)); }
    if (!raf) raf = requestAnimationFrame(flush);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

