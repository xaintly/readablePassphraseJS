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
