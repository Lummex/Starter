// Shared helpers for the factory pipeline.
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = process.cwd();
export const FACTORY = path.join(ROOT, 'factory');
export const config = JSON.parse(fs.readFileSync(path.join(FACTORY, 'config.json'), 'utf8'));
export const FAKE = process.env.FACTORY_FAKE === '1'; // local testing: no GitHub/Vercel/Claude calls

export const STATUS_LABELS = [
  'factory:new', 'factory:building', 'factory:needs-info', 'factory:review',
  'factory:revise', 'factory:approved', 'factory:shipping', 'factory:shipped', 'factory:failed',
];

export function log(...a) { console.log('[factory]', ...a); }

export function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  if (opts.check !== false && r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}):\n${(r.stderr || '') + (r.stdout || '')}`.slice(0, 4000));
  }
  return r;
}

export const git = (...args) => sh('git', args).stdout.trim();

export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'site';
}

// Finds the project folder for an issue (projects/<slug>-<n>), or makes a new slug.
export function resolveSlug(issue, title) {
  const dir = path.join(ROOT, 'projects');
  if (fs.existsSync(dir)) {
    const hit = fs.readdirSync(dir).find((d) => d.endsWith(`-${issue}`) && fs.statSync(path.join(dir, d)).isDirectory());
    if (hit) return hit;
  }
  const data = path.join(ROOT, 'factory-data');
  if (fs.existsSync(data)) {
    const hit = fs.readdirSync(data).find((d) => d.endsWith(`-${issue}`));
    if (hit) return hit;
  }
  return `${slugify(title)}-${issue}`;
}

export function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ''));
}

export function stripAnsi(s) { return String(s).replace(/\u001b\[[0-9;]*m/g, ''); }

// ---------- GitHub ----------
const REPO = process.env.GITHUB_REPOSITORY;

export function gh(method, endpoint, body) {
  if (FAKE) { log(`(fake) gh ${method} ${endpoint}`); return method === 'GET' ? [] : {}; }
  const args = ['api', '-X', method, `repos/${REPO}/${endpoint}`];
  let input;
  if (body) { args.push('--input', '-'); input = JSON.stringify(body); }
  const r = sh('gh', args, { input, check: false });
  if (r.status !== 0) { log(`gh ${method} ${endpoint} failed: ${r.stderr}`); return null; }
  try { return JSON.parse(r.stdout || 'null'); } catch { return null; }
}

export function setStatus(issue, status) {
  const current = gh('GET', `issues/${issue}/labels`) || [];
  for (const l of current) {
    if (STATUS_LABELS.includes(l.name) && l.name !== status) gh('DELETE', `issues/${issue}/labels/${encodeURIComponent(l.name)}`);
  }
  gh('POST', `issues/${issue}/labels`, { labels: [status] });
}

export function comment(issue, body, data) {
  const marker = data ? `\n\n<!-- factory:${JSON.stringify(data)} -->` : '';
  gh('POST', `issues/${issue}/comments`, { body: body + marker });
}

export function runUrl() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  return GITHUB_RUN_ID ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}` : '';
}

// Owner comments (not from the bot), oldest first: answers to questions and change requests.
export function ownerFeedback(issue) {
  const comments = gh('GET', `issues/${issue}/comments?per_page=100`) || [];
  return comments
    .filter((c) => c.user?.type !== 'Bot' && !c.body.includes('<!-- factory:'))
    .map((c) => `- (${c.created_at?.slice(0, 10)}) ${c.body.trim()}`)
    .join('\n');
}

// ---------- Claude agents ----------
let spent = 0;
export const totalSpent = () => spent;

