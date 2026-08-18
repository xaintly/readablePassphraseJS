# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

readablePassphraseJS is a JavaScript port of Murray Grant's C# "Readable Passphrase Generator". It generates random, grammatically-structured English sentences (e.g. "an orchid will oversee the fig") for use as memorable, high-entropy passphrases. It ships two ways from one ES module source: a browser `<script>` global bundle and an npm package (ESM + CJS). It has zero runtime dependencies.

## Commands

- `npm install` — installs the one devDependency (`tsup`, plus `typescript` which tsup requires internally).
- `npm run build` — builds `dist/` from `src/` via tsup (see `tsup.config.js`). Required before opening `passphraseJsDemo.html` or using the package from Node, since `dist/` is gitignored and not committed.
- `npm test` — runs `node --test`, which auto-discovers `test/*.test.js`. To run a single file: `node --test test/entropy.test.js`.
- Tests run directly against `src/` (no build needed to iterate on tests).

## Repository layout

- `src/` — ES module source, the single source of truth for both build targets.
  - `index.js` — barrel export (`ReadablePassphrase` default export, plus named exports). Imports `dictionary/index.js` first for its side effect of populating `RPWordList.*`.
  - `readable-passphrase.js` — the `ReadablePassphrase` class (main entry point) plus its statics (`randomness`, `randomInt`, `templates()`, `mutators()`, `entropyOf()`).
  - `rng.js` — isomorphic RNG: `globalThis.crypto.getRandomValues()` by default (works natively in browsers and Node ≥19), falls back to `Math.random()` with a one-time warning.
  - `mutator.js`, `random-factors.js`, `sentence-template.js`, `word.js`, `word-list.js` — the rest of the engine (see Architecture below).
  - `dictionary/` — dictionary data. `index.js` assembles `RPWordList.{nouns,verbs,adjectives,...}` from the category files (`nouns.js`, `verbs.js`, `adjectives.js`, `adverbs.js`, `speech-verbs.js`, `proper-nouns.js`, `prepositions.js`, `intransitive-verbs.js`, `small-lists.js`). Category files export plain array/object literals only, no logic — treat edits to word content as data edits, not code changes.
- `dist/` — build output (gitignored, not committed). `readable-passphrase.mjs`/`.cjs` for npm consumers (wired via `package.json` `exports`), `readable-passphrase.global.js` for `<script>` tag use (IIFE that assigns only `window.ReadablePassphrase`, `window.RPMutator`, `window.RPSentenceTemplate`; internal classes are not exposed globally).
- `test/` — `node:test` suite: `generation.test.js` (every template produces a non-empty phrase), `entropy.test.js` (entropy values are stable/finite/positive), `mutator.test.js`, `rng.test.js` (crypto default + `Math.random()` fallback behavior).
- `old/dict-readablepassphrase-uncompressed.js` — legacy artifact from the pre-refactor single-file version, kept only as a manually-maintained uncompressed reference; not part of the build and not kept in sync with `src/dictionary/*` automatically.
- `passphraseJsDemo.html` — standalone browser demo. Loads `dist/readable-passphrase.global.js` dynamically, defines `ReadablePassphrase_Callback()`, generates one example phrase per template. Run `npm run build` before opening it.
- `reference/` — static HTML API reference generated externally from JSDoc via `documentation.js`; no in-repo script regenerates it.
- `README.md` — primary usage/behavior documentation (templates, factors/modifiers, mutators, entropy, randomness, npm vs. browser usage). Consult it before changing template or mutator semantics.
- `CHANGELOG` — plain-text version history, newest at top.

## Architecture

- **`ReadablePassphrase(template, mutator)`** (`src/readable-passphrase.js`) — builds a phrase by walking a sentence template and appending words/clauses (`addNoun`, `addVerb`, `addClause`, etc.). `.toString()` renders the final phrase through the mutator. `ReadablePassphrase.randomness` (backed by `src/rng.js`) and `.randomInt` are the sole randomness source used throughout the engine — every other class calls through this static (not `rng.js` directly), so consumers can override `ReadablePassphrase.randomness` to swap in their own RNG and have it apply everywhere.
- **`RPSentenceTemplate`** (`sentence-template.js`) — defines a sentence as an array of part specs (`noun`, `verb`, `conjunction`, `directSpeech`). `RPSentenceTemplate.templates` holds all predefined templates (`normal`, `strong`, `insane`, their `*And`/`*Speech`/`*Required`/`*Equal` variants) plus meta-templates (`random`, `randomShort`, `randomLong`, `randomForever`) that pick among the others. `.byName()` resolves a name (recursing through meta-templates); `.entropy()`/`.entropyOf()` compute bits of entropy.
- **`RPRandomFactors`** (`random-factors.js`) — the modifier ("factor") system used by noun/verb specs: weighted choices (e.g. `{ common: 1, proper: 4 }`) and weighted booleans (`[trueWeight, falseWeight]`). `chanceOf`, `mustBeTrue`, `entropyOf` operate on these; `RPRandomFactors.computeFactor` does the actual weighted random pick.
- **`RPMutator`** (`mutator.js`) — post-processes a generated phrase to add uppercase letters and/or embedded numbers. Predefined mutators (`standard`, `random`) live in `RPMutator.mutators`. `.mutate()` applies the transform; `.entropy()` estimates added entropy.
- **`RPWord`** (`word.js`) / **`RPWordList*` family** (`word-list.js`: `RPWordList`, `RPWordListPlural`, `RPWordListVerb`, `RPWordListArticle`, `RPWordListNumber`, `RPWordListIndefinitePronoun`, all real `extends RPWordList`/standalone classes) — typed wrappers around dictionary data that pick a random entry respecting grammatical constraints (tense, plurality, transitivity, definiteness).
- **Module load order matters**: `src/index.js` imports `dictionary/index.js` first (for its side effect of populating `RPWordList.nouns`/`.verbs`/etc.) before anything else can use word lists. Several modules import each other circularly by design (e.g. `word-list.js` ↔ `readable-passphrase.js`, for the `ReadablePassphrase.randomInt` override mechanism) — safe in ES modules because all cross-references happen inside method bodies invoked later, never at module-evaluation time. Don't "fix" these into one-directional imports without preserving that deferred-access property.

### Template/factor spec format (needed when editing templates or dictionaries)

Sentence templates are arrays of part objects with a `type` (`noun`, `verb`, `conjunction`, `directSpeech`). Noun/verb parts carry factor specs — choices as `{option: weight, ...}` objects, booleans as `[trueWeight, falseWeight]` or plain booleans. All choice weights being 0 evaluates to `null` (only valid for a verb's `intransitive` factor); elsewhere it throws. Full field-by-field semantics (article/subtype/adjective/preposition/number/singular for nouns; subtype/adverb/interrogative/intransitive for verbs) are documented in README.md's "Templates" section — read it before adding/editing a template rather than reverse-engineering the compact array literals in `RPSentenceTemplate.templates`.

## Publishing

`package.json` is set up for npm publishing (`exports`, `files`, `engines`) but the package has **not** been published yet — that's a deliberate, not-yet-taken step. Don't run `npm publish` without explicit direction.
