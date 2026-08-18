import { ReadablePassphrase } from './readable-passphrase.js';

/**
 *  This object represents a set of random factors.
 *  A factor is a name, followed by a specification.  If a spec is a boolean, string or number, then it will be returned as-is.
 *  If a spec is a 2-element array, then it will become a boolean with probability true A out of (A+B) times, eg [ 1, 4 ] is true 20% of the time.
 *  If a spec is an object, it will become a string with probability according to all values in the object, eg { a: 1, b: 2, c: 1, d: 0 } returns 'b' 50% of the time.
 */
export class RPRandomFactors {
	/**
	 *  @param {object} spec - an object describing the specification and weights of various factors
	 */
	constructor(spec) {
		for (const prop in spec) this[prop] = spec[prop];
	}

	/**
	 *  Get the value of a factor according to the weights assigned to it.
	 *  @param {string} factorName - name of the factor being requested
	 *  @return {string|boolean} returns the string (out of a set of choices) or boolean (out of a 2-element array) randomly chosen for this factor
	 */
	byName(factorName) {
		return RPRandomFactors.computeFactor(this[factorName]);
	}

	/**
	 *  Returns true if the given factor must always be true
	 *  @param {string} factorName - name of the factor
	 *  @return {boolean} true if the factor must always be true, false if there is any chance it might be false
	 */
	mustBeTrue(factorName) {
		return this.chanceOf(factorName, true) === 1;
	}

	/**
	 *  Returns the odds that a given factor will have the given value
	 *  @param {string} factorName - name of the factor
	 *  @param {*} value - possible value of the factor, or boolean to find out if the factor could be true/false at all
	 *  @return {number} floating-point probability between 0 and 1, eg 0.25
	 */
	chanceOf(factorName, value) {
		switch (typeof this[factorName]) {
			case 'boolean':
				value = Boolean(value);
				return this[factorName] === value ? 1 : 0;
			case 'string':
			case 'number':
				if (typeof value === 'boolean') {
					return value ? (this[factorName] ? 1 : 0) : (this[factorName] ? 0 : 1);
				}
				return this[factorName] === value ? 1 : 0;
			case 'object':
				if (this[factorName].length === undefined) {
					let total = 0;
					const thisWeight = this[factorName][value];
					for (const weightFactor in this[factorName]) {
						total += this[factorName][weightFactor];
					}
					if (!total) return 0;
					if (typeof value === 'boolean') {
						return value ? (total ? 1 : 0) : (total ? 0 : 1);
					}
					return thisWeight / total;
				} else if (this[factorName].length === 2) {
					const total = this[factorName][0] + this[factorName][1];
					return value ? this[factorName][0] / total : this[factorName][1] / total;
				}
			// falls through
			default:
				throw new Error(`Cannot compute chance of unknown object type: ${typeof this[factorName]} factor: ${factorName}`);
		}
	}

	/**
	 *  Returns the number of bits of entropy in a factor.  Eg a straight [ 1, 1 ] is a 50% chance = 1 bit
	 *  @param {string} factorName - name of the factor
	 *  @return {number} floating-point number of bits
	 */
	entropyOf(factorName) {
		switch (typeof this[factorName]) {
			case 'boolean':
			case 'string':
			case 'number':
				return 0;
			case 'object':
				if (this[factorName].length === undefined) {
					let total = 0;
					let totalEntropy = 0;
					for (const weightFactor in this[factorName]) total += this[factorName][weightFactor];
					for (const weightFactor in this[factorName]) {
						const thisChance = this[factorName][weightFactor] / total;
						if (thisChance) totalEntropy += Math.abs(thisChance * Math.log2(thisChance));
					}
					return totalEntropy;
				} else if (this[factorName].length === 2) {
					const a = this[factorName][0];
					const b = this[factorName][1];
					const total = a + b;
					return (a / total) * Math.log2(a / total) + (b / total) * Math.log2(b / total);
				}
			// falls through
			default:
				throw new Error(`Cannot compute chance of unknown object type: ${typeof this[factorName]} factor: ${factorName}`);
		}
	}

	/**
	 *  Static function that computes a random value for a specification, see the RPRandomFactors constructor for possible specs
	 *  @param {*} factor - specification
	 *  @return {*} value of the factor, randomly-chosen if possible
	 */
	static computeFactor(factor) {
		switch (typeof factor) {
			case 'boolean':
			case 'string':
			case 'number':
				return factor;
			case 'object':
				if (factor.length === undefined) {
					const weights = [];
					let totalWeight = 0;
					for (const weightFactor in factor) {
						totalWeight += factor[weightFactor];
						weights.push({ value: weightFactor, weight: totalWeight });
					}
					if (totalWeight === 0) return false;

					const chosenWeight = ReadablePassphrase.randomness(totalWeight);
					for (let checkWeight = 0; checkWeight < weights.length; checkWeight++) {
						if (chosenWeight < weights[checkWeight].weight) {
							return weights[checkWeight].value;
						}
					}
					return false;
				} else if (factor.length === 2) {
					const chosenWeight = ReadablePassphrase.randomness(factor[0] + factor[1]);
					return chosenWeight <= factor[0];
				}
				throw new Error('Unknown object type in computation');
			default:
				return null;
		}
	}
}
