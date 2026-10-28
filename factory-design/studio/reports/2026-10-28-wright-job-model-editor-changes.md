# Job: Ken's Model Editor changes → game + every editor (Oct 28 2026)

From Ken, directly to Wright: "I've made a lot of changes in the model editor. Get those changes through the processes and updated in all the programs."
Forge: please pass on: **Ledger → Gauge → Anvil**. Ken's OK covers this round up to the game preview. **Going live still needs Ken's OK** (Live step in the Studio).

## What Ken changed (in the old Model Editor, 5isEcqgnmtqRHJUWAmqRDd, on Oct 28)
He pressed **Save as default look** on 18 cards. Each one now has a new `setup`, `look`/`lookJson`, `final` GLB and `preview` in `library/<card-id>`:

| Card | Card id |
|---|---|
| Grudge Hurler | `axe-thrower` |
| Barrelback Courier | `barrelback-courier` |
| Corpsman Brewlord | `brewmaster` |
| Grubnak Rotgut Goblin King | `cmd-grubnak` |
| Gemdrunk Deepdelver | `crystal-drunk-delver` |
| Marksmen Gunner | `deepforge-crossbowman` |
| Riot Shield Bearer | `dwarf-miner` |
| Ironjaw Big Back | `dwarf-pickman` |
| Granite Oathkeeper | `dwarf-stoneback` |
| Bowler Brawler | `goblin-scrapper` |
| Grimhold Ravager | `grimhold-ravager` |
| Bloodbeard Berserker | `ironhammer-berserker` |
| Junk Shaman | `junk-shaman` |
| Oathbound Overwatch | `oathbound-pikeman` |
| Queen Brunhilda | `queen-brunhilda-stonebeard` |
| Thunderhorn Ram Rider | `ram-rider` |
| Door Splitter | `rune-splitter` |
| Ironwall Shieldbeard | `shieldbeard` |

Also: **Overclocked Conduit** (`overclocked-conduit`): Ken asked for a **redraw of the model sheet**: "This doesn't look anything like the card image. This is a person. It should be a robot." → **Sketch**.

## Done by Wright
- Copied all of the above into **Oreheart Studio** (library docs + 54 files: final GLBs, look files and previews), and Ledger's 5 saved backups/proposals (modelSetups). Checked: Grudge Hurler opens in the Studio's Model Editor with the shield on his right hand, same as the old editor.
- Sent the Studio's newer bits back to the old Model Editor: Shieldbeard's shoulder-pad shield (needed), Bowler Brawler's 4 move requests, rig requests for Anvilsworn Miner and Borgo.
- Studio steps: for each card above, "Model Editor setup" = **Approved** (Ken saved it himself), "Editors updated" = **Working · Ledger**. Overclocked Conduit's Reference sheet = **Redraw** with Ken's note.

## For Ledger
Put each new look into the game (projects/oreheart-8 on factory/issue-8): creature3d.ts `look` (bone/pos/rot/scale, 1:1 from the editor) and the models/accessories it uses. Then update **every editor** to match (Game Editor, Arena Editor, Menu Builder, Card Editor where the 3D look shows). Mark `final.synced = true` in both Model Editors when done. Size: under 95 MB (shrink textures only).
Note: Bowler Brawler and Junk Shaman also have your Oct 28 proposals saved. Ken's saved look is the one to use.

## For Gauge, then Anvil
Gauge checks each card. Anvil builds a **preview** for Ken. Nothing goes live without Ken's OK.
