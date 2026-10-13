// The factory pipeline: plan → build → inspect (loop) → report → preview → wait for owner approval.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ROOT, FACTORY, config, FAKE, log, sh, git, resolveSlug, fill, setStatus, comment, runUrl,
  ownerFeedback, runAgent, totalSpent, buildApp, runAcceptance, withServer,
} from './lib.mjs';

const issue = process.env.ISSUE_NUMBER;
const title = process.env.ISSUE_TITLE || `Project ${issue}`;
const body = process.env.ISSUE_BODY || '';
if (!issue) throw new Error('ISSUE_NUMBER is required');

const slug = resolveSlug(issue, title);
const branch = `factory/issue-${issue}`;
const appRel = `projects/${slug}`;
const dataRel = `factory-data/${slug}`;
const appDir = path.join(ROOT, appRel);
const dataDir = path.join(ROOT, dataRel);
const accDir = path.join(dataDir, 'acceptance');
const workDir = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'factory-'));
const prompt = (name) => fs.readFileSync(path.join(FACTORY, 'prompts', `${name}.md`), 'utf8');

function commitAll(message) {
  const paths = [appRel, dataRel].filter((p) => fs.existsSync(path.join(ROOT, p)));
  if (paths.length) git('add', '-A', ...paths);
  const staged = sh('git', ['diff', '--cached', '--quiet'], { check: false }).status !== 0;
  if (staged) git('commit', '-q', '-m', message);
}

function push() {
  if (FAKE) return log('(fake) git push');
  git('push', '-q', '--force-with-lease', 'origin', `HEAD:${branch}`);
}

// Undo anything an agent changed outside the folder it was allowed to touch.
function confineTo(allowedRel) {
  const inside = (f) => f === allowedRel || f.startsWith(`${allowedRel}/`);
  const changed = sh('git', ['diff', '--name-only', 'HEAD'], { check: false }).stdout.split('\n').filter(Boolean);
  const reverted = changed.filter((f) => !inside(f));
  if (reverted.length) sh('git', ['checkout', 'HEAD', '--', ...reverted], { check: false });
  const untracked = sh('git', ['ls-files', '--others', '--exclude-standard'], { check: false }).stdout.split('\n').filter(Boolean);
  const removed = untracked.filter((f) => !inside(f));
  for (const f of removed) fs.rmSync(path.join(ROOT, f), { force: true });
  if (reverted.length + removed.length) log(`reverted out-of-bounds changes: ${[...reverted, ...removed].join(', ')}`);
}

function checkoutBranch() {
  if (FAKE) return;
  const exists = sh('git', ['ls-remote', '--exit-code', '--heads', 'origin', branch], { check: false }).status === 0;
  if (exists) {
    git('fetch', '-q', 'origin', `${branch}:${branch}`);
    git('checkout', '-q', branch);
    // Pick up factory improvements made on main since this project started.
    sh('git', ['merge', '-q', '--no-edit', '-X', 'theirs', 'origin/main'], { check: false });
  } else {
    git('checkout', '-q', '-b', branch);
  }
}

