// Writes the Phase A settings migration from the game's own content files.
// Usage: node supabase/scripts/make-settings-sql.mjs [contentDir] > supabase/migrations/<ts>_phase_a_settings.sql
// contentDir defaults to projects/oreheart-8/src/content (run from the repo root).
// Run it again (into a NEW migration file) whenever cards or starter decks change.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || 'projects/oreheart-8/src/content';
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

const cards = read('cards.json');
const decks = read('starter-decks.json');
const commanders = read('commanders.json');

// Every new player owns every starter-deck card: for each card, the most
// copies any one starter deck uses (so all starter decks can be built).
const starter = {};
for (const d of Object.values(decks)) {
  const n = {};
  for (const id of d.cards) n[id] = (n[id] || 0) + 1;
  for (const [id, k] of Object.entries(n)) starter[id] = Math.max(starter[id] || 0, k);
}
const sorted = Object.fromEntries(Object.entries(starter).sort(([a], [b]) => a.localeCompare(b)));

const cardIds = cards.map((c) => c.id).sort();
// Avatars come from existing card art only (no new pictures): every card that is not disabled.
const avatarCards = cards.filter((c) => !c.disabled).map((c) => c.id).sort();
const commanderIds = commanders.map((c) => c.id).sort();

const settings = {
  // Ken, Oct 28: "300 is fine for now". Editable in the back counter (Settings).
  signup_bonus_coins: 300,
  max_decks: 30,
  // Version of the parent privacy notice shown on the consent page (change it when the text changes).
  consent_notice_version: '2026-10-28-draft',
  deck_max_cards: 100,
  starter_collection: sorted,
  card_ids: cardIds,
  commander_ids: commanderIds,
  avatar_cards: avatarCards,
  // Compared after private.normalize_name(): lowercase letters only, look-alikes undone.
  reserved_usernames: ['ken', 'lummex', 'forge', 'root', 'system', 'staff', 'support', 'help', 'official',
    'player', 'guest', 'null', 'undefined', 'grubnak', 'sproingle', 'knobbin', 'borgo', 'skreeka', 'sprocket', 'grumblebeard'],
  reserved_name_parts: ['admin', 'oreheart', 'moderator', 'anthropic', 'claude'],
  // Starter list only (kid-friendly game). Extend from the admin side later; any name containing one is refused.
  blocked_words: ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'penis', 'vagina', 'boob', 'tits',
    'whore', 'slut', 'bastard', 'asshole', 'wank', 'twat', 'porn', 'sex', 'nazi', 'hitler',
    'nigg', 'fag', 'retard', 'kys', 'killyourself'],
};

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const rows = Object.entries(settings).map(([k, v]) => `  (${q(k)}, ${q(JSON.stringify(v))}::jsonb)`);
process.stdout.write(`-- Oreheart Online, Phase A: settings (made by supabase/scripts/make-settings-sql.mjs from
-- projects/oreheart-8/src/content: cards.json, starter-decks.json, commanders.json).
-- starter_collection: ${Object.keys(sorted).length} different cards, ${Object.values(sorted).reduce((a, b) => a + b, 0)} cards in all.
-- signup_bonus_coins = 300 (Ken, Oct 28); the back counter can change it (audited).
insert into public.settings (key, value) values
${rows.join(',\n')}
on conflict (key) do update set value = excluded.value, updated_at = now();
`);
