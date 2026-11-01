// Renders the glossy ruby heart (no text) to public/art/ui/ruby-heart.png with headless Chromium.
import { chromium } from '../../../factory/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<defs>
<radialGradient id="b" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#ff8a8a"/><stop offset=".35" stop-color="#e3162c"/><stop offset=".8" stop-color="#8e0a1e"/><stop offset="1" stop-color="#4a0510"/></radialGradient>
<linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset=".5" stop-color="#d9a52c"/><stop offset="1" stop-color="#7a5410"/></linearGradient>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<path id="h" d="M128 232 C 40 164 14 118 14 78 C 14 40 42 18 76 18 C 100 18 118 30 128 50 C 138 30 156 18 180 18 C 214 18 242 40 242 78 C 242 118 216 164 128 232 Z" fill="url(#b)" stroke="url(#r)" stroke-width="10" stroke-linejoin="round"/>
<path d="M44 74 C 44 52 60 40 78 40 C 92 40 104 46 112 58 C 96 52 80 54 66 66 C 56 74 52 88 54 100 C 46 92 44 84 44 74 Z" fill="url(#g)"/>
<path d="M150 56 C 160 42 172 38 184 40" stroke="#ffd0d0" stroke-opacity=".7" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M128 224 C 70 176 36 132 30 96" stroke="#3a0008" stroke-opacity=".35" stroke-width="10" fill="none" stroke-linecap="round" transform="translate(6 6)"/>
</svg>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 256, height: 256 } });
await p.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
writeFileSync('public/art/ui/ruby-heart.png', await p.screenshot({ omitBackground: true }));
await b.close();