async function main() {
  setStatus(issue, 'factory:building');
  comment(issue, `🏭 **The factory has started working on this.**\n\nPlanning → building → testing. This usually takes 10–30 minutes. ${runUrl() ? `[Watch the agents work](${runUrl()})` : ''}`,
    { type: 'started', run: runUrl() });

  checkoutBranch();
  fs.mkdirSync(dataDir, { recursive: true });
  const feedback = FAKE ? (process.env.FACTORY_FAKE_FEEDBACK || '') : ownerFeedback(issue);
  const feedbackSection = feedback
    ? `## Owner feedback and answers (oldest first — later items win if they conflict)\n\n${feedback}\n\nThe current spec, tests and app (if any) reflect earlier rounds. Update them to satisfy this feedback.`
    : '';

  // ---- 1. Plan ----
  fs.rmSync(path.join(dataDir, 'QUESTIONS.md'), { force: true });
  const vars = { TITLE: title, BODY: body, DATA_DIR: dataRel, APP_DIR: appRel, ACCEPTANCE_DIR: `${dataRel}/acceptance`, FEEDBACK_SECTION: feedbackSection };
  runAgent('planner', fill(prompt('planner'), vars), config.budgetsUsd.planner);
  confineTo(dataRel);

  if (fs.existsSync(path.join(dataDir, 'QUESTIONS.md'))) {
    commitAll(`factory: questions for #${issue}`);
    push();
    const q = fs.readFileSync(path.join(dataDir, 'QUESTIONS.md'), 'utf8');
    setStatus(issue, 'factory:needs-info');
    comment(issue, `❓ **The planner needs a bit more information before building.**\n\n${q}\n\nReply with your answers and the factory will continue.`, { type: 'questions' });
    return;
  }
  const specFile = path.join(dataDir, 'SPEC.md');
  const testFiles = fs.existsSync(accDir) ? fs.readdirSync(accDir).filter((f) => /\.spec\.(m?js|ts)$/.test(f)) : [];
  if (!fs.existsSync(specFile) || testFiles.length === 0) throw new Error('The planner did not produce a spec and acceptance tests.');
  commitAll(`factory: plan for #${issue}`);

  // ---- 2. Build + inspect loop ----
  let failures = [];
  let result = { passed: 0, total: 0, failures: [] };
  let round = 0;
  for (round = 1; round <= config.maxBuildRounds; round++) {
    const failuresSection = failures.length
      ? `## The inspector rejected the previous attempt (round ${round - 1})\n\nFix every one of these problems. The acceptance tests are hidden from you; these are their results. Fix the app — do not try to special-case the tests.\n\n\`\`\`\n${failures.join('\n\n').slice(0, 12000)}\n\`\`\``
      : '';
    // Hide the acceptance tests from the builder (they're restored from git afterwards).
    fs.rmSync(accDir, { recursive: true, force: true });
    runAgent('builder', fill(prompt('builder'), { ...vars, FAILURES_SECTION: failuresSection }), config.budgetsUsd.builderPerRound);
    confineTo(appRel); // also restores the hidden tests
    commitAll(`factory: build round ${round} for #${issue}`);

    log(`inspecting round ${round}`);
    const b = buildApp(appDir);
    if (!b.ok) {
      failures = [b.log];
      result = { passed: 0, total: 0, failures, buildFailed: true };
      log('build failed', b.log);
      continue;
    }
    result = await runAcceptance(appDir, accDir, path.join(workDir, `round-${round}`));
    log(`round ${round}: ${result.passed}/${result.total} checks passed`);
    if (result.total > 0 && result.passed === result.total) break;
    failures = result.failures;
    if (totalSpent() > config.budgetsUsd.maxPerRun - config.budgetsUsd.builderPerRound / 2) { log('stopping: budget nearly used'); break; }
  }
  round = Math.min(round, config.maxBuildRounds);

  // ---- 3. Report ----
  const shotsDir = path.join(dataDir, 'screenshots');
  fs.rmSync(shotsDir, { recursive: true, force: true });
  const resultsFile = path.join(dataDir, 'test-results.md');
  const summary = [
    `# Automated check results`,
    ``,
    result.buildFailed ? `The site did not build after ${round} round(s), so no checks could run.` : `${result.passed} of ${result.total} checks passed after ${round} build round(s).`,
    ``,
    ...(result.results || []).map((r) => `- ${r.ok ? '✅' : '❌'} ${r.title}`),
    ...(result.failures?.length ? ['', '## Failures', '', '```', ...result.failures, '```'] : []),
  ].join('\n');
  fs.writeFileSync(resultsFile, summary);
  if (fs.existsSync(path.join(appDir, 'dist', 'index.html'))) {
    await withServer(path.join(appDir, 'dist'), (url) => {
      sh('node', [path.join(FACTORY, 'scripts/screenshots.mjs'), url, shotsDir], { cwd: FACTORY, check: false, stdio: 'inherit' });
    });
  }
  try {
    runAgent('reviewer', fill(prompt('reviewer'), { ...vars, RESULTS_FILE: `${dataRel}/test-results.md`, SHOTS_DIR: `${dataRel}/screenshots` }), config.budgetsUsd.reviewer);
  } catch (e) { log('reviewer skipped:', e.message); }
  confineTo(dataRel);
  const reportFile = path.join(dataDir, 'REPORT.md');
  const report = fs.existsSync(reportFile) ? fs.readFileSync(reportFile, 'utf8') : `## Automated checks\n\n${result.passed} of ${result.total} checks passed.`;
  commitAll(`factory: report for #${issue}`);
  push();

  // ---- 4. Preview deploy ----
  let preview = '';
  if (fs.existsSync(path.join(appDir, 'dist', 'index.html'))) preview = deploy(false);
  commitAll(`factory: link Vercel project for #${issue}`);
  push();
  ensurePullRequest();

  // ---- 5. Hand over to the owner ----
  const allPassed = result.total > 0 && result.passed === result.total;
  const cost = totalSpent();
  setStatus(issue, 'factory:review');
  comment(issue, [
    allPassed ? `✅ **Ready for your review.** All ${result.total} automated checks passed.` : `⚠️ **Ready for your review, but some checks failed** (${result.passed} of ${result.total} passed). Read the report before approving.`,
    '',
    preview ? `**👉 Preview: ${preview}**` : '**No preview could be made because the site did not build.** Request changes to try again.',
    '',
    report,
    '',
    `<sub>Build rounds: ${round} · Agent cost this run: $${cost.toFixed(2)} · [Run log](${runUrl()})</sub>`,
  ].join('\n'), { type: 'report', preview, passed: result.passed, total: result.total, rounds: round, cost: Number(cost.toFixed(2)), slug });
}

