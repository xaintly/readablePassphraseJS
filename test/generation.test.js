import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReadablePassphrase } from '../src/index.js';

test('lists at least the documented predefined templates', () => {
	const templates = ReadablePassphrase.templates();
	assert.ok(Array.isArray(templates));
	for (const name of ['normal', 'random', 'randomShort', 'randomLong', 'randomForever']) {
		assert.ok(templates.includes(name), `expected templates() to include "${name}"`);
	}
});

for (const name of ReadablePassphrase.templates()) {
	test(`generates a non-empty phrase for template "${name}"`, () => {
		const phrase = new ReadablePassphrase(name).toString();
		assert.equal(typeof phrase, 'string');
		assert.ok(phrase.length > 0);
	});
}

test('generating with no template produces an empty phrase', () => {
	assert.equal(new ReadablePassphrase().toString(), '');
});

test('toString() accepts a separator override that only changes how words are joined', () => {
	// No mutator is passed, so there's no per-call randomization - the word list is fixed and
	// every toString() call below re-joins the exact same words, just with a different separator.
	const phrase = new ReadablePassphrase('normal');
	const words = phrase.toString().split(' ');
	assert.equal(phrase.toString('-'), words.join('-'));
	assert.equal(phrase.toString(''), words.join(''));
});

test('toString() with no argument still defaults to a space', () => {
	const phrase = new ReadablePassphrase('normal');
	assert.ok(!phrase.toString().includes('undefined'));
	assert.ok(phrase.toString().includes(' '));
});
