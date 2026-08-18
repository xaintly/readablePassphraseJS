import { ReadablePassphrase } from './readable-passphrase.js';
import { RPWordList } from './word-list.js';
import { RPRandomFactors } from './random-factors.js';

function len2log(listName) {
	return Math.log2(RPWordList[listName].length);
}

/**
 *  This object represents a pattern for constructing a sentence.  See the README for constructing new sentence templates.
 */
export class RPSentenceTemplate {
	/**
	 *  @param {object[]} template - an array of clause objects
	 */
	constructor(template) {
		this.length = template.length;
		for (let i = 0; i < template.length; i++) {
			const el = template[i];
			if (typeof el === 'string') this[i] = { type: el };
			else if (typeof el === 'object' && el.length) {
				// reassemble packed templates
				switch (el[0]) {
					case 'noun':
						this[i] = {
							type: 'noun',
							subtype: { common: el[1], proper: el[2], nounFromAdjective: el[3] },
							article: { none: el[4], definite: el[5], indefinite: el[6], demonstrative: el[7], personalPronoun: el[8] },
							adjective: el[9], preposition: el[10], number: el[11], singular: el[12],
						};
						break;
					case 'verb':
						this[i] = {
							type: 'verb',
							subtype: { present: el[1], past: el[2], future: el[3], continuous: el[4], continuousPast: el[5], perfect: el[6], subjunctive: el[7] },
							adverb: el[8], interrogative: el[9],
							intransitive: { noNounClause: el[10], preposition: el[11] },
						};
						break;
					default:
						throw new Error(`Error unpacking template spec array, unknown type: ${el[0]}`);
				}
			} else this[i] = el;

			if (this[i].type === 'noun' && this[i].article && !this[i].articleSingular) {
				// unpack article weights into Singular and Plural for convenience later
				const s = {};
				const p = {};
				for (const articleType in this[i].article) p[articleType] = s[articleType] = this[i].article[articleType];
				delete s.none;
				delete p.indefinite; // singular nouns must have an article, plural can't have indefinite
				delete this[i].article;
				this[i].articleSingular = s;
				this[i].articlePlural = p;
			}
		}
	}

	/**
	 *  Returns the number of bits of entropy in the template
	 *  @return {number} floating-point number of bits
	 */
	entropy() {
		let totalEntropy = 0;
		let currentMultiplier = 1;

		for (let templateNum = 0; templateNum < this.length; templateNum++) {
			switch (this[templateNum].type) {
				case 'conjunction':
					totalEntropy += len2log('conjunctions') * currentMultiplier;
					break;
				case 'directSpeech':
					totalEntropy += len2log('speechVerbs') * currentMultiplier;
					break;
				case 'noun': {
					const factors = new RPRandomFactors(this[templateNum]);
					let thisEntropy = 0;
					thisEntropy += factors.entropyOf('subtype');
					thisEntropy += factors.chanceOf('subtype', 'proper') * len2log('properNouns');
					const preludeEntropy =
						factors.entropyOf('preposition') +
						factors.entropyOf('singular') +
						factors.chanceOf('preposition', true) * len2log('prepositions') +
						factors.chanceOf('singular', true) *
							(factors.entropyOf('articleSingular') +
								factors.chanceOf('articleSingular', 'definite') * len2log('articles') +
								factors.chanceOf('articleSingular', 'indefinite') * len2log('articles') +
								factors.chanceOf('articleSingular', 'demonstrative') * len2log('demonstratives') +
								factors.chanceOf('articleSingular', 'personalPronoun') * len2log('personalPronouns')) +
						factors.chanceOf('singular', false) *
							(factors.entropyOf('articlePlural') +
								factors.chanceOf('articlePlural', 'definite') * len2log('articles') +
								factors.chanceOf('articlePlural', 'demonstrative') * len2log('demonstratives') +
								factors.chanceOf('articlePlural', 'personalPronoun') * len2log('articles'));
					thisEntropy +=
						factors.chanceOf('subtype', 'common') *
						(len2log('nouns') +
							factors.entropyOf('adjective') +
							preludeEntropy +
							factors.chanceOf('adjective', true) * len2log('adjectives') +
							factors.chanceOf('singular', false) * factors.chanceOf('number', true) * len2log('numbers'));

					thisEntropy += factors.chanceOf('subtype', 'nounFromAdjective') * (len2log('indefinitePronouns') + preludeEntropy + len2log('adjectives'));
					totalEntropy += thisEntropy * currentMultiplier;
					break;
				}
				case 'verb': {
					const factors = new RPRandomFactors(this[templateNum]);
					const intLen = RPWordList.intransitiveVerbs.length;
					const tranLen = RPWordList.verbs.length;
					const totalLen = intLen + tranLen;
					const chanceOfIntransitive = intLen / totalLen;
					const thisEntropy =
						factors.entropyOf('interrogative') +
						factors.entropyOf('adverb') +
						factors.entropyOf('adverb') +
						(chanceOfIntransitive * Math.log2(chanceOfIntransitive) + (tranLen / totalLen) * Math.log2(tranLen / totalLen)) +
						factors.chanceOf('interrogative', true) * len2log('interrogatives') +
						factors.chanceOf('adverb', true) * (len2log('adverbs') + 1) +
						chanceOfIntransitive * factors.chanceOf('intransitive', 'preposition') * len2log('prepositions');
					totalEntropy += thisEntropy * currentMultiplier;
					currentMultiplier *= 1 - chanceOfIntransitive * factors.chanceOf('intransitive', 'noNounClause');
					break;
				}
				default:
					throw new Error('Unknown clause type in entropy');
			}
		}
		return totalEntropy;
	}

