import './style.css';

const KEY = 'truck-inventory-v1';
const CATS = ['Plumbing', 'Air conditioning', 'Electrical', 'Other'];

// ---------- state ----------
let state = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.parts)) return { parts: s.parts, history: s.history || [], bad: s.bad || [] };
  } catch (e) { /* ignore */ }
  return { parts: [], history: [], bad: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}
let uid = Date.now();
const nextId = () => ++uid;

// ---------- helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const keyOf = (n) => String(n).toLowerCase().trim().replace(/\s+/g, ' ').replace(/s$/, '');
const findPart = (name) => state.parts.find((p) => keyOf(p.name) === keyOf(name));
const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const isLow = (p) => p.qty <= p.low;
const whole = (v) => /^\d+$/.test(String(v).trim());
const total = () => state.parts.reduce((a, p) => a + p.qty, 0);
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

function log(type, part, qty, job = '') {
  state.history.push({ ts: new Date().toISOString(), type, part, qty, job });
}
function addQty(name, qty, category = 'Other', low = 0) {
  let p = findPart(name);
  if (p) p.qty += qty;
  else {
    p = { id: nextId(), name: capFirst(name.trim()), category, qty, low };
    state.parts.push(p);
  }
  return p;
}
function fmtDate(iso) {
  const d = new Date(iso);
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

// message area: exactly one element with role status/alert when there is a message
function setMsg(text, kind = 'status', root = document) {
  const box = $('.msg-box', root);
  if (!box) return;
  box.innerHTML = '';
  if (!text) return;
  const el = document.createElement('div');
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = text;
  box.appendChild(el);
}
const ok = (t, r) => setMsg(t, 'status', r);
const err = (t, r) => setMsg(t, 'error', r);

// ---------- parsing ----------
const NUMWORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
const FILLER = /^(?:i['’]m using|im using|i used|we used|i have|there are|add|used|using|plus)(?![a-z0-9])\s*/i;

function parseList(text) {
  const chunks = text.split(/\r?\n|,|;|&|\band\b/i);
  const out = [];
  for (let c of chunks) {
    c = c.trim().replace(/\.$/, '').trim();
    for (let i = 0; i < 4; i++) {
      const n = c.replace(FILLER, '');
      if (n === c) break;
      c = n.trim();
    }
    let qty = 1;
    let name = c;
    let m = c.match(/^(\d+)\s*(.*)$/s);
    if (m) {
      if (/^(°|degrees?\b|deg\b)/i.test(m[2])) { qty = 1; name = c; }
      else { qty = parseInt(m[1], 10); name = m[2]; }
    } else {
      m = c.match(/^([a-z]+)\s+(.*)$/is);
      if (m && Object.prototype.hasOwnProperty.call(NUMWORDS, m[1].toLowerCase())) {
        qty = NUMWORDS[m[1].toLowerCase()];
        name = m[2];
      }
    }
    name = name.trim().replace(/\s+/g, ' ');
    if (!name || qty < 1) continue;
    const k = keyOf(name);
    const ex = out.find((o) => o.key === k);
    if (ex) ex.qty += qty;
    else out.push({ key: k, name, qty });
  }
  return out;
}

// ---------- voice ----------
function voiceBlock(textarea) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const wrap = document.createElement('div');
  if (!SR) {
    wrap.innerHTML = '<p class="muted">Voice input isn\'t supported in this browser. Type instead.</p>';
    return wrap;
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Start talking';
  wrap.appendChild(btn);
  let rec = null;
  let listening = false;
  const stop = () => { listening = false; btn.textContent = 'Start talking'; };
  btn.addEventListener('click', () => {
    if (listening && rec) {
      try { rec.stop(); } catch (e) { /* ignore */ }
      stop();
      return;
    }
    try {
      rec = new SR();
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (ev) => {
        let t = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) t += ev.results[i][0].transcript;
        t = t.trim();
        if (t) textarea.value = textarea.value.trim() ? textarea.value.trim() + ', ' + t : t;
      };
      rec.onerror = () => { stop(); err("Couldn't hear you. Check microphone permission and try again."); };
      rec.onend = stop;
      rec.start();
      listening = true;
      btn.textContent = 'Stop talking';
    } catch (e) {
      stop();
      err("Couldn't hear you. Check microphone permission and try again.");
    }
  });
  return wrap;
}

// ---------- pages ----------
const app = $('#app');

function catOptions(sel = 'Plumbing') {
  return CATS.map((c) => `<option${c === sel ? ' selected' : ''}>${c}</option>`).join('');
}

function validatePart(name, qty, low) {
  if (!name.trim()) return 'Please enter a part name.';
  if (!whole(qty)) return 'Quantity must be a whole number of 0 or more.';
  if (!whole(low)) return 'Low-stock alert must be a whole number of 0 or more.';
  return '';
}

function inventoryPage() {
  app.innerHTML = `
  <h1>Truck Inventory</h1>
  <p id="total"></p>
  <section class="card">
    <h2>Add a part</h2>
    <form id="add-form" novalidate>
      <div class="grid">
        <div class="field"><label for="p-name">Part name</label><input type="text" id="p-name" autocomplete="off"></div>
        <div class="field"><label for="p-qty">Quantity</label><input type="number" id="p-qty" min="0" step="1" inputmode="numeric"></div>
        <div class="field"><label for="p-low">Low-stock alert at</label><input type="number" id="p-low" min="0" step="1" value="0" inputmode="numeric"></div>
        <div class="field"><label for="p-cat">Category</label><select id="p-cat">${catOptions()}</select></div>
      </div>
      <button type="submit" class="primary">Add part</button>
    </form>
    <div class="msg-box"></div>
  </section>
  <section class="card">
    <div class="field"><label for="search">Search parts</label><input type="search" id="search" placeholder="Search parts" autocomplete="off"></div>
    <div class="table-wrap"><table><thead><tr><th scope="col">Part</th><th scope="col">Category</th><th scope="col">On truck</th><th scope="col">Low at</th><th scope="col">Actions</th></tr></thead><tbody id="rows"></tbody></table></div>
  </section>
  <dialog id="edit-dlg" role="dialog" aria-labelledby="edit-h">
    <form id="edit-form" novalidate>
      <h2 id="edit-h">Edit part</h2>
      <div class="field"><label for="e-name">Part name</label><input type="text" id="e-name"></div>
      <div class="field"><label for="e-qty">Quantity</label><input type="number" id="e-qty" min="0" step="1"></div>
      <div class="field"><label for="e-low">Low-stock alert at</label><input type="number" id="e-low" min="0" step="1"></div>
      <div class="field"><label for="e-cat">Category</label><select id="e-cat">${catOptions()}</select></div>
      <div class="msg-box"></div>
      <div class="btn-row"><button type="submit" class="primary">Save changes</button><button type="button" id="e-cancel">Cancel</button></div>
    </form>
  </dialog>`;

  const rows = $('#rows');
  const dlg = $('#edit-dlg');
  let editing = null;

  function draw() {
    $('#total').textContent = `Total items on truck: ${total()}`;
    const q = $('#search').value.trim().toLowerCase();
    const list = state.parts.filter((p) => p.name.toLowerCase().includes(q)).sort(byName);
    if (!list.length) {
      rows.innerHTML = `<tr><td colspan="5">${state.parts.length ? 'No parts match your search.' : 'No parts yet. Add your first part above.'}</td></tr>`;
      return;
    }
    rows.innerHTML = list.map((p) => `<tr data-id="${p.id}"><td>${esc(p.name)}${isLow(p) ? '<span class="badge">Low</span>' : ''}</td><td>${esc(p.category)}</td><td>${p.qty}</td><td>${p.low}</td><td><div class="btn-row" style="margin:0"><button type="button" data-act="edit">Edit</button><button type="button" class="danger" data-act="del">Delete</button></div></td></tr>`).join('');
  }
  draw();

  $('#search').addEventListener('input', draw);

  $('#add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#p-name').value, qty = $('#p-qty').value, low = $('#p-low').value;
    const m = validatePart(name, qty, low);
    if (m) return err(m);
    const q = parseInt(qty, 10);
    const p = addQty(name, q, $('#p-cat').value, parseInt(low, 10));
    log('Added', p.name, q);
    save();
    $('#p-name').value = ''; $('#p-qty').value = ''; $('#p-low').value = '0'; $('#p-cat').value = 'Plumbing';
    draw();
    ok(`Added ${q} to ${p.name} (now ${p.qty}).`);
  });

  rows.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const p = state.parts.find((x) => x.id === Number(b.closest('tr').dataset.id));
    if (!p) return;
    if (b.dataset.act === 'edit') {
      editing = p;
      $('#e-name').value = p.name; $('#e-qty').value = p.qty; $('#e-low').value = p.low; $('#e-cat').value = p.category;
      setMsg('', 'status', dlg);
      dlg.showModal();
    } else if (window.confirm(`Delete ${p.name} from the truck?`)) {
      state.parts = state.parts.filter((x) => x !== p);
      log('Removed', p.name, p.qty);
      save();
      draw();
      ok(`Removed ${p.name}.`);
    }
  });

  $('#e-cancel').addEventListener('click', () => dlg.close());
  $('#edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#e-name').value, qty = $('#e-qty').value, low = $('#e-low').value;
    const m = validatePart(name, qty, low);
    if (m) return err(m, dlg);
    const other = findPart(name);
    if (other && other !== editing) return err('Another part already has that name.', dlg);
    const q = parseInt(qty, 10);
    const changed = q !== editing.qty;
    editing.name = name.trim().replace(/\s+/g, ' ');
    editing.qty = q;
    editing.low = parseInt(low, 10);
    editing.category = $('#e-cat').value;
    if (changed) log('Count changed', editing.name, q);
    save();
    dlg.close();
    draw();
    ok(`Saved changes to ${editing.name}.`);
  });
}

