import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RPWordListPlural, RPWordListVerb } from '../src/word-list.js';
import { compressNouns, compressVerbs } from '../scripts/dictionary-compression.js';
import nounsSource from '../src/dictionary/source/nouns.js';
import verbsSource from '../src/dictionary/source/verbs.js';
import intransitiveVerbsSource from '../src/dictionary/source/intransitive-verbs.js';

// Compressing the readable dictionary source must be lossless: expanding the compressed output
// through the real engine classes must reproduce exactly the same words as expanding the
// uncompressed source directly. This is the safety net for scripts/dictionary-compression.js —
// it uses the same expansion logic already trusted in production as the correctness oracle,
// rather than trusting a second, hand-written "decompressor".

test('noun compression round-trips losslessly', () => {
	const compressed = compressNouns(nounsSource);
	const fromSource = new RPWordListPlural('noun', [...nounsSource]);
	const fromCompressed = new RPWordListPlural('noun', compressed);
	assert.deepEqual(fromCompressed.list, fromSource.list);
});

test('transitive verb compression round-trips losslessly', () => {
	const compressed = compressVerbs(verbsSource);
	const fromSource = new RPWordListVerb('transitive', verbsSource);
	const fromCompressed = new RPWordListVerb('transitive', compressed);
	assert.deepEqual(
		fromCompressed.list.map((w) => w.value),
		fromSource.list.map((w) => w.value),
	);
});

test('intransitive verb compression round-trips losslessly', () => {
	const compressed = compressVerbs(intransitiveVerbsSource);
	const fromSource = new RPWordListVerb('intransitive', intransitiveVerbsSource);
	const fromCompressed = new RPWordListVerb('intransitive', compressed);
	assert.deepEqual(
		fromCompressed.list.map((w) => w.value),
		fromSource.list.map((w) => w.value),
	);
});
