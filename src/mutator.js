import { ReadablePassphrase } from './readable-passphrase.js';

function parseSpec(spec) {
	if (spec.length) spec = { type: spec[0], count: spec[1] };
	if (spec.type !== 'none' && (!spec.count || Number.isNaN(spec.count) || spec.count < 1)) spec.count = 0;
	return spec;
}

/**
 *  This object mutates a generated phrase by adding uppercase letters and/or embedded numbers.
 */
export class RPMutator {
	/**
	 *  @param {(string|object)} [mutatorSpec] - either a string name of a predefined mutator (see RPMutator.mutators),
	 *    or an object with 'upper' and 'numbers' properties (each a { type, count } spec or a [ type, count ] array)
	 */
	constructor(mutatorSpec) {
		this.upper = { type: 'none' };
		this.numbers = { type: 'none' };

		if (!mutatorSpec) return;
		if (typeof mutatorSpec === 'string') mutatorSpec = RPMutator.mutators[mutatorSpec];

		this.upper = parseSpec(mutatorSpec.upper);
		this.numbers = parseSpec(mutatorSpec.numbers);
	}

	/**
	 *  Mutate a string according to the mutator specification
	 *  @param {string} string - a string to mutate, should be multiple words with spaces in between
	 *  @return {string} a mutated string
	 */
	mutate(string) {
		// Normalize to NFC first (collapses eg. "e" + combining acute accent into a single "é"
		// codepoint) and slice by codepoint rather than raw UTF-16 index everywhere below, so
		// inserting a letter/number can't land in the middle of a surrogate pair or a
		// not-yet-composed accent and corrupt the character it touches.
		const words = string.normalize('NFC').split(' '); // we already have parts[], but a part might have multiple words in it
		if (this.upper && this.upper.type !== 'none') {
			let count = this.upper.count || ReadablePassphrase.randomInt(words.length) + 1;
			if (count > words.length) count = words.length;

			const availableWords = [];
			const chosenUpper = [];
			for (let i = 0; i < words.length; i++) availableWords.push(i);
			while (count-- > 0) chosenUpper.push(availableWords.splice(ReadablePassphrase.randomInt(availableWords.length), 1));
			const upperTechniques = ['StartOfWord', 'WholeWord', 'Anywhere', 'RunOfLetters'];
			const upperType = this.upper.type;
			chosenUpper.forEach((wordNumber) => {
				const chars = Array.from(words[wordNumber]);
				let thisTechnique = upperType;
				let start = 0;
				let end = 0;
				if (thisTechnique === 'random') thisTechnique = upperTechniques[ReadablePassphrase.randomInt(upperTechniques.length)];
				switch (thisTechnique) {
					case 'StartOfWord':
						end = 1;
						break;
					case 'WholeWord':
						end = chars.length;
						break;
					case 'Anywhere':
						start = ReadablePassphrase.randomInt(chars.length);
						end = start + 1;
						break;
					case 'RunOfLetters':
						start = ReadablePassphrase.randomInt(chars.length - 1);
						end = start + 2 + ReadablePassphrase.randomInt(chars.length - start);
						break;
					default:
						throw new Error(`Unknown word uppercasing technique: ${thisTechnique}`);
				}
				words[wordNumber] = chars.slice(0, start).join('') + chars.slice(start, end).join('').toUpperCase() + chars.slice(end, chars.length).join('');
			});
		}
		if (this.numbers && this.numbers.type !== 'none') {
			let count = this.numbers.count || ReadablePassphrase.randomInt(5) + 1;
			while (count-- > 0) {
				let thisTechnique = this.numbers.type;
				if (thisTechnique === 'StartOrEndOfWord') thisTechnique = ReadablePassphrase.randomness(2) >= 1 ? 'StartOfWord' : 'EndOfWord';
				const chosenWord = thisTechnique === 'EndOfPhrase' ? words.length - 1 : ReadablePassphrase.randomInt(words.length);
				let thisWord = words[chosenWord];
				const thisNumber = ReadablePassphrase.randomInt(10).toString();
				switch (thisTechnique) {
					case 'StartOfWord':
						thisWord = thisNumber + thisWord;
						break;
					case 'EndOfWord':
					case 'EndOfPhrase':
						thisWord += thisNumber;
						break;
					case 'random':
					case 'Anywhere': {
						const chars = Array.from(thisWord);
						const thisPosition = ReadablePassphrase.randomInt(chars.length);
						thisWord = chars.slice(0, thisPosition).join('') + thisNumber + chars.slice(thisPosition, chars.length).join('');
						break;
					}
					default:
						throw new Error(`Unknown number insertion technique: ${thisTechnique}`);
				}
				words[chosenWord] = thisWord;
			}
		}
		return words.join(' ');
	}

	/**
	 *  Estimate the entropy added by a mutator
	 *  (actual entropy would vary based on number & length of words in the string)
	 *  @return {number} floating-point number of bits
	 */
	entropy() {
		const averageNumberOfWords = 9;
		const averageWordLength = 5;
		let entropy = 0;
		if (this.upper && this.upper.type !== 'none') {
			const count = this.upper.count || Math.floor(averageNumberOfWords / 2);
			let thisEntropy = Math.log2(averageNumberOfWords); // choice of a random word

			switch (this.upper.type) {
				case 'StartOfWord':
				case 'WholeWord':
					thisEntropy += 0; // these are predictable, so no bonus for position
					break;
				case 'Anywhere':
					thisEntropy += Math.log2(averageWordLength);
					break;
				case 'RunOfLetters':
					thisEntropy += Math.log2(averageWordLength) * 2;
					break;
				case 'random':
					// 2 bits for choice of 4, then average entropy of choices
					thisEntropy += 2 + (Math.log2(averageWordLength) * 3) / 5;
					break;
				default:
					throw new Error(`Unknown word uppercasing technique: ${this.upper.type}`);
			}

			entropy += thisEntropy * count;
		}
		if (this.numbers && this.numbers.type !== 'none') {
			const count = this.numbers.count || ReadablePassphrase.randomInt(5) + 1;
			let thisEntropy = Math.log2(10); // random number
			switch (this.numbers.type) {
				case 'StartOfWord':
				case 'EndOfWord':
					thisEntropy += Math.log2(averageNumberOfWords); // choice of word
					break;
				case 'EndOfPhrase':
					thisEntropy += 0; // no bonus for fixed location
					break;
				case 'random':
				case 'Anywhere':
					thisEntropy += Math.log2(averageNumberOfWords) + Math.log2(averageWordLength);
					break;
				default:
					throw new Error(`Unknown number insertion technique: ${this.numbers.type}`);
			}

			entropy += thisEntropy * count;
		}
		return entropy;
	}
}

/**
 *  Predefined mutators
 */
RPMutator.mutators = {
	standard: { upper: ['WholeWord', 1], numbers: ['EndOfWord', 2] },
	random: { upper: ['random'], numbers: ['random'] },
};