function quickAddPage() {
  app.innerHTML = `
  <h1>Quick Add</h1>
  <p>Type or say what you're putting on the truck, like "add 3 angle stops and 2 90 degree elbows".</p>
  <section class="card">
    <div class="field"><label for="qa-text">What do you want to add?</label><textarea id="qa-text"></textarea></div>
    <div id="voice"></div>
    <div class="btn-row"><button type="button" id="read" class="primary">Read list</button></div>
    <div class="msg-box"></div>
    <div id="preview"></div>
  </section>`;
  const ta = $('#qa-text');
  $('#voice').appendChild(voiceBlock(ta));
  let items = [];
  $('#read').addEventListener('click', () => {
    items = parseList(ta.value);
    const pv = $('#preview');
    if (!items.length) {
      pv.innerHTML = '';
      return err('I couldn\'t find any parts in that. Try something like "3 angle stops".');
    }
    setMsg('');
    pv.innerHTML = `<div class="table-wrap"><table><thead><tr><th scope="col">Part</th><th scope="col">Quantity</th><th scope="col">Status</th></tr></thead><tbody>${items.map((it) => {
      const ex = findPart(it.name);
      return `<tr><td>${esc(ex ? ex.name : capFirst(it.name))}</td><td>${it.qty}</td><td>${ex ? 'Already on truck' : 'New part'}</td></tr>`;
    }).join('')}</tbody></table></div><div class="btn-row"><button type="button" id="save-qa" class="primary">Save to inventory</button></div>`;
    $('#save-qa').addEventListener('click', () => {
      for (const it of items) {
        const p = addQty(it.name, it.qty);
        log('Added', p.name, it.qty);
      }
      save();
      const n = items.length;
      items = [];
      ta.value = '';
      pv.innerHTML = '';
      ok(`Saved ${n} parts to inventory.`);
    });
  });
}

