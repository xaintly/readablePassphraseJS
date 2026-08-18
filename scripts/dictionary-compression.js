import { RPWordListVerb } from '../src/word-list.js';

/**
 *  Compress a fully-spelled-out noun dictionary (array of [singular, plural] pairs) into the
 *  compact on-disk form: a pair whose plural is exactly `singular + 's'` collapses to the bare
 *  singular string (RPWordListPlural expands it back to a pair at load time). Pairs that use the
 *  `0` sentinel (plural-only or singular-only nouns) or an irregular plural are left untouched.
 */
export function compressNouns(nounPairs) {
	return nounPairs.map(([singular, plural]) => {
		if (typeof singular === 'string' && plural === `${singular}s`) return singular;
		return [singular, plural];
	});
}

function computeDefaultTense(baseWord, baseWordTrim, specNum) {
	const template = RPWordListVerb.unpackDefaults[specNum];
	return template.replace('&1e', `${baseWordTrim}e`).replace('&1i', `${baseWordTrim}i`).replace('&1', baseWord);
}

/**
 *  Compress a fully-spelled-out verb dictionary (array of 14-element tense arrays, in
 *  RPWordListVerb.tenses order) into the compact on-disk form used by RPWordListVerb: any tense
 *  slot whose value exactly matches the computed default (base word + unpackDefaults template) is
 *  replaced with the `0` sentinel, trailing `0` slots are truncated, and an entry that's entirely
 *  defaults beyond the base word collapses to the bare base-word string.
 */
export function compressVerbs(verbTenseArrays) {
	const tenseCount = RPWordListVerb.tenses.length;
	return verbTenseArrays.map((tenses) => {
		const baseWord = tenses[0];
		const baseWordTrim = baseWord.replace(/e$/, '');

		const compressed = [baseWord];
		for (let specNum = 1; specNum < tenseCount; specNum++) {
			const value = tenses[specNum];
			const isDefault = value === computeDefaultTense(baseWord, baseWordTrim, specNum);
			compressed.push(isDefault ? 0 : value);
		}

		let length = compressed.length;
		while (length > 1 && compressed[length - 1] === 0) length--;

		if (length === 1) return baseWord;
		return compressed.slice(0, length);
	});
}
