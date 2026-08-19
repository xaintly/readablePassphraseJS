import { randomness } from './rng.js';
import { RPMutator } from './mutator.js';
import { RPRandomFactors } from './random-factors.js';
import { RPSentenceTemplate } from './sentence-template.js';
import { RPWordList, RPWordListVerb } from './word-list.js';

/**
 *  ReadablePassphrase objects generate random english sentences
 */
export class ReadablePassphrase {
	/**
	 *  @param {(string|object)} [template] - create a sentence using the given template (either a string name of a predefined template, or an RPSentenceTemplate object)
	 *  @param {(string|object)} [mutator]  - use a mutator to add random uppercase & numbers (either a string name of a predefined mutator, or an RPMutator object)
	 */
	constructor(template, mutator) {
		this.parts = [];
		this.length = 0;
		this.usedWords = {};
		this.mutator = new RPMutator(mutator);

		if (template) this.addTemplate(template);
	}

	/**
	 *  Get the string representation of the generated phrase
	 *  @param {string} [separator] - overrides the mutator's configured word separator for this call only
	 *    (eg. '-' or '' for password fields that don't accept spaces); defaults to ' '
	 *  @return {string} A phrase, eg "the milk will eat the angry decision"
	 */
	toString(separator) {
		const phrase = [];
		for (let wordNum = 0; wordNum < this.parts.length; wordNum++) phrase.push(this.parts[wordNum].value);
		return this.mutator.mutate(phrase.join(' '), separator);
	}

	// ****** methods called by addTemplate() *******

	/**
	 *  Add a template to the end of the current phrase.
	 *  Called automatically by the constructor if you pass a template to the constructor.
	 *  @param {(string|object)} template - use the given template (either a string name of a predefined template, or an RPSentenceTemplate object)
	 */
	addTemplate(template) {
		if (typeof template === 'string') template = RPSentenceTemplate.byName(template);
		this.template = template;
		for (let templateNumber = 0; templateNumber < template.length; templateNumber++) {
			const thisTemplate = template[templateNumber];
			const finalize = this.addClause(new RPRandomFactors(thisTemplate));
			if (finalize) break; // some verb templates cause premature completion
		}

		// Cleanup: 'a' before vowel => 'an'
		for (let wordNum = 0; wordNum < this.parts.length; wordNum++) {
			const thisWord = this.parts[wordNum];
			if (thisWord.hasTypes(['article', 'indefinite'])) {
				const nextWord = this.parts[wordNum + 1];
				if (!nextWord) break;
				if (nextWord.value.match(/^[aeiou]/)) thisWord.value = thisWord.indefiniteBeforeVowel;
			}
		}
	}

	/**
	 *  Get the last clause in the phrase, or null if the phrase is empty
	 *  @return {object} an RPWord object or null
	 */
	last() {
		return this.length > 0 ? this.parts[this.length - 1] : null;
	}

	/**
	 *  Add a clause to the current passphrase
	 *  @param {object} factors - an object representing a clause (see README for examples)
	 *  @return {boolean} returns true if no more clauses should be added after this
	 */
	addClause(factors) {
		switch (factors.type) {
			case 'noun':
				return this.addNoun(factors);
			case 'verb':
				return this.addVerb(factors);
			case 'conjunction':
				this.appendWord(RPWordList.conjunctions.getRandomWord(this.usedWords));
				return false;
			case 'directSpeech':
				this.appendWord(RPWordList.speechVerbs.getRandomWord(this.usedWords));
				return false;
			default:
				throw new Error(`Unexpected clause type: ${factors.type}`);
		}
	}

	/**
	 *  Add an RPWord object to the end of the current passphrase
	 *  @param {object} word - an RPWord object
	 *  @return {ReadablePassphrase} returns the current ReadablePassphrase object
	 */
	appendWord(word) {
		return this.insertWord(word, this.length);
	}

	/**
	 *  Insert an RPWord object at any position in the current passphrase
	 *  @param {object} word - an RPWord object
	 *  @param {number} position - a number representing the position in the current set of RPWords to add the new one
	 *  @return {ReadablePassphrase} returns the current ReadablePassphrase object
	 */
	insertWord(word, position) {
		this.parts.splice(position, 0, word);
		this.usedWords[word.value] = true;
		this.length++;
		return this;
	}

