import { RPWordList, RPWordListPlural, RPWordListVerb, RPWordListArticle, RPWordListNumber, RPWordListIndefinitePronoun } from '../word-list.js';

import adjectives from './adjectives.js';
import adverbs from './adverbs.js';
import speechVerbs from './speech-verbs.js';
import properNouns from './proper-nouns.js';
import prepositions from './prepositions.js';
import nouns from './nouns.js';
import intransitiveVerbs from './intransitive-verbs.js';
import verbs from './verbs.js';
import { numbers, indefinitePronouns, conjunctions, personalPronouns, demonstratives, interrogatives, articles } from './small-lists.js';

// Populates the RPWordList.* dictionary registry used throughout the engine.
// Imported once (for its side effects) by src/index.js before anything else runs.
RPWordList.numbers = new RPWordListNumber(numbers.start, numbers.end);
RPWordList.indefinitePronouns = new RPWordListIndefinitePronoun(indefinitePronouns);
RPWordList.conjunctions = new RPWordList('conjunction', conjunctions);
RPWordList.personalPronouns = new RPWordListPlural('personalPronoun', personalPronouns);
RPWordList.demonstratives = new RPWordListPlural('demonstrative', demonstratives);
RPWordList.interrogatives = new RPWordListPlural('interrogative', interrogatives);
RPWordList.articles = new RPWordListArticle(articles);

RPWordList.adjectives = new RPWordList('adjective', adjectives);
RPWordList.adverbs = new RPWordList('adverb', adverbs);
RPWordList.speechVerbs = new RPWordList('speechVerb', speechVerbs);
RPWordList.properNouns = new RPWordList('properNoun', properNouns);
RPWordList.prepositions = new RPWordList('preposition', prepositions);
RPWordList.nouns = new RPWordListPlural('noun', nouns);
RPWordList.intransitiveVerbs = new RPWordListVerb('intransitive', intransitiveVerbs);
RPWordList.verbs = new RPWordListVerb('transitive', verbs);
