import { guarded, gh, statusOf, parseMarker, readJson } from './_lib.js';

// GET: list all factory projects.  POST: submit a new idea.
export default guarded(async (req, res) => {
  if (req.method === 'POST') {
    const { title, description } = await readJson(req);
    if (!title?.trim() || !description?.trim()) return res.status(400).json({ error: 'Please give your idea a name and a description.' });
    const issue = await gh('POST', 'issues', { title: title.trim().slice(0, 120), body: description.trim() });
    // Adding the label as a separate step is what starts the factory.
    await gh('POST', `issues/${issue.number}/labels`, { labels: ['factory:new'] });
    return res.status(201).json({ number: issue.number });
  }

  const issues = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await gh('GET', `issues?state=all&per_page=100&page=${page}&sort=updated`);
    issues.push(...batch.filter((i) => !i.pull_request && i.labels.some((l) => l.name.startsWith('factory:'))));
    if (batch.length < 100) break;
  }
  const projects = await Promise.all(issues.map(async (i) => {
    let latest = null; let live = null;
    if (i.comments > 0) {
      // Find the latest report / shipped info from the bot's comments.
      const last = Math.max(1, Math.ceil(i.comments / 100));
      const comments = await gh('GET', `issues/${i.number}/comments?per_page=100&page=${last}`);
      for (const c of comments) {
        const m = parseMarker(c.body);
        if (m?.type === 'report') latest = m;
        if (m?.type === 'shipped') live = m.live;
      }
    }
    return {
      number: i.number, title: i.title, status: statusOf(i), updated: i.updated_at, created: i.created_at,
      preview: latest?.preview || null, passed: latest?.passed ?? null, total: latest?.total ?? null, live,
    };
  }));
  res.status(200).json({ projects, repo: process.env.GITHUB_REPO });
});
