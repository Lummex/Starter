-- Per-copy upgrades (Ken, Nov 5: "I don't want it to upgrade the whole stack ... if I only have one overcharge card and the rest
-- are all original, I want only one to be able to be put in the deck").
-- Every copy already has its own tier (card_instances.tier); what changes:
--   * a saved deck says which copy tier sits in each slot (decks.card_tiers, parallel to cards; 1 = plain). The server checks
--     the player owns that many copies of that tier. The match reads the tiers from the deck, so a card shows the tier of
--     the copy that is really in it.
--   * my_upgrade_info tells the copies per tier of each card (by_tier), for the Deck Builder's chooser.
--   * upgrade_card(..., p_force): without force it still refuses to leave a saved deck short ("Keep N copies"); with force
--     (the player read the warning and confirmed) it goes through and repairs the tiers in every deck using that card:
--     the best copies left fill the slots in order; a deck left short is flagged at play time as before.
-- Existing data needs no change: a combined stack is already one upgraded copy plus the plain copies left.

alter table public.decks add column if not exists card_tiers smallint[] not null default '{}';

drop function if exists private.deck_problem(text, text, text[]);
create function private.deck_problem(p_name text, p_commander text, p_cards text[], p_tiers smallint[] default null) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  known text[] := private.setting_text_list('card_ids');
  uid uuid := auth.uid();
  bad text;
  short record;
  tier_names text[] := array['Original', 'Enhanced', 'Overcharged', 'Legendary', 'Mythic'];
begin
  if p_name is null or length(btrim(p_name)) not between 1 and 40 then return 'Deck name must be 1 to 40 characters.'; end if;
  if p_commander is not null and not (p_commander = any (private.setting_text_list('commander_ids'))) then
    return 'Unknown commander.';
  end if;
  if p_cards is null then return 'No cards.'; end if;
  if cardinality(p_cards) > coalesce((private.setting('deck_max_cards'))::int, 100) then return 'Too many cards.'; end if;
  select c into bad from unnest(p_cards) c where c is null or not (c = any (known)) limit 1;
  if found then return 'Unknown card: ' || coalesce(left(bad, 64), 'empty'); end if;
  if p_tiers is not null then
    if cardinality(p_tiers) <> cardinality(p_cards) then return 'The card tiers do not match the cards.'; end if;
    if exists (select 1 from unnest(p_tiers) t where t is null or t < 1 or t > 5) then return 'Bad card tier.'; end if;
  end if;
  if uid is not null then
    select u.card_id, u.n, coalesce(o.n, 0) as owned, coalesce(k.name, u.card_id) as name into short
    from (select c as card_id, count(*) as n from unnest(p_cards) c group by c) u
    left join public.cards k on k.id = u.card_id
    left join (select ci.card_id, count(*) as n from public.card_instances ci
               where ci.owner_id = uid and ci.status = 'owned' group by ci.card_id) o on o.card_id = u.card_id
    where u.n > coalesce(o.n, 0)
    order by u.card_id limit 1;
    if found then return 'you own ' || short.owned || ' of ' || short.name; end if;
    if p_tiers is not null then
      -- an upgraded slot needs a copy of that very tier
      select u.card_id, u.tier, u.n, coalesce(o.n, 0) as owned, coalesce(k.name, u.card_id) as name into short
      from (select x.c as card_id, x.t as tier, count(*) as n from unnest(p_cards, p_tiers) as x(c, t) where x.t > 1 group by x.c, x.t) u
      left join public.cards k on k.id = u.card_id
      left join (select ci.card_id, ci.tier, count(*) as n from public.card_instances ci
                 where ci.owner_id = uid and ci.status = 'owned' group by ci.card_id, ci.tier) o on o.card_id = u.card_id and o.tier = u.tier
      where u.n > coalesce(o.n, 0)
      order by u.card_id, u.tier limit 1;
      if found then return format('you own %s %s cop%s of %s', short.owned, tier_names[short.tier], case when short.owned = 1 then 'y' else 'ies' end, short.name); end if;
    end if;
  end if;
  return null;
end $$;
revoke all on function private.deck_problem(text, text, text[], smallint[]) from public, anon, authenticated;

drop function if exists public.save_deck(uuid, text, text, text[]);
create function public.save_deck(p_id uuid, p_name text, p_commander text, p_cards text[], p_tiers smallint[] default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  child boolean := (select age_group = 'under_13' from public.profiles where id = uid);
  nm text := p_name;
  problem text;
  did uuid;
  tiers smallint[] := coalesce(p_tiers, array_fill(1::smallint, array[coalesce(cardinality(p_cards), 0)]));
begin
  if child then nm := coalesce((select name from public.decks where id = p_id and user_id = uid), private.child_deck_name(uid)); end if;
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

-- the copies per tier of each card (by_tier: plain, Enhanced, Overcharged, Legendary, Mythic), for the Deck Builder's chooser
create or replace function public.my_upgrade_info() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.assert_player();
begin
  return jsonb_build_object(
    'steps', private.upgrade_steps(),
    'drop_bp', coalesce(private.setting('upgrade_drop_bp'), '{}'::jsonb),
    'drop_tiers', coalesce(private.setting('upgrade_drop_tiers'), '{}'::jsonb),
    'cards', coalesce((select jsonb_object_agg(card_id, jsonb_build_object('best', best, 'owned', owned, 'upgraded', upgraded, 'by_tier', jsonb_build_array(t1, t2, t3, t4, t5)))
                       from (select ci.card_id, max(ci.tier) as best, count(*) as owned, count(*) filter (where ci.tier > 1) as upgraded,
                                    count(*) filter (where ci.tier = 1) as t1, count(*) filter (where ci.tier = 2) as t2, count(*) filter (where ci.tier = 3) as t3,
                                    count(*) filter (where ci.tier = 4) as t4, count(*) filter (where ci.tier = 5) as t5
                             from public.card_instances ci where ci.owner_id = uid and ci.status = 'owned' group by ci.card_id) x), '{}'::jsonb));
end $$;

drop function if exists public.upgrade_card(uuid, uuid[], text);
create function public.upgrade_card(p_target uuid, p_sources uuid[], p_idem_key text, p_force boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.assert_player();
  prior public.upgrade_events;
  t public.card_instances;
  rar text;
  srcs uuid[] := (select coalesce(array_agg(distinct s), '{}'::uuid[]) from unnest(coalesce(p_sources, '{}'::uuid[])) s where s is not null and s <> p_target);
  found_n integer; spent_worth integer; need integer; left_n integer;
  new_worth integer; new_tier smallint; eid uuid := gen_random_uuid(); result jsonb;
  d record; avail smallint[]; newt smallint[]; k integer; i integer; repaired text[] := '{}';
begin
  if p_idem_key is null or length(p_idem_key) not between 8 and 120 then raise exception 'idem_key required'; end if;
  perform 1 from public.wallets where user_id = uid for update;
  select * into prior from public.upgrade_events where idem_key = p_idem_key;
  if found then
    if prior.user_id <> uid then raise exception 'idem_key already used'; end if;
    return prior.result || jsonb_build_object('repeat', true);
  end if;
  if cardinality(srcs) < 1 then raise exception 'Pick at least one copy to combine.'; end if;
  if cardinality(srcs) > 200 then raise exception 'At most 200 copies at a time.'; end if;
  select * into t from public.card_instances where id = p_target and owner_id = uid and status = 'owned' for update;
  if not found then raise exception 'That card is not yours.'; end if;
  if t.tier >= 5 then raise exception 'That card is already Mythic.'; end if;
  rar := (select c.rarity from public.cards c where c.id = t.card_id);
  perform 1 from public.card_instances where id = any (srcs) for update;
  select count(*), coalesce(sum(worth), 0) into found_n, spent_worth
    from public.card_instances where id = any (srcs) and owner_id = uid and status = 'owned' and card_id = t.card_id;
  if found_n <> cardinality(srcs) then raise exception 'Only your own copies of the same card can be combined.'; end if;
  need := greatest(1, coalesce((select max(n) from (select count(*) as n from public.decks dd, unnest(dd.cards) c where dd.user_id = uid and c = t.card_id group by dd.id) x), 0));
  left_n := (select count(*) from public.card_instances where owner_id = uid and status = 'owned' and card_id = t.card_id) - cardinality(srcs);
  -- Ken (Nov 5): the player is warned first; with p_force (they confirmed) the combine goes through and the decks follow
  if left_n < need and not coalesce(p_force, false) then raise exception 'Keep % cop% of that card for your decks.', need, case when need = 1 then 'y' else 'ies' end; end if;
  new_worth := t.worth + spent_worth;
  new_tier := private.tier_of_worth(new_worth, rar);
  update public.card_instances set worth = new_worth, tier = new_tier, updated_at = now() where id = t.id;
  update public.card_instances set status = 'combined', updated_at = now() where id = any (srcs);
  insert into public.card_history (card_instance_id, event, from_user, to_user, reason, ref, created_by)
    select s, 'combined', uid, null, 'combined into ' || t.id::text, eid::text, null from unnest(srcs) s;
  insert into public.card_history (card_instance_id, event, from_user, to_user, reason, ref, created_by)
    values (t.id, 'upgraded', uid, uid, format('worth %s -> %s, tier %s -> %s', t.worth, new_worth, t.tier, new_tier), eid::text, null);
  -- every deck using this card gets the best copies left, in slot order (a deck left short stays short; play flags it)
  avail := array(select ci.tier from public.card_instances ci where ci.owner_id = uid and ci.status = 'owned' and ci.card_id = t.card_id order by ci.tier desc, ci.worth desc);
  for d in select dd.id, dd.name, dd.cards, dd.card_tiers from public.decks dd where dd.user_id = uid and t.card_id = any (dd.cards) for update loop
    newt := d.card_tiers;
    if newt is null or cardinality(newt) <> cardinality(d.cards) then newt := array_fill(1::smallint, array[cardinality(d.cards)]); end if;
    k := 0;
    for i in 1..cardinality(d.cards) loop
      if d.cards[i] = t.card_id then k := k + 1; newt[i] := coalesce(avail[k], 1); end if;
    end loop;
    if newt is distinct from d.card_tiers then
      update public.decks set card_tiers = newt, updated_at = now() where id = d.id;
      repaired := repaired || d.name;
    end if;
  end loop;
  result := jsonb_build_object('event_id', eid, 'target', t.id, 'card_id', t.card_id, 'spent', cardinality(srcs), 'left', left_n,
    'worth_before', t.worth, 'worth_after', new_worth, 'tier_before', t.tier, 'tier_after', new_tier,
    'next_worth', case when new_tier < 5 then private.worth_of_tier(new_tier + 1, rar) else null end,
    'decks', to_jsonb(repaired));
  insert into public.upgrade_events (id, user_id, target_id, card_id, source_ids, worth_before, worth_after, tier_before, tier_after, idem_key, result)
    values (eid, uid, t.id, t.card_id, srcs, t.worth, new_worth, t.tier, new_tier, p_idem_key, result);
  return result || jsonb_build_object('repeat', false);
end $$;
revoke all on function public.upgrade_card(uuid, uuid[], text, boolean) from public, anon;
grant execute on function public.upgrade_card(uuid, uuid[], text, boolean) to authenticated;
