# Oreheart animation API

You write one small Python file per clip: `anims/<ClipName>.py` with a function `build(ctx)`.
The worker checks the file, then runs it inside Blender. It is NOT normal Blender scripting:

- Allowed imports: `math`, `mathutils`, `random`. Nothing else (no `bpy`, `os`, `open`, `exec`, `eval`, `getattr`, dunder names).
- Use only the `ctx` methods below. Everything is relative to the character's **base pose** (frame 0 of its Idle clip).
- The finished clip is added to the model; existing clips are never changed.

## Directions

Everything uses the character's own directions, in metres: **(right, up, forward)**.
`forward` is where the character faces, `right` is its own right hand side. Axis names for turns:
`'right'`, `'left'`, `'up'`, `'down'`, `'forward'`, `'back'`.

Turns follow the right-hand rule around the axis (thumb along the axis, fingers curl = positive). In practice:

| turn | what it does |
|---|---|
| `('up', +30)` on the spine | the chest twists so it faces more to the character's **left** |
| `('up', -30)` on the spine | chest twists toward the character's **right** (the wind-up of a right-handed throw) |
| `('right', -30)` on the spine | the upper body bends **forward** |
| `('right', +30)` on the spine | leans **back** |
| `('forward', +30)` on the spine | leans toward its **right** side |
| `('right', +40)` on an arm hanging down | the arm swings **forward** |

Arms and legs are easier with `aim`: "point this bone in this direction".

## Methods

```python
ctx.length(frames)                 # clip length in frames (ctx.fps is 30). Set it first.
name = ctx.bone('right hand')      # find a bone by exact name or words: 'right upperarm', 'left foot', 'spine', 'hips'
ctx.bones                          # dict: name -> {parent, children, head, tail, length, points, deforms}
                                   #   head/tail are (right, up, forward) in the base pose; points = unit direction head->tail
ctx.parent(name), ctx.children(name)
ctx.height                         # character height in metres
ctx.request                        # this clip's entry from the job (name, description, frames, events, ...)
ctx.parts                          # names of extra parts (props) you may attach for the preview

ctx.key(frame, bone,
        turn=[('up', -35), ('right', 10)],  # turns applied in order, in degrees, around the bone's own joint
        aim=(0.2, 0.9, -0.3),               # optional: point the bone in this (right, up, forward) direction
        twist=0,                            # optional: roll the bone around its own length (degrees)
        move=(0, -0.03, 0),                 # optional: shift the bone (metres). Use on the hips only.
        interp='BEZIER')                    # 'BEZIER' (smooth), 'LINEAR', or 'CONSTANT' (snap/hold)

ctx.event(frame, 'projectile_release', bone=ctx.bone('right hand'))   # gameplay event, stored outside the model
ctx.attach(part, bone, length=0.25, offset=(0, 0, 0), turn=[...], hide_at=None, show_at=None)
                                   # PREVIEW ONLY: show a prop in the hand (e.g. the skull). length = its biggest
                                   # size in metres; it sits at the bone's tip + offset. hide_at = frame it vanishes.
ctx.note('text')                   # a note for the build report
```

How keys work:

- Each `ctx.key` is a complete pose for that bone at that frame, relative to the base pose. Keys are not added together.
  A bone with no key at a frame is smoothly blended between its neighbouring keys.
- Frame 0 and the last frame are automatically set to the base pose for every bone you do not key there, so the clip
  starts and ends in idle. Only key the last frame yourself if the clip should end somewhere else (and the job says so).
- `aim` and `turn` are "as if the parents stayed still": a child moves along with its parents, like a real arm (FK).
  So to raise the whole arm you key the upper arm; the forearm and hand follow. Then key the forearm/hand for the bend.
- Apply `aim` first, then `turn`s, then nothing else. `twist` rolls before aiming.
- Keep feet planted unless the job says otherwise: do not turn the legs much; small knee bends are fine.
- Do not animate fingers that do not exist; check `ctx.bones`.

## Game rules

- The game moves projectiles. Never move a thrown object with the skeleton. Mark the release with
  `ctx.event(frame, 'projectile_release', bone=<hand>)` and hide any preview prop at that frame (`hide_at`).
- The character stays on the spot (origin at the feet). Use `move` on the hips for weight shifts only (a few cm).
- Cartoon style: clear anticipation, strong poses, overshoot then settle. Hold key poses 2-4 frames.

## Example (a quick right-hand wave)

```python
def build(ctx):
    ctx.length(36)
    up = ctx.bone('right upperarm'); fore = ctx.bone('right forearm'); hand = ctx.bone('right hand')
    ctx.key(8,  up,   aim=(0.6, 0.6, 0.2))
    ctx.key(8,  fore, turn=[('forward', 40)])
    for f, ang in ((14, 25), (20, -25), (26, 25)):
        ctx.key(f, up, aim=(0.6, 0.6, 0.2))
        ctx.key(f, hand, turn=[('forward', ang)])
    ctx.key(30, up, aim=(0.5, 0.5, 0.2))
```
