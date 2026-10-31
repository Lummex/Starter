# 2026-10-29 — Wright — Card Editor faction backgrounds

Job from Forge (Ken: "I wanted these images for the card editor background according to their faction. So when you change their faction, the background changes to this.").

- Ken's 4 paintings (owner art, used as-is) are Studio assets: dwarves-hall f806d4c3…, gnomes-hall 2da92376…, goblins-hall e402b7f5…, neutral-tavern 6d2557ad…; copies on main in factory-design/references/card-editor-backgrounds/.
- Mapping checked against the Card Format (format.json on factory/issue-8): cost gems and faction crystals are dwarves = blue, gnomes = purple, goblins = green; the owner frames match (dwarf frame blue, gnome frame purple). So blue gear banners = dwarves, purple eye/sun = gnomes, skull = goblins, tavern = "any" (spells for everyone, crystals, card back). Note: the gnomes' faith name is "The Cogwork Congregation", but the gear hall is blue, and blue is the dwarf colour everywhere in the Card Format, so Forge's mapping stands.
- Card Editor room (Studio v29, room ?v=26): the area behind the card shows the hall of the faction picked above the card (cover-fit, 50% dark overlay); it switches live on every faction or card-type change. The card itself is not covered.
- Tested locally with the real room code: Goblins → goblin hall, Gnomes → gnome hall, Dwarves → dwarf hall, Crystal (no faction) → tavern. Live file read back identical.
