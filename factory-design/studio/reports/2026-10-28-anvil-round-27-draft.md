# Round 27 brief — draft (Anvil, Oct 28, 2026)

Job from Forge (Ken: "So we're working on 27 then"). Draft only: **not posted on #8, no labels, nothing started, game branch not touched, phase-1b pointer not switched.**

## What I did
- Wrote `factory-design/design/oreheart-round-27-brief.md` (title "Round 27", marked DRAFT). Checks start at **AC397** (Round 26 ended at AC396).
  - **C (first): smaller bodies.** 15 dwarf + 13 gnome bodies from `models/round27-shrunk/` (Ledger). AC397–399.
  - **A: Ken's 18 Studio looks.** 14 bone parts + ram file from `models/parts/`, paste-ready PARTS from `editor-setups-2026-10-28b.md`, Grubnak's scepter with Ken's numbers, Shieldbeard medic pack only (shoulder-pad shield left out). AC400–402.
  - **B: Ram Rider mount** (ram on the ground at scale 0.53, rider seated on it at scale 2, Ken's numbers from the JSON). AC403–404.
  - **D: New moves (add if approved)** — grunt death (`goblin-grunt`), Goblin Chef death (`rotgut-grenadier`), Skullflinger throw (`goblin-slinger`), Thief backstab (`goblin-sneak`), Bare Knuckle Lunatic v5 idle + shadow boxing (`goblin-bomber`, decision `bkl-v5`). AC405–407.
  - **E: Round 26 leftovers** — empty placeholder.
  - Same builder rules as Round 26.

## Checked
- All 15 part files and all 28 shrunk bodies (+ README) are on main, names match the brief.
- Studio (Oct 28): none of the five D cards has an approved move yet; decision `bkl-v5` is still open.
- Ledger's report `2026-10-28-ledger-round27-shrink.md` is **not on main yet**; I used his `round27-shrunk/README.md`.

## Needs Ken before starting
1. **Gnome shrink.** Ledger's README quotes Ken's OK as "shrink the dwarf". With dwarves only the game ends ~97.2 MB (over 95). With the 13 gnome bodies too: **~92.4 MB**. Ken: OK the gnomes too?
2. Ken's review of the Round 26 preview (fills E) and his move approvals (fills D).
3. After the round: the Studio's Model Editor files must get the same shrunk bodies (Wright) so game and Studio match.

## Ready-to-use pointer text (for the top of oreheart-phase-1b-brief.md — replaces the Round 26 section; use only when Ken says start)

```
## Round 27 — the current round (owner, <date>) — read this first

The current round is **Round 27**. Read `factory-design/design/oreheart-round-27-brief.md` first: it is the whole job for this round (smaller dwarf/gnome body textures, the owner's 18 saved Studio looks with their parts, the Ram Rider's ram, approved new moves, Round 26 leftovers). **Round 26** is finished; its brief (`oreheart-round-26-combined-brief.md`) is history only — do not redo it. Every round section below is history from earlier rounds.
```

Also when starting: remove the "DRAFT … not started" line at the top of the Round 27 brief.