	/**
	 *  Static function to return the number of bits of entropy in the given template
	 *  @param {string} templateName - name of the template
	 *  @return {number} floating-point number of bits
	 */
	static entropyOf(templateName) {
		const template = RPSentenceTemplate.templates[templateName];

		if (typeof template[0] === 'string') {
			// it's a collection of templates, not a template itself
			let entropy = 0;
			template.forEach((name) => {
				entropy += RPSentenceTemplate.entropyOf(name);
			});
			return entropy / template.length + Math.log2(template.length); // gain some entropy for choosing a random template
		}

		return template.entropy();
	}

	/**
	 *  Static function to return a template of the given name
	 *  (if the template is a collection of other templates, returns a random template from the collection)
	 *  @param {string} templateName - name of the template
	 *  @return {RPSentenceTemplate} the resolved template
	 */
	static byName(templateName) {
		let template = RPSentenceTemplate.templates[templateName];

		if (typeof template[0] === 'string') {
			// it's a collection of templates, not a template itself
			templateName = template[ReadablePassphrase.randomInt(template.length)];
			template = RPSentenceTemplate.templates[templateName];
		}

		template.name = templateName;
		return template;
	}
}

/**
 *  A set of predefined sentence templates.
 *  'random', 'randomShort', 'randomLong' and 'randomForever' are shorthand collections that select
 *  randomly from a set of similar templates; the rest are concrete templates.
 */
