# 2026-10-28 — Gauge — Full "is everything up to date?" sync check

Job from Forge (Ken, Oct 28: "make sure everything's up to date, all the files and stuff"). **Report only: I changed nothing** except my own `checks/<card>` docs in the Studio Checklist (Forge asked for that), plus my checklist and notes files.

New rule from Ken (added to my checklist and notes): **height/scale differences between the editor and the game are not a fail any more.** Only the final game heights matter (set at the end). Listed below as notes only.

## How I checked (all looked at for real, Oct 28 ~03:30–04:00 UTC)
- **Game (factory/issue-8):** GitHub tree (sizes), every char.glb's clip list (read from the GLB itself), models.json, events.json, `creature3d.ts` (PARTS, LOOKS, how clips are picked), cards.json names. Last commit on the branch: 03:22 UTC "factory: report for #8".
- **Model Editor (5isEcq…):** all 69 `library` docs + 13 `modelSetups`; downloaded the bundled model files for the 12 characters and read their clip lists and byte sizes.
- **Oreheart Studio (PrZreW…):** read its page code and the 3 room pages (model-editor.html, art-studio.html, card-editor.html); listed its `library`, `characters`, `checks`, `takes`, `cards`, `artRequests`, `modelSetups`, `cardTemplates`; compared every doc with the old programs (asset ids ignored, since Wright gave copied pictures new ids).
- **Motion References (U9YiTA…)** `takes`, the old one (Gj8rn7…) `takes`, and the `blender-queue` branch (54 job folders, job.json status, out/char.glb sizes).
- **Studio Checklist (KwnPNS…):** all 48 `characters` + 12 `checks`.

## The big one: Oreheart Studio has its OWN copy of the data (split data)
- The Studio's page and all three rooms (Model Editor, Art Studio, Card Editor) read and write **the Studio's own database** (`window.claude.use("db")` of PrZreW…; the rooms borrow the parent's). They do **not** touch the old Model Editor `library`, Motion References `takes`, Studio Checklist, Art Studio or Card Editor.
- Wright's stage 2/3 reports say the Studio is now the home and the old programs are "backups". But the Handbook, my checklist, Forge's jobs and the other agents still use the old ones — and since the copy (~01:30 UTC) **people have kept writing to both sides**:

| Where | Written in the old program only | Written in the Studio only |
|---|---|---|
| Bare Knuckle Lunatic — Runway video (idle + shadow boxing) | Motion References: **both parts approved** by Ken (02:38) | Studio `takes`: both parts **waiting** (part 1 set back at 03:17) |
| Bare Knuckle Lunatic — steps | Studio Checklist: sheet **waiting**, posing **waiting** (Spring 03:35: "new clips ready to check") | Studio: Ken **approved** sheet (02:38), Runway (02:39) and posing (02:39) — the posing note is still the old Oct 26 text |
| Bare Knuckle Lunatic — new model file | Model Editor has `goblin-bomber-v5` (OH_Idle_v2 + OH_Idle_ShadowBox, same bytes as Blender job goblin-bomber-runway-idlebox) | Studio's model files stop at v4 — **no v5** |
| Bowler Brawler — moves | — | Studio `library`: Ken's new "Idle" move request (Oct 28) + a "Dead" approval entry; Runway step "working" (Spring's job) |
| Bowler Brawler — Runway step | Studio Checklist: "not started" | Studio: "working" |
| Thunderwing Gyronaut — Runway step | Studio Checklist: "5 videos waiting" | Studio: "You deleted the Runway videos on Oct 28" |
| Ledger's Oct 28 setups | Model Editor `modelSetups`: ball-a, ball-b, staff-upright proposals | missing in Studio |
| My `checks` | Studio Checklist (updated today) | Studio copy is the 00:55 version |

**Update ~05:00 UTC (re-checked before writing this):** Spring has since put 10 new front-view videos (death for 9 goblins + Backstabbing Thief backstab) into **both** Motion References and the Studio — those match, all "waiting" for Ken. The bomber video is still split. The Studio Checklist page itself now shows a banner: "This checklist has moved into Oreheart Studio. Approvals there are the up-to-date ones." — so the Studio Checklist I was asked to update is officially the backup.