let photoUrl = null;
function photoPage() {
  app.innerHTML = `
  <h1>Photo Count</h1>
  <p id="photo-intro">Snap a photo of a bin or shelf, then tap each part in the photo to count it.</p>
  <section class="card">
    <div class="field"><label for="photo-in">Take or choose a photo</label><input type="file" id="photo-in" accept="image/*" capture="environment"></div>
    <div id="photo-area" hidden>
      <p>Tap each part in the photo to count it.</p>
      <div class="photo-wrap" id="pw"><img id="pimg" alt="Your photo"></div>
      <p><strong id="counted">Counted: 0</strong></p>
      <div class="btn-row"><button type="button" id="undo">Undo last tap</button><button type="button" id="clear">Clear taps</button></div>
      <div class="field"><label for="ph-name">Part name</label><input type="text" id="ph-name" list="part-names" autocomplete="off"><datalist id="part-names">${state.parts.map((p) => `<option value="${esc(p.name)}"></option>`).join('')}</datalist></div>
      <button type="button" id="ph-add" class="primary">Add to inventory</button>
    </div>
    <div class="msg-box"></div>
  </section>`;
  const area = $('#photo-area'), pw = $('#pw'), img = $('#pimg');
  let taps = [];
  const draw = () => {
    pw.querySelectorAll('.marker').forEach((m) => m.remove());
    taps.forEach((t, i) => {
      const m = document.createElement('span');
      m.className = 'marker';
      m.textContent = i + 1;
      m.style.left = t.x + '%';
      m.style.top = t.y + '%';
      pw.appendChild(m);
    });
    $('#counted').textContent = `Counted: ${taps.length}`;
  };
  $('#photo-in').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(f);
    img.src = photoUrl;
    area.hidden = false; $('#photo-intro').hidden = true;
    taps = [];
    setMsg('');
    draw();
  });
  pw.addEventListener('click', (e) => {
    const r = pw.getBoundingClientRect();
    if (!r.width || !r.height) return;
    taps.push({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
    draw();
  });
  $('#undo').addEventListener('click', () => { taps.pop(); draw(); });
  $('#clear').addEventListener('click', () => { taps = []; draw(); });
  $('#ph-add').addEventListener('click', () => {
    if (!taps.length) return err('Tap the photo to count at least one part.');
    const name = $('#ph-name').value;
    if (!name.trim()) return err('Please enter a part name.');
    const n = taps.length;
    const p = addQty(name.trim().replace(/\s+/g, ' '), n);
    log('Added', p.name, n);
    save();
    taps = [];
    $('#ph-name').value = '';
    draw();
    ok(`Added ${n} to ${p.name} (now ${p.qty}).`);
  });
}

function usePage() {
  app.innerHTML = `
  <h1>Use Parts</h1>
  <section class="card">
    <div class="field"><label for="job">Job number</label><input type="text" id="job" autocomplete="off"></div>
    <fieldset><legend>What happened?</legend>
      <label class="radio" for="r-used"><input type="radio" name="kind" id="r-used" value="used" checked> Used on job</label>
      <label class="radio" for="r-bad"><input type="radio" name="kind" id="r-bad" value="bad"> Bad part (not usable)</label>
      <p class="helper">The part was bad and not used. It won't be charged to the job and will go on your restock list.</p>
    </fieldset>
    <div class="field"><label for="u-text">Parts used</label><textarea id="u-text" placeholder="e.g. 2 angle stops, 2 90 degree elbows"></textarea></div>
    <div id="voice"></div>
    <div class="btn-row"><button type="button" id="record" class="primary">Record</button></div>
    <div class="msg-box"></div>
  </section>`;
  const ta = $('#u-text');
  $('#voice').appendChild(voiceBlock(ta));
  $('#record').addEventListener('click', () => {
    const items = parseList(ta.value);
    const job = $('#job').value.trim();
    const bad = $('#r-bad').checked;
    if (!items.length) return err('Please list the parts you used.');
    if (!bad && !job) return err('Please enter a job number.');
    const missing = items.filter((it) => !findPart(it.name));
    if (missing.length) return err(`Not on your truck: ${missing.map((m) => m.name).join(', ')}. Add it on the Inventory page first.`);
    for (const it of items) {
      const p = findPart(it.name);
      if (p.qty < it.qty) return err(`Not enough ${p.name} on the truck (have ${p.qty}, need ${it.qty}).`);
    }
    const parts = [];
    for (const it of items) {
      const p = findPart(it.name);
      p.qty -= it.qty;
      parts.push(`${it.qty} × ${p.name}`);
      if (bad) {
        log('Bad part', p.name, it.qty, '');
        state.bad.push({ id: nextId(), name: p.name, qty: it.qty });
      } else log('Used on job', p.name, it.qty, job);
    }
    save();
    ta.value = '';
    ok(bad ? `Recorded bad part: ${parts.join(', ')}. Added to your restock list.` : `Recorded for job ${job}: ${parts.join(', ')}.`);
  });
}

function restockPage() {
  app.innerHTML = `
  <h1>Restock List</h1>
  <section class="card"><h2>Running low</h2><div id="low"></div></section>
  <section class="card"><h2>Replace bad parts</h2><div class="msg-box"></div><div id="bad"></div></section>`;
  const draw = () => {
    const low = state.parts.filter(isLow).sort(byName);
    $('#low').innerHTML = low.length ? `<ul class="plain">${low.map((p) => `<li>${esc(p.name)}: have ${p.qty}, alert at ${p.low}</li>`).join('')}</ul>` : '<p>Nothing is running low.</p>';
    $('#bad').innerHTML = state.bad.length ? `<ul class="plain">${state.bad.map((b) => `<li><span>${esc(b.name)} × ${b.qty}</span><button type="button" data-id="${b.id}">Mark replaced</button></li>`).join('')}</ul>` : '<p>No bad parts to replace.</p>';
  };
  draw();
  $('#bad').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    const i = state.bad.findIndex((x) => x.id === Number(b.dataset.id));
    if (i < 0) return;
    const [rec] = state.bad.splice(i, 1);
    const p = addQty(rec.name, rec.qty);
    log('Replaced', p.name, rec.qty);
    save();
    draw();
    ok(`Replaced ${rec.qty} × ${p.name}.`);
  });
}

