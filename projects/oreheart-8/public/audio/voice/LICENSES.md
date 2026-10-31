# Oreheart sound effects: sources and licences (Brush, 2026-10-31)

Every file in art/sound/out/ (39 files) was **synthesized from scratch** by Brush with the project's own code in art/sound/synth/ (dsp.py, sounds.py: oscillators, filtered noise, modal metal/glass/wood models, Karplus-Strong strings and a generated reverb). No recordings, samples, sample packs or AI audio were used.

- Source: original work made for Oreheart (Lummex). Licence: owned outright by the project; released CC0 1.0 so it is commercial-safe with no attribution needed.
- Re-make: run `python art/sound/synth/sounds.py` with numpy and scipy installed (ffmpeg with libvorbis for the OGG files).

| File group | Files | Source | Licence |
|---|---|---|---|
| UI | ui-click, ui-tick, ui-chime, card-draw, card-play | synthesized (sounds.py) | CC0, project-owned |
| Board | summon, step-goblin/gnome/dwarf, melee, ranged, bonk-1..3, clink-1..3, thud, mine-pick, shatter, defeat-poof, commander-hit, kaboom, turn-start | synthesized | CC0, project-owned |
| Stingers | win, lose | synthesized | CC0, project-owned |
| Ranged (Oct 31) | shot-rifle, shot-cannon, throw-whoosh, cast-zap, cast-hex, fireball-whoosh, bowl-roll, skull-crack, book-thud, zap-hit, fire-burst, pins-scatter | synthesized | CC0, project-owned |
| Spells | spell-<id> for all 13 spells | synthesized | CC0, project-owned |
| Sample reel | sample-reel.mp3 | the files above, back to back | CC0, project-owned |

Not part of this set (unchanged, Ken's own): public/audio/music/*.mp3 and public/audio/menu/snd-qoqhrj.mp3.

## Added 2026-10-31: punches and unit voices

| File group | Files | Source | Licence |
|---|---|---|---|
| Punches | out/punch-1..3, punch-armour-1..2, punch-heavy | synthesized by Brush (synth/sounds.py) | CC0, project-owned |
| Unit voices (v2) | voices/out/vo-*.ogg (244 lines, 15 voices; v1 set kept in voices/_discontinued-v1) | Runway API text-to-speech (model eleven_multilingual_v2, ElevenLabs via Runway), Runway preset voices Grungle, Monster, Malachi, Rusty, Wanda, Pip, Elliot, Xylar, Brodie, Myrna, Clint, Kirk, Billy, Bernard, Mabel; lines from studio/character-bible.json; scripts written by Brush; pitch/tone post-processed with ffmpeg | Generated on Lummex's paid Runway API account. Runway's terms give the customer ownership of outputs, incl. commercial use; the preset voices are stock voices (no real-person cloning). Keep the Runway account in good standing. |
| Generator | factory/scripts/runway-audio.mjs + .github/workflows/runway-audio.yml (repo) | Brush | project code |
