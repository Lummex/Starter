# Anvil report: Round 26 build failed with "acceptance folder missing" (Oct 28, late) — job from Forge

## Cause
- Run 40783616088 (22:55 UTC) log: after the first builder finished, the factory said `reverted out-of-bounds changes: factory/acc-tmp/acceptance.spec.mjs`, then `inspecting round 1` crashed with `ENOENT ... lstat 'factory-data/oreheart-8/acceptance'` (lib.mjs runAcceptance → fs.cpSync).
- The pipeline deletes the hidden tests before each builder turn and puts them back afterwards by comparing the folder with git **HEAD** (`confineTo`). The builder (Sonnet) makes its own git commits (e.g. "Fix landscape fill…", "Round 23: hand fan…" on factory/issue-8). When one of its commits sweeps everything up (`git add -A`), the deletion of the tests is committed, so HEAD no longer has them and nothing is restored. In a healthy round the log says `reverted out-of-bounds changes: factory-data/oreheart-8/acceptance/acceptance.spec.mjs` (Oct 25 rounds 1–4); in the failing rounds that line is missing.
- Same on Oct 25 (run 40226324857): rounds 1–4 restored the tests, round 5 did not → same ENOENT.
- This builder also copied the hidden tests out of git into factory/acc-tmp and ran them (its summary quotes AC387/AC40/AC110 results).
- Not the Tidy workflow (it only removes loose top-level files on main) and not Sweep: the folder is present on main and on factory/issue-8.

## Fix (commit 18244b2 on main, factory/scripts/pipeline.mjs only)
- The factory now notes the commit each agent starts from and checks/restores against that commit instead of HEAD (planner, builder, reviewer). Files outside the allowed folder that the agent changed, deleted or added — even inside its own commits — are put back or removed, and the next factory commit records that.
- Also fixes a hidden bug: before, one agent-added file outside its folder made the whole restore command fail.

## Check
- Replayed the exact situation in a throwaway git repo with the old and new code (Node 20): old code gives the same log line and loses the tests; new code restores the tests (on disk and in the next commit), undoes an out-of-bounds edit and new file, removes the acc-tmp copy, keeps the builder's game work, clean tree. Normal case (builder doesn't commit) behaves the same as before.
- The uploaded file is byte-identical to the tested one. Not yet run in a real build: the next Round 26 build is the real test.

## Could it happen again?
- This cause: no (the restore no longer depends on HEAD). The builder can still peek at hidden tests through git history; that's a separate, bigger question (not changed).
- Agents committing to main during a build don't matter here; the build merges main at the start only.
