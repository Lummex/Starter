# Clay – Round 27: lossless packing of the two rigged dwarves (Oct 29, 2026)

Job from Forge: Round 27 builds to ~96.1 MB (Ledger, 051a79d). Pack the Anvilsworn Miner and Thane Borgo with meshopt, quantization OFF, no simplify/merge/weld, and prove every byte is unchanged.

## What I did
- Did NOT use gltfpack: even with `-noq` it can reorder and de-duplicate vertices, resample clips and merge nodes (not tested here, avoided on purpose). Instead I ran the official meshoptimizer 0.22.0 encoder (`encodeGltfBuffer`) on each data block of the original file, one by one: vertex data in ATTRIBUTES mode (lossless byte codec, no filter), the index list in INDICES mode (lossless, same triangle order), animation times/values in ATTRIBUTES mode. Blocks that would not get smaller, and the three pictures, are copied as they are. The glTF JSON is the original, with only the buffer layout and `EXT_meshopt_compression` added (the game already loads it: `creature3d.ts` sets `MeshoptDecoder`).
- Scripts (for reuse): `2026-10-29-clay-pack-lossless.mjs` (pack) and `2026-10-29-clay-pack-verify.mjs` (check) next to this report.

## Proof
- Decoded with BOTH meshoptimizer 0.22.0's decoder and three r170's decoder (the game's copy): every bufferView, every accessor (POSITION, NORMAL, TEXCOORD_0, JOINTS_0, WEIGHTS_0, indices, inverse bind matrices, all 12/10 animation time lists and 432/360 value lists) and all pictures are byte-for-byte identical to the original. glTF JSON identical apart from buffer layout. Result: EXACT for both files.
- Checker self-test: flipping one bit in the packed file is caught (POSITION mismatch).
- Render: three r170 GLTFLoader + MeshoptDecoder, original and packed side by side, front idle t=0, side idle, attack mid-swing, walk: 0 differing pixel bytes in all 8 pairs. Same triangles (20,730 / 20,587), 24 bones, 6 / 5 clips. Picture: `2026-10-29-clay-r27-pack-check.jpg`.

## New files (factory-design/design/models/round27-shrunk/, originals untouched)
| File | Original (factory-design/design/models/) | Old bytes | New bytes | Saves |
|---|---|---|---|---|
| anvilsworn-miner-rig-oct28-packed.glb | anvilsworn-miner-rig-oct28.glb | 2,603,600 | 1,838,332 | 765,268 |
| borgo-rig-oct28-packed.glb | borgo-rig-oct28.glb | 2,384,088 | 1,710,432 | 673,656 |
| **Total** | | 4,987,688 | 3,548,764 | **1,438,924** |

SHA-1: miner packed 45983db639c466acfe9e5e62fd235e5cc442e191, borgo packed 3af0c677a112f96b0cde14e3b53b50202caa16bc.

## For others
- Ledger: redo the Round 27 total with these sizes and update the round27-shrunk README / brief item R (I did not touch them: your files).
- Wright: nothing to publish. The model data is unchanged, so the Studio's copies don't need to change.
- Not checked in the real game build yet (no build made); the game uses the same three r170 loader I tested with. Builder: these files need a GLTFLoader with `setMeshoptDecoder(MeshoptDecoder)` (creature3d.ts and grubnak3d.ts have it; art.ts loaders do not). If Borgo is shown through another loader, add the decoder there.
