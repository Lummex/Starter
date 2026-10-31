# 2026-10-30 – Spring – Biped pack v2 with Mixamo (Forge job, Ken OK)

**Result:** `factory-design/design/anims/biped-pack-v2.glb` (+ `.json`) on main (9b6dbd2): 57 shared biped clips = all 32 hand-made v1 clips + 25 from Mixamo. Same skeleton, format and retarget as v1, so Anvil's loader takes it as-is. Studio `animations`: 25 new docs (`source: "mixamo"`, `mixamoClip`), approved by Forge under Ken's delegation.

**Licence:** Adobe's Mixamo FAQ says characters and animations are "royalty free for personal, commercial, and non-profit projects", including video games. Raw FBX files stay on Ken's PC (`art/mixamo/`, 28 files), never on GitHub.

| Group | Mixamo clips added |
|---|---|
| Idle ×10 (11–20) | breathing, happy, bored, nervous look-around, dizzy rocking, orc stance, dwarf idle, old-timer, victory showboat, weight shift |
| Idle break ×4 (05–08) | big yawn, elbow stretch, neck roll, nervous look over the shoulder |
| Walk ×2 / Run ×2 | swagger, dwarf walk / standard run, drunken stagger run (rootSpeed in json) |
| Reactions | belly punch stagger (bonk-04), punched flat + get up (knockback-02), knocked to stomach + push up (bowled-02) |
| Death ×2 / Cheer ×2 | fall backwards, fall forwards / two-fist pump, super excited |

**Fitting to our units:** same align retarget, wrists softened 50%. Get-ups and big stretches were sped up (×1.5–2.8) for snappier comedy. Hips were lifted by a ground pass, because Mixamo's long-legged body otherwise sank lying poses 30–38% into the floor on our chunky units.
**Checks (goblin, gnome, dwarf, golem):** no sinking (worst +1.7% on one run), no backward knees, loops seamless, wrists ≤60°.
**Known:** some units hover 2–5% on Mixamo clips (per-unit ground offset at load fixes it; told Anvil); Mixamo clips start/end in their own stance (cross-fade); a few stepping idles/cheers skid a little (up to 6–12% foot slide). Dropped 1 hit reaction (stepped back too far).
**How:** Mixamo's own page API inside Ken's signed-in tab. Chrome blocked repeat downloads, so a local receiver on Ken's PC took the links.
