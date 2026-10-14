// Name understanding: sizes, number words, synonyms, nicknames (see SPEC sections A-D).

const NUMWORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
const FILLER_WORDS = new Set(['degree', 'degrees', 'deg', 'the', 'of', 'a', 'an']);
const UNIT = '(?:\\s*(?:"|(?:inches|inch|in)(?![a-z])))';
const DECIMALS = { 0.25: '1/4', 0.375: '3/8', 0.5: '1/2', 0.625: '5/8', 0.75: '3/4', 1.25: '1-1/4', 1.5: '1-1/2' };

function step1(s) {
  return String(s).toLowerCase()
    .replace(/½/g, ' 1/2').replace(/¼/g, ' 1/4').replace(/¾/g, ' 3/4')
    .replace(/[”″“]/g, '"').replace(/°/g, ' degree').replace(/-/g, ' ');
}

function sizes(s) {
  const rep = (re, tok) => { s = s.replace(re, ` ${tok} `); };
  rep(/\b(?:one and (?:a|one) quarter inch(?:es)?|inch and a quarter)(?![a-z])/g, '1-1/4in');
  rep(/\b(?:one and (?:a|one) half inch(?:es)?|inch and a half)(?![a-z])/g, '1-1/2in');
  rep(/\bthree eighths? inch(?:es)?(?![a-z])/g, '3/8in');
  rep(/\bfive eighths? inch(?:es)?(?![a-z])/g, '5/8in');
  rep(/\bthree (?:quarters?|fourths?) inch(?:es)?(?![a-z])/g, '3/4in');
  rep(/\b(?:(?:a|one) )?quarter inch(?:es)?(?![a-z])/g, '1/4in');
  rep(/\b(?:(?:a|one) half|half(?: an)?) inch(?:es)?(?![a-z])/g, '1/2in');
  rep(/\b(?:one|an) inch(?:es)?(?![a-z])/g, '1in');
  s = s.replace(/\b(two|three|four) inch(?:es)?(?![a-z])/g, (m, w) => ` ${NUMWORDS[w]}in `);
  s = s.replace(new RegExp(`(?<![\\d/.-])(\\d+)\\s+(\\d+)/(\\d+)${UNIT}?(?![\\d/])`, 'g'), ' $1-$2/$3in ');
  s = s.replace(new RegExp(`(?<![\\d/.-])(\\d+)/(\\d+)${UNIT}?(?![\\d/])`, 'g'), ' $1/$2in ');
  s = s.replace(new RegExp(`(?<![\\d/.-])(\\d*\\.\\d+)${UNIT}`, 'g'), (m, n) => ` ${DECIMALS[parseFloat(n)] || parseFloat(n)}in `);
  s = s.replace(new RegExp(`(?<![\\d/.-])(\\d+)${UNIT}`, 'g'), ' $1in ');
  return s;
}

export function keyOf(name) {
  let s = sizes(step1(name));
  s = s.replace(/[^a-z0-9\s/.\-]/g, ' ').replace(/(?<!\d)-|-(?!\d)/g, ' ').replace(/(?<!\d)\.|\.(?!\d)/g, ' ');
  s = s.replace(/\btwenty two and a half\b/g, '22.5').replace(/\bpro press\b/g, 'propress').replace(/\bshark bite\b/g, 'sharkbite')
    .replace(/\b(?:ells?|els?)\b/g, 'elbow').replace(/\bcouplers?\b/g, 'coupling')
    .replace(/\bninety\b/g, '90').replace(/\bforty five\b/g, '45');
  const words = s.split(/\s+/).filter((w) => w && !FILLER_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
  return words.join(' ');
}

const tokens = (k) => (k ? k.split(' ') : []);
const allNames = (p) => [p.name, ...(p.other || [])];

export function strictFind(parts, name) {
  const k = keyOf(name);
  if (!k) return null;
  return parts.find((p) => keyOf(p.name) === k) || null;
}

// returns { part } | { none: true } | { ambiguous: [names sorted] }
export function smartLookup(parts, name) {
  const k = keyOf(name);
  if (!k) return { none: true };
  const ambiguous = (list) => ({ ambiguous: list.map((p) => p.name).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })) });
  const exact = parts.filter((p) => allNames(p).some((n) => keyOf(n) === k));
  if (exact.length === 1) return { part: exact[0] };
  if (exact.length > 1) return ambiguous(exact);
  const want = tokens(k);
  const partial = parts.filter((p) => allNames(p).some((n) => {
    const have = tokens(keyOf(n));
    return want.every((t) => have.includes(t));
  }));
  if (partial.length === 1) return { part: partial[0] };
  if (partial.length > 1) return ambiguous(partial);
  return { none: true };
}

export function searchMatch(p, text) {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  const names = allNames(p);
  if (names.some((n) => n.toLowerCase().includes(t))) return true;
  const want = tokens(keyOf(t));
  if (!want.length) return false;
  const pools = names.map((n) => tokens(keyOf(n)));
  return want.every((w) => pools.some((pool) => pool.some((tok) => tok.includes(w))));
}

// ---------- reading a list ----------
const FILLER = /^(?:i['’]m using|im using|i used|we used|i have|there are|add|used|using|plus)(?![a-z0-9])\s*/i;
const SPLIT = /\r?\n|,|;|&|\band\b(?!\s+(?:a\s+half|a\s+quarter|one\s+half|one\s+quarter)\b)/i;
const SPOKEN_START = /^(?:(?:one|an?) inch(?:es)?\b|(?:two|three|four) inch(?:es)?\b|one and (?:a|one) (?:half|quarter) inch|(?:one|a) half(?: an)? inch|(?:a )?quarter inch|three (?:eighths?|quarters?|fourths?) inch|five eighths? inch)/;

function splitQty(c) {
  let m = c.match(/^(\d+)\s+(\S[\s\S]*)$/);
  if (m) {
    const inName = /^\d+\s*(?:°|degrees?\b|deg\b|"|”|″|inch(?:es)?\b|in\b)/i.test(c) || /^\d+\s+(?:\d+\/\d+|[½¼¾])/.test(c);
    return inName ? { qty: 1, name: c } : { qty: parseInt(m[1], 10), name: m[2] };
  }
  m = c.match(/^([a-z]+)\s+(\S[\s\S]*)$/i);
  if (m && Object.prototype.hasOwnProperty.call(NUMWORDS, m[1].toLowerCase())) {
    const n = step1(c).trim();
    if (!SPOKEN_START.test(n) && !/^[a-z]+\s+(?:degrees?|deg)\b/.test(n)) return { qty: NUMWORDS[m[1].toLowerCase()], name: m[2] };
  }
  return { qty: 1, name: c };
}

// returns [{ name, qty }] — not combined
export function parseList(text) {
  const out = [];
  for (let c of text.split(SPLIT)) {
    c = (c || '').trim().replace(/\.$/, '').trim();
    for (let i = 0; i < 4; i++) {
      const n = c.replace(FILLER, '').trim();
      if (n === c) break;
      c = n;
    }
    const { qty, name } = splitQty(c);
    const nm = name.trim().replace(/\s+/g, ' ');
    if (!nm || qty < 1) continue;
    out.push({ name: nm, qty });
  }
  return out;
}

export const ambiguousMessage = (name, list) => `${name} could be more than one part: ${list.join(', ')}. Say or type more of the name.`;
