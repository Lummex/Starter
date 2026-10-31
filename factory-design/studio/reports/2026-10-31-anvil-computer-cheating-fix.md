# Anvil report, 2026-10-31: "the opposing team is cheating"

**Ken (playtest, Oct 31):** "They're putting units they don't even have crystals for out ... right at my side ... multiple ... they need to have a deck. And play by the rules."

## What was really happening
Not the AI. An engine rule bug that the smarter Oct 30/31 computer exploited to the full:
- The dwarves' basic Miner card (`dwarf-miner`, the Riot Shield Bearer) has been a **Fighter** since Round 12c, but it is still the dwarves' "basic Miner" in game-config.
- The rule "one free basic Miner when you are broke and have no Miner on the battlefield" looked for a *Miner* on the board. A Bearer is not a Miner, so the rule never switched off: a broke Dwarf side (Thane Borgo) got a **free Bearer again and again**.
- Basic Miners have **Tunnel** (Round 10): summoned next to any mine, from turn 1. So the free Bearers landed by the mines nearest Ken's rows.
- The Hard AI's new look-ahead was checked and is clean: it thinks on copies and never changed the real match (6 full matches, every difficulty, 0 differences).

## The fix (factory/issue-8 41823716)
- Engine: the faction's basic Miner card itself (and one still in an open summon window) counts as "a Miner on the battlefield" for the free-Miner rule. Every faction now gets exactly one free basic Miner when broke, as the GDD says.
- Referee in the match controller: every computer action is checked against the same legal-move list the player gets **before** it is applied. An illegal one is refused and never applied. Summons are also checked for payment, deploy zone and coming from the side's own hand and deck.
- Hidden checks: AC422 (one free Bearer, the second refused without crystals; fails on 90410c08) and AC423 (a whole computer-vs-computer match on easy, normal and hard: 0 refused, 0 unpaid, 0 off-zone, 0 foreign cards, 0 state changes by the thinking; a forced illegal computer action is refused). Unit tests: free Bearer once, `tests/ai-referee.test.ts`, Easy golden seed 11 re-recorded (the rule change alters that match; the AI is untouched).
- Checks run locally: AC422, AC423, AC34, AC11, AC46, AC50, AC344, AC61, AC84 pass (10 passed). Unit tests: engine, ai, ai-oct30, ai-referee pass apart from the long-standing "R8 new cards" failure.

## Preview
https://oreheart-8-1g5mwvqs7-lummex.vercel.app (factory/issue-8 41823716, Factory — preview only run 41172670432). Bundle checked for the referee hook.

## Open rule question for Ken
Tunnel on basic Miners works from turn 1 on any space next to any mine (Round 10, checks AC11/AC50). The design doc says Tunnel is a **comeback only** (when the enemy owns more mines than you; otherwise the back row). Ken's words ("only on their back line") match the design doc. Not changed; it is Ken's call (a small engine change plus two check updates).
