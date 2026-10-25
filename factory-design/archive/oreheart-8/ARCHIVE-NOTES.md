# Archive: files the game no longer uses

These files were taken out of the game so they are not sent to Vercel.
They are kept here in GitHub in case we want them back.
To restore one, copy it back to its old place and rebuild.

## Moved Oct 25, 2026 (owner asked for a cleanup)

| Now here (factory-design/archive/oreheart-8/) | Was here (projects/oreheart-8/) | Why it was unused |
|---|---|---|
| themes/goblin.json | public/themes/goblin.json | Old copy of the goblin theme. The game reads src/content/themes/goblins.json. |
| themes/img-b6nv6k.webp | public/themes/img-b6nv6k.webp | Old copy of a goblin HUD picture. The game uses public/art/goblin/img-b6nv6k.webp. |
| themes/img-ghu1yc.webp | public/themes/img-ghu1yc.webp | Same as above. |
| themes/img-hbdpqp.webp | public/themes/img-hbdpqp.webp | Same as above. |
| themes/img-prbig7.webp | public/themes/img-prbig7.webp | Same as above. |
| themes/img-zrfak9.webp | public/themes/img-zrfak9.webp | Same as above. |
| goblin-theme.json | public/art/goblin/goblin-theme.json | Another old copy of the goblin theme. |
| goblin-pebbler-card-art.webp | public/art/owner/goblin/goblin-pebbler-card-art.webp | The card uses boneknocker-card-art.png instead. |
| goblin-smith-miner-card-art.webp | public/art/owner/goblin/goblin-smith-miner-card-art.webp | The card uses scrapsmith-miner-card-art.png instead. |
| crystal-mine-placeholder.gltf | public/assets/models/crystal-mine-placeholder.gltf | Early placeholder mine. The game uses public/models/mines/. |

## Kept in GitHub but no longer sent to Vercel

A `.vercelignore` file in projects/oreheart-8 now tells Vercel to skip these folders.
They stay where they are in GitHub; only the upload to Vercel skips them.

- `screenshots/`: about 157 MB of factory test screenshots.
- `tools/`: the factory's art and test scripts.
- `tests/`: the automatic checks. They run on GitHub, not on Vercel.
