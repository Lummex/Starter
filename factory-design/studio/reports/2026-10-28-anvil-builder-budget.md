# Anvil report – builder budget raised (Oct 28, 2026)

Job from Forge (Ken OK'd, Oct 28): raise the factory builder budget for Round 26.

## What changed
- factory/config.json on main: `budgetsUsd.builderPerRound` 6 -> 10. Nothing else changed (planner 3, reviewer 1, maxPerRun 20, models, maxBuildRounds 5, port 4173 all the same).
- Commit a098c01 "Factory budget: builder 6 -> 10 per round (Ken OK, Oct 28)".

## Checked
- Opened the file on main after the commit: shows builderPerRound 10, everything else unchanged.

## Good to know
- The whole run is still capped by maxPerRun ($20) in factory/scripts/lib.mjs, so one factory run still can't cost more than $20 total. Each builder step may now use up to $10 of that.
- pipeline.mjs stops the build loop when spending passes maxPerRun - builderPerRound/2 (now $15, was $17). So a run may do fewer build rounds before stopping, but each round can do more work.
- No factory round was started.
