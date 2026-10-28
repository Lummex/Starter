# Studio Checklist (new program), Oct 28 2026

Job from Forge (Ken's request, Oct 28). Done by Wright.

**Link:** https://claude.ai/artifact/KwnPNScc2RjbM98WZ7R79G (pinned in Ken's sidebar; private to Ken until he shares it)

## What it is
One page for the whole production line, dark look like Motion References, works on a phone.
- Top: "N steps waiting for you" with a list (character, step, agent, **Approve here** button that opens the right program) and five big counts: Waiting for you (blue), Failed (red), Working (amber), Approved/done (green), Not started (grey).
- Filters: Show (everything / waiting for you / failed / working / done), Agent, Faction, and a name search.
- Board: one row per character with a 10-part colour strip (Art, Sheet, 3D, Editor, Runway, Blender, Editors, Gauge, Preview, Live; ✋ = needs Ken's OK). Rows needing Ken come first, then failed ones.
- Tap a row: all 10 steps with owner, status, note, date; Ken's note box (Save note); Gauge's checklist (sections Model, Accessories, Animations, Editors, Game files; pass / fail / not checked; Must-have / Nice-to-have; what's missing; who fixes it; date checked).
- Link straight to one character: add `#<card-id>`, e.g. https://claude.ai/artifact/KwnPNScc2RjbM98WZ7R79G#gyrocopter-ace

## Pictures (Ken asked mid-job, Oct 28)
Tap a character: a Pictures row shows Card art, Reference sheet, 3D model and Model Editor, each with its step status; tap one to see it big. The board and the waiting list show the card art too.
- Copied from the Model Editor into this program (server-side copy, nothing re-made): card art = Model Editor `thumbs/<id>.webp`; sheet = the approved sheet ref; 3D / Model Editor = the preview picture saved in the Model Editor (same picture for both today). The page trims the empty background off 3D pictures.
- 19 characters have no saved 3D picture yet (the dwarves and some gnomes without an Editor setup), so they show "No picture saved yet".

## Checked
Opened it in my own Chrome tab: board, counts, waiting list, failed filter and the character panel all render with the live data. Opened Bare Knuckle Lunatic and Thunderwing Gyronaut: all four pictures load, tap-to-enlarge works. Saved a test note on Bowler Brawler, read it back with ArtifactData (kenNote, kenNoteAt, kenNoteBy were there), then put the record back clean. Pinned: yes (Artifact list shows "mine, pinned").

## Database layout (for Gauge, Spring, Ledger, Anvil, Forge)
Use the ArtifactData tool with url `https://claude.ai/artifact/KwnPNScc2RjbM98WZ7R79G`. Always `get` first and pass `if_version`. Use `update` (not `set`) so you don't wipe Ken's note. The page updates live.

### Collection `characters` (one doc per card id, e.g. `goblin-bomber`)
```
name, faction, role, rarity, order,
kenNote, kenNoteAt, kenNoteBy        (written by the page; don't overwrite)
images: { art, sheet, model, editor }  (picture paths in THIS program: "thumbs/<id>.webp", "refs/...webp" or "/_blob/<asset id>")
updatedAt, updatedBy
steps: {
  art | sheet | model | editor | runway | blender | editors | gauge | preview | live : {
    status:  "not-started" | "working" | "waiting" | "approved" | "failed",
    agent:   "Brush" | "Sketch" | "Clay" | "Ledger" | "Spring" | "Gauge" | "Anvil",
    link:    URL where Ken approves it (empty = page default: Model Editor, or Motion References for runway),
    note:    short plain-English note Ken sees,
    updatedAt: ISO time
  }
}
```
Step order and owners: art (Brush ✋), sheet (Sketch ✋), model (Clay ✋), editor (Ledger), runway (Spring ✋), blender (Spring ✋), editors (Ledger), gauge (Gauge), preview (Anvil ✋), live (Anvil, Ken's OK).
"waiting" = waiting for Ken. Only set it on ✋ steps. Non-✋ steps show "Done" when approved.
To change one step, `update` the whole `steps.<key>` object is safest: read the doc, change that step, write `steps` back with `if_version`.

To add a new picture: upload/copy it into this program's assets (Artifact publish, asset:true; copies get a NEW id), then `update` images.<step> with "/_blob/<new id>". Ask Wright if unsure.

### Collection `checks` (one doc per card id) — Gauge owns this
```
checkedAt: ISO time, checkedBy: "Gauge",
items: [ { section: "Model" | "Accessories" | "Animations" | "Editors" | "Game files",
           item: "Idle clip",            (Animations: one line per clip the game needs)
           level: "must" | "nice",
           result: "pass" | "fail" | "not-checked",
           missing: "what's missing, plain words",
           fixer: "Spring" } ]
```
Empty right now: Gauge's checklist and first-check report were not on main yet when I finished. Gauge (or I, next run) can load them in.

## How I seeded it (48 characters = every creature in cards.json on factory/issue-8)
From the Model Editor library, the Oct 27 model reference check, Motion References and the blender-queue branch:
- Card art: approved for all 48 (owner painting in game).
- Reference sheet: 43 approved; failed: Gearward Sentinel, Gemsinger Miner, Overclocked Aethervein (redo asked Oct 27, picture maker out of OpenAI credits); waiting for Ken: Anvilsworn Miner (sheet not marked approved), Bare Knuckle Lunatic (editor marks sheet Redraw but Ken OK'd the model).
- 3D model: approved when it is in the game files (44); failed: Gearward Sentinel, Gemsinger Miner; working: Anvilsworn Miner (not in game files); not started: Overclocked Aethervein.
- Model Editor: done where a setup is saved (29), else not started.
- Runway: Thunderwing Gyronaut waiting (5 videos in Motion References); Bare Knuckle Lunatic working (Ken asked for an idle redraw); rest not started.
- Blender: waiting for Ken on the 10 goblins with Oct 26 clips (Bowler Brawler, Skullflinger, Bare Knuckle Lunatic, Backstabbing Thief, Snotskull Grunt, Boneknocker, Junk Shaman, Goblin Chef, Shiv Rat, Skullbasher Rusher) and Thunderwing Gyronaut (Oct 27 clips). I found no record of Ken's OK, so I put them in his list.
- Editors updated: working for those 11 (Model Editor lists the clips, final file not marked synced).
- Gauge check, Game preview, Live: not started for all (I could not confirm what is on oreheart.cards).
Aegis Tinkerer: sheet, model and editor done; no animation work found yet.
Not included: commanders (cmd-borgo, cmd-grubnak, cmd-sproingle) because they are not in cards.json. Easy to add if Ken wants.

## Notes
- The page never approves steps itself; approvals still happen in Model Editor / Motion References, then the owning agent updates the step here.
- Ken's sidebar has two pinned "Motion References" (U9YiTAL… is the live one, Gj8rn7… is older). I did not touch it; Ken can unpin the old one.
