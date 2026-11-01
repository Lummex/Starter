// Round 12d: renders the 8 owner reference cards at 420x624 next to the reference images (side-by-side sheet).
import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const ids = ['goblin-scrounger','gnome-prospector','rune-splitter','fireball','healing-light','soul-shard','venom-shiv','second-wind'];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1700, height: 700 } });
await p.goto('http://localhost:4173/?test=1&seed=3'); await p.waitForTimeout(1000);
for (const id of ids) {
  const ref = 'data:image/jpeg;base64,' + fs.readFileSync(`../../factory-design/card-format/reference/${id}.jpg`).toString('base64');
  await p.evaluate(([id, ref]) => { document.body.innerHTML = '<div id="x" style="display:flex;gap:10px;background:#222;padding:10px"></div>'; const x = document.getElementById('x'); x.append(window.__ohCard(id, 624)); const i = new Image(); i.src = ref; i.style.height = '624px'; x.append(i); }, [id, ref]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `/tmp/cmp-${id}.png`, clip: { x: 0, y: 0, width: 960, height: 650 } });
}
await b.close();
