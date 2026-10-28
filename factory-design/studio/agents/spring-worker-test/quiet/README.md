# Quiet-worker test rig (Spring, Oct 28)

Runs the REAL worker.py offline and counts the commits it makes on blender-queue. Old and new code side by side.

- `fakeapi.py`: fake GitHub at the HTTP level (only `GitHub.call` is replaced), with real commits, compare-and-swap and
  fast-forward checks, so get_file / put_file / list_dir / commit_files run unchanged.
- `drive.py`: one worker start (fresh process = a restart) with a virtual clock (an hour takes seconds) and fake programs
  that "take" realistic time (Claude Code 5 min, Blender steps 20-90 s).
- `fakeblender`, `fakeclaude`: make the files each step expects (`tiny.glb` is the model).
- `scenario.py`: idle hour, 10 restarts, one good job + idle until an hour, failing job (retry cap), failed validation,
  cancel mid-job, crash + restart after the lease, a 23-minute Claude Code stage (lease renewal).

Run (needs a copy of the old and the new factory/blender-worker folder):

    python3 scenario.py <old worker folder> <new worker folder>

Result of Oct 28 run: `result-2026-10-28.txt`. The older rig one folder up (fakegh.py) only works with the old worker.py.
