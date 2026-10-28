# Job for Spring: Bowler Brawler Runway videos (test of the new Studio), Oct 28 2026

From Ken, directly to Wright, to hand to Spring. Forge: please pass to Spring.

Character: **Bowler Brawler** (card id `goblin-scrapper`). Card art and the approved sheet are in Oreheart Studio: https://claude.ai/artifact/PrZreWSayBrALDPvQwsVmn#goblin-scrapper--sheet

## Moves Ken wants (his words, from the Studio)
1. **Bowling attack**: He brings the ball back behind him, then swings forward and throws it out in front of him. The ball then rolls away along the ground.
2. **Spinning the ball on his finger**: He spins the bowling ball on one finger like a basketball.
3. **Basketball shot**: He shoots the bowling ball up like a basketball shot. It flies up, then comes down and stops dead with a heavy thunk into the ground (no bounce, no roll).
4. **Idle**: A relaxed standing idle that loops: he stands in place holding the bowling ball, breathes, shifts his weight a little, maybe taps the ball. Feet stay planted.

Ken's animation rules for him (from the Model Editor):
He holds the bowling ball out in front of him in his hand.
The bowling ball never goes through his body.
The bowling ball never goes through or clips into the ground.
Every movement is thoughtfully made so nothing clips, in every animation.

## How (usual Runway rules)
Runway jobs in factory-design/runway-jobs/jobs.json, workflow runway-videos.yml. Face frozen, body/limb motion only, smooth loops, two moves per clip, front/side/back views, prompt under 1000 characters, gentle wording.

## Where the videos go (NEW: the Studio, not Motion References)
For each clip, in the Studio (ArtifactData url `https://claude.ai/artifact/PrZreWSayBrALDPvQwsVmn`):
- Upload clip.mp4 as an asset of the Studio (Artifact publish with url + asset:true).
- `set` a doc in collection `takes`, id = Runway job id, with the same fields Motion References used: character "goblin-scrapper", characterName "Bowler Brawler", move, take, title, detail, view, seconds, prompt, video (asset id), moves [{move,from,to}], order, source, status "waiting", chosen false, updatedAt.
- When all clips are in: `update` `characters/goblin-scrapper` → steps.runway.status "waiting", note "N videos ready".
- Move requests are in `library/goblin-scrapper.animRequests` (status "wanted"): set "working" while you make them, "done" when Ken approves the Blender result.

Ken will see the videos play in the Studio's "Runway videos" step and approve, redraw or skip there. If Wright needs to change the Studio for anything (e.g. approving a single take), tell Wright.

## Status now
The Studio shows Bowler Brawler's Runway step as "Working · Spring", with the 4 moves listed under Posing & animation.
