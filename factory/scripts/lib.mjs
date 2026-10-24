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
// opts.onlyFailed + opts.previous: re-run only the checks that failed in `previous`
// (a quick in-between check); passing checks keep their earlier result.
export async function runAcceptance(appDir, accDir, outDir, opts = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const resultsJson = path.join(outDir, 'results.json');
  fs.rmSync(resultsJson, { force: true });
  // Copy the tests next to the factory's node_modules so '@playwright/test' resolves.
  const runDir = path.join(FACTORY, '.run-tests');
  fs.rmSync(runDir, { recursive: true, force: true });
  fs.cpSync(accDir, runDir, { recursive: true });
  const prevFailed = opts.onlyFailed && opts.previous ? (opts.previous.results || []).filter((r) => !r.ok && r.id) : [];
  const partial = prevFailed.length > 0;
  const args = ['playwright', 'test', '--config', path.join(FACTORY, 'playwright.config.mjs'), '--output', path.join(outDir, 'artifacts')];
  if (partial) {
    // Pick exactly the failed checks: one "file › describe › title" per line.
    const list = path.join(outDir, 'only-failed.txt');
    fs.writeFileSync(list, [...new Set(prevFailed.map((r) => `${r.id} › ${r.title}`))].join('\n') + '\n');
    args.push('--test-list', list);
  }
  const t0 = Date.now();
  // Full runs are split across several GitHub machines at once (the 3D checks are CPU-bound, so
  // more workers on ONE machine barely helps). Falls back to running here if that fails.
  const shards = Number(process.env.FACTORY_SHARDS || 0);
  let remoteOk = false;
  if (!partial && opts.remote && shards > 1 && !FAKE) {
    try { remoteOk = await remoteChecks({ ...opts.remote, shards, outDir, resultsJson }); } catch (e) { log('split checks failed, running them here instead:', e.message); }
  }
  if (!remoteOk) {
    await withServer(path.join(appDir, 'dist'), async () => {
      sh('npx', args, {
        cwd: FACTORY, check: false, stdio: ['ignore', 'inherit', 'inherit'],
        env: { ...process.env, ACCEPTANCE_DIR: runDir, RESULTS_JSON: resultsJson, FACTORY_PORT: String(config.port), ...(opts.workers ? { PW_WORKERS: String(opts.workers) } : {}) },
      });
    });
  }
  log(`checks took ${Math.round((Date.now() - t0) / 60000)} min${partial ? ` (re-checked only the ${prevFailed.length} that failed last time)` : remoteOk ? ` (split across ${shards} machines)` : ''}`);
  const fresh = readResults(resultsJson);
  if (!partial) {
    // Heavy 3D/drag checks can time out when many run side by side. Give each failure one more
    // try with less load before calling it a real failure.
    const nFailed = (fresh.results || []).filter((r) => !r.ok).length;
    if (process.env.FACTORY_CONFIRM === '1' && !opts.noConfirm && nFailed > 0 && nFailed <= 40) {
      log(`confirming ${nFailed} failed check(s) with fewer running at once`);
      return runAcceptance(appDir, accDir, path.join(outDir, 'confirm'), { onlyFailed: true, previous: fresh, workers: 2, noConfirm: true, keepFull: true });
    }
    return fresh;
  }
  if (!fresh.results) return fresh;
  // Merge: re-run checks replace their old result, everything else keeps its earlier result.
  const byKey = new Map(fresh.results.map((r) => [r.id + '|' + r.title, r]));
  const results = opts.previous.results.map((r) => byKey.get(r.id + '|' + r.title) || r);
  const failed = results.filter((r) => !r.ok);
  return {
    passed: results.length - failed.length,
    total: results.length,
    results,
    failures: [...fresh.fatal, ...failed.map((f) => `✗ ${f.title}\n${f.error}`)],
    partial: !opts.keepFull, // a confirm pass still counts as a full run
  };
}

// Starts factory-checks.yml for the pushed commit, waits for it, and merges the shard reports.
async function remoteChecks({ push, branch, slug, shards, outDir, resultsJson }) {
  push();
  const sha = git('rev-parse', 'HEAD');
  const tag = `${sha.slice(0, 8)}-${Date.now().toString(36)}`;
  const r = sh('gh', ['workflow', 'run', 'factory-checks.yml', '--ref', 'main', '-f', `sha=${sha}`, '-f', `slug=${slug}`, '-f', `tag=${tag}`, '-f', `shards=${shards}`], { check: false });
  if (r.status !== 0) throw new Error('could not start factory-checks: ' + (r.stderr || r.stdout));
  log(`checks split across ${shards} machines (run ${tag})`);
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  let run = null;
  for (let i = 0; i < 240; i++) { // up to ~60 minutes
    await sleep(15000);
    const l = sh('gh', ['run', 'list', '--workflow', 'factory-checks.yml', '-L', '30', '--json', 'databaseId,displayTitle,status,conclusion'], { check: false });
    if (l.status !== 0) continue;
    run = JSON.parse(l.stdout || '[]').find((x) => (x.displayTitle || '').includes(tag));
    if (run && run.status === 'completed') break;
  }
  if (!run || run.status !== 'completed') throw new Error('factory-checks did not finish in time');
  const dl = path.join(outDir, 'shards');
  fs.rmSync(dl, { recursive: true, force: true });
  const d = sh('gh', ['run', 'download', String(run.databaseId), '-D', dl], { check: false });
  if (d.status !== 0) throw new Error('could not download shard results: ' + d.stderr);
  const files = [];
  const walk = (p) => { for (const f of fs.readdirSync(p)) { const q = path.join(p, f); if (fs.statSync(q).isDirectory()) walk(q); else if (f === 'results.json') files.push(q); } };
  walk(dl);
  if (files.length < shards) throw new Error(`only ${files.length} of ${shards} shard reports came back`);
  const merged = { suites: [], errors: [] };
  for (const f of files) { const j = JSON.parse(fs.readFileSync(f, 'utf8')); merged.suites.push(...(j.suites || [])); merged.errors.push(...(j.errors || [])); }
  fs.writeFileSync(resultsJson, JSON.stringify(merged));
  return true;
}

function readResults(resultsJson) {
  if (!fs.existsSync(resultsJson)) return { passed: 0, total: 0, failures: ['The test runner crashed or found no tests.'], fatal: [] };
  const report = JSON.parse(fs.readFileSync(resultsJson, 'utf8'));
  const results = [];
  const walk = (suite, prefix = '') => {
    for (const s of suite.suites || []) walk(s, s.title && !s.title.endsWith('.mjs') && !s.title.endsWith('.js') ? `${prefix}${s.title} › ` : prefix);
    for (const sp of suite.specs || []) {
      const ok = sp.ok;
      const err = sp.tests?.flatMap((t) => t.results || []).flatMap((r) => r.errors || (r.error ? [r.error] : [])).map((e) => stripAnsi(e.message || '')).find(Boolean);
      results.push({ title: prefix + sp.title, ok, id: sp.file || '', error: err ? err.split('\n').slice(0, 12).join('\n') : '' });
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
    fatal,
  };
}
