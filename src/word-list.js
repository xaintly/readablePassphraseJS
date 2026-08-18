import { RPWord } from './word.js';
import { ReadablePassphrase } from './readable-passphrase.js';
import { RPRandomFactors } from './random-factors.js';

/**
 *  This object represents a pool of words of a similar type, with the assumption that you will request random members from the pool
 */
export class RPWordList {
	/**
	 *  @param {string} type  - a string describing the type of all words in this list
	 *  @param {string[]} wordArray - an array of words
	 */
	constructor(type, wordArray) {
		this.list = wordArray;
		this.type = type;
		this.length = wordArray.length;
	}

	/**
	 *  Get a random word from the pool.
	 *  Note that passing alreadyChosen{} actually weakens the overall strength of the passphrase slightly
	 *  @param {object} [alreadyChosen] - if a hash of words that are already chosen is provided, this will avoid returning one already chosen
	 *  @return {RPWord} the chosen word
	 */
	getRandomWord(alreadyChosen) {
		let word;
		let attempts = 100;
		do {
			word = this.list[ReadablePassphrase.randomInt(this.length)];
			if (attempts-- < 1) throw new Error(`Exceeded max attempts in RPWordList.getRandomWord() for type ${this.type}`);
		} while (alreadyChosen && alreadyChosen[word]);
		return new RPWord(this.type, word);
	}
}

/**
 *  This object represents a pool of word pairs of a similar type, with the first element in each pair being the singular form and the second the plural
 */
export class RPWordListPlural extends RPWordList {
	/**
	 *  @param {string} type  - a string describing the type of all words in this list
	 *  @param {object[]} pluralWordArray - an array of word pairs, eg [[ 'mouse', 'mice' ], ['dog','dogs' ]]
	 */
	constructor(type, pluralWordArray) {
		super(type, pluralWordArray);
		for (let wordNum = 0; wordNum < this.list.length; wordNum++) {
			const thisWord = this.list[wordNum];
			if (typeof thisWord === 'string') this.list[wordNum] = [thisWord, thisWord + 's'];
		}
	}

	/**
	 *  Get a random word from the pool.
	 *  Note that passing alreadyChosen{} actually weakens the overall strength of the passphrase slightly
	 *  @param {boolean} [isPlural] - true if the plural form of the word is being requested
	 *  @param {object} [alreadyChosen] - if a hash of words that are already chosen is provided, this will avoid returning one already chosen
	 *  @return {RPWord} the chosen word
	 */
	getRandomWord(isPlural, alreadyChosen) {
		let word = null;
		let attempts = 100;
		do {
			word = this.list[ReadablePassphrase.randomInt(this.length)][isPlural ? 1 : 0];
			if (attempts-- < 1) throw new Error(`Exceeded max attempts in RPWordListPlural.getRandomWord() for type ${this.type}`);
		} while (!word || (alreadyChosen && alreadyChosen[word]));
		return new RPWord([this.type, isPlural ? 'plural' : 'singular'], word);
	}
}

/**
 *  This object represents a pool of verbs, with each verb having multiple possible tenses
 */
