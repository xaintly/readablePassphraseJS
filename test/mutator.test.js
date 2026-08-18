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
