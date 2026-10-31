// Paints the compact stat icons (sword = Attack, boot = Movement) to public/art/ui/ with headless Chromium, same gloss/gold rim style as the ruby heart.
import { chromium } from '../../../factory/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const defs = `<defs>
<linearGradient id="bl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa4b8"/><stop offset=".45" stop-color="#f4f8ff"/><stop offset="1" stop-color="#6a7388"/></linearGradient>
<linearGradient id="go" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset=".5" stop-color="#d9a52c"/><stop offset="1" stop-color="#7a5410"/></linearGradient>
<radialGradient id="lt" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#d98c4a"/><stop offset=".6" stop-color="#8a4a1e"/><stop offset="1" stop-color="#4a230c"/></radialGradient>
<radialGradient id="bk" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#26364f"/><stop offset="1" stop-color="#0c121e"/></radialGradient></defs>`;
const sword = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">${defs}
<circle cx="128" cy="128" r="116" fill="url(#bk)" stroke="url(#go)" stroke-width="12"/>
<g transform="rotate(45 128 128)"><path d="M128 20 L152 56 L152 160 L104 160 L104 56 Z" fill="url(#bl)" stroke="#2a3040" stroke-width="6" stroke-linejoin="round"/><path d="M128 28 L128 160" stroke="#8a93a8" stroke-width="5"/>
<rect x="76" y="160" width="104" height="18" rx="9" fill="url(#go)" stroke="#4a3208" stroke-width="5"/><rect x="116" y="178" width="24" height="48" rx="8" fill="url(#lt)" stroke="#2a1406" stroke-width="5"/><circle cx="128" cy="232" r="13" fill="url(#go)" stroke="#4a3208" stroke-width="5"/></g></svg>`;
const boot = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">${defs}
<circle cx="128" cy="128" r="116" fill="url(#bk)" stroke="url(#go)" stroke-width="12"/>
<path d="M92 52 L152 52 L156 128 C190 136 214 150 214 178 L214 196 L70 196 L74 150 Z" fill="url(#lt)" stroke="#2a1406" stroke-width="7" stroke-linejoin="round"/>
<rect x="66" y="190" width="152" height="20" rx="8" fill="#2a1a0c" stroke="#120a04" stroke-width="5"/><rect x="86" y="44" width="76" height="24" rx="8" fill="url(#go)" stroke="#4a3208" stroke-width="5"/>
<path d="M104 80 L146 80" stroke="#ffd9a8" stroke-opacity=".6" stroke-width="7" stroke-linecap="round"/></svg>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 256, height: 256 } });
for (const [n, svg] of [['sword', sword], ['boot', boot]]) {
  await p.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  writeFileSync(`public/art/ui/stat-${n}.png`, await p.screenshot({ omitBackground: true }));
}
await b.close();
