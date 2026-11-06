-- Ken's three decisions (Nov 5):
--   1. the Rare-or-better slot: Rare 78 %, Ultra Rare 20 %, Legendary 2 % (was 85 / 13 / 2), on every pack type;
--   2. the third upgrade tier is called "Radiant" (deck_problem's message; the game's TIER4_LABEL);
--   3. "Iron Scarab Automaton" is "Silver Scarab Automaton" (name only; the id clockwork-beetle stays).
update public.pack_slots set odds = '{"Rare": 7800, "Ultra Rare": 2000, "Collector": 200}'::jsonb where slot_no = 4;
update public.cards set name = 'Silver Scarab Automaton' where id = 'clockwork-beetle';

create or replace function private.deck_problem(p_name text, p_commander text, p_cards text[], p_tiers smallint[] default null) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  known text[] := private.setting_text_list('card_ids');
  uid uuid := auth.uid();
  bad text;
  short record;
  tier_names text[] := array['Original', 'Enhanced', 'Overcharged', 'Radiant', 'Mythic'];
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
