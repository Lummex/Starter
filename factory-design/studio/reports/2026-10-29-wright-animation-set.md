# 2026-10-29 — Wright — Animation set in the Model Editor room

Job from **Ken directly** (in Wright's chat), so Forge stays in sync through this report.

## Ken's ask (his words, short)
"I don't need a bunch of animations for each individual character... a main core of animations that every character should have": idle, casual walk, casual run (all can share them; animals get a different walk/run). About 10 idles to pick from, 2 walks, 3 hit reactions, 2 deads. Attacks and special abilities are per character. Reactions only need one option each (bonk, bolt, backstab, lifted, and room to add more). A place to type a description of a new animation and send "this is what I want this character's animations to be".

## What's live (Oreheart Studio version 24, room ?v=21)
Model Editor room → Pose editor → new **Animation set** box at the top (the old per-clip mapping and wish list are still below it):
- Body type: Humanoid / Animal (Animal swaps in "Animal walk" and "Animal run").
- Core moves, each a dropdown: Idle 1–10, Casual walk 1–2, Casual run 1–2, Hit reaction 1–3, Dead 1–2. Each slot shows its status, a Play button (borrows the shared move onto the open character, preview only), a "what it should look like" box, and Approve / Redo… once it's made.
- His own moves: Attack and Special ability description boxes, plus "+ Add another move for him" (name + description).
- Reactions (one each, shared): bonk, bolt, backstab, being lifted, bowling ball, with a tick box "he uses this", plus "+ Add reaction".
- **Send this animation set to the team** → writes `animOrders/<card-id>` (status "new"); the box then shows "Sent <date>" or "Changed since you sent it".

## Data (Studio database)
- `coreAnims/<id>`: shared slots (`idle-1`…, `walk-1`…, `run-1`…, `hit-1`…, `dead-1`…, `walk-animal-1`…, `react-<name>`): group, name, status not-made|made|approved|redo, desc, src {key:"b:<bundled model key>", clip}. Seeded 14 already-made moves (status "made", for Ken to look at): Idle 1–3, Walk 1–2, Run 1, Hit 1–3, Dead 1, React bonk/backstab/lifted/bowling ball (Meshy clips from Goblin Miner/Gemsinger, Blender OH_ clips from Boneknocker v4).
- `library/<card>.animSet`: body, pick {idle:3,…}, own {attack,special}, react {<id>:false to leave one out}, extra [{name,desc}], updatedAt, sentAt.
- `animOrders/<card>`: snapshot sent to the team (core picks, own moves, extras, reactions, sentAt, status "new").

## Tested
Locally with a fake database and the real models: dropdown pick saved, Play loaded Idle 1 onto Boneknocker, attack text saved, new reaction added, Send wrote animOrders, Animal switched to animal walk/run. Live file read back = identical to my build; Studio still pinned.

## Next (for Forge)
- Spring: read `animOrders` (status "new") and fill empty `coreAnims` slots (make the move once, put it on a bundled model, set src + status "made"). Redo requests: status "redo" with Ken's note in `desc`.
- Anvil (later round): the game still uses each character's own clips; making it use the shared core moves is game work.