	/**
	 *  Add a Verb clause to the current passphrase
	 *  @param {object} factors - an object representing a verb clause (see README for examples)
	 *  @return {boolean} returns true if no more clauses should be added after this (triggered by some intransitive verbs)
	 */
	addVerb(factors) {
		// calculating whether the verb should be plural...
		let firstNoun = null;
		let firstIndefinitePronoun = null;
		let pluralVerb = null;
		let insertInterrogative = 0;
		for (let wordNumber = 0; wordNumber < this.length; wordNumber++) {
			const thisWord = this.parts[wordNumber];
			if (!firstNoun && thisWord.hasTypes('noun')) firstNoun = thisWord;
			else if (thisWord.hasTypes('speechVerb')) {
				firstNoun = null;
				insertInterrogative = wordNumber + 1;
			} else if (!firstIndefinitePronoun && thisWord.hasTypes('indefinitePronoun')) firstIndefinitePronoun = thisWord;
		}

		if (firstNoun) pluralVerb = firstNoun.hasTypes('plural');
		else if (firstIndefinitePronoun) pluralVerb = firstIndefinitePronoun.hasTypes('plural');
		else pluralVerb = false;

		let selectTransitive = true;
		let removeAccusativeNoun = false;
		let addPreposition = false;
		const intransitiveType = factors.byName('intransitive');

		if (intransitiveType && RPWordListVerb.getRandomTransitivity() === 'intransitive') {
			selectTransitive = false;
			switch (intransitiveType) {
				case 'noNounClause':
					removeAccusativeNoun = true;
					break;
				case 'preposition':
					addPreposition = true;
					break;
				default:
					throw new Error(`Unexpected intransitive type: ${intransitiveType}`);
			}
		}

		const makeInterrogative = factors.byName('interrogative');
		let tense = factors.byName('subtype');
		if (makeInterrogative) {
			this.insertWord(RPWordList.interrogatives.getRandomWord(pluralVerb), insertInterrogative, this.usedWords);
			pluralVerb = true;
			tense = 'presentPlural';
		}

		const includeAdverb = factors.byName('adverb') ? (randomness(2) >= 1 ? 'before' : 'after') : 'no';
		if (includeAdverb === 'before') this.appendWord(RPWordList.adverbs.getRandomWord(this.usedWords));

		this.appendWord(RPWordList[selectTransitive ? 'verbs' : 'intransitiveVerbs'].getRandomWord(tense, pluralVerb, this.usedWords));

		if (includeAdverb === 'after') this.appendWord(RPWordList.adverbs.getRandomWord(this.usedWords));
		if (addPreposition) this.appendWord(RPWordList.prepositions.getRandomWord(this.usedWords));

		if (removeAccusativeNoun) return true; // Returning true means the sentence is done
		return false;
	}

	/**
	 *  Add a Noun clause to the current passphrase
	 *  @param {object} factors - an object representing a noun clause (see README for examples)
	 *  @return {boolean} returns true if no more clauses should be added after this (currently always false)
	 */
	addNoun(factors) {
		const n = factors.byName('subtype');
		switch (n) {
			case 'common':
				return this.addCommonNoun(factors);
			case 'nounFromAdjective':
				return this.addNounFromAdjective(factors);
			case 'proper':
				this.appendWord(RPWordList.properNouns.getRandomWord(this.usedWords));
				return false;
			default:
				throw new Error(`Unknown noun subtype: ${n}`);
		}
	}

	/**
	 *  Add a common Noun clause to the current passphrase (eg. "dog", "cat", "justice")
	 *  @param {object} factors - an object representing a noun clause (see README for examples)
	 *  @return {boolean} returns true if no more clauses should be added after this (currently always false)
	 */
	addCommonNoun(factors) {
		const isPlural = this.addNounPrelude(factors);
		if (factors.byName('number') && (isPlural || factors.mustBeTrue('singular'))) {
			if (!isPlural && !(this.length && this.last().hasTypes(['article', 'indefinite']))) this.appendWord(RPWordList.numbers.getSingularNumberWord());
			else if (isPlural) this.appendWord(RPWordList.numbers.getPluralNumberWord());
		}

		if (factors.byName('adjective')) this.appendWord(RPWordList.adjectives.getRandomWord(this.usedWords));
		this.appendWord(RPWordList.nouns.getRandomWord(isPlural, this.usedWords));
		return false;
	}

