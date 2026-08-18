import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomness } from '../src/rng.js';

test('randomness() defaults to [0, 1)', () => {
	const value = randomness();
	assert.ok(value >= 0 && value < 1);
});

test('randomness(multiplier) stays within [0, multiplier)', () => {
	for (let i = 0; i < 20; i++) {
		const value = randomness(10);
		assert.ok(value >= 0 && value < 10);
	}
});

test('falls back to Math.random() with a single warning when crypto is unavailable', async () => {
	const original = globalThis.crypto;
	Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
	try {
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args.join(' '));
		try {
			randomness(5);
			randomness(5);
		} finally {
			console.warn = originalWarn;
		}
		assert.equal(warnings.length, 1, 'should only warn once even after repeated fallback calls');
		assert.match(warnings[0], /falling back to Math\.random/);
	} finally {
		Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
	}
});
