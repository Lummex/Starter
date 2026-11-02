# Anvil: Respond leak closed, lock and small items (Nov 2)

**Preview (TEST server, not live):** https://oreheart-8-ljihyp6y4-lummex.vercel.app. Built from pvp-nov2 8dc19dbb, bundle index-DwLBw8G7.js. Branch head is 810fa4f3; the two commits after 8dc19dbb touch only the deploy setup, not the game. The TEST `match` function is deployed from 810fa4f3 (run #13). oreheart.cards still serves index-TL7BJx57.js.

## 1. The Respond leak
**Rule now:** no Respond window closes sooner than 2 s after it opened. The `match` function refuses a pass, a counter or a Brew that would close it sooner, and answers how long is left. A refused answer moves no clock and changes nothing the attacker can see. So a modified browser gains nothing.
- A crystal played inside the window stays inside it and doesn't restart the 2 s. Giving up doesn't wait. A new window gets its own 2 s. The 12 s run-out is unchanged.
- **In the browser:** clicking "Let it happen" at once now shows the same small note as holding nothing, and the pass goes out at the same moment (2 s after the window came up on that screen). A counter also waits for the 2 s.
- The minimum can be changed with the setting `pvp_respond_min_seconds`; default 2.

**What's left, by design:** a window lasting clearly longer than the usual time still hints the player is thinking. A modified browser could answer at exactly 2.0 s, a little sooner than a normal one, but that only tells on the person doing it.

## 2. Lock and chips
Brush's `lock-coin.webp` sits in the top corner of unowned cards in the Collection and Deck Builder. I chose the coin over the bare lock because the greyed art is busy. `chip-chosen.webp` replaces the tinted green chip on chosen and hovered filter chips. FREE and NEW still use the tinted chip.

## 3. Small items, all done
- The deck list opens as a painted list, with arrow keys and Esc.
- On a phone the auto note draws above the turn banner.
- On a phone, a solid backing sits behind Back when Collection cards scroll under it.

## 4. Merge
factory/issue-8 16c14ae9 (test tidy) is merged.

## Checks
- **Unit tests:** 309 pass, 1 fail, 1 skipped. The failure is `arena.test.ts` "uses the owner files unchanged": this full checkout has Ledger's Oct 29 edit of `references/skullfang-arena-layout.json`, which differs from the game's layout. Not from this job, and left alone: which file is right is Ledger's or Ken's call. The game's own layout files are the same as factory/issue-8.
- **Referee:** 4 new tests. Quick passes refused at 0-1999 ms and taken at 2000; counter, crystal and give-up cases; each window's own 2 s and the 12 s run-out; the opening time isn't in either player's view.
- **Browser checks on these areas:** 92 pass, 18 skip (they need the database rig), 0 fail, with one retry allowed and none reported as flaky. New: AC670 (quick passes straight to the server refused, accepted at 2 s, attacker's view unchanged), AC671 (a real holder clicks at once in two browsers: attacker waits at least about 2 s, nothing refused), AC672 (deck list).
- **Screens looked at:** deck list (PC and phone), Collection (PC) and scrolled Collection (phone). Deck Builder lock at PC size, with the lock added by hand because the stand-in server has no owned counts. Phone note: its z-index and position measured, and a screenshot with a turn banner added by hand, since the real banner wasn't up at that moment.
- **On the real preview:** bundle and art served, TEST project address in the bundle, `match` refuses anonymous callers (401).

## Not checked
- **Still no real match on the TEST server.** So the new rule has not been run on the deployed function with signed-in players; it ran only on the stand-in server, which uses the same code. Timing there will shift with real network delay.
- Not retimed the way Gauge did it (many windows, holder vs non-holder side by side). AC671 is one window.
- A real phone. The full hidden suite (not needed, per the job).

## For Forge
**The deploy broke on Supabase's new CLI, and main still has the problem.** v3.0.0 came out this morning. It refuses `[inbucket]` in config.toml, aims `supabase db push` at the local copy unless told `--remote`, and wants a `--yes` a workflow can't give. Runs #11 and #12 failed with nothing changed on the TEST project. In #12 the workflow's pipe to `sed` hid the push failure, so **a future run could skip migrations and still go on**.

I pinned the CLI to 2.122.1 on pvp-nov2 only (run #13 passed). main's workflow still says `latest`. Before anything deploys from main, including production, it needs the same pin or a planned move to v3, plus a pipefail on that line. I didn't touch it: main's workflow can deploy to production.