	/**
	 *  Construct a Noun clause from an adjective and add it to the current passphrase, eg. "a green thing"
	 *  @param {object} factors - an object representing a noun clause (see README for examples)
	 *  @return {boolean} returns true if no more clauses should be added after this (currently always false)
	 */
	addNounFromAdjective(factors) {
		const isPlural = this.addNounPrelude(factors);
		this.appendWord(RPWordList.adjectives.getRandomWord(this.usedWords));
		const isPersonal = randomness(2) >= 1;
		this.appendWord(RPWordList.indefinitePronouns.getRandomWord(isPersonal, isPlural, this.usedWords));
		return false;
	}

	/**
	 *  Add a prelude to a noun to the current passphrase, eg. "before the"
	 *  @param {object} factors - an object representing a noun clause (see README for examples)
	 *  @return {boolean} returns true if the following noun should be plural
	 */
	addNounPrelude(factors) {
		if (factors.byName('preposition') && (!this.last() || !this.last().hasTypes('preposition'))) {
			this.appendWord(RPWordList.prepositions.getRandomWord(this.usedWords));
		}

		const isPlural = !factors.byName('singular');

		switch (factors.byName(isPlural ? 'articlePlural' : 'articleSingular')) {
			case 'none':
				break; // shouldn't come up for Singular
			case 'definite':
				this.appendWord(RPWordList.articles.getRandomDefiniteArticle());
				break;
			case 'indefinite':
				this.appendWord(RPWordList.articles.getRandomIndefiniteArticle());
				break; // shouldn't come up for Plural
			case 'demonstrative':
				this.appendWord(RPWordList.demonstratives.getRandomWord(isPlural));
				break;
			case 'personalPronoun':
				this.appendWord(RPWordList.personalPronouns.getRandomWord(isPlural, this.usedWords));
				break;
			default:
				throw new Error('Unknown case result from computeFactor');
		}

		return isPlural;
	}
}

/**
 *  Used by all ReadablePassphrase objects as a source of randomness. Defaults to a cryptographically
 *  strong source (see rng.js); replace this function to plug in your own randomness source.
 *  @param {number} [multiplier=1] - get a value between 0 and multiplier (including 0, but not including multiplier)
 *  @return {number} A random, floating-point number between 0 and 1 (or multiplier, if provided)
 */
ReadablePassphrase.randomness = randomness;

/**
 *  Convenience function: get a random integer
 *  @param {number} [multiplier=2] Get a random number between 0 and multiplier (including 0 but not including multiplier)
 *  @return {number} A random integer
 */
ReadablePassphrase.randomInt = function (multiplier) {
	return Math.floor(ReadablePassphrase.randomness(multiplier || 2));
};

/**
 *  Get a list of names of predefined templates
 *  @return {string[]} A list of predefined templates, in no particular order
 */
ReadablePassphrase.templates = function () {
	return Object.keys(RPSentenceTemplate.templates);
};

/**
 *  Get a list of names of predefined mutators
 *  @return {string[]} A list of predefined mutators, in no particular order
 */
ReadablePassphrase.mutators = function () {
	return Object.keys(RPMutator.mutators);
};

/**
 *  Get the number of bits of entropy in a template + mutator
 *  @param {string} template - name of the given template (not a template object)
 *  @param {(string|object)} [mutator]  - either a string name of a predefined mutator, or an RPMutator object
 *  @return {number} floating-point number of bits
 */
ReadablePassphrase.entropyOf = function (template, mutator) {
	mutator = mutator ? new RPMutator(mutator) : null;
	return RPSentenceTemplate.entropyOf(template) + (mutator ? mutator.entropy() : 0);
};
