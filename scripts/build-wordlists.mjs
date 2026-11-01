// Regenerates src/data/guesses.json and src/data/answers.json from SCOWL
// (via the wordlist-english package). See WORDLISTS.md for sources and licenses.
//
// The answer list is versioned: any change to answers.json changes which word
// falls on which day, so bump ANSWERS_VERSION in src/game/puzzle.ts with it.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('wordlist-english/package.json'));
const outDir = new URL('../src/data/', import.meta.url);

const SIZES = [10, 20, 35, 40, 50, 55, 60, 70];
const VARIANTS = ['english', 'american', 'british'];
const FIVE = /^[a-z]{5}$/;

function load(maxSize) {
  const words = new Set();
  for (const variant of VARIANTS) {
    for (const size of SIZES.filter((s) => s <= maxSize)) {
      const file = join(pkgDir, `${variant}-words-${size}.json`);
      for (const word of JSON.parse(readFileSync(file, 'utf8'))) words.add(word);
    }
  }
  return words;
}

const all = load(70);

// Words ending in -er that are base words, not comparatives or agent nouns.
const ER_BASE = new Set([
  'after', 'under', 'never', 'water', 'other', 'paper', 'power', 'order', 'river', 'enter',
  'offer', 'cover', 'lower', 'upper', 'tower', 'fever', 'lever', 'timer', 'cider', 'diner',
]);

function isInflected(w) {
  if (w.endsWith('s') && (all.has(w.slice(0, -1)) || (w.endsWith('es') && all.has(w.slice(0, -2))))) return true;
  if (w.endsWith('ed') && (all.has(w.slice(0, -2)) || all.has(w.slice(0, -1)))) return true;
  if (w.endsWith('ing')) return true;
  if (w.endsWith('er') && all.has(w.slice(0, -2)) && !ER_BASE.has(w)) return true;
  if (w.endsWith('ly') && all.has(w.slice(0, -2))) return true;
  if (w.endsWith('est') && all.has(w.slice(0, -3))) return true;
  return false;
}

// Removed during manual review of the common-word candidates.
const EXCLUDED_ANSWERS = new Set([
  // Insults, slurs-adjacent, or upsetting as a daily answer
  'abuse', 'bigot', 'idiot', 'moron', 'slave', 'vomit', 'dummy',
  // Inflected forms the suffix filter misses
  'cried', 'cries', 'dried', 'dries', 'flied', 'flies', 'fried', 'fries', 'spies', 'tried',
  'tries', 'pends', 'rarer', 'nicer', 'safer', 'wider', 'wiser', 'taker', 'undid', 'spelt',
  // Spelling differs between US and UK English
  'color', 'favor', 'honor', 'humor', 'labor', 'rumor', 'litre', 'metre', 'fibre', 'mould',
  'appal', 'lorry', 'pence', 'fiver', 'prise',
  // Jargon, abbreviations, or proper-noun leaning
  'debug', 'datum', 'circa', 'ditto', 'inter', 'unset', 'roman', 'bible',
]);

const guesses = [...all].filter((w) => FIVE.test(w)).sort();
const answers = [...load(20)]
  .filter((w) => FIVE.test(w) && !isInflected(w) && !EXCLUDED_ANSWERS.has(w))
  .sort();

const guessSet = new Set(guesses);
const missing = answers.filter((w) => !guessSet.has(w));
if (missing.length) throw new Error(`Answers missing from guesses: ${missing.join(', ')}`);

writeFileSync(new URL('guesses.json', outDir), JSON.stringify(guesses) + '\n');
writeFileSync(new URL('answers.json', outDir), JSON.stringify(answers) + '\n');
console.log(`guesses: ${guesses.length}, answers: ${answers.length}`);