Everything else matched: the other 66 `library` docs, all 69 `cards`, 132 `artRequests`, `cardTemplates`, and the other 10 `modelSetups` are the same on both sides **today** — but any new edit will split them again.

## Card-by-card table

Game = factory/issue-8. ME = old Model Editor. OS = Oreheart Studio. MR = Motion References. CL = Studio Checklist. "Same file" = editor's bundled model has exactly the same bytes and clips as the game's char.glb.

| Card | Game | Model Editor | Oreheart Studio | Motion Refs / Blender | Checklist | Matches? What's different |
|---|---|---|---|---|---|---|
| Bare Knuckle Lunatic (goblin-bomber) | OH_ set incl. OH_Death; no parts; models/events agree | `v4` = same file as game; **v5 (new idle + shadow boxing) bundled but not set as his model** | Ken approved sheet/Runway/posing here; no v5; take parts "waiting" | MR: take approved; Blender idlebox job done (awaiting review) | sheet + posing "waiting"; Runway approved | **NO** — split approvals; new clips not in editor setup, Studio or game |
| Snotskull Grunt (goblin-grunt) | OH_ set, no OH_Death; frying pan | same file; pan | same as ME | no takes; jobs done | posing waiting | Yes (only the known gaps: no death, game plays old Meshy idle/walk/hit/death) |
| Boneknocker (goblin-pebbler) | OH_ set, no OH_Death; club | same file; club | same | no takes | posing waiting | Yes (same known gaps) |
| Bowler Brawler (goblin-scrapper) | OH_ set + OH_Special, no OH_Death; bowling ball | same file; ball + flame | **Idle request + "Dead" approval only in Studio** | no takes; Spring making Runway refs | Runway "not started" | **NO** — Studio-only request; Checklist Runway step out of date |
| Skullflinger (goblin-slinger) | Skull_Throw is his attack (Round 24) + OH_ idle/walk/hit/reactions; no OH_Death; skull mace | same file | same | 4 skull-throw jobs, no takes | posing waiting | Yes. Note: Round 26 removes the Round 24 flying skull (Ken rejected it) |
| Backstabbing Thief (goblin-sneak) | OH_ set; bag + dagger | same file; bag + dagger | same | no takes | posing waiting | Yes |
| Junk Shaman | OH_ set + OH_Special; staff | same file; staff + glow/orbs | same | no takes | posing waiting | Yes (glow/orbs effects still not in game — known) |
| Goblin Chef (rotgut-grenadier) | OH_ set; spatula | same file; spatula | same | no takes | posing waiting | Yes |
| Shiv Rat | OH_ set; dagger only | same file; **dagger + backpack** | same | no takes | posing waiting | **NO** — editor has a backpack the game doesn't have (no backpack.glb, not in PARTS) |
| Skullbasher Rusher | OH_ set; mace + shield | same file; mace + shield | same | no takes | posing waiting | Yes |
| Thunderwing Gyronaut (gyrocopter-ace) | **old Meshy file** (no OH_ clips, no events.json), no wings | `v4` has OH_Hover, OH_Fly, OH_Attack, OH_Hit; gyro wings | same as ME; Runway "videos deleted" | Blender jobs a/a2/b/b2 done (awaiting review), made from the old fly/cast videos plus side/back pictures; those videos are only in the old MR (Gj8rn7) | Runway "5 videos waiting" | **NO** — game behind editor; Checklist Runway stale; his clips came from videos Ken never approved (and side/back views, now not allowed) |
| Aegis Tinkerer (gnome-tinker) | old Meshy file; no parts | same file; **scepter, crystal shield, wrench** | same | none | posing not started | **NO** — 3 accessories in editor, none in game |

Names: cards.json and the editor agree for all 12. Game size: `public/` = **92.6 MB** (under 95).

### Heights (note only, not a fail — Ken, Oct 28)
Game LOOKS heights: scrapper 1.188, bomber 0.97, pebbler 1.011, sneak 0.982, rotgut 1.219; everyone else uses the default (goblins 1.1, gnomes 0.85). The editor scales differ for several of them (see first-check report). Final heights get set at the end.