export class RPWordListVerb {
	/**
	 *  @param {string} transitiveType  - either 'transitive' or 'intransitive' depending on the type of verbs in the list
	 *  @param {object[]} verbArray - an array of verbs, each represented as a 14-element array of tenses (see RPWordListVerb.tenses for order)
	 */
	constructor(transitiveType, verbArray) {
		this.list = [];

		if (typeof RPWordListVerb.tenses[0] === 'string') {
			// compile the tenses (once, the first time any list is constructed)
			for (let specNum = 0; specNum < RPWordListVerb.tenses.length; specNum++) {
				const thisSpec = RPWordListVerb.tenses[specNum];
				const specObj = { fullTense: thisSpec, tense: null, continuous: false, plural: false };
				const tenseMatch = thisSpec.match(/^(past|present|future|perfect|subjunctive)/);
				if (tenseMatch) specObj.tense = tenseMatch[0];
				if (thisSpec.match(/Continuous/)) specObj.continuous = true;
				if (thisSpec.match(/Plural/)) specObj.plural = true;
				RPWordListVerb.tenses[specNum] = specObj;
			}
		}

		for (let verbNum = 0; verbNum < verbArray.length; verbNum++) {
			let thisVerb = verbArray[verbNum];
			if (typeof thisVerb === 'string') thisVerb = [thisVerb];
			const baseWord = thisVerb[0];
			const baseWordTrim = thisVerb[0].replace(/e$/, '');
			for (let specNum = 0; specNum < RPWordListVerb.tenses.length; specNum++) {
				const thisSpec = RPWordListVerb.tenses[specNum];
				let thisWord = thisVerb[specNum] || RPWordListVerb.unpackDefaults[specNum];
				thisWord = thisWord.replace('&1e', `${baseWordTrim}e`).replace('&1i', `${baseWordTrim}i`).replace('&1', baseWord);
				const types = ['verb', thisSpec.fullTense, thisSpec.tense, thisSpec.plural ? 'plural' : 'singular', transitiveType];
				if (thisSpec.continuous) types.push('continuous');
				this.list.push(new RPWord(types, thisWord));
			}
		}
		this.length = this.list.length;
	}

	/**
	 *  Returns 'transitive' or 'intransitive', biased toward whichever pool is bigger.  Eg, 5 transitive + 1 intransitive returns 'transitive' 5:1
	 *  @return {string} 'transitive' or 'intransitive'
	 */
	static getRandomTransitivity() {
		return RPRandomFactors.computeFactor([RPWordList.verbs.length, RPWordList.intransitiveVerbs.length]) ? 'transitive' : 'intransitive';
	}

	/**
	 *  Get a random word from the pool.
	 *  Note that passing alreadyChosen{} actually weakens the overall strength of the passphrase slightly
	 *  @param {string} [tense] - name of the tense being requested, eg. 'pastContinuousPlural'
	 *  @param {boolean} [isPlural] - true if the plural form of the word is being requested
	 *  @param {object} [alreadyChosen] - if a hash of words that are already chosen is provided, this will avoid returning one already chosen
	 *  @return {RPWord} the chosen word
	 */
	getRandomWord(tense, isPlural, alreadyChosen) {
		const types = [];
		if (typeof isPlural === 'boolean') types.push(isPlural ? 'plural' : 'singular');
		if (tense && tense === 'continuousPast') types.push('continuous', 'past');
		else if (tense) types.push(tense);

		const options = [];
		for (let wordNum = 0; wordNum < this.list.length; wordNum++) {
			const thisWord = this.list[wordNum];
			if ((!alreadyChosen || !alreadyChosen[thisWord.value]) && thisWord.hasTypes(types)) options.push(thisWord);
		}
		if (!options.length) throw new Error('No verbs match criteria!');
		return options[ReadablePassphrase.randomInt(options.length)];
	}
}

/**
 *  Tenses of each element in a verb passed to RPWordListVerb, in order
 */
RPWordListVerb.tenses = [
	'presentPlural', 'presentSingular', 'futurePlural', 'futureSingular',
	'pastContinuousPlural', 'pastContinuousSingular', 'pastPlural', 'pastSingular',
	'perfectPlural', 'perfectSingular', 'presentContinuousPlural', 'presentContinuousSingular',
	'subjunctivePlural', 'subjunctiveSingular',
];

/**
 *  Default unpacking technique for simple verbs; &1 is replaced by the first (base) word
 */
RPWordListVerb.unpackDefaults = [
	'', '&1s', 'will &1', 'will &1', 'were &1ing', 'was &1ing', '&1ed', '&1ed',
	'have &1ed', 'has &1ed', 'are &1ing', 'is &1ing', 'might &1', 'might &1',
];

/**
 *  This object represents a pool of random articles.  Currently there is only 1 article in the list "a", "an" or "the"
 */
