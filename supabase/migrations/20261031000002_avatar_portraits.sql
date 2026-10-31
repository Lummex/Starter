-- Player avatars (Ken, Oct 31): Brush's painted portraits (projects/oreheart-8/src/content/avatars.json, 61 ids).
-- set_avatar checks the avatar_cards setting, so every portrait id is added to it. The old card ids stay allowed,
-- so players who already picked card art keep it until they change it in Profile.
update public.settings
set value = (
      select jsonb_agg(x order by x)
      from (
        select jsonb_array_elements_text(value) as x from public.settings where key = 'avatar_cards'
        union
        select jsonb_array_elements_text('["goblin-goggle-rogue","goblin-girl","goblin-scrapper-boy","goblin-bruiser","goblin-shaman-elder","goblin-tinker","goblin-sneak","goblin-chief","goblin-granny","goblin-bomber-girl","goblin-witch","goblin-kid-girl","goblin-wolf-rider","gnome-boy","gnome-professor","gnome-stormmage","gnome-guard","gnome-pilot","gnome-kid","gnome-illusionist","gnome-engineer","gnome-grandma","gnome-crystal-girl","gnome-kid-girl","gnome-alchemist","dwarf-woman","dwarf-miner","dwarf-thane-elder","dwarf-smith","dwarf-kid-boy","dwarf-guard","dwarf-brewer","dwarf-queen","dwarf-kid-girl","dwarf-gunner","dwarf-healer","dwarf-granny","human-man","human-girl","human-paladin","human-rogue","human-old-wizard","human-kid-boy","human-bard","human-archer-girl","human-warrior-woman","human-kid-girl","human-queen","human-merchant","undead-girl","undead-knight","undead-ghost-boy","undead-zombie-farmer","undead-lich","undead-vampire","undead-pirate","undead-ghost-lady","undead-mummy-girl","undead-witch","undead-zombie-girl","undead-banshee"]'::jsonb)
      ) ids),
    updated_at = now()
where key = 'avatar_cards';
