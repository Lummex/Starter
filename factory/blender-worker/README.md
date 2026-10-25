# Oreheart Blender Worker (3D Production)

A small program on the owner's Windows PC that does 3D jobs (inspect, animate) with the local Blender and Claude Code.

```
Dashboard "3D Production" ──writes job.json──▶ GitHub branch blender-queue ◀──polls (outbound HTTPS)── Windows worker
                                                blender-jobs/<id>/job.json                              │
                                                blender-jobs/<id>/out/…  ◀──uploads results────────────┤
                                                                                     Blender (background) + Claude Code (headless)
```

## Install (owner)

1. Make a GitHub fine-grained token: repository `Lummex/Starter` only; permissions **Contents: Read and write**, **Metadata: Read**.
2. Double-click `Install-Blender-Worker.cmd`. Paste the token when asked (hidden; saved only in Windows Credential Manager).
3. Choose whether it starts with Windows. It then starts in a minimized window.

Controls (in `%LOCALAPPDATA%\OreheartBlenderWorker`): `Start-`, `Stop-`, `Pause-`, `Resume-Blender-Worker.cmd`,
`Cancel-Current-Job.cmd`, `Check-Blender-Worker.cmd` (tests Blender, Claude Code, Blender MCP port and GitHub).

## Job life

`queued → claimed → running → validating → awaiting_review (animate) / completed (inspect)`, or `failed` / `cancelled`.

- **Claim** = rewrite `job.json` with its current file SHA (compare-and-swap). Only one worker can win.
- **Lease** 5 minutes, renewed by a heartbeat every 90 s. If the PC sleeps or crashes, the lease runs out and the job is picked up again (`retries` counts this).
- **Idempotent**: every run starts from a clean work folder; results overwrite the job's own `out/` only.
- **Cancel** from the dashboard sets `cancel_requested`; the worker stops at its next heartbeat.

## Security

- Nothing listens on the network. The worker only makes outbound HTTPS calls to api.github.com. Blender MCP (port 9876) is only probed on 127.0.0.1 by the self-check and never exposed.
- The token lives in Windows Credential Manager, never in files or the repo.
- Allowed job types: `inspect`, `animate`. Anything else is refused. Job text is never run as a command.
- Source models are copied into `%LOCALAPPDATA%\OreheartBlenderWorker\work\<job>`; the originals are never written. Local sources must be under Downloads or Documents\Oreheart.
- Downloaded models are read as data only (GLB magic checked, no scripts or add-ons are run from them).
- Claude Code runs headless in the job folder with only Read/Write/Edit/Glob/Grep (no shell, no web). It writes `anims/<Clip>.py`; the worker checks it with an allowlist (imports `math`, `mathutils`, `random` only; no `bpy`, `open`, `exec`, dunders) and Blender runs it with restricted builtins through the `ctx` API (`blender_ops/anim_api.md`).

## How an animation is made

1. `inspect_asset.py`: skeleton, clips, size, facing, base pose (Idle frame 0).
2. Claude Code designs the clip as keyframes through the `ctx` API (one revision round with preview pictures).
3. `build_animation.py`: keys the clip in Blender, renders previews with the held prop, exports, then
   `glbtool.splice` adds ONLY the new clip to the **original** file: geometry, textures and existing clips stay byte-for-byte
   the same (meshopt compression kept). Joint frames are calibrated on the Idle clip and checked on every shared clip.
4. `events.json` holds gameplay events (e.g. `projectile_release` with the hand bone and time). The game moves projectiles.
5. `verify_export.py` re-imports the finished file in a clean Blender and renders `final-*.png`.
   `tools/validate-three.mjs` loads it like the game (three.js GLTFLoader + MeshoptDecoder + AnimationMixer).

Output: glTF 2.0 GLB, Y-up, facing +Z, origin at the feet, named clips.
