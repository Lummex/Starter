// Secret scan: refuses a commit or build that contains a secret key.
// Proposed location: factory/scripts/secret-scan.mjs (see factory-changes.md).
//
// Usage:
//   node secret-scan.mjs                 scan every file git tracks (plus untracked, not ignored)
//   node secret-scan.mjs <path> ...      scan these files/folders (e.g. projects/oreheart-8/dist)
// Exit code 1 and a list of "file:line  what" when anything is found. Never prints the key itself.
//
// What counts as a secret:
//   - Supabase secret keys          sb_secret_...
//   - Stripe secret/restricted keys sk_live_..., sk_test_..., rk_live_..., rk_test_...
//   - Stripe webhook secrets        whsec_...
//   - Any JWT whose payload says role = service_role (the old Supabase secret key format)
//   - The words service_role / SERVICE_ROLE anywhere in the two browser apps' code
//     (projects/*/src, projects/*/index.html, projects/*/dist): browser code must never
//     even mention the secret key. SQL, tests and docs may name the role.
// The bare prefixes (e.g. in this comment or a brief) are fine: a key needs a body after the prefix.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', '.supabase', 'test-results', 'playwright-report']);
const BINARY = /\.(png|jpe?g|webp|gif|ico|glb|gltf|bin|ktx2|mp3|ogg|wav|mp4|webm|woff2?|ttf|otf|zip|gz|pdf|psd|blend|fbx)$/i;
const MAX_BYTES = 5 * 1024 * 1024;

const PATTERNS = [
  { what: 'Supabase secret key (sb_secret_)', re: /sb_secret_[A-Za-z0-9_-]{16,}/ },
  { what: 'Stripe secret key (sk_live_)', re: /sk_live_[A-Za-z0-9]{16,}/ },
  { what: 'Stripe test secret key (sk_test_)', re: /sk_test_[A-Za-z0-9]{16,}/ },
  { what: 'Stripe restricted key (rk_live_/rk_test_)', re: /rk_(live|test)_[A-Za-z0-9]{16,}/ },
  { what: 'Stripe webhook secret (whsec_)', re: /whsec_[A-Za-z0-9+/=]{16,}/ },
];
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;
const BROWSER_CODE = /(^|\/)projects\/[^/]+\/(src|dist|public)\/|(^|\/)projects\/[^/]+\/index\.html$/;
const ROLE_WORD = /service_role/i;

function listFiles(args) {
  if (args.length) {
    const out = [];
    const walk = (p) => {
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(path.basename(p))) return;
        for (const f of fs.readdirSync(p)) walk(path.join(p, f));
      } else out.push(p);
    };
    args.forEach(walk);
    return out;
  }
  const git = (a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
  return [...new Set([...git(['ls-files']), ...git(['ls-files', '--others', '--exclude-standard'])])]
    .filter((f) => !f.split('/').some((part) => SKIP_DIRS.has(part)));
}

function jwtRole(payloadPart) {
  try {
    return JSON.parse(Buffer.from(payloadPart.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role;
  } catch { return undefined; }
}

export function scanText(file, text) {
  const hits = [];
  const norm = file.replace(/\\/g, '/');
  const browser = BROWSER_CODE.test(norm);
  text.split(/\r?\n/).forEach((line, i) => {
    for (const p of PATTERNS) if (p.re.test(line)) hits.push({ file: norm, line: i + 1, what: p.what });
    for (const m of line.matchAll(JWT)) {
      if (jwtRole(m[1]) === 'service_role') hits.push({ file: norm, line: i + 1, what: 'JWT with role service_role (secret key)' });
    }
    if (browser && ROLE_WORD.test(line)) hits.push({ file: norm, line: i + 1, what: 'browser code mentions the secret-key role' });
  });
  return hits;
}

function main() {
  const files = listFiles(process.argv.slice(2));
  const hits = [];
  for (const f of files) {
    if (BINARY.test(f)) continue;
    let st;
    try { st = fs.statSync(f); } catch { continue; }
    if (!st.isFile() || st.size > MAX_BYTES) continue;
    hits.push(...scanText(f, fs.readFileSync(f, 'utf8')));
  }
  if (hits.length) {
    console.error(`Secret scan FAILED: ${hits.length} finding(s). Remove the key, rotate it in its dashboard, then commit again.`);
    for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.what}`);
    process.exit(1);
  }
  console.log(`Secret scan passed (${files.length} files).`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('secret-scan.mjs')) main();
