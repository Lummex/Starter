# Gauge recheck of the fixes on the PvP preview (2026-11-02)

Target: https://oreheart-8-owchwcl7q-lummex.vercel.app, pvp-nov2 c774d8a9, TEST database. Focused recheck, not a full pass. Earlier report: 2026-11-02-gauge-pvp-night-check.md. Anvil's list: 2026-11-02-anvil-gauge-fixes.md. Checked at 1600x900 first, then 1280x720 for the screens, then 844x390 (touch).

**Verdict: the list is fixed, with one real gap.** The 2 s auto answer doesn't fully hide who holds a counter: a holder who clicks fast answers sooner than anyone without a counter can, so Anvil's "every window takes at least 2 s" is not true. Nothing else on the list failed, and the merge broke nothing I could find. A real match on the TEST server is still unproven.

## Item by item
| Item | Result | Evidence |
|---|---|---|
| Respond run-outs aren't timeouts | **FIXED** | Referee: 4 ignored windows, 0 timeouts, no forfeit. Live: 3 windows with the tab closed, 0 timeouts. Whole phases still count: nobody acting loses at 3 timeouts (720 s in the referee run); a player away for good loses at about 7 min. |
| 2 s auto answer | **WORKS, but leaks more than stated** | See below. |
| Keyboard lock | **FIXED** | Shop, Collection, Quests, pack at all 3 sizes: 24 Tabs, 0 reach the menu; the old Tab, Tab no longer lands there. Same from the real menu buttons as the stand-in signed-in user: menu inert, 0 Tabs reach it, comes back on Back. |
| White on pale | **FIXED on the listed three; card name plates unchanged** | FREE is white on a painted blue chip, NEW and the Commander tick are painted (seen on Shop and Make a code; NEW only via its check, not re-seen). Spell and crystal names are still white on a pale plate and still hard to read. Anvil says live is the same; I didn't check live, per this job's rules. |
| Menu chips clear of the logo | **FIXED** | No overlap with the logo, menu words or each other at 3 sizes, all on screen. PC: column under the menu words. Phone: two rows along the bottom. |
| Small pack items | **FIXED** | No forced focus after a press, ring only on keyboard (3 px white). Double tap flips only, no zoom. Back before the rip works, with the toast "Your cards are safe in your Collection." "85%" never splits. Collection Back stays on screen. |
| Bigger rip | **FIXED** | Flash, white-hot tear line, jolt, strip off to the right, shreds peak 81 pieces in the page on PC and 45 on phone (includes other parts with "shred" in the name). 59-61 fps, worst gap 17-33 ms on repeat rips at all sizes while the PvP run was also going. |
| Painted parts | **FIXED, one piece left** | Menu buttons, chips, filters, panels, quest bars, code letters, Commander tiles, deck box and owned counts are painted; scrollbar is now silver-grey. Unowned cards have no lock yet (Anvil asked Brush); they are only grey. |

## The 2 s auto answer, exactly
Measured as the attacker sees it, on the stand-in server (it polls every 500 ms, so add noise on the real one).
- No counter: note, no dialog, no click, no timeout. **2.5-3.0 s** in the timed runs (up to 3.9 s over 118 windows in the two-browser matches).
- Holder clicks "Let it happen" at once: **1.0, 1.4 and 1.8 s** (once 3.0 s). The server accepts it with no minimum. So **under about 2 s means they hold something**.
- Holder waits, or lets it run out: up to **13.3-13.8 s**. A closed tab looks the same: 13.5-14.1 s.
- Holder plays the counter: 2.0-2.2 s, and the card shows anyway. Pickpocket! sent the summon back (respond, counter, bounce), hand and board agree on both pages.
- Holds a counter it can't pay for, no Crystal card: treated as no counter. With a Crystal card that could pay: the dialog, as Anvil describes.
- The views carry nothing else about the hand: no leak in the referee scan (below).

An option if Ken wants it hidden better: hold a fast holder's pass until the same 2 s, so only a long wait says anything (Anvil, Ken's call). A longer wait always hints; that's by design.

## Other findings
- **Low, phone:** the auto note can be hidden behind the turn banner: a screenshot at the first summon of a turn shows "Opponent's Turn" and no note. On PC the same moment shows the note fine. Seen once.
- **Low, phone:** with Back and the title kept on screen, scrolled cards pass behind them with no backing.
- **Facts for Ken:** with the responder's tab closed, the attacker waits about 13.5 s per summon or attack, by design. The "Let it happen" button is a hand icon with no words.
- Not on the list, seen in passing and not new: Deck Builder filter chips read "All All Any All" at phone size; a microphone emoji in the Deck Builder's text.
- Not changed, as Anvil said: "Crushing Defeat" cut-off at phone size (not re-looked at), gold in the pack art (Ken's call).

## The merge
- Vs computer by real clicks (Play, Commander screen, Fight, Keep Hand), then to turn 9 by hooks: PC and phone, 0 errors, all pieces 3D, no missing clips.
- Deck Builder, How to Play, Settings open.
- Offline: real visit caches 927 core files; network off + reload opens the menu.
- PvP on the stand-in, new code: 2 matches (gnome vs dwarf, goblin vs gnome), 368 moves, 0 refused, 0 mirror errors, 0 errors. Tab closed and reopened: same match. Give up: both end screens.
- Referee attack rerun: about 25,000 cheats, 0 accepted; 8,400 moves, no hidden information (only the known bounced unit's id, seen by everyone on the board).
- The only network errors: 401s for the stand-in user's Supabase calls (shop_info, my_collection, my_quests), expected with a fake sign-in. Anvil's own suite: I didn't rerun it.

## What I could not check
- **Anything on the real TEST server**: needs logged-in accounts and I may not make them. Real coins, packs, quests, the Realtime push, real timing of windows (the leak numbers will shift) and the screens with real data. Screens used stand-in data.
- The redeployed `match` function itself.
- A real phone, slow network, sound (muted). Rip smoothness on a cold first load (my only cold run also took screenshots, so its frame rate means nothing), and I didn't repeat the slowed-CPU run.
- "Board stays usable during the note": not tried. Rare and better card glows after the rip changes: not re-looked at.
- The deck box's open list: it's still a browser list in the code (closed it looks painted); I didn't capture it open.

## A slip of mine, for Anvil
While setting up, a bad folder path made my checkout commands run in Anvil's shared clone `r28/repo`: it moved off factory/issue-8 and its file list changed. Nothing was lost (0 changed files, nothing committed or pushed, branch still at ff9625c7). I put it back on factory/issue-8 and removed the stray folder. Its old file list wasn't recorded, so I restored the list used by the other copies (`base`). If something there looks different, that's why.

Split: did it myself, since the runs shared one stand-in server and needed judging together.
