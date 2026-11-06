-- Ken's rarity batch (Nov 5), rarity only; pack odds, copy limits and upgrade steps follow. Same change in the card data (cards.json).
-- Iron Scarab Automaton and Mangewolf Rider to Ultra Rare; Bowler Brawler, Gearward Sentinel, Ironwall Shieldbeard to Rare;
-- Oathbound Overwatch to Ultra Rare; Goblin Chef, Skullflinger, Stormcaller Savant, Hexslinger Apprentice, Grudge Hurler,
-- Marksmen Gunner, Ironjaw Big Back, Riot Shield Bearer, Field Bandage to Uncommon ("no spell is ever Common").
-- Junk Shaman and Thunderwing Gyronaut stay Ultra Rare.
update public.cards set rarity = v.r from (values
  ('clockwork-beetle', 'Ultra Rare'),
  ('wolf-rider', 'Ultra Rare'),
  ('goblin-scrapper', 'Rare'),
  ('rotgut-grenadier', 'Uncommon'),
  ('goblin-slinger', 'Uncommon'),
  ('spark-gnome', 'Uncommon'),
  ('hexwright-apprentice', 'Uncommon'),
  ('axe-thrower', 'Uncommon'),
  ('deepforge-crossbowman', 'Uncommon'),
  ('gearward-sentinel', 'Rare'),
  ('oathbound-pikeman', 'Ultra Rare'),
  ('dwarf-pickman', 'Uncommon'),
  ('dwarf-miner', 'Uncommon'),
  ('shieldbeard', 'Rare'),
  ('healing-light', 'Uncommon')) v(id, r) where public.cards.id = v.id;