## Other programs pinned / listed for Ken (suggest discontinue; I touched nothing)
- **Motion References (old, Gj8rn7…)**: duplicate; holds the 5 Gyronaut videos + an old bomber idle that the new MR and the Studio don't have. → Sweep: list as discontinued once Ken confirms the Gyronaut videos are really gone.
- **Hub Test (JwntCb…)**: Wright's probe page for the Studio rooms (writes a "probe" doc). → discontinue.
- **Oreheart Art Studio (DRScVH…, pinned)**, **Card Editor (Hd1vVJ…, pinned)**, **Model Editor (5isEcq…, pinned)**, **Motion References (U9YiTA…, pinned)**, **Studio Checklist (KwnPNS…, pinned)**: all now have a copy inside the Studio. Today the data match except what's listed above, but keeping both pinned means Ken (and agents) can edit either one. → Wright/Forge decide which side is the real one; then Sweep marks the other as backup/discontinued.
- **Fetch Test (FpbCoq…)**, **Oreheart Camera**, **Card Frames**: old one-offs, not pinned. → Sweep may list them.
- Game, Arena, Menu editors are still separate (Studio only links to them) — not part of the split.

## Known work in progress (not counted as fails)
- Ledger's export `factory-design/design/models/editor-setups-2026-10-28.json` is **not on main yet** (404).
- Anvil's Round 26 brief (game fixes, incl. removing the Round 24 skull throw) — no round started.
- Spring: death/backstab references are in (10 takes, both sides, waiting for Ken); skull-throw reference and worker fixes still in progress.

## Fix list (send through Forge)
**Wright**
1. Decide with Ken: is the Studio the one real database? If yes, move the writes made in the old programs since ~01:30 UTC into the Studio (bomber take approvals, bomber v5 model file, Ledger's 3 setups, Spring's Checklist notes, my checks) and make the old programs read-only/backup. If no, point the Studio at the old databases.
2. Ask Ken which bomber Runway state is right (approved in MR, set back to waiting in the Studio at 03:17).
3. Tell every agent (and update the Handbook) which URL to read/write.

**Ledger**
4. Bare Knuckle Lunatic: decide with Ken whether `goblin-bomber-v5` becomes his model (it's bundled but his `src` is still v4); make it show in whichever editor is the real one.
5. Shiv Rat: editor has a backpack the game doesn't — confirm against the card art; either Anvil adds it or the editor drops it.
6. Finish the editor-setups export (not on main yet).

**Spring**
7. Write Bowler Brawler and Gyronaut status into the real checklist (Runway "working" for Brawler; Gyronaut videos deleted → his OH_ clips have no approved reference).
8. Bomber: new clips are in Blender + editor v5; get Ken's OK in one place only.

**Anvil** (only after Ken's OK, Round 26+)
9. Gyronaut: game still has the old Meshy file; editor has the Blender clips + wings.
10. Aegis Tinkerer: scepter, crystal shield, wrench are in the editor, not in the game.
11. Game still plays old Meshy idle/walk/hit/death for everyone (only attack uses the new clip). No goblin except the bomber has a death clip (Spring).

**Sweep**
12. List as discontinued (after Ken's OK): old Motion References Gj8rn7…, Hub Test, Fetch Test; and whichever side of the split Wright retires.

## Studio Checklist
Updated my `checks/<card>` for the 12 characters (Studio Checklist only): height → "nice / note only"; added "Same as Oreheart Studio", "Accessories same in editor and game" and "Newest Blender clips everywhere". Did not change any `steps`. Did **not** write the Studio's own `checks` copy (that's the split Wright has to settle). The write went through (12 docs, version 3); I could not scroll the page's side panel to look at it in my tab (page was very slow), so on-page view is not confirmed.

## Verdict
All 12 still **FAIL** (same blockers as the first check). New this run: **5 cards are out of sync** between programs (Bare Knuckle Lunatic, Bowler Brawler, Shiv Rat, Thunderwing Gyronaut, Aegis Tinkerer), and the Studio-vs-old-programs split is live.
