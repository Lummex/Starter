-- Oreheart packs only (Ken, Nov 6: "I do not want Deepforge packs, Gizmo packs, or junk pile packs. Oreheart packs only. Get rid
-- of all these."). Done by data, not by deleting: the three faction packs are switched off (an admin can switch them back on in
-- pack_types.active), the one Oreheart pack keeps the shop. Sealed faction packs already in TEST stashes become Oreheart packs.
-- Free packs (quests, sign-up) were never of a kind: they open as the Oreheart pack. The faction art files stay.

update public.pack_types set active = false, updated_at = now() where id in ('goblin', 'gnome', 'dwarf');
update public.pack_types set name = 'Oreheart Pack', blurb = 'Eleven cards from every corner of the mines: every army, every crystal.', updated_at = now() where id = 'standard';

-- sealed packs of a faction kind become Oreheart packs (the bundle keeps its promises, its progress and its history)
update public.pack_bundles set pack_type = 'standard', updated_at = now()
  where pack_type in ('goblin', 'gnome', 'dwarf') and packs_left > 0;
