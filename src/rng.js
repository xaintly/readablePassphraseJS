/**
 *  Isomorphic cryptographically-strong random source.
 *  Uses globalThis.crypto.getRandomValues(), available natively in browsers and in Node.js >= 19
 *  with no import required. Falls back to Math.random() (with a one-time console warning) only if
 *  globalThis.crypto is genuinely unavailable.
 */

let warnedFallback = false;

function hasCrypto() {
	return typeof globalThis.crypto === 'object' && typeof globalThis.crypto.getRandomValues === 'function';
}

function cryptoRandom() {
	const buf = new Uint32Array(1);
	globalThis.crypto.getRandomValues(buf);
	return buf[0] / 0x100000000; // normalize to [0, 1)
}

/**
 *  Get a random, floating-point number between 0 and multiplier (including 0, but not including multiplier)
 *  @param {number} [multiplier=1]
 *  @return {number}
 */
export function randomness(multiplier) {
	const m = multiplier || 1;
	if (hasCrypto()) return cryptoRandom() * m;

	if (!warnedFallback) {
		console.warn(
			'readable-passphrase: globalThis.crypto is unavailable; falling back to Math.random(), ' +
				'which is NOT cryptographically secure. Consider upgrading your environment or providing ' +
				'ReadablePassphrase.randomness yourself.',
		);
		warnedFallback = true;
	}
	return Math.random() * m;
}