export function runAgent(role, prompt, budgetUsd) {
  const remaining = config.budgetsUsd.maxPerRun - spent;
  if (remaining <= 0.25) throw new Error(`Run budget of $${config.budgetsUsd.maxPerRun} used up.`);
  const budget = Math.min(budgetUsd, remaining);
  log(`agent ${role} starting (model ${config.models[role]}, budget $${budget.toFixed(2)})`);
  if (FAKE) {
    const hook = process.env[`FACTORY_FAKE_${role.toUpperCase()}`];
    if (hook) sh('bash', ['-c', hook], { stdio: 'inherit' });
    return { ok: true, cost: 0 };
  }
  const r = sh('claude', [
    '-p', '--dangerously-skip-permissions',
    '--model', config.models[role],
    '--max-budget-usd', budget.toFixed(2),
    '--output-format', 'json',
  ], { input: prompt, check: false, timeout: 45 * 60 * 1000, stdio: ['pipe', 'pipe', 'inherit'] });
  let out = {};
  try { out = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { log(`agent ${role}: unparsable output`, r.stdout?.slice(-2000)); }
  const cost = Number(out.total_cost_usd || 0);
  spent += cost;
  log(`agent ${role} finished: ${out.subtype || r.status}, cost $${cost.toFixed(2)}, run total $${spent.toFixed(2)}`);
  if (out.result) log(`agent ${role} says: ${String(out.result).slice(0, 1500)}`);
  // Account problems: stop right away with a plain-English explanation instead of a confusing later error.
  const said = String(out.result || r.stdout || '');
  if (/invalid api key|not logged in|please run \/login|authentication_error/i.test(said) && cost === 0) {
    throw new Error('Anthropic rejected the API key. Make a new key at console.anthropic.com → API Keys, then paste it into GitHub → Starter → Settings → Secrets and variables → Actions → ANTHROPIC_API_KEY (pencil icon → Update secret).');
  }
  if (/credit balance|billing|insufficient.*credit|quota/i.test(said) && cost === 0) {
    throw new Error('Your Anthropic account is out of credits. Add credits at console.anthropic.com → Billing, then press Try again.');
  }
  return { ok: r.status === 0 && !out.is_error, cost, result: out.result, subtype: out.subtype };
}

// ---------- Inspection ----------
export async function withServer(dir, fn) {
  const port = String(config.port);
  const proc = spawn('node', [path.join(FACTORY, 'scripts/serve.mjs'), dir, port], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) {
      try { await fetch(`http://127.0.0.1:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    return await fn(`http://127.0.0.1:${port}`);
  } finally { proc.kill(); }
}

// Installs + builds the app. Returns { ok, log }.
export function buildApp(appDir) {
  if (!fs.existsSync(path.join(appDir, 'package.json'))) {
    return { ok: false, log: `No package.json in ${path.relative(ROOT, appDir)} — the app was not created.` };
  }
  const lock = fs.existsSync(path.join(appDir, 'package-lock.json'));
  const inst = sh('npm', [lock ? 'ci' : 'install', '--no-audit', '--no-fund'], { cwd: appDir, check: false });
  if (inst.status !== 0) return { ok: false, log: `npm install failed:\n${tail(inst.stderr + inst.stdout)}` };
  const b = sh('npm', ['run', 'build'], { cwd: appDir, check: false });
  if (b.status !== 0) return { ok: false, log: `npm run build failed:\n${tail(b.stdout + b.stderr)}` };
  if (!fs.existsSync(path.join(appDir, 'dist', 'index.html'))) return { ok: false, log: 'Build finished but dist/index.html is missing.' };
  return { ok: true, log: '' };
}

export function tail(s, n = 60) { return stripAnsi(s).trim().split('\n').slice(-n).join('\n'); }

// Runs the hidden acceptance tests against the built site.
export async function runAcceptance(appDir, accDir, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const resultsJson = path.join(outDir, 'results.json');
  fs.rmSync(resultsJson, { force: true });
  // Copy the tests next to the factory's node_modules so '@playwright/test' resolves.
  const runDir = path.join(FACTORY, '.run-tests');
  fs.rmSync(runDir, { recursive: true, force: true });
  fs.cpSync(accDir, runDir, { recursive: true });
  await withServer(path.join(appDir, 'dist'), async () => {
    sh('npx', ['playwright', 'test', '--config', path.join(FACTORY, 'playwright.config.mjs'), '--output', path.join(outDir, 'artifacts')], {
      cwd: FACTORY, check: false, stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, ACCEPTANCE_DIR: runDir, RESULTS_JSON: resultsJson, FACTORY_PORT: String(config.port) },
    });
  });
  if (!fs.existsSync(resultsJson)) return { passed: 0, total: 0, failures: ['The test runner crashed or found no tests.'] };
  const report = JSON.parse(fs.readFileSync(resultsJson, 'utf8'));
  const results = [];
  const walk = (suite, prefix = '') => {
    for (const s of suite.suites || []) walk(s, s.title && !s.title.endsWith('.mjs') && !s.title.endsWith('.js') ? `${prefix}${s.title} › ` : prefix);
    for (const sp of suite.specs || []) {
      const ok = sp.ok;
      const err = sp.tests?.flatMap((t) => t.results || []).flatMap((r) => r.errors || (r.error ? [r.error] : [])).map((e) => stripAnsi(e.message || '')).find(Boolean);
      results.push({ title: prefix + sp.title, ok, error: err ? err.split('\n').slice(0, 12).join('\n') : '' });
    }
  };
  for (const s of report.suites || []) walk(s);
  const failed = results.filter((r) => !r.ok);
  const fatal = (report.errors || []).map((e) => stripAnsi(e.message || ''));
  return {
    passed: results.length - failed.length,
    total: results.length,
    results,
    failures: [...fatal, ...failed.map((f) => `✗ ${f.title}\n${f.error}`)],
  };
}