RPSentenceTemplate.templates = {
	random: ['normal', 'normalAnd', 'normalSpeech', 'strong', 'strongAnd', 'strongSpeech', 'insane', 'insaneAnd', 'insaneSpeech'],
	randomShort: ['normal', 'normalEqual', 'normalRequired', 'strong', 'insane', 'strongEqual'],
	randomLong: ['normalAnd', 'normalSpeech', 'normalEqualSpeech', 'normalRequiredAnd', 'normalRequiredSpeech', 'insaneEqual', 'normalEqualAnd', 'strongRequired', 'strongSpeech', 'strongAnd'],
	randomForever: ['strongEqualSpeech', 'insaneAnd', 'insaneSpeech', 'strongEqualAnd', 'insaneRequired', 'strongRequired', 'strongRequiredSpeech', 'insaneEqualSpeech', 'insaneEqualAnd', 'strongRequiredAnd', 'insaneRequiredSpeech', 'insaneRequiredAnd'],

	// actual templates
	normal: new RPSentenceTemplate([['noun', 12, 1, 2, 5, 4, 4, 0, 2, false, false, [1, 5], true], ['verb', 10, 8, 8, 0, 0, 0, 0, false, [1, 8], 0, 0], ['noun', 1, 0, 0, 5, 4, 4, 0, 2, false, false, false, true]]),
	normalAnd: new RPSentenceTemplate([['noun', 12, 1, 2, 5, 4, 4, 0, 2, false, false, [1, 5], true], ['verb', 10, 8, 8, 0, 0, 0, 0, false, [1, 8], 0, 0], ['noun', 1, 0, 0, 5, 4, 4, 0, 2, false, false, false, true], 'conjunction', ['noun', 1, 0, 0, 5, 4, 4, 0, 2, false, false, false, true]]),
	normalSpeech: new RPSentenceTemplate([['noun', 7, 1, 0, 0, 4, 4, 0, 2, false, false, false, true], 'directSpeech', ['noun', 12, 1, 2, 5, 4, 4, 0, 2, false, false, [1, 5], true], ['verb', 10, 8, 8, 0, 0, 0, 0, false, [1, 8], 0, 0], ['noun', 1, 0, 0, 5, 4, 4, 0, 2, false, false, false, true]]),
	normalEqual: new RPSentenceTemplate([['noun', 1, 1, 1, 1, 1, 1, 0, 1, false, false, [1, 1], true], ['verb', 1, 1, 1, 0, 0, 0, 0, false, [1, 1], 0, 0], ['noun', 1, 0, 0, 1, 1, 1, 0, 1, false, false, false, true]]),
	normalEqualAnd: new RPSentenceTemplate([['noun', 1, 1, 1, 1, 1, 1, 0, 1, false, false, [1, 1], true], ['verb', 1, 1, 1, 0, 0, 0, 0, false, [1, 1], 0, 0], ['noun', 1, 0, 0, 1, 1, 1, 0, 1, false, false, false, true], 'conjunction', ['noun', 1, 0, 0, 1, 1, 1, 0, 1, false, false, false, true]]),
	normalEqualSpeech: new RPSentenceTemplate([['noun', 1, 1, 0, 0, 1, 1, 0, 1, false, false, false, true], 'directSpeech', ['noun', 1, 1, 1, 1, 1, 1, 0, 1, false, false, [1, 1], true], ['verb', 1, 1, 1, 0, 0, 0, 0, false, [1, 1], 0, 0], ['noun', 1, 0, 0, 1, 1, 1, 0, 1, false, false, false, true]]),
	normalRequired: new RPSentenceTemplate([['noun', 1, 1, 1, 0, 1, 1, 0, 1, false, false, true, true], ['verb', 1, 1, 1, 0, 0, 0, 0, false, [1, 1], 0, 0], ['noun', 1, 0, 0, 0, 1, 1, 0, 1, false, false, false, true]]),
	normalRequiredAnd: new RPSentenceTemplate([['noun', 1, 1, 1, 0, 1, 1, 0, 1, false, false, true, true], ['verb', 1, 1, 1, 0, 0, 0, 0, false, [1, 1], 0, 0], ['noun', 1, 0, 0, 0, 1, 1, 0, 1, false, false, false, true], 'conjunction', ['noun', 1, 0, 0, 0, 1, 1, 0, 1, false, false, false, true]]),
	normalRequiredSpeech: new RPSentenceTemplate([['noun', 1, 1, 0, 0, 1, 1, 0, 1, false, false, false, true], 'directSpeech', ['noun', 1, 1, 1, 0, 1, 1, 0, 1, false, false, true, true], ['verb', 1, 1, 1, 0, 0, 0, 0, false, [1, 1], 0, 0], ['noun', 1, 0, 0, 0, 1, 1, 0, 1, false, false, false, true]]),
	strong: new RPSentenceTemplate([['noun', 12, 1, 2, 5, 4, 4, 1, 2, false, false, [1, 4], [7, 3]], ['verb', 10, 10, 10, 5, 5, 5, 2, false, [1, 8], 0, 4], ['noun', 1, 0, 0, 5, 4, 4, 1, 2, [3, 6], [1, 15], false, true]]),
	strongAnd: new RPSentenceTemplate([['noun', 12, 1, 2, 5, 4, 4, 1, 2, false, false, [1, 4], [7, 3]], ['verb', 10, 10, 10, 5, 5, 5, 2, false, [1, 8], 0, 4], ['noun', 1, 0, 0, 5, 4, 4, 1, 2, [3, 6], [1, 15], false, true], 'conjunction', ['noun', 1, 0, 0, 5, 4, 4, 1, 2, [3, 6], false, false, true]]),
	strongSpeech: new RPSentenceTemplate([['noun', 7, 1, 0, 0, 4, 4, 1, 2, false, false, false, [7, 3]], 'directSpeech', ['noun', 12, 1, 2, 5, 4, 4, 1, 2, false, false, [1, 4], [7, 3]], ['verb', 10, 10, 10, 5, 5, 5, 2, false, [1, 8], 0, 4], ['noun', 1, 0, 0, 5, 4, 4, 1, 2, [3, 6], [1, 15], false, true]]),
	strongEqual: new RPSentenceTemplate([['noun', 1, 1, 1, 1, 1, 1, 1, 1, false, false, [1, 1], [1, 1]], ['verb', 1, 1, 1, 1, 1, 1, 1, false, [1, 1], 0, 1], ['noun', 1, 0, 0, 1, 1, 1, 1, 1, [1, 1], [1, 1], false, true]]),
	strongEqualAnd: new RPSentenceTemplate([['noun', 1, 1, 1, 1, 1, 1, 1, 1, false, false, [1, 1], [1, 1]], ['verb', 1, 1, 1, 1, 1, 1, 1, false, [1, 1], 0, 1], ['noun', 1, 0, 0, 1, 1, 1, 1, 1, [1, 1], [1, 1], false, true], 'conjunction', ['noun', 1, 0, 0, 1, 1, 1, 1, 1, [1, 1], false, false, true]]),
	strongEqualSpeech: new RPSentenceTemplate([['noun', 1, 1, 0, 0, 1, 1, 1, 1, false, false, false, [1, 1]], 'directSpeech', ['noun', 1, 1, 1, 1, 1, 1, 1, 1, false, false, [1, 1], [1, 1]], ['verb', 1, 1, 1, 1, 1, 1, 1, false, [1, 1], 0, 1], ['noun', 1, 0, 0, 1, 1, 1, 1, 1, [1, 1], [1, 1], false, true]]),
	strongRequired: new RPSentenceTemplate([['noun', 1, 1, 1, 0, 1, 1, 1, 1, false, false, true, [1, 1]], ['verb', 1, 1, 1, 1, 1, 1, 1, false, [1, 1], 0, 1], ['noun', 1, 0, 0, 0, 1, 1, 1, 1, true, true, false, true]]),
	strongRequiredAnd: new RPSentenceTemplate([['noun', 1, 1, 1, 0, 1, 1, 1, 1, false, false, true, [1, 1]], ['verb', 1, 1, 1, 1, 1, 1, 1, false, [1, 1], 0, 1], ['noun', 1, 0, 0, 0, 1, 1, 1, 1, true, true, false, true], 'conjunction', ['noun', 1, 0, 0, 0, 1, 1, 1, 1, true, false, false, true]]),
	strongRequiredSpeech: new RPSentenceTemplate([['noun', 1, 1, 0, 0, 1, 1, 1, 1, false, false, false, [1, 1]], 'directSpeech', ['noun', 1, 1, 1, 0, 1, 1, 1, 1, false, false, true, [1, 1]], ['verb', 1, 1, 1, 1, 1, 1, 1, false, [1, 1], 0, 1], ['noun', 1, 0, 0, 0, 1, 1, 1, 1, true, true, false, true]]),
	insane: new RPSentenceTemplate([['noun', 8, 0, 1, 5, 4, 4, 1, 2, [3, 6], false, [1, 3], [7, 3]], ['verb', 10, 10, 10, 5, 5, 5, 5, [3, 10], [1, 8], 1, 5], ['noun', 1, 0, 0, 5, 4, 4, 1, 2, [3, 6], [2, 8], false, [7, 3]]]),
	insaneAnd: new RPSentenceTemplate([['noun', 8, 0, 1, 5, 4, 4, 1, 2, [3, 6], false, [1, 3], [7, 3]], ['verb', 10, 10, 10, 5, 5, 5, 5, [3, 10], [1, 8], 1, 5], ['noun', 1, 0, 0, 5, 4, 4, 1, 2, [3, 6], [2, 8], false, [7, 3]], 'conjunction', ['noun', 1, 0, 0, 5, 4, 4, 1, 2, [3, 6], false, false, [7, 3]]]),
	insaneSpeech: new RPSentenceTemplate([['noun', 7, 1, 0, 0, 4, 4, 1, 2, [3, 6], false, false, [7, 3]], 'directSpeech', ['noun', 8, 0, 1, 5, 4, 4, 1, 2, [3, 6], false, [1, 3], [7, 3]], ['verb', 10, 10, 10, 5, 5, 5, 5, [3, 10], [1, 8], 1, 5], ['noun', 1, 0, 0, 5, 4, 4, 1, 2, [3, 6], [2, 8], false, [7, 3]]]),
	insaneEqual: new RPSentenceTemplate([['noun', 1, 0, 1, 1, 1, 1, 1, 1, [1, 1], false, true, [1, 1]], ['verb', 1, 1, 1, 1, 1, 1, 1, [1, 1], [1, 1], 1, 1], ['noun', 1, 0, 0, 1, 1, 1, 1, 1, [1, 1], [1, 1], false, [1, 1]]]),
	insaneEqualAnd: new RPSentenceTemplate([['noun', 1, 0, 1, 1, 1, 1, 1, 1, [1, 1], false, [1, 1], [1, 1]], ['verb', 1, 1, 1, 1, 1, 1, 1, [1, 1], [1, 1], 1, 1], ['noun', 1, 0, 0, 1, 1, 1, 1, 1, [1, 1], [1, 1], false, [1, 1]], 'conjunction', ['noun', 1, 0, 0, 1, 1, 1, 1, 1, [1, 1], false, false, [1, 1]]]),
	insaneEqualSpeech: new RPSentenceTemplate([['noun', 1, 1, 0, 0, 1, 1, 1, 1, [1, 1], false, false, [1, 1]], 'directSpeech', ['noun', 1, 0, 1, 1, 1, 1, 1, 1, [1, 1], false, [1, 1], [1, 1]], ['verb', 1, 1, 1, 1, 1, 1, 1, [1, 1], [1, 1], 1, 1], ['noun', 1, 0, 0, 1, 1, 1, 1, 1, [1, 1], [1, 1], false, [1, 1]]]),
	insaneRequired: new RPSentenceTemplate([['noun', 1, 0, 1, 0, 1, 1, 1, 1, true, false, true, [1, 1]], ['verb', 1, 1, 1, 1, 1, 1, 1, true, [1, 1], 1, 1], ['noun', 1, 0, 0, 0, 1, 1, 1, 1, true, true, false, [1, 1]]]),
	insaneRequiredAnd: new RPSentenceTemplate([['noun', 1, 0, 1, 0, 1, 1, 1, 1, true, false, true, [1, 1]], ['verb', 1, 1, 1, 1, 1, 1, 1, true, [1, 1], 1, 1], ['noun', 1, 0, 0, 0, 1, 1, 1, 1, true, true, false, [1, 1]], 'conjunction', ['noun', 1, 0, 0, 0, 1, 1, 1, 1, true, false, false, [1, 1]]]),
	insaneRequiredSpeech: new RPSentenceTemplate([['noun', 1, 1, 0, 0, 1, 1, 1, 1, true, false, false, [1, 1]], 'directSpeech', ['noun', 1, 0, 1, 0, 1, 1, 1, 1, true, false, true, [1, 1]], ['verb', 1, 1, 1, 1, 1, 1, 1, true, [1, 1], 1, 1], ['noun', 1, 0, 0, 0, 1, 1, 1, 1, true, true, false, [1, 1]]]),
};
