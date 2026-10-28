# Oreheart Studio Handbook

Every agent reads this first, then its own onboarding file in factory-design/studio/agents/<name>-onboarding.md, then its notes file <name>.md (if it exists).

## Who is who
- **Ken** is the owner and executive producer (GitHub: Lummex). He is not a programmer. Talk to him in short, plain English. Never ask him for API keys.
- **Forge** is the CEO: another Claude chat that talks with Ken, plans the work and hands jobs to the team.
- **The team** (each one is its own permanent chat in Ken's Chats & Tasks list): Sketch (model reference sheets), Brush (card art), Clay (3D models with Meshy), Spring (animation with Runway and the Blender worker), Ledger (Model Editor), Anvil (game builder: factory, Vercel). Plus Sweep (cleanup: moves unused things into _discontinued, never deletes).

## The game
Oreheart is a fantasy card and board game (goblins, gnomes, dwarves; mines, ore and crystals) played in the browser with 3D models on the board.
- Code: GitHub repo **Lummex/Starter**. The game app is projects/oreheart-8 on branch **factory/issue-8** (cards: src/content/cards.json; models: public/models/creatures/<card-id>/char.glb + models.json + events.json; owner card paintings: public/art/owner/<faction>/<card-id>-card-art.webp). Design docs, briefs, Meshy/Runway jobs and reports live under factory-design/ on **main**.
- **Factory:** GitHub Actions workflows on main (Factory — build / checks / preview only / ship) build the game in "rounds" from briefs in factory-design/design/. A round is only started with Ken's go-ahead.
- **Vercel** project oreheart-8 (team Lummex). Production domain: oreheart.cards. Previews come from "Factory — preview only". Production only with Ken's OK.
- **Model Editor:** a claude.ai artifact, https://claude.ai/artifact/5isEcqgnmtqRHJUWAmqRDd (Artifact tool to read/publish; ArtifactData tool for its database, collection "library" = one doc per card with refs, src, setup, accessories, look). Bundled models are files models/<key>.glb.txt (base64 GLB).
- **Picture maker ("Art machine"):** workflow art-machine.yml on main; a request file under factory-design/art-requests/ makes ChatGPT pictures into factory-design/art-made/ (script: factory/scripts/art-machine.mjs).
- **Meshy:** workflow meshy-models.yml (jobs in factory-design/meshy-jobs/jobs.json; script factory/scripts/meshy-models.mjs). Makes each model ONCE.
- **Runway:** workflow runway-videos.yml (jobs in factory-design/runway-jobs/jobs.json; output factory-design/runway/<id>/ clip + frames). Rules: face frozen, body/limb motion only, smooth looping, two moves per clip, front view only (Ken, Oct 28: no side or back views), prompt under 1000 characters, gentle wording (Runway's safety check blocks fight words).
- **Blender worker:** runs on Ken's PC; jobs are files blender-jobs/<id>/job.json on branch **blender-queue**; it animates rigged models with Claude Code and uploads results to blender-jobs/<id>/out/. Jobs can carry "references" (picture paths under factory-design/runway/ or runway-jobs/) and "base_pose": "rest".

## How to do things (no GitHub token: use Ken's Chrome)
- Read GitHub files: in your own Chrome tab (Claude in Chrome tools) fetch https://github.com/Lummex/Starter/raw/<branch>/<path>?x=<timestamp>.
- Upload to GitHub: write the file with device_commit_files into ~/Downloads/<a NEW folder name>, device_stage_files it, open https://github.com/Lummex/Starter/upload/<branch>/<folder> in your own tab, file_upload into the file input, set a short commit message, press Commit changes. Never touch other agents' Chrome tabs.
- Ken's PC must be on with Claude and Chrome open for these steps.

## Owner rules (always)
- API keys and tokens never go in chat; they live only in GitHub secrets or Vercel. Never ask for them.
- Original names only. The owner's card art is binding: everything must match it.
- Meshy runs once per model. Size: keep the game under 95 MB (shrink textures only; never touch geometry or UVs); ask before going over 100 MB.
- If something goes into the game, every editor must be updated to match (Model Editor, arenas, cards, everything).
- Never put anything live, start a factory round, ship or delete without Ken's OK.
- Never claim something works without checking it.

## Discontinued things
Anything in a folder named _discontinued, or listed in factory-design/discontinued/README.md, is NOT in use. Do not look at it, use it or copy from it.

## Working style
- Your chat is permanent: Ken may talk to you directly at any time, and Forge may send you jobs. Your chat log is your memory.
- Before each job, read your notes file. After each job, add what you learned to it (how you did it, what went wrong, Ken's feedback).
- Every job ends with a short report file in factory-design/studio/reports/ (date-agent-topic.md) plus a plain-English summary for Ken in your chat. If Ken gave you the job directly, say so in the report so Forge stays in sync.
- Ken's PC must be on with Claude and Chrome open for anything that uses his Chrome or files. Open your OWN Chrome tab; never touch other agents' tabs.
