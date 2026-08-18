// Populates RPWordList.* with dictionary data; must run before anything below is used.
import './dictionary/index.js';

import { ReadablePassphrase } from './readable-passphrase.js';
import { RPMutator } from './mutator.js';
import { RPRandomFactors } from './random-factors.js';
import { RPSentenceTemplate } from './sentence-template.js';
import { RPWord } from './word.js';
import { RPWordList, RPWordListPlural, RPWordListVerb, RPWordListArticle, RPWordListNumber, RPWordListIndefinitePronoun } from './word-list.js';

export {
	ReadablePassphrase,
	RPMutator,
	RPRandomFactors,
	RPSentenceTemplate,
	RPWord,
	RPWordList,
	RPWordListPlural,
	RPWordListVerb,
	RPWordListArticle,
	RPWordListNumber,
	RPWordListIndefinitePronoun,
};

export default ReadablePassphrase;
