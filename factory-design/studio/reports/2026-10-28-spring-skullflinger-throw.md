# Spring – Skullflinger skull throw, step 1: Runway reference (Oct 28)

Job from Forge (Ken, Oct 28). Redo the Skullflinger (goblin-slinger) skull throw "the proper way". The Round 24 flying-skull version was rejected by Ken and ignored.

## What I made
- Runway job `goblin-slinger-throw` (factory-design/runway-jobs/jobs.json), front view, cheapest settings: grok_imagine_1_5_lite, 480p (auto_480p), 6 s.
- Start image: `goblin-slinger--front.jpg` = Ken's saved Model Editor scene, skull in his right hand, no helpers (same image the death take uses).
- Part 1 (0–3 s) `wind-up-throw`: wind-up over the shoulder, overhand toss of the skull "like a baseball", follow-through.
- Part 2 (3–6 s) `reload-ready`: straightens up, reaches back to the pouch behind his hip, a new skull is in his hand, back to the start pose so it loops.
- Gentle wording (skull called "a round tan ball (a cartoon skull)", "tosses"): not blocked.
- Output: factory-design/runway/goblin-slinger-throw/ (clip.mp4, frames, sheets). Runway run #6, made first try in about 1 minute. 544x544, 6.04 s.

## Checked
I looked at the clip frame by frame: he winds up, throws overhand, the ball leaves the picture at about 2.5 s, then he reaches back and comes up with a new ball and ends in the start pose. Face stays the same, camera still.
Honest gaps: at the release his body twists well to the side, and the ball flies out to the side rather than straight at the camera. If Ken wants it straighter, one redraw costs another $0.13.

## Programs
- Motion References: take `goblin-slinger-throw` (status waiting, parts[] with 2 parts waiting). Checked it shows under Skullflinger (2 videos, 4 parts waiting).
- Oreheart Studio: same take (its own video asset).
- Studio Checklist + Oreheart Studio: goblin-slinger steps.runway = waiting (note lists both the death and the throw video).
- Did not touch the Blender worker or blender-queue. Waited for the parallel deaths/backstab Runway run (#5) to finish before adding my job; jobs.json was unchanged when I added it.

## Cost
About 13 credits = $0.13 (6 s x 2 credits + 1 start frame).

## Next (separate jobs after Ken approves)
Blender worker clip from the frames, Model Editor, Gauge check, game.
