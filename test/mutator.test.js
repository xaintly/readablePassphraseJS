import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReadablePassphrase, RPMutator } from '../src/index.js';

for (const name of ReadablePassphrase.mutators()) {
	test(`mutator "${name}" mutates a phrase and reports positive entropy`, () => {
		const mutator = new RPMutator(name);
		const mutated = mutator.mutate('the quick brown fox jumps');
		assert.equal(typeof mutated, 'string');
		assert.ok(mutated.length > 0);
		assert.ok(Number.isFinite(mutator.entropy()));
		assert.ok(mutator.entropy() > 0);
	});
}

test('no mutator spec leaves a phrase unchanged', () => {
	const mutator = new RPMutator();
	assert.equal(mutator.mutate('the quick brown fox'), 'the quick brown fox');
	assert.equal(mutator.entropy(), 0);
});

function isWellFormedUtf16(string) {
	try {
		encodeURIComponent(string); // throws URIError on an unpaired surrogate
		return true;
	} catch {
		return false;
	}
}

// The dictionary is plain ASCII today, but the mutator's uppercase/number insertion works by
// slicing a word at a random position - these guard against the position landing inside a
// multi-code-unit character (an astral codepoint like an emoji, or a not-yet-composed accent)
// and corrupting it, which would otherwise only surface later if non-ASCII content is ever added.
test('mutating a word containing an astral codepoint (surrogate pair) never produces malformed UTF-16', () => {
	const mutator = new RPMutator({ upper: { type: 'random' }, numbers: { type: 'random' } });
	const emoji = '\u{1F389}'; // outside the BMP - a surrogate pair in UTF-16
	for (let i = 0; i < 50; i++) {
		const mutated = mutator.mutate(`tada${emoji}party favors`);
		assert.ok(isWellFormedUtf16(mutated), `malformed output: ${JSON.stringify(mutated)}`);
		assert.ok(mutated.includes(emoji), `emoji codepoint was split apart: ${JSON.stringify(mutated)}`);
	}
});

test('mutating a decomposed accented character (combining mark) composes it before slicing', () => {
	const mutator = new RPMutator({ upper: { type: 'random' }, numbers: { type: 'random' } });
	const combiningAcuteAccent = '́';
	const decomposedEclair = `e${combiningAcuteAccent}clair`; // "e" + combining accent, not precomposed "é"
	for (let i = 0; i < 50; i++) {
		const mutated = mutator.mutate(`${decomposedEclair} party`);
		assert.ok(!mutated.includes(combiningAcuteAccent), `combining accent was left detached: ${JSON.stringify(mutated)}`);
	}
});
