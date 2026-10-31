// Ships an approved project: production deploy on Vercel, merge the code into main, close the request.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, FAKE, log, sh, git, resolveSlug, projectConfig, setStatus, comment, runUrl } from './lib.mjs';

const issue = process.env.ISSUE_NUMBER;
const title = process.env.ISSUE_TITLE || '';
const body = process.env.ISSUE_BODY || '';
const branch = `factory/issue-${issue}`;

async function main() {
  setStatus(issue, 'factory:shipping');
  if (!FAKE) {
    git('fetch', '-q', 'origin', `${branch}:${branch}`);
    git('checkout', '-q', branch);
  }
  const slug = resolveSlug(issue, title, body);
  const appDir = path.join(ROOT, 'projects', slug);
  if (!fs.existsSync(path.join(appDir, 'package.json'))) throw new Error(`No app found at projects/${slug}.`);

  let live = 'https://example.vercel.app';
  const alsoLive = [];
  if (!FAKE) {
    const r = sh('npx', ['--yes', 'vercel@latest', 'deploy', '--prod', '--yes', '--token', process.env.VERCEL_TOKEN], { cwd: appDir, check: false });
    const out = `${r.stdout}\n${r.stderr}`;
    if (r.status !== 0) throw new Error(`Vercel production deploy failed:\n${out.slice(-3000)}`);
    // Prefer the short production alias (e.g. my-site-12.vercel.app) over the long deployment URL.
    const urls = [...new Set(out.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/g) || [])].sort((a, b) => a.length - b.length);
    live = (await productionDomain(appDir)) || urls[0] || r.stdout.trim().split('\n').pop();
    log('live at', live, 'all urls:', urls.join(' '));

    // Extra apps (e.g. the admin site) go live too, but only when the owner has linked their Vercel project.
    // The real database is never touched here: that is the separate "Supabase — deploy" workflow.
    for (const a of projectConfig(slug).extraApps) {
      const dir = path.join(ROOT, a.dir);
      if (!fs.existsSync(path.join(dir, '.vercel', 'project.json')) || !fs.existsSync(path.join(dir, 'package.json'))) continue;
      const e = sh('npx', ['--yes', 'vercel@latest', 'deploy', '--prod', '--yes', '--token', process.env.VERCEL_TOKEN], { cwd: dir, check: false });
      if (e.status !== 0) { log(`${a.dir}: production deploy failed`, `${e.stdout}\n${e.stderr}`.slice(-1500)); alsoLive.push(`${a.dir}: deploy FAILED (see run log)`); continue; }
      alsoLive.push(`${a.dir}: ${(await productionDomain(dir)) || (e.stdout.match(/https:\/\/\S+/g) || []).pop() || 'deployed'}`);
    }

    const merge = sh('gh', ['pr', 'merge', branch, '--squash', '--delete-branch'], { check: false });
    if (merge.status !== 0) log('PR merge skipped:', merge.stderr);
  }

  setStatus(issue, 'factory:shipped');
  comment(issue, `🚀 **Shipped! Your site is live:** ${live}\n${alsoLive.map((s) => `\nAlso live: ${s}`).join('')}\n\n<sub>[Run log](${runUrl()})</sub>`, { type: 'shipped', live });
  if (!FAKE) sh('gh', ['issue', 'close', issue, '--reason', 'completed'], { check: false });
}

// Asks Vercel for the project's public production domain (deployment-specific URLs may require a Vercel login).
async function productionDomain(appDir) {
  try {
    const link = JSON.parse(fs.readFileSync(path.join(appDir, '.vercel', 'project.json'), 'utf8'));
    const q = link.orgId?.startsWith('team_') ? `?teamId=${link.orgId}` : '';
    const res = await fetch(`https://api.vercel.com/v9/projects/${link.projectId}/domains${q}`, {
      headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
    });
    const data = await res.json();
    const names = (data.domains || []).filter((d) => !d.redirect && !d.gitBranch).map((d) => d.name);
    const pick = names.find((n) => !n.endsWith('.vercel.app')) || names.sort((a, b) => a.length - b.length)[0];
    return pick ? `https://${pick}` : '';
  } catch (e) {
    log('could not look up production domain:', e.message);
    return '';
  }
}

main().catch((e) => {
  console.error(e);
  try {
    setStatus(issue, 'factory:review');
    comment(issue, `🛑 **Shipping failed.** The site is not live yet.\n\n\`\`\`\n${String(e.message || e).slice(0, 3000)}\n\`\`\`\n\nPress **Approve** again to retry. [Run log](${runUrl()})`, { type: 'ship-failed' });
  } finally { process.exit(1); }
});
