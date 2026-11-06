// Refreshes the server's copy of the card list inside the Phase B economy migration.
// Usage (repo root): node supabase/scripts/make-cards-sql.mjs [contentDir] [migrationFile]
//   contentDir     defaults to projects/oreheart-8/src/content (reads cards.json)
//   migrationFile  defaults to supabase/migrations/20261102000001_phase_b_economy.sql
// It rewrites ONLY the block between the two marker lines below, so "supabase db push"
// needs no extra step: the inserts live in the migration itself. Keeps the file's line endings.
// Run it again (into a NEW migration file with the same markers) whenever cards.json changes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dir = process.argv[2] || 'projects/oreheart-8/src/content';
const target = process.argv[3] || 'supabase/migrations/20261102000001_phase_b_economy.sql';
const BEGIN = '-- BEGIN GENERATED CARDS (supabase/scripts/make-cards-sql.mjs; do not edit by hand)';
const END = '-- END GENERATED CARDS';

const raw = fs.readFileSync(path.join(dir, 'cards.json'), 'utf8');
const cards = JSON.parse(raw);
// The version of the card list this copy came from: a short fingerprint of cards.json.
const version = 'cards:' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Collector'];
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const rows = [];
const deckIds = [...cards].filter((c) => !c.token).map((c) => c.id).sort();
for (const c of [...cards].sort((a, b) => a.id.localeCompare(b.id))) {
  if (!/^[a-z0-9-]{1,64}$/.test(c.id)) throw new Error(`bad card id: ${c.id}`);
  if (!RARITIES.includes(c.rarity)) throw new Error(`unknown rarity "${c.rarity}" on ${c.id}`);
  if (c.token) continue; // Nov 6: tokens (Piglet, Spark Wisp, Clockwork Mule) appear in play only: never in the catalog, packs, collections or decks
  const disabled = !!c.disabled;
  // Packs v2 (Ken, Nov 5): crystals are in the pool at their own rarity like any card. Disabled cards are kept but never dealt.
  const inPacks = (c.type === 'creature' || c.type === 'spell' || c.type === 'crystal') && !disabled;
  rows.push(`  (${q(c.id)}, ${q(c.name)}, ${q(c.type)}, ${q(c.faction || 'any')}, ${q(c.rarity)}, ${Number(c.cost) | 0}, ${inPacks}, ${disabled}, ${q(version)})`);
}

const block = [
  BEGIN,
  `-- ${rows.length} cards from cards.json (${rows.filter((r) => r.includes(', true, false,')).length} can be dealt in packs; ${cards.length - rows.length} tokens left out); content_version ${version}.`,
  'insert into public.cards (id, name, type, faction, rarity, cost, in_packs, disabled, content_version) values',
  rows.join(',\n'),
  'on conflict (id) do update set name = excluded.name, type = excluded.type, faction = excluded.faction,',
  '  rarity = excluded.rarity, cost = excluded.cost, in_packs = excluded.in_packs, disabled = excluded.disabled,',
  '  content_version = excluded.content_version;',
  '-- the deck checks know every deck card id (settings card_ids), tokens left out',
  `update public.settings set value = ${q(JSON.stringify(deckIds))}::jsonb, updated_at = now() where key = 'card_ids';`,
  END,
].join('\n');

const file = fs.readFileSync(target, 'utf8');
const eol = file.includes('\r\n') ? '\r\n' : '\n';
const lf = file.replace(/\r\n/g, '\n');
const a = lf.indexOf(BEGIN);
const b = lf.indexOf(END);
if (a < 0 || b < 0 || b < a) throw new Error(`markers not found in ${target}`);
const out = lf.slice(0, a) + block + lf.slice(b + END.length);
fs.writeFileSync(target, out.replace(/\n/g, eol));
console.log(`wrote ${rows.length} cards (${version}) into ${target}`);
