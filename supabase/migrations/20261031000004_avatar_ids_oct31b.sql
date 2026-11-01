-- Player avatars, second list (Brush, Oct 31): avatars.json changed (trolls added, some ids dropped). Every current
-- id becomes allowed; old ids stay allowed so saved profiles keep working.
update public.settings
set value = (
      select jsonb_agg(x order by x)
      from (
        select jsonb_array_elements_text(value) as x from public.settings where key = 'avatar_cards'
        union
        select jsonb_array_elements_text('["goblin-goggle-rogue","goblin-girl","goblin-scrapper-boy","goblin-bruiser","goblin-shaman-elder","goblin-tinker","goblin-sneak","goblin-chief","goblin-granny","goblin-bomber-girl","goblin-witch","goblin-kid-girl","goblin-wolf-rider","gnome-boy","gnome-professor","dwarf-woman","human-man","human-girl","undead-girl","gnome-stormmage","gnome-pilot","gnome-warty-tinker","gnome-kid","gnome-illusionist","gnome-engineer","gnome-grandma","gnome-crystal-girl","dwarf-miner","dwarf-thane-elder","dwarf-lumpy-guard","dwarf-kid-boy","dwarf-brewer","dwarf-queen","dwarf-kid-girl","dwarf-gunner","dwarf-granny","human-paladin","human-rogue","human-old-wizard","human-kid-boy","human-archer-girl","human-warrior-woman","human-kid-girl","human-swamp-hag","undead-knight","undead-ghost-boy","undead-zombie-farmer","undead-vampire","undead-ghost-lady","undead-mummy-girl","undead-witch","undead-zombie-girl","troll-chieftain","troll-bog-brute","troll-hunter","troll-kid","troll-shaman-woman","troll-warrior-woman","troll-granny","troll-cave-girl"]'::jsonb)
      ) ids),
    updated_at = now()
where key = 'avatar_cards';