export class RPWordListArticle {
	/**
	 *  @param {object[]} articleArray - an array of article objects {definite: ..., indefinite: ..., indefiniteBeforeVowel: ...}
	 */
	constructor(articleArray) {
		this.list = articleArray;
		this.length = articleArray.length;
	}

	/**
	 *  Get a random definite article from the pool.  Currently always returns 'the'
	 *  @return {RPWord} the chosen word
	 */
	getRandomDefiniteArticle() {
		return this.getRandomWord(true);
	}

	/**
	 *  Get a random indefinite article from the pool.  Currently always returns 'a'/'an'
	 *  @return {RPWord} the chosen word
	 */
	getRandomIndefiniteArticle() {
		return this.getRandomWord(false);
	}

	/**
	 *  Get a random article from the pool
	 *  @param {boolean} definite - if true, returns a definite article (eg. 'the'), otherwise an indefinite one.
	 *  @return {RPWord} the chosen word
	 */
	getRandomWord(definite) {
		const word = this.list[ReadablePassphrase.randomInt(this.list.length)];
		const returnWord = new RPWord(['article', definite ? 'definite' : 'indefinite'], definite ? word.definite : word.indefinite);
		if (!definite) returnWord.indefiniteBeforeVowel = word.indefiniteBeforeVowel;
		return returnWord;
	}
}

/**
 *  This object represents a pool of random numbers.
 */
export class RPWordListNumber {
	/**
	 *  @param {number} start - the lowest number to return
	 *  @param {number} end - the highest number to return
	 */
	constructor(start, end) {
		this.start = start;
		this.end = end;
		this.length = 1 + end - start;
	}

	/**
	 *  Get a random singular number (always returns '1')
	 *  @return {RPWord} the chosen word
	 */
	getSingularNumberWord() {
		return new RPWord(['number', 'requiresSingularNoun'], '1');
	}

	/**
	 *  Get a random plural number (between 2 and 'end', inclusive)
	 *  @return {RPWord} the chosen word
	 */
	getPluralNumberWord() {
		// NOTE: `start` is clamped to >= 2 here but (matching pre-existing behavior) the
		// clamped value isn't actually used below — this.start is used instead, so the
		// clamp currently has no effect. Preserved as-is; not in scope for this refactor.
		let start = this.start;
		if (start < 2) start = 2;
		const thisNumber = ReadablePassphrase.randomInt(this.end - this.start) + this.start;
		return new RPWord(['number'], thisNumber.toString());
	}
}

/**
 *  This object represents a pool of indefinite pronouns.  There is currently 1 personal pronoun, and 1 impersonal
 */
export class RPWordListIndefinitePronoun {
	/**
	 *  @param {object[]} indefinitePronounArray - an array of indefinitePronoun objects {personal: [bool], singular: ..., plural: ...}
	 */
	constructor(indefinitePronounArray) {
		this.list = indefinitePronounArray;
		this.length = indefinitePronounArray.length;
		this.personal = [];
		this.impersonal = [];
		for (const thisPronoun of indefinitePronounArray) {
			if (thisPronoun.personal) this.personal.push(thisPronoun);
			else this.impersonal.push(thisPronoun);
		}
	}

	/**
	 *  Get a random word from the pool.
	 *  @param {boolean} [personal] - true if a personal pronoun is being requested
	 *  @param {boolean} [plural] - true if the plural form of the word is being requested
	 *  @return {RPWord} the chosen word
	 */
	getRandomWord(personal, plural) {
		let searchList = this.list;
		if (personal) searchList = this.personal;
		else if (typeof personal !== 'undefined') searchList = this.impersonal;

		const word = searchList[ReadablePassphrase.randomInt(searchList.length)];
		return new RPWord(
			['indefinitePronoun', 'pronoun', 'indefinite', plural ? 'plural' : 'singular'],
			word[plural ? 'plural' : 'singular'],
		);
	}
}