function deploy(prod) {
  if (FAKE) return 'https://example-preview.vercel.app';
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN secret is missing.');
  fs.rmSync(path.join(appDir, 'node_modules'), { recursive: true, force: true });
  const args = ['--yes', 'vercel@latest', 'deploy', '--yes', '--token', token];
  if (prod) args.push('--prod');
  const r = sh('npx', args, { cwd: appDir, check: false });
  const out = (r.stdout || '') + '\n' + (r.stderr || '');
  if (r.status !== 0) throw new Error(`Vercel deploy failed:\n${out.slice(-3000)}`);
  const url = (r.stdout.match(/https:\/\/\S+/g) || []).pop();
  if (!url) throw new Error(`Could not find the deployment URL in Vercel's output:\n${out.slice(-2000)}`);
  // Keep the project link so approval deploys to the same Vercel project.
  if (fs.existsSync(path.join(appDir, '.vercel', 'project.json'))) git('add', '-f', path.join(appRel, '.vercel', 'project.json'));
  return url;
}

function ensurePullRequest() {
  if (FAKE) return;
  const owner = process.env.GITHUB_REPOSITORY.split('/')[0];
  const existing = sh('gh', ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number'], { check: false });
  if (existing.status === 0 && JSON.parse(existing.stdout || '[]').length) return;
  sh('gh', ['pr', 'create', '--base', 'main', '--head', branch, '--title', `Factory: ${title} (#${issue})`,
    '--body', `Built autonomously by the factory for #${issue}. Approve from the dashboard to ship.\n\nOwner: @${owner}`], { check: false });
}

main().catch((e) => {
  console.error(e);
  try {
    setStatus(issue, 'factory:failed');
    comment(issue, `🛑 **The factory hit a problem and stopped.**\n\n\`\`\`\n${String(e.message || e).slice(0, 3000)}\n\`\`\`\n\nYou can press **Try again** in the dashboard. [Run log](${runUrl()})`, { type: 'failed' });
  } finally { process.exit(1); }
});
