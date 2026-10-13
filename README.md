# Software Factory

An autonomous "dark" software factory. You describe a website or web app in plain English, and AI agents plan it, build it, test it and deploy a preview. **Nothing goes live until you press Approve.**

## How it works

```
You (dashboard) ──idea──▶ GitHub issue (label factory:new)
                              │
                              ▼  GitHub Actions: "Factory — build"
                     ┌─────────────────────┐
                     │ 1. Planner agent     │  writes SPEC.md + hidden acceptance tests
                     │ 2. Builder agent     │  builds the site (can't see the tests)
                     │ 3. Inspector         │  runs the hidden tests in a real browser
                     │    ↺ up to 3 rounds  │  failures go back to the builder
                     │ 4. Reporter agent    │  plain-English report + screenshots
                     │ 5. Preview deploy    │  Vercel preview link
                     └─────────────────────┘
                              │
                              ▼
You (dashboard): Approve ──▶ "Factory — ship": production deploy, code merged, issue closed
             or Request changes ──▶ back to step 1 with your notes
```

## Where things live

| Path | What it is |
|---|---|
| `dashboard/` | Your control panel (deployed on Vercel, password-protected) |
| `factory/config.json` | Models, spending limits per run, number of build rounds |
| `factory/prompts/` | Instructions for the planner, builder and reporter agents |
| `factory/scripts/` | The pipeline that runs the agents and tests |
| `.github/workflows/` | Triggers the factory on GitHub's servers |
| `projects/<name>/` | The code for each site the factory builds |
| `factory-data/<name>/` | Spec, hidden tests, test results, screenshots and report for each site |

## Secrets and settings

GitHub (Settings → Secrets and variables → Actions):

- `ANTHROPIC_API_KEY`: pays for the agents
- `VERCEL_TOKEN`: lets the factory publish sites

Vercel dashboard project (Settings → Environment Variables):

- `DASHBOARD_PASSWORD`: your login password
- `GITHUB_TOKEN`: a fine-grained token for this repo (Issues: read & write, Metadata: read)
- `GITHUB_REPO`: `Lummex/Starter`

## Costs and safety

- Each run is capped by `budgetsUsd.maxPerRun` in `factory/config.json` ($20 by default). A typical small site costs a few dollars.
- Only the repository owner's actions can trigger builds and launches.
- Agents can only change their own project folder. Anything else they touch is reverted automatically.

## Version 1 limits

Builds static websites and browser apps (data saved in the browser). It doesn't yet handle user accounts, databases, payments or sending email.
