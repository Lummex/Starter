# Wright – "Waiting for you" in Oreheart Studio (2026-10-28)

Job from Forge (Ken asked: "Are there any approvals I need to do? Can you put them in the programs?").

## What I built
- Oreheart Studio (https://claude.ai/artifact/PrZreWSayBrALDPvQwsVmn, still pinned) has a new **Waiting for you** page (top bar, orange badge with the count; also an orange banner on Home). Link: `#waiting`.
- It gathers live: open `decisions`, Runway `takes` with status "waiting", and character steps with status "waiting".
  - Decisions: option buttons + optional note; answered ones move to a folded "Answered" list with "Change my answer".
  - Runway videos: small player, Approve (all parts) / Redraw with note / "Each part ->".
  - Character steps: card picture, Approve / Redraw with note / "Look first ->".
- New db collection `decisions` (fields in the Handbook). Seeded 10 open decisions from Forge: factory cap $25, read all issue #8 comments, disconnect 4 old Vercel projects, rename oreheart-8 to oreheart-v0.8, Gauge daily check, mine emblems (Keep/Swap/note), Shiv Rat backpack, Junk Shaman staff, Bare Knuckle Lunatic v5, reinstall Blender worker.
- Handbook: new section "Asking Ken: the Waiting for you page" (ask through `decisions`, read answers there).

## Checked
- Live page shows **32** waiting = 10 decisions + 5 Runway videos + 17 character steps (matches the database).
- Answered a probe decision in my Chrome tab -> saved as answered (read back with ArtifactData), badge went down by one; "Change my answer" put it back to open; then I removed the probe. No real record was changed.
- Before publishing: a Playwright run with the real data (decision answer, take approve, step redraw) wrote the right fields; phone width has no sideways scroll.
- Studio is still pinned.

## Notes
- Counts on the old "Next for me" badge (17) are only character steps; the new orange badge is the full total.
