import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReadablePassphrase, RPSentenceTemplate } from '../src/index.js';

for (const name of ReadablePassphrase.templates()) {
	test(`entropyOf("${name}") is a stable, positive, finite number`, () => {
		const first = RPSentenceTemplate.entropyOf(name);
		const second = RPSentenceTemplate.entropyOf(name);
		assert.equal(typeof first, 'number');
		assert.ok(Number.isFinite(first));
		assert.ok(first > 0);
		assert.equal(first, second, 'entropy should be deterministic for the same template');
	});
}

test('ReadablePassphrase.entropyOf adds mutator entropy to template entropy', () => {
	const templateOnly = ReadablePassphrase.entropyOf('normal');
	const withMutator = ReadablePassphrase.entropyOf('normal', 'standard');
	assert.ok(withMutator > templateOnly);
});
