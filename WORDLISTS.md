# Word lists

Wordly keeps two lists. Accepted guesses are broad; answers are a smaller reviewed subset, so obscure or unsuitable words can never become a solution. Neither list comes from, or is checked against, the dictionary API.

| File | Contents | Count |
|---|---|---|
| `src/data/guesses.json` | Accepted guesses | 6,476 |
| `src/data/answers.json` | Possible answers (all also accepted as guesses) | 811 |

Regenerate both with `npm run wordlists` (`scripts/build-wordlists.mjs`).

## Source

- **SCOWL** (Spell Checker Oriented Word Lists) by Kevin Atkinson, http://wordlist.aspell.net/, as packaged in the npm module [`wordlist-english`](https://github.com/jacksonrayhamilton/wordlist-english) v1.2.1 by Jackson Ray Hamilton (MIT).
- **SCOWL license:** permissive. "Permission to use, copy, modify, distribute and sell these word lists, the associated scripts, the output created from the scripts, and its documentation for any purpose is hereby granted without fee, provided that the above copyright notice appears in all copies and that both that copyright notice and this permission notice appear in supporting documentation." Copyright 2000-2016 by Kevin Atkinson; component lists carry their own notices, reproduced in full in `node_modules/wordlist-english/Copyright`. Keep that notice with any redistribution of the generated lists.

## How the lists are built

**Guesses:** every lowercase, purely alphabetic five-letter word in the `english`, `american`, and `british` lists up to SCOWL size 70. Capitalized entries (proper nouns) are not included.

**Answers:** the same filter applied to only the most common sizes (10 and 20), then:

1. Inflected forms removed automatically (plurals, `-ed`, `-ing`, comparatives, `-ly` adverbs, superlatives) when their base word is in the list.
2. Manual review on 2026-11-01 removed the words listed in `EXCLUDED_ANSWERS` in the build script: insults and words that are upsetting as a daily answer, inflections the suffix filter missed, words spelled differently in US and UK English (so no region gets an unfair answer), and jargon or abbreviations.

## Changing the answer list

The daily answer is picked from a seeded shuffle of `answers.json`, and saved games store an id like `a1-305` (list version, day). Any change to the answers file or the seed changes which word lands on which day, so bump `ANSWERS_VERSION` in `src/game/puzzle.ts` at the same time. Saved games from the old version are then rejected with a visible notice instead of resolving to a different word.
