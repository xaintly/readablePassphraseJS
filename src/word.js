/**
 *  This object represents a word in a sentence, plus some attributes that describe the type of word
 */
export class RPWord {
	/**
	 *  @param {(string|string[])} types  - a string, or array of strings describing the type of the word, eg [ 'verb', 'intransitive' ]
	 *  @param {string} value - the text representation of this word
	 */
	constructor(types, value) {
		this.value = value;
		this.types = {};
		this.addTypes(types);
	}

	/**
	 *  Add one or more types to this word
	 *  @param {(string|string[])} types  - a string, or array of strings describing the type of the word, eg [ 'verb', 'intransitive' ]
	 *  @return {RPWord} returns this RPWord object
	 */
	addTypes(types) {
		if (typeof types !== 'object') types = [types];
		types.forEach((type) => {
			this.types[type] = true;
		});
		return this;
	}

	/**
	 *  Returns true if the word has all the given types
	 *  @param {(string|string[])} types  - a string, or array of strings you want to check for, eg [ 'verb', 'transitive' ]
	 *  @return {boolean} true if the word has all the requested types, false if any are missing
	 */
	hasTypes(types) {
		if (typeof types !== 'object') types = [types];
		for (const type of types) {
			if (!this.types[type]) return false;
		}
		return true;
	}
}
