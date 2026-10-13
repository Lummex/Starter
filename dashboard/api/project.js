import { guarded, gh, statusOf, parseMarker, stripMarker, readJson } from './_lib.js';

// GET ?n=12: one project with its full history.  POST: owner actions (approve / revise / retry).
export default guarded(async (req, res) => {
  if (req.method === 'POST') {
    const { n, action, message } = await readJson(req);
    const num = Number(n);
    if (!Number.isInteger(num) || num <= 0) return res.status(400).json({ error: 'Bad project number.' });
    const issue = await gh('GET', `issues/${num}`);
    const labels = issue.labels.map((l) => l.name);
    const drop = async (name) => { if (labels.includes(name)) await gh('DELETE', `issues/${num}/labels/${encodeURIComponent(name)}`); };

    if (action === 'approve') {
      await drop('factory:approved');
      await drop('factory:review');
      await gh('POST', `issues/${num}/labels`, { labels: ['factory:approved'] });
    } else if (action === 'revise' || action === 'retry') {
      if (action === 'revise' && !message?.trim()) return res.status(400).json({ error: 'Please describe what to change.' });
      if (message?.trim()) await gh('POST', `issues/${num}/comments`, { body: message.trim() });
      if (issue.state === 'closed') await gh('PATCH', `issues/${num}`, { state: 'open' });
      for (const l of ['factory:revise', 'factory:review', 'factory:needs-info', 'factory:failed', 'factory:shipped']) await drop(l);
      await gh('POST', `issues/${num}/labels`, { labels: ['factory:revise'] });
    } else {
      return res.status(400).json({ error: 'Unknown action.' });
    }
    return res.status(200).json({ ok: true });
  }

  const num = Number(req.query?.n || new URL(req.url, 'http://x').searchParams.get('n'));
  if (!Number.isInteger(num) || num <= 0) return res.status(400).json({ error: 'Bad project number.' });
  const [issue, comments] = await Promise.all([
    gh('GET', `issues/${num}`),
    gh('GET', `issues/${num}/comments?per_page=100`),
  ]);
  let preview = null; let live = null; let report = null; let run = null;
  const timeline = comments.map((c) => {
    const m = parseMarker(c.body);
    if (m?.type === 'report') { preview = m.preview; report = m; }
    if (m?.type === 'shipped') live = m.live;
    if (m?.type === 'started') run = m.run;
    return { id: c.id, at: c.created_at, fromFactory: Boolean(m), kind: m?.type || 'owner', body: stripMarker(c.body) };
  });
  res.status(200).json({
    number: issue.number, title: issue.title, description: issue.body, status: statusOf(issue),
    created: issue.created_at, updated: issue.updated_at, preview, live, run, report, timeline,
    githubUrl: issue.html_url,
  });
});
