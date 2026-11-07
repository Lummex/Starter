-- Deck names (Ken, Nov 7: "you need to be able to name the deck inside the deck builder"). The Deck Builder now has a name field
-- at the top (up to 24 letters there; the server keeps its 1-40 rule so older, longer names still save). Every saved name goes through
-- the same blocked-word mask as feedback (rude words become stars; a save is never refused for a word). Under-13 accounts keep the
-- server-made names as before. The ownership check (no more copies than owned, per tier) is unchanged: private.deck_problem.
-- Safe for the real database.

create or replace function public.save_deck(p_id uuid, p_name text, p_commander text, p_cards text[], p_tiers smallint[] default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  child boolean := (select age_group = 'under_13' from public.profiles where id = uid);
  nm text := p_name;
  problem text;
  did uuid;
  tiers smallint[] := coalesce(p_tiers, array_fill(1::smallint, array[coalesce(cardinality(p_cards), 0)]));
begin
  if child then nm := coalesce((select name from public.decks where id = p_id and user_id = uid), private.child_deck_name(uid));
  else nm := private.mask_words(btrim(coalesce(nm, ''))); end if;
  problem := private.deck_problem(nm, p_commander, p_cards, p_tiers);
  if problem is not null then raise exception '%', problem; end if;
  if p_id is null then
    -- Lock the profile so two saves at once can't pass the deck limit together.
    perform 1 from public.profiles where id = uid for update;
    if (select count(*) from public.decks where user_id = uid) >= coalesce((private.setting('max_decks'))::int, 30) then
      raise exception 'You can keep at most % decks.', coalesce((private.setting('max_decks'))::int, 30);
    end if;
    insert into public.decks (user_id, name, commander, cards, card_tiers)
      values (uid, btrim(nm), p_commander, p_cards, tiers) returning id into did;
  else
    update public.decks set name = btrim(nm), commander = p_commander, cards = p_cards, card_tiers = tiers, updated_at = now()
      where id = p_id and user_id = uid returning id into did;
    if did is null then raise exception 'deck not found'; end if;
  end if;
  return did;
end $$;
revoke all on function public.save_deck(uuid, text, text, text[], smallint[]) from public, anon;
grant execute on function public.save_deck(uuid, text, text, text[], smallint[]) to authenticated;
