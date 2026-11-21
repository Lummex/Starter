-- Frames, single emotes and emote packs are sold for Oreshards ONLY (Ken, Nov 21: "avatar frames and single emotes and packs
-- emotes ... I only want you to be able to buy them with OR shards ... no coins").
-- * Each item keeps the Oreshard price it already has (Ken had already cleared the coin price on the three emote packs in
--   the editor, keeping 400 Oreshards): emote 100, pack 400 (6 emotes: cheaper than 6 singles), frame 500. Only an item with
--   a coin price and no Oreshard price is converted (1 Oreshard = 4 coins, rounded to 5 under 100, to 25 from 100). Then
--   the coin price is cleared and a check keeps it empty.
-- * pay_cosmetic (frames, emotes, packs) refuses coins; admin_set_cosmetic_price refuses a coin price.
-- * Free starter emotes and the Founder / Producer frames stay unsold. Sleeves (already Oreshards only) are untouched.
-- Production-safe and re-runnable.

do $$
declare r numeric := coalesce((select (value #>> '{}')::numeric from public.settings where key = 'oreshard_pack_rate'), 0.25);
begin
  if r <= 0 then r := 0.25; end if;
  update public.emote_packs set price_oreshards = greatest(5, (case when price_coins * r < 100 then round(price_coins * r / 5) * 5 else round(price_coins * r / 25) * 25 end)::int)
    where price_coins is not null and price_oreshards is null and not free;
  update public.emotes set price_oreshards = greatest(5, (case when price_coins * r < 100 then round(price_coins * r / 5) * 5 else round(price_coins * r / 25) * 25 end)::int)
    where price_coins is not null and price_oreshards is null;
  update public.frames set price_oreshards = greatest(5, (case when price_coins * r < 100 then round(price_coins * r / 5) * 5 else round(price_coins * r / 25) * 25 end)::int)
    where price_coins is not null and price_oreshards is null and kind = 'store';
end $$;

update public.emote_packs set price_coins = null where price_coins is not null;
update public.emotes set price_coins = null where price_coins is not null;
update public.frames set price_coins = null where price_coins is not null;

alter table public.emote_packs drop constraint if exists emote_packs_oreshards_only;
alter table public.emote_packs add constraint emote_packs_oreshards_only check (price_coins is null);
alter table public.emotes drop constraint if exists emotes_oreshards_only;
alter table public.emotes add constraint emotes_oreshards_only check (price_coins is null);
alter table public.frames drop constraint if exists frames_oreshards_only;
alter table public.frames add constraint frames_oreshards_only check (price_coins is null);

/** pay for a frame, emote or emote pack: Oreshards only (Nov 21) */
create or replace function private.pay_cosmetic(p_user uuid, p_coins integer, p_shards integer, p_pay text, p_ref text, p_idem text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare bal integer;
begin
  if p_pay is distinct from 'oreshards' then raise exception 'Frames and emotes are sold for Oreshards only.'; end if;
  if p_shards is null then raise exception 'That is not for sale.'; end if;
  perform 1 from public.oreshard_wallets where user_id = p_user for update;
  bal := coalesce((select oreshards from public.oreshard_wallets where user_id = p_user), 0);
  if bal < 0 then raise exception 'This account owes Oreshards from a refund; nothing can be spent until it is back to zero.'; end if;
  if bal < p_shards then raise exception 'Not enough Oreshards (this costs %, you have %).', p_shards, bal; end if;
  perform private.oreshard_apply(p_user, -p_shards, 'cosmetic', p_ref, 'cos:' || p_idem);
  return jsonb_build_object('paid_with', 'oreshards', 'price', p_shards);
end $$;

create or replace function public.admin_set_cosmetic_price(p_kind text, p_id text, p_coins integer, p_oreshards integer, p_enabled boolean, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare aid uuid := private.assert_admin(); before jsonb; after jsonb;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason required'; end if;
  if p_coins is not null then raise exception 'Frames and emotes are sold for Oreshards only: leave the coin price empty.'; end if;
  if p_oreshards is not null and (p_oreshards < 1 or p_oreshards > 100000) then raise exception 'prices: Oreshards 1-100000, or empty for not sold'; end if;
  if p_kind = 'emote_pack' then
    select to_jsonb(x) into before from public.emote_packs x where id = p_id; if before is null then raise exception 'unknown emote pack'; end if;
    if (before ->> 'free')::boolean and p_oreshards is not null then raise exception 'The free starter emotes can''t be sold.'; end if;
    update public.emote_packs set price_oreshards = p_oreshards, enabled = coalesce(p_enabled, enabled) where id = p_id;
    select to_jsonb(x) into after from public.emote_packs x where id = p_id;
  elsif p_kind = 'emote' then
    select to_jsonb(x) into before from public.emotes x where id = p_id; if before is null then raise exception 'unknown emote'; end if;
    update public.emotes set price_oreshards = p_oreshards, enabled = coalesce(p_enabled, enabled) where id = p_id;
    select to_jsonb(x) into after from public.emotes x where id = p_id;
  elsif p_kind = 'frame' then
    select to_jsonb(x) into before from public.frames x where id = p_id; if before is null then raise exception 'unknown frame'; end if;
    if before ->> 'kind' <> 'store' and p_oreshards is not null then raise exception 'The % frame can''t be sold.', before ->> 'name'; end if;
    update public.frames set price_oreshards = p_oreshards, enabled = coalesce(p_enabled, enabled) where id = p_id;
    select to_jsonb(x) into after from public.frames x where id = p_id;
  else raise exception 'kind: emote_pack, emote or frame';
  end if;
  perform private.audit(aid, 'set_cosmetic_price', null, before, after, p_reason);
  return after;
end $$;

revoke all on function private.pay_cosmetic(uuid, integer, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_set_cosmetic_price(text, text, integer, integer, boolean, text) from public, anon;
grant execute on function public.admin_set_cosmetic_price(text, text, integer, integer, boolean, text) to authenticated;