function csvCell(v) {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function download(name, rows) {
  const blob = new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reportsPage() {
  app.innerHTML = `
  <h1>Reports</h1>
  <section class="card">
    <div class="field"><label for="f-job">Filter by job number</label><input type="text" id="f-job" autocomplete="off"></div>
    <p id="job-total"></p>
    <div class="table-wrap"><table><thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Part</th><th scope="col">Qty</th><th scope="col">Job number</th></tr></thead><tbody id="hist"></tbody></table></div>
  </section>
  <section class="card"><div class="btn-row"><button type="button" id="dl-inv" class="primary">Download inventory CSV</button><button type="button" id="dl-hist" class="primary">Download history CSV</button></div></section>`;
  const draw = () => {
    const f = $('#f-job').value.trim().toLowerCase();
    let list = state.history.slice().reverse();
    if (f) list = list.filter((h) => String(h.job).trim().toLowerCase() === f);
    $('#job-total').textContent = f ? `Parts used on job ${$('#f-job').value.trim()}: ${list.filter((h) => h.type === 'Used on job').reduce((a, h) => a + h.qty, 0)}` : '';
    $('#hist').innerHTML = list.length ? list.map((h) => `<tr><td>${fmtDate(h.ts)}</td><td>${esc(h.type)}</td><td>${esc(h.part)}</td><td>${h.qty}</td><td>${h.job ? esc(h.job) : '—'}</td></tr>`).join('') : '<tr><td colspan="5">No history yet.</td></tr>';
  };
  draw();
  $('#f-job').addEventListener('input', draw);
  $('#dl-inv').addEventListener('click', () => download('truck-inventory.csv', [['Part', 'Category', 'On truck', 'Low at'], ...state.parts.slice().sort(byName).map((p) => [p.name, p.category, p.qty, p.low])]));
  $('#dl-hist').addEventListener('click', () => download('truck-history.csv', [['Date', 'Type', 'Part', 'Qty', 'Job number'], ...state.history.slice().reverse().map((h) => [fmtDate(h.ts), h.type, h.part, h.qty, h.job])]));
}

// ---------- router ----------
const routes = { '/': inventoryPage, '/quick-add': quickAddPage, '/photo': photoPage, '/use': usePage, '/restock': restockPage, '/reports': reportsPage };
function route() {
  let path = location.hash.replace(/^#/, '') || '/';
  if (!routes[path]) path = '/';
  document.querySelectorAll('nav a').forEach((a) => {
    if (a.dataset.route === path) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  routes[path]();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
