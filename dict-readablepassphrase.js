/**
 * @file This is a port of the C# ReadablePassphraseGenerator, by Murray Grant
 * @author Steven Zeck <saintly@innocent.com>
 * @version 1.0.1
 * @license Apache-2
 *
 *
 *  ReadablePassphrase objects generate random english sentences 
 *  @param {(string|object)} [template] - create a sentence using the given template (either a string name of a predefined template, or an RPSentenceTemplate object)
 *  @param {(string|object)} [mutator]  - use a mutator to add random uppercase & numbers (either a string name of a predefined mutator, or an RPMutator object)
 */ 
function ReadablePassphrase( template, mutator ) {
	this.parts = []; 
	this.length = 0;
	this.usedWords = {};
	this.mutator   = new RPMutator( mutator );
	
	if( template ) this.addTemplate( template );
	return this;
}

/**
 *  ReadablePassphrase.randomness() is used by all ReadablePassphrase objects as a source of randomness.  
 *  It uses a weak source of randomness by default.
 *  If using ReadablePassphrase in a production environment, you should replace this function with a better one
 *  @param {number} [multiplier=1] - get a value between 0 and multiplier (including 0, but not including multiplier)
 *  @return {number} A random, floating-point number between 0 and 1 (or multiplier, if provided)
 */
ReadablePassphrase.randomness = function( multiplier ) { return Math.random() * ( multiplier || 1 ); }

/**
 *  Convenience function: get a random integer
 *  @param {number} [multiplier=2] Get a random number betweeen 0 and multiplier (including 0 but not including multiplier)
 *  @return {number} A random integer
 */
ReadablePassphrase.randomInt  = function( multiplier ) { return Math.floor( ReadablePassphrase.randomness( multiplier || 2 ) ); }

/**
 *  Get a list of names of predefined templates
 *  @return {string[]} A list of predefined templates, in no particular order
 */
ReadablePassphrase.templates = function () {
	var templates = [];
	for( var templateName in RPSentenceTemplate.templates ) templates.push( templateName );
	return templates;
}

/**
 *  Get a list of names of predefined mutators
 *  @return {string[]} A list of predefined mutators, in no particular order
 */
ReadablePassphrase.mutators = function () {
	var mutators = [];
	for( var mutatorName in RPMutator.mutators ) mutators.push( mutatorName );
	return mutators;
}

/**
 *  Get the number of bits of entropy in a template + mutator
 *  @param {string} template - name of the given template (not a template object)
 *  @param {(string|object)} [mutator]  - either a string name of a predefined mutator, or an RPMutator object
 *  @return {number} floating-point number of bits
 */
ReadablePassphrase.entropyOf = function ( template, mutator ) {
		mutator = mutator ? new RPMutator( mutator ) : null;	
		return RPSentenceTemplate.entropyOf( template ) + ( mutator ? mutator.entropy() : 0 );
}


/**
 *  Get the string representation of the generated phrase
 *  @return {string} A phrase, eg "the milk will eat the angry decision"
 */
ReadablePassphrase.prototype.toString = function () { 
	var phrase = [];
	for( var wordNum=0; wordNum < this.parts.length; wordNum++ ) phrase.push( this.parts[ wordNum ].value );
	return this.mutator.mutate( phrase.join(' ') );
}

// ****** methods called by addTemplate() ******* 

/**
 *  Add a template to the end of the current phrase.
 *  Called automatically by the constructor if you pass a template to the constructor.
 *  @param {(string|object)} template - use the given template (either a string name of a predefined template, or an RPSentenceTemplate object)
 */
ReadablePassphrase.prototype.addTemplate = function ( template ) {
	if( typeof(template) == 'string' ) template = RPSentenceTemplate.byName( template );
	this.template = template;
	for( var templateNumber = 0; templateNumber < template.length; templateNumber++ ) {
		var thisTemplate = template[ templateNumber ];
		var finalize = this.addClause( new RPRandomFactors( thisTemplate ) );
		if( finalize ) break; // some verb templates cause premature completion
	}		
	
	// Cleanup: 'a' before vowel => 'an'
	for( var wordNum=0; wordNum < this.parts.length; wordNum++ ) {
		var thisWord = this.parts[ wordNum ];
		if( thisWord.hasTypes(['article','indefinite']) ) {
			var nextWord = this.parts[ wordNum + 1 ];
			if( !nextWord ) break;
			if( nextWord.value.match(/^[aeiou]/) ) thisWord.value = thisWord.indefiniteBeforeVowel;
		}		
	}
}

/**
 *  Get the last clause in the phrase, or null if the phrase is empty
 *  @return {object} an RPWord() object or null
 */
ReadablePassphrase.prototype.last = function () { return ( this.length > 0 ) ? this.parts[ this.length - 1 ] : null; }

/**
 *  Add a clause to the current passphrase
 *  @param {object} factors - an object representing a clause (see README for examples)
 *  @return {boolean} returns true if no more clauses should be added after this
 */
ReadablePassphrase.prototype.addClause = function ( factors ) {
	switch( factors.type ) {
		case 'noun': return this.addNoun( factors ); 
		case 'verb': return this.addVerb( factors ); 
		case 'conjunction':	 this.appendWord( RPWordList.conjunctions.getRandomWord( this.usedWords ) ); return false;
		case 'directSpeech': this.appendWord( RPWordList.speechVerbs.getRandomWord( this.usedWords ) );  return false;
		default: throw 'Unexpected clause type: ' + factors.type;
	}
}

/**
 *  Add an RPWord() object to the end of the current passphrase
 *  @param {object} word - an RPWord object
 *  @return {object} returns the current ReadablePassphrase object
 */
ReadablePassphrase.prototype.appendWord = function( word ) { return this.insertWord( word, this.length ); }

/**
 *  Insert an RPWord() object at any position in the current passphrase
 *  @param {object} word - an RPWord object
 *  @param {number} position - a number representing the position in the current set of RPWords to add the new one
 *  @return {object} returns the current ReadablePassphrase object
 */
ReadablePassphrase.prototype.insertWord = function( word, position ) {
	this.parts.splice( position, 0, word );
	this.usedWords[ word.value ] = true;
	this.length++;
	// console.log('Adding ' + word.value + ' to sentence');
	return this;
}

/**
 *  Add a Verb clause to the current passphrase
 *  @param {object} factors - an object representing a verb clause (see README for examples)
 *  @return {boolean} returns true if no more clauses should be added after this (triggered by some intransitive verbs)
 */
ReadablePassphrase.prototype.addVerb = function ( factors ) {
	// calculating whether the verb should be plural...
	var firstNoun = null, firstIndefinitePronoun = null, pluralVerb = null, insertInterrogative = 0;
	for( var wordNumber=0; wordNumber < this.length; wordNumber++ ) {
		var thisWord = this.parts[ wordNumber ];
		if( !firstNoun && thisWord.hasTypes( 'noun' ) ) firstNoun = thisWord;
		else if( thisWord.hasTypes('speechVerb') ) {
			firstNoun = null;
			insertInterrogative = wordNumber + 1;
		}
		else if( !firstIndefinitePronoun && thisWord.hasTypes('indefinitePronoun') ) firstIndefinitePronoun = thisWord;
	}
	
	if( firstNoun ) pluralVerb = firstNoun.hasTypes('plural') ? true : false;
	else if( firstIndefinitePronoun ) pluralVerb = firstIndefinitePronoun.hasTypes('plural') ? true : false;
	else pluralVerb = false;
	
	// console.log('FirstNoun: ' + firstNoun + ', indefPronoun: ' + firstIndefinitePronoun + ' is plural: ' + pluralVerb);
		
	var selectTransitive = true, removeAccusativeNoun = false, addPreposition = false;
	var intransitiveType = factors.byName('intransitive');
	
	if( intransitiveType && ( RPWordListVerb.getRandomTransitivity() == 'intransitive' ) ) {
		// console.log('Adding intransitive, type = ' + intransitiveType);
		selectTransitive = false;		
		switch( intransitiveType ) {
			case 'noNounClause': removeAccusativeNoun = true; break;
			case 'preposition':  addPreposition = true; break;
			default: throw 'Unexpected intransitive type: ' + intransitiveType;
		}
	}
		
	var makeInterrogative = factors.byName('interrogative'), tense = factors.byName('subtype');
	// console.log('Make interrogative: ' + makeInterrogative + ', tense: ' + tense);		
	if( makeInterrogative ) {
		this.insertWord( RPWordList.interrogatives.getRandomWord( pluralVerb ), insertInterrogative, this.usedWords );
		pluralVerb = true;
		tense      = 'presentPlural';
	}
	
	var includeAdverb = factors.byName('adverb') ? ( ( ReadablePassphrase.randomness( 2 ) >= 1 ) ? 'before' : 'after' ) : 'no';
	if( includeAdverb == 'before' ) this.appendWord( RPWordList.adverbs.getRandomWord( this.usedWords ) );
	
	this.appendWord( RPWordList[ selectTransitive ? 'verbs' : 'intransitiveVerbs' ].getRandomWord( tense, pluralVerb, this.usedWords ) );

	if( includeAdverb == 'after' ) this.appendWord( RPWordList.adverbs.getRandomWord( this.usedWords ) );	
	if( addPreposition ) this.appendWord( RPWordList.prepositions.getRandomWord( this.usedWords ) );

	if( removeAccusativeNoun ) return true; // Returning true means the sentence is done
	return false;
}

/**
 *  Add a Noun clause to the current passphrase
 *  @param {object} factors - an object representing a noun clause (see README for examples)
 *  @return {boolean} returns true if no more clauses should be added after this (currently always false)
 */
ReadablePassphrase.prototype.addNoun = function ( factors ) {
	var n = factors.byName('subtype');
	switch( n ) {
		case 'common': return this.addCommonNoun( factors ); break;
		case 'nounFromAdjective': return this.addNounFromAdjective( factors );	break;
		case 'proper': this.appendWord( RPWordList.properNouns.getRandomWord( this.usedWords ) ); return false;
		default: 
			console.log( this );
			throw 'Unknown noun subtype: ' + n;
	}
}

/**
 *  Add a common Noun clause to the current passphrase (eg. "dog", "cat", "justice")
 *  @param {object} factors - an object representing a noun clause (see README for examples)
 *  @return {boolean} returns true if no more clauses should be added after this (currently always false)
 */
ReadablePassphrase.prototype.addCommonNoun = function ( factors ) {
	var isPlural = this.addNounPrelude( factors );
	if(factors.byName('number') && (isPlural || factors.mustBeTrue('singular') )) {
		if( !isPlural && !(this.length && this.last().hasTypes(['article','indefinite'])) ) this.appendWord( RPWordList.numbers.getSingularNumberWord() );
		else if( isPlural ) this.appendWord( RPWordList.numbers.getPluralNumberWord() );
	}
	
	if(factors.byName('adjective')) this.appendWord( RPWordList.adjectives.getRandomWord( this.usedWords ) );
	this.appendWord( RPWordList.nouns.getRandomWord( isPlural, this.usedWords ) );
	return false;
}

/**
 *  Construct a Noun clause from an adjective and add it to the current passphrase, eg. "a green thing"
 *  @param {object} factors - an object representing a noun clause (see README for examples)
 *  @return {boolean} returns true if no more clauses should be added after this (currently always false)
 */
ReadablePassphrase.prototype.addNounFromAdjective = function ( factors ) {
	var isPlural = this.addNounPrelude( factors );
	this.appendWord( RPWordList.adjectives.getRandomWord(this.usedWords) );
	var isPersonal = ReadablePassphrase.randomness( 2 ) >= 1 ? true : false;
	this.appendWord( RPWordList.indefinitePronouns.getRandomWord( isPersonal, isPlural, this.usedWords ) );
	return false;
}

/**
 *  Add a prelude to a noun to the current passphrase, eg. "before the"
 *  @param {object} factors - an object representing a noun clause (see README for examples)
 *  @return {boolean} returns true if the following noun should be plural
 */
ReadablePassphrase.prototype.addNounPrelude = function ( factors ) {
	if( factors.byName('preposition') &&
		( !this.last() || !this.last().hasTypes('preposition') )
	) {
		this.appendWord( RPWordList.prepositions.getRandomWord( this.usedWords ) );
	}
	
	var isPlural = ! factors.byName('singular');
	
	switch( factors.byName( isPlural ? 'articlePlural' : 'articleSingular' ) ) {	
	  case 'none':            break; // shouldn't come up for Singular
	  case 'definite':        this.appendWord( RPWordList.articles.getRandomDefiniteArticle() ); break;
	  case 'indefinite':      this.appendWord( RPWordList.articles.getRandomIndefiniteArticle() ); break; // shouldn't come up for Plural
	  case 'demonstrative':   this.appendWord( RPWordList.demonstratives.getRandomWord( isPlural ) ); break;
	  case 'personalPronoun': this.appendWord( RPWordList.personalPronouns.getRandomWord( isPlural, this.usedWords ) ); break;		
	  default: throw 'Unknown case result from computeFactor';
	}
	
	return isPlural;
}

/**
 *  This object mutates sentences by making some words (or parts of words) uppercase and adding numbers inside the sentence
 *  @param {(string|object)} mutatorSpec  - either a string name of a predefined mutator, or an object describing the mutator
 */
function RPMutator ( mutatorSpec ) {
	this.upper   = { type: 'none' };
	this.numbers = { type: 'none' };
	
	if( !mutatorSpec ) return;
	else if( typeof(mutatorSpec) == 'string' ) mutatorSpec = RPMutator.mutators[ mutatorSpec ];

	function parseSpec ( spec ) { // helper function
		if( spec.length ) spec = { type: spec[0], count: spec[1] };
		if( spec.type != 'none' && ( !spec.count || isNaN(spec.count) || ( spec.count < 1 ) ) ) spec.count = 0;
		return spec;
	}
	
	this.upper   = parseSpec( mutatorSpec.upper );
	this.numbers = parseSpec( mutatorSpec.numbers );
}

/**
 * Predefined mutators 
 */
RPMutator.mutators = {
	'standard': { upper: [ 'WholeWord', 1 ], numbers: [ 'EndOfWord', 2 ] },
	'random'  : { upper: [ 'random' ], numbers: [ 'random' ] },
};

/**
 *  Mutate a string according to the mutator specification
 *  @param {string} string - a string to mutate, should be multiple words with spaces in between
 *  @return {string} a mutated string
 */
RPMutator.prototype.mutate = function ( string ) {
	var words = string.split(' '); // we already have parts[], but a part might have multiple words in it
	if( this.upper && this.upper.type != 'none' ) {		
		var count = this.upper.count || ( ReadablePassphrase.randomInt( words.length ) + 1 );
		if( count > words.length ) count = words.length;
		
		var availableWords = [], chosenUpper = []; 
		for(var i=0; i<words.length; i++ ) availableWords.push(i);
		while( count-- > 0 ) chosenUpper.push( availableWords.splice(ReadablePassphrase.randomInt(availableWords.length),1) );
		var upperTechniques = [ 'StartOfWord', 'WholeWord', 'Anywhere', 'RunOfLetters' ], upperType = this.upper.type;
		chosenUpper.forEach(function ( wordNumber ) {
			var thisWord = words[ wordNumber ], thisTechnique = upperType, start = 0, end = 0;
			if( thisTechnique == 'random' ) thisTechnique = upperTechniques[ReadablePassphrase.randomInt(upperTechniques.length)];
			switch( thisTechnique ) {
				case 'StartOfWord':  end = 1; break;
				case 'WholeWord':    end = thisWord.length; break;
				case 'Anywhere':     start = ReadablePassphrase.randomInt(thisWord.length); end = start + 1; break;
				case 'RunOfLetters': 
					start = ReadablePassphrase.randomInt(thisWord.length - 1); 
					end = start + 2 + ReadablePassphrase.randomInt(thisWord.length - start); 
					break;
				default: throw "Unknown word uppercasing technique: " + thisTechnique;
			}
			words[wordNumber] = "" + thisWord.slice(0,start) + thisWord.slice(start,end).toUpperCase() + thisWord.slice(end,thisWord.length);
		});
	}
	if( this.numbers && this.numbers.type != 'none' ) {
		var count = this.numbers.count || ( ReadablePassphrase.randomInt( 5 ) + 1 );
		while( count-- > 0 ) {
			var thisTechnique = this.numbers.type;
			if( thisTechnique == 'StartOrEndOfWord' ) thisTechnique = ( ReadablePassphrase.randomness(2) >= 1 ) ? 'StartOfWord' : 'EndOfWord';
			var chosenWord = ( thisTechnique == 'EndOfPhrase' ) ? ( words.length - 1 ) : ReadablePassphrase.randomInt(words.length);
			var thisWord   = words[ chosenWord ], thisNumber = ReadablePassphrase.randomInt(10).toString();
			switch( thisTechnique ) {
				case 'StartOfWord': thisWord = "" + thisNumber + thisWord; break;
				case 'EndOfWord':
				case 'EndOfPhrase': thisWord += thisNumber; break;
				case 'random':
				case 'Anywhere':
					var thisPosition = ReadablePassphrase.randomInt(thisWord.length);
					thisWord = thisWord.slice(0,thisPosition) + thisNumber + thisWord.slice(thisPosition,thisWord.length);
					break;
				default: throw "Unknown number insertion technique: " + thisTechnique;				
			}
			words[ chosenWord ] = thisWord;
		}		
	}	
	return words.join(' ');
}

/**
 *  Estimate the entropy added by a mutator 
 *  (actual entropy would vary based on number & length of words in the string)
 *  @return {number} floating-point number of bits
 */
RPMutator.prototype.entropy = function () { 
	var averageNumberOfWords = 9, averageWordLength = 5, entropy = 0;
	if( this.upper && this.upper.type != 'none' ) {		
		var count = this.upper.count || Math.floor(averageNumberOfWords / 2);
		var thisEntropy = Math.log2(averageNumberOfWords); // choice of a random word

		switch( this.upper.type ) {
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
				thisEntropy += 2 + ( Math.log2(averageWordLength) * 3 / 5 );
				break;
			default: throw "Unknown word uppercasing technique: " + this.upper.type;
		}
		
		entropy += thisEntropy * count;
	}
	if( this.numbers && this.numbers.type != 'none' ) {
		var count = this.numbers.count || ( ReadablePassphrase.randomInt( 5 ) + 1 );
		var thisEntropy = Math.log2(10); // random number
		switch( this.numbers.type ) {
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
			default: throw "Unknown number insertion technique: " + this.numbers.type;				
		}

		entropy += thisEntropy * count;
	}	
	return entropy;
}


/**
 *  This object represents a word in a sentence, plus some attributes that describe the type of word
 *  @param {(string|string[])} types  - a string, or array of strings describing the type of the word, eg [ 'verb', 'intransitive' ]
 *  @param {string} value - the text representation of this word
 */
function RPWord( types, value ) {
	this.value = value;
	this.types = {};
	this.addTypes( types );
	return this;
}

/**
 *  Add one or more types to this word
 *  @param {(string|string[])} types  - a string, or array of strings describing the type of the word, eg [ 'verb', 'intransitive' ]
 *  @return {object} returns this RPWord() object
 */
RPWord.prototype.addTypes = function ( types ) {
	if( typeof(types) != 'object' ) types = [ types ];
	var obj = this;
	types.forEach(function( type ) { obj.types[ type ] = true; });
	return this;
}

/**
 *  Returns true if the word has all the given types
 *  @param {(string|string[])} types  - a string, or array of strings you want to check for, eg [ 'verb', 'transitive' ]
 *  @return {boolean} true if the word has all the requested types, false if any are missing
 */
RPWord.prototype.hasTypes = function ( types ) {
	if( typeof(types) != 'object' ) types = [ types ];
	for( var typeNum=0; typeNum < types.length; typeNum++ ) {
		if( !this.types[ types[typeNum] ] ) return false;
	}
	return true;
}

/**
 *  This object represents a pool of words of a similar type, with the assumption that you will request random members from the pool
 *  @param {string} type  - a string describing the type of all words in this list
 *  @param {string[]} wordArray - an array of words
 */
function RPWordList( type, wordArray ) {
	this.list = wordArray;
	this.type = type;
	this.length = wordArray.length;
	return this;
}

/**
 *  Get a random word from the pool.
 *  Note that passing alreadyChosen{} actually weakens the overall strength of the passphrase slightly
 *  @param {object} [alreadyChosen] - if a hash of words that are already chosen is provided, this will avoid returning one already chosen
 *  @return {object} an RPWord() object with the chosen word
 */
RPWordList.prototype.getRandomWord = function( alreadyChosen ) {
	var word, attempts = 100;
	do {
		word = this.list[ ReadablePassphrase.randomInt( this.length ) ];
		if( attempts-- < 1 ) throw 'Exceeded max attempts in RPWordListPlural.getRandomWord() for type ' + this.type;
	} while( alreadyChosen && alreadyChosen[ word ] );
	return new RPWord( this.type, word );
}

/**
 *  This object represents a pool of word pairs of a similar type, with the first element in each pair being the singular form and the second the plural
 *  @param {string} type  - a string describing the type of all words in this list
 *  @param {object[]} wordArray - an array of a word pairs, eg [[ 'mouse', 'mice ], ['dog','dogs' ]]
 */
function RPWordListPlural( type, pluralWordArray ) {
	RPWordList.call(this, type, pluralWordArray);
	for( var wordNum=0; wordNum < this.list.length; wordNum++ ) {
		var thisWord = this.list[ wordNum ];
		if( typeof(thisWord) == 'string' ) this.list[ wordNum ] = [ thisWord, thisWord + 's' ];
	}
	return this;
}

/**
 *  Get a random word from the pool.
 *  Note that passing alreadyChosen{} actually weakens the overall strength of the passphrase slightly
 *  @param {boolean} [isPlural] - true if the plural form of the word is being requested
 *  @param {object} [alreadyChosen] - if a hash of words that are already chosen is provided, this will avoid returning one already chosen
 *  @return {object} an RPWord() object with the chosen word
 */
RPWordListPlural.prototype.getRandomWord = function( isPlural, alreadyChosen ) {
	var word = null, attempts = 100;
	do {
		word = this.list[ ReadablePassphrase.randomInt( this.length ) ][ isPlural ? 1 : 0 ];
		if( attempts-- < 1 ) throw 'Exceeded max attempts in RPWordListPlural.getRandomWord() for type ' + this.type;
	} while( !word || ( alreadyChosen && alreadyChosen[ word ] ) );
	return new RPWord( [ this.type, isPlural ? 'plural' : 'singular' ], word );
}

/**
 *  This object represents a pool of verbs, with each verb having multiple possible tenses
 *  @param {string} transitiveType  - either 'transitive' or 'intransitive' depending on the type of verbs in the list
 *  @param {object[]} verbArray - an array of a verbs, each represented as a 14-element array of tenses (see RPWordListVerb.tenses for order)
 */
function RPWordListVerb( transitiveType, verbArray ) {	
	this.list     = [];
	
	if( typeof(RPWordListVerb.tenses[0]) == 'string') { // compile the tenses
		for( var specNum=0; specNum < RPWordListVerb.tenses.length; specNum++ ) {		
			var thisSpec = RPWordListVerb.tenses[specNum];		
			var specObj = { fullTense: thisSpec, tense: null, continuous: false, plural: false };
			var tenseMatch = thisSpec.match(/^(past|present|future|perfect|subjunctive)/);
			if( tenseMatch ) specObj.tense = tenseMatch[0];
			if( thisSpec.match(/Continuous/) ) specObj.continuous = true; 
			if( thisSpec.match(/Plural/) ) specObj.plural = true;
			RPWordListVerb.tenses[specNum] = specObj;
		}
		// console.log( RPWordListVerb.tenses );
	}
	
	for( var verbNum=0; verbNum < verbArray.length; verbNum++ ) {
		var thisVerb = verbArray[ verbNum ];
		if( typeof(thisVerb) == 'string' ) thisVerb = [ thisVerb ];
		var baseWord = thisVerb[0], baseWordTrim = thisVerb[0].replace(/e$/,'');
		for( var specNum=0; specNum < RPWordListVerb.tenses.length; specNum++ ) {
			var thisSpec = RPWordListVerb.tenses[ specNum ];
			var thisWord = thisVerb[ specNum ] || RPWordListVerb.unpackDefaults[ specNum ];
			thisWord = thisWord.replace('&1e',baseWordTrim + 'e').replace('&1i',baseWordTrim + 'i').replace('&1',baseWord);
			var types    = [ 'verb', thisSpec.fullTense, thisSpec.tense, ( thisSpec.plural ? 'plural' : 'singular' ), transitiveType ];
			if( thisSpec.continuous ) types.push('continuous');
			this.list.push( new RPWord( types, thisWord ) );
		}
	}
	// console.log( this );
	this.length = this.list.length;
	return this;
}

/**
 *  Static array representing the tenses of each element in a verb passed to RPWordListVerb
 */
RPWordListVerb.tenses = ['presentPlural','presentSingular','futurePlural','futureSingular','pastContinuousPlural','pastContinuousSingular','pastPlural','pastSingular','perfectPlural','perfectSingular','presentContinuousPlural','presentContinuousSingular','subjunctivePlural','subjunctiveSingular'];

/**
 *  Static array representing the default unpacking technique for simple verbs; &1 is replaced by the first word
 */
RPWordListVerb.unpackDefaults = ['','&1s','will &1','will &1','were &1ing','was &1ing','&1ed','&1ed','have &1ed','has &1ed','are &1ing','is &1ing','might &1','might &1'];

/**
 *  Returns 'transitive' or 'intransitive', biased toward whichever pool is bigger.  Eg, 5 transitive + 1 intransitive returns 'transitive' 5:1
 *  @return {string} 'transitive' or 'intransitive'
 */
RPWordListVerb.getRandomTransitivity = function () {
	return RPRandomFactors.computeFactor([ RPWordList.verbs.length, RPWordList.intransitiveVerbs.length ]) ? 'transitive' : 'intransitive';
}

/**
 *  Get a random word from the pool.
 *  Note that passing alreadyChosen{} actually weakens the overall strength of the passphrase slightly
 *  @param {string} [tense] - name of the tense being requested, eg. 'pastContinuousPlural'
 *  @param {boolean} [isPlural] - true if the plural form of the word is being requested
 *  @param {object} [alreadyChosen] - if a hash of words that are already chosen is provided, this will avoid returning one already chosen
 *  @return {object} an RPWord() object with the chosen word
 */
RPWordListVerb.prototype.getRandomWord = function ( tense, isPlural, alreadyChosen ) {
	var types = [];
  	if( typeof(isPlural) == 'boolean' )      types.push( isPlural ? 'plural' : 'singular'  );
	if( tense && tense == 'continuousPast' ) types.push('continuous','past');
	else if ( tense ) types.push( tense );
	
	var options = [];
	for( var wordNum=0; wordNum < this.list.length; wordNum++ ) {
		var thisWord = this.list[ wordNum ];
		if( ( !alreadyChosen || !alreadyChosen[ thisWord.value ] ) && thisWord.hasTypes( types ) ) options.push( thisWord );
	}
	if( !options.length ) throw "No verbs match criteria!";
	return options[ ReadablePassphrase.randomInt( options.length ) ];
}

/**
 *  This object represents a pool of random articles.  Currently there is only 1 article in the list "a", "an" or "the"
 *  @param {object[]} articleArray - an array of article objects {definite: ..., indefinite: ..., indefiniteBeforeVowel: ...}
 */
function RPWordListArticle( articleArray ) {
	this.list = articleArray;
	this.length = articleArray.length;
}

/**
 *  Get a random definite article from the pool.  Currently always returns 'the'
 *  @return {object} an RPWord() object with the chosen word
 */
RPWordListArticle.prototype.getRandomDefiniteArticle = function () { return this.getRandomWord( true ); }

/**
 *  Get a random indefinite article from the pool.  Currently always returns 'a/an'
 *  @return {object} an RPWord() object with the chosen word
 */
RPWordListArticle.prototype.getRandomIndefiniteArticle = function () { return this.getRandomWord( false ); }

/**
 *  Get a random article from the pool
 *  @param {boolean} definite - if true, returns a definite article (eg. 'the'), otherwise an indefinite one.
 *  @return {object} an RPWord() object with the chosen word
 */
RPWordListArticle.prototype.getRandomWord = function( definite ) {
	var word = this.list[ ReadablePassphrase.randomInt( this.list.length ) ];
	var returnWord = new RPWord( [ 'article', definite ? 'definite' : 'indefinite' ], definite ? word.definite : word.indefinite, word );
	if( !definite ) returnWord.indefiniteBeforeVowel = word.indefiniteBeforeVowel;
	return returnWord;
}

/**
 *  This object represents a pool of random numbers.
 *  @param {number} start - an integer representing where the lowest number to return
 *  @param {number} end - an integer representing the highest number to return
 */
function RPWordListNumber( start, end ) {
	this.start = start;
	this.end   = end;
	this.length = 1 + end - start;
}

/**
 *  Get a random singular number (always returns '1')
 *  @return {object} an RPWord() object with the chosen word
 */
RPWordListNumber.prototype.getSingularNumberWord = function() {
	return new RPWord( ['number', 'requiresSingularNoun' ], '1' );
}

/**
 *  Get a random plural number (between 2 and 'end', inclusive)
 *  @return {object} an RPWord() object with the chosen word
 */
RPWordListNumber.prototype.getPluralNumberWord = function() {
	var start = this.start;
	if( start < 2 ) start = 2;
	var thisNumber = ReadablePassphrase.randomInt( this.end - this.start ) + this.start;		
	return new RPWord( ['number' ], thisNumber.toString() );
}

/**
 *  This object represents a pool of indefinite pronouns.  There is currently 1 personal pronoun, and 1 impersonal
 *  @param {object[]} indefinitePronounArray - an array of indefinitePronoun objects {personal: [bool], singular: ..., plural: ...}
 */
function RPWordListIndefinitePronoun( indefinitePronounArray ) {
	this.list = indefinitePronounArray;
	this.length = indefinitePronounArray.length;
	this.personal   = [];
	this.impersonal = [];
	for( var pronounNum = 0; pronounNum < indefinitePronounArray.length; pronounNum++ ) {
		var thisPronoun = indefinitePronounArray[ pronounNum ];
		if( thisPronoun.personal ) this.personal.push( thisPronoun );
		else this.impersonal.push( thisPronoun );
	}	
}
/**
 *  Get a random word from the pool.
 *  @param {string} [personal] - true if a personal pronoun is being requested
 *  @param {boolean} [plural] - true if the plural form of the word is being requested
 *  @return {object} an RPWord() object with the chosen word
 */
RPWordListIndefinitePronoun.prototype.getRandomWord = function( personal, plural ) {
	var searchList = this.list;
	if( personal ) searchList = this.personal;
	else if( typeof(personal) != 'undefined' ) searchList = this.impersonal;
	
	var word = searchList[ ReadablePassphrase.randomInt( searchList.length ) ];
	var returnWord = new RPWord( [ 'indefinitePronoun', 'pronoun', 'indefinite', ( plural ? 'plural' : 'singular' ) ], word[ plural ? 'plural' : 'singular' ], word );
	return returnWord;
}

/**
 *  This object represents a set of random factors
 *  A factor is a name, followed by a specification.  If a spec is a boolean, string or number, then it will be returned as-is.
 *  If a spec is a 2-element array, then it will become a boolean with probability true A out of (A+B) times, eg [ 1, 4 ] is true 20% of the time.
 *  If a spec is an object, it will become a string with probability according to all values in the object, eg { a: 1, b: 2, c: 1, d: 0 } returns 'b' 50% of the time.
 *  @param {object} spec - an object describing the specification and weights of various factors
 */
function RPRandomFactors ( spec ) {
	for( var prop in spec ) this[prop] = spec[prop];
}

/**
 *  Get the value of a factor according to the weights assigned to it.
 *  @param {string} factorName - name of the factor being requested
 *  @return {string|boolean} returns the string (out of a set of choices) or boolean (out of a 2-element array) randomly chosen for this factor
 */
RPRandomFactors.prototype.byName = function ( factorName ) {
  return RPRandomFactors.computeFactor( this[factorName] )
}

/**
 *  Returns true if the given factor must always be true
 *  @param {string} factorName - name of the factor
 *  @return {boolean} true if the factor must always be true, false if there is any chance it might be false
 */
RPRandomFactors.prototype.mustBeTrue = function ( factorName )  { return this.chanceOf(factorName,true) == 1 ? true : false; } 
/* Function unused ---- 
RPRandomFactors.prototype.mustBeFalse = function ( factorName ) { return this.chanceOf(factorName,false) == 1 ? true : false; }
*/

/**
 *  Returns the odds that a given factor will have the given value
 *  @param {string} factorName - name of the factor
 *  @param {*} value - possible value of the factor, or boolean to find out if the factor could be true/false at all
 *  @return {number} floating-point probability between 0 and 1, eg 0.25
 */
RPRandomFactors.prototype.chanceOf = function ( factorName, value ) {
  switch( typeof(this[factorName]) ) {
	  case 'boolean': 
		value = value ? true : false;
		return ( this[factorName] == value ) ? 1 : 0;
	  case 'string': 
	  case 'number':
	    if( typeof(value) == 'boolean' ) {
			if( value ) return this[factorName] ? 1 : 0;
			else return this[factorName] ? 0 : 1;
		}
		return ( this[factorName] == value ) ? 1 : 0;
	  case 'object':  
	    if( this[factorName].length === undefined ) {
			var total = 0, thisWeight = this[factorName][value];
			for( var weightFactor in this[factorName] ) {
				total += this[factorName][weightFactor];
			}
			if( !total ) return 0;
			if( typeof(value) == 'boolean' ) {
				if( value ) return total ? 1 : 0;
				else return total ? 0 : 1;
			}
			return thisWeight / total;
		} else if( this[factorName].length == 2 ) {
			var total = this[factorName][0] + this[factorName][1];
			return value ? this[factorName][0] / total : this[factorName][1] / total;
		}
	  default: throw "Cannot compute chance of unknown object type: " + typeof(this[factorName]) + ' factor: ' + factorName;
  }
}

/**
 *  Returns the number of bits of entropy in a factor.  Eg a straight [ 1, 1 ] is a 50% chance = 1 bit
 *  @param {string} factorName - name of the factor
 *  @return {number} floating-point number of bits
 */
RPRandomFactors.prototype.entropyOf = function ( factorName ) { // return number of bits of entropy in a factor
  switch( typeof(this[factorName]) ) {
	  case 'boolean': 
	  case 'string': 
	  case 'number':
		return 0;
	  case 'object':  
	    if( this[factorName].length === undefined ) {
			var total = 0, totalEntropy = 0;
			for( var weightFactor in this[factorName] ) total += this[factorName][weightFactor];
			for( var weightFactor in this[factorName] ) {
				var thisChance = this[factorName][weightFactor] / total;
				if( thisChance ) totalEntropy += Math.abs( thisChance * Math.log2( thisChance ) );
			}
			return totalEntropy;
		} else if( this[factorName].length == 2 ) {
			var a = this[factorName][0], b = this[factorName][1], total = this[factorName][0] + this[factorName][1];
			return ( ( a / total ) * Math.log2( a / total ) + ( b / total ) * Math.log2( b / total ) );
		}
	  default: throw "Cannot compute chance of unknown object type: " + typeof(this[factorName]) + ' factor: ' + factorName;
  }
}

/* Function unused ----
RPRandomFactors.prototype.all = function() {
	var computed = {};
	for( var factor in this ) computed[factor] = RPRandomFactors.computeFactor( this[factor] );
	return computed;
}
*/

/**
 *  Static function that computes a random value for a specification, see RPRandomFactors() for possible specs
 *  @param {*} factor - specification
 *  @return {*} value of the factor, randomly-chosen if possible
 */
RPRandomFactors.computeFactor = function ( factor ) {
	switch( typeof( factor ) ) {
		case 'boolean': 
		case 'string':
		case 'number':
			return factor;
		case 'object':
			if( factor.length === undefined ) {
				var weights = [], totalWeight = 0;
				for( var weightFactor in factor ) {
					totalWeight += factor[ weightFactor ];
					weights.push({ value: weightFactor, weight: totalWeight });
				}
				if( totalWeight == 0 ) return false;
				
				var chosenWeight = ReadablePassphrase.randomness( totalWeight );
				for( var checkWeight=0; checkWeight < weights.length; checkWeight++ ) {
					if( chosenWeight < weights[ checkWeight ].weight ) {
						return weights[ checkWeight ].value;
						break;
					}
				}

				return false;
			} else if( factor.length == 2 ) {
				var chosenWeight = ReadablePassphrase.randomness( factor[0] + factor[1] );
				return ( chosenWeight > factor[0] ) ? false : true;
			} else throw "Unknown object type in computation";
			break;
		default:
			break;
	}
	return null;
}

/**
 *  This object represents a pattern for constructing a sentence.  See the README for constructing new sentence templates.
 *  @param {object[]} template - an array of clause objects
 */
function RPSentenceTemplate ( template ) {
	this.length = template.length;
	for( var i=0; i < template.length; i++ ) {
		var el = template[ i ];
		if( typeof(el) == 'string' ) this[ i ] = { type: el };
		else if( typeof(el) == 'object' && el.length ) { // reassemble packed templates
			switch( el[0] ) {
				case 'noun': 
					this[ i ] = { 
						type: 'noun', subtype: { common: el[1], proper: el[2], nounFromAdjective: el[3] },
						article: { none: el[4], definite: el[5], indefinite: el[6], demonstrative: el[7], personalPronoun: el[8] },
						adjective: el[9], preposition: el[10], number: el[11], singular: el[12]
					}; break;
				case 'verb': 
					this[ i ] = {
						type: 'verb', subtype: { present: el[1], past: el[2], future: el[3], continuous: el[4], continuousPast: el[5], perfect: el[6], subjunctive: el[7] },
						adverb: el[8], interrogative: el[9],
						intransitive: { noNounClause: el[10], preposition: el[11] }						
					}; break;
				default: throw "Error unpacking template spec array, unknown type: " + thisElement[0];					
			}
		} 
		else this[ i ] = el;
		if( this[i].type == 'noun' && this[i].article && !this[i].articleSingular ) { // unpack article weights into Singular and Plural for convenience later
			var s = {}, p = {};
			for( var articleType in this[i].article ) p[articleType] = s[articleType] = this[i].article[articleType];
			delete s['none']; delete p['indefinite']; delete this[i]['article']; // singular nouns must have an article, plural can't have indefinite
			this[i].articleSingular = s; this[i].articlePlural = p;
		}
	}	
	return this;
}

/**
 *  Returns the number of bits of entropy in the template
 *  @return {number} floating-point number of bits
 */
RPSentenceTemplate.prototype.entropy = function () {
	var totalEntropy = 0, currentMultiplier = 1;

	function len2log( listName ) { return Math.log2( RPWordList[listName].length ); } // helper function
	
	for( var templateNum=0; templateNum < this.length; templateNum++ ) switch( this[templateNum].type ) {
		case 'conjunction':  totalEntropy += len2log('conjunctions') * currentMultiplier; break;
		case 'directSpeech': totalEntropy += len2log('speechVerbs') * currentMultiplier; break;
		case 'noun':
			var factors = new RPRandomFactors(this[templateNum]), thisEntropy = 0;
			thisEntropy += factors.entropyOf('subtype');
			thisEntropy += factors.chanceOf('subtype','proper') * len2log('properNouns');
			var preludeEntropy = (
				factors.entropyOf('preposition') + factors.entropyOf('singular') +
				( factors.chanceOf('preposition',true) * len2log('prepositions') ) +										
				( factors.chanceOf('singular',true) * (
					factors.entropyOf('articleSingular') +
					( factors.chanceOf('articleSingular','definite') * len2log('articles') ) +
					( factors.chanceOf('articleSingular','indefinite') * len2log('articles') ) +
					( factors.chanceOf('articleSingular','demonstrative') * len2log('demonstratives') ) +
					( factors.chanceOf('articleSingular','personalPronoun') * len2log('personalPronouns') )
				  )
				) +
				( factors.chanceOf('singular',false) * (
					factors.entropyOf('articlePlural') +
					( factors.chanceOf('articlePlural','definite') * len2log('articles') ) +
					( factors.chanceOf('articlePlural','demonstrative') * len2log('demonstratives') ) +
					( factors.chanceOf('articlePlural','personalPronoun') * len2log('articles') )				
				  )
				)
			);			
			thisEntropy += factors.chanceOf('subtype','common') * (
				len2log('nouns') + factors.entropyOf('adjective') + preludeEntropy +
				( factors.chanceOf('adjective',true) * len2log('adjectives') ) + 					
				( factors.chanceOf('singular',false) * factors.chanceOf('number',true) * len2log('numbers') )
			);
			
			thisEntropy += factors.chanceOf('subtype','nounFromAdjective') * (	len2log('indefinitePronouns') +	preludeEntropy + len2log('adjectives') );
			totalEntropy += thisEntropy * currentMultiplier;
			break;
		case 'verb':
			var factors = new RPRandomFactors(this[templateNum]), intLen = RPWordList.intransitiveVerbs.length, tranLen = RPWordList.verbs.length;
			var totalLen = intLen + tranLen;
			var chanceOfIntransitive = intLen / totalLen;
			var thisEntropy = (				
				factors.entropyOf('interrogative') + factors.entropyOf('adverb') + factors.entropyOf('adverb') + 
				( chanceOfIntransitive * Math.log2( chanceOfIntransitive ) + ( tranLen / totalLen ) * Math.log2( tranLen / totalLen ) ) +
				( factors.chanceOf('interrogative',true) * len2log('interrogatives') ) + 
				( factors.chanceOf('adverb',true) * ( len2log('adverbs') + 1 ) ) + 
				( chanceOfIntransitive * factors.chanceOf('intransitive','preposition') * len2log('prepositions') )
			);
			totalEntropy += thisEntropy * currentMultiplier;
			currentMultiplier *= 1 - ( chanceOfIntransitive * factors.chanceOf('intransitive','noNounClause') );
			break;				
		default: throw "Unknown clause type in entropy";
	}
	return totalEntropy;
}

/**
 *  Static function to return the number of bits of entropy in the given template
 *  @param {string} templateName - name of the template
 *  @return {number} floating-point number of bits
 */
RPSentenceTemplate.entropyOf = function ( templateName ) {
	var template = RPSentenceTemplate.templates[ templateName ];

	if( typeof(template[0]) == 'string' ) { // it's a collection of templates, not a template itself
		var entropy = 0; 
		template.forEach(function ( templateName ) { entropy += RPSentenceTemplate.entropyOf( templateName ); });
		return ( entropy / template.length ) + Math.log2( template.length ); // gain some entropy for choosing a random template
	}

	return template.entropy();
}

/**
 *  Static function to return a template of the given name 
 *  (if the template is a collection of other templates, returns a random template from the collection)
 *  @param {string} templateName - name of the template
 *  @return {object} RPSentenceTemplate() object
 */
RPSentenceTemplate.byName = function ( templateName ) {	
	var template = RPSentenceTemplate.templates[ templateName ];
	
	if( typeof(template[0]) == 'string' ) { // it's a collection of templates, not a template itself
		templateName = template[ ReadablePassphrase.randomInt( template.length ) ];
		template = RPSentenceTemplate.templates[ templateName ];
	}
	
	template.name = templateName;
	return template;
}

/*
 *   ******************* DATA *******************
 *   RPSentence.templates = A set of sentence templates, used to construct predefined sentences
 *   RPWordList.{wordtype} = A static global object that wraps a list of parts of some kind
 */

 RPSentenceTemplate.templates = {
	// Shorthand to select a random template out of a set of similar ones
	'random': [ 'normal', 'normalAnd', 'normalSpeech', 'strong', 'strongAnd', 'strongSpeech', 'insane', 'insaneAnd', 'insaneSpeech' ],
	'randomShort': [ 'normal', 'normalEqual', 'normalRequired', 'strong', 'insane', 'strongEqual' ],
	'randomLong':  [ 'normalAnd', 'normalSpeech', 'normalEqualSpeech', 'normalRequiredAnd', 'normalRequiredSpeech', 'insaneEqual', 'normalEqualAnd', 'strongRequired', 'strongSpeech', 'strongAnd' ],
	'randomForever': [ 'strongEqualSpeech', 'insaneAnd', 'insaneSpeech', 'strongEqualAnd', 'insaneRequired', 'strongRequired', 'strongRequiredSpeech', 'insaneEqualSpeech', 'insaneEqualAnd', 'strongRequiredAnd', 'insaneRequiredSpeech', 'insaneRequiredAnd' ],

	// actual templates
    normal: new RPSentenceTemplate([['noun',12,1,2,5,4,4,0,2,false,false,[1,5],true],['verb',10,8,8,0,0,0,0,false,[1,8],0,0],['noun',1,0,0,5,4,4,0,2,false,false,false,true]]),
    normalAnd: new RPSentenceTemplate([['noun',12,1,2,5,4,4,0,2,false,false,[1,5],true],['verb',10,8,8,0,0,0,0,false,[1,8],0,0],['noun',1,0,0,5,4,4,0,2,false,false,false,true],'conjunction',['noun',1,0,0,5,4,4,0,2,false,false,false,true]]),
    normalSpeech: new RPSentenceTemplate([['noun',7,1,0,0,4,4,0,2,false,false,false,true],'directSpeech',['noun',12,1,2,5,4,4,0,2,false,false,[1,5],true],['verb',10,8,8,0,0,0,0,false,[1,8],0,0],['noun',1,0,0,5,4,4,0,2,false,false,false,true]]),
    normalEqual: new RPSentenceTemplate([['noun',1,1,1,1,1,1,0,1,false,false,[1,1],true],['verb',1,1,1,0,0,0,0,false,[1,1],0,0],['noun',1,0,0,1,1,1,0,1,false,false,false,true]]),
    normalEqualAnd: new RPSentenceTemplate([['noun',1,1,1,1,1,1,0,1,false,false,[1,1],true],['verb',1,1,1,0,0,0,0,false,[1,1],0,0],['noun',1,0,0,1,1,1,0,1,false,false,false,true],'conjunction',['noun',1,0,0,1,1,1,0,1,false,false,false,true]]),
    normalEqualSpeech: new RPSentenceTemplate([['noun',1,1,0,0,1,1,0,1,false,false,false,true],'directSpeech',['noun',1,1,1,1,1,1,0,1,false,false,[1,1],true],['verb',1,1,1,0,0,0,0,false,[1,1],0,0],['noun',1,0,0,1,1,1,0,1,false,false,false,true]]),
    normalRequired: new RPSentenceTemplate([['noun',1,1,1,0,1,1,0,1,false,false,true,true],['verb',1,1,1,0,0,0,0,false,[1,1],0,0],['noun',1,0,0,0,1,1,0,1,false,false,false,true]]),
    normalRequiredAnd: new RPSentenceTemplate([['noun',1,1,1,0,1,1,0,1,false,false,true,true],['verb',1,1,1,0,0,0,0,false,[1,1],0,0],['noun',1,0,0,0,1,1,0,1,false,false,false,true],'conjunction',['noun',1,0,0,0,1,1,0,1,false,false,false,true]]),
    normalRequiredSpeech: new RPSentenceTemplate([['noun',1,1,0,0,1,1,0,1,false,false,false,true],'directSpeech',['noun',1,1,1,0,1,1,0,1,false,false,true,true],['verb',1,1,1,0,0,0,0,false,[1,1],0,0],['noun',1,0,0,0,1,1,0,1,false,false,false,true]]),
    strong: new RPSentenceTemplate([['noun',12,1,2,5,4,4,1,2,false,false,[1,4],[7,3]],['verb',10,10,10,5,5,5,2,false,[1,8],0,4],['noun',1,0,0,5,4,4,1,2,[3,6],[1,15],false,true]]),
    strongAnd: new RPSentenceTemplate([['noun',12,1,2,5,4,4,1,2,false,false,[1,4],[7,3]],['verb',10,10,10,5,5,5,2,false,[1,8],0,4],['noun',1,0,0,5,4,4,1,2,[3,6],[1,15],false,true],'conjunction',['noun',1,0,0,5,4,4,1,2,[3,6],false,false,true]]),
    strongSpeech: new RPSentenceTemplate([['noun',7,1,0,0,4,4,1,2,false,false,false,[7,3]],'directSpeech',['noun',12,1,2,5,4,4,1,2,false,false,[1,4],[7,3]],['verb',10,10,10,5,5,5,2,false,[1,8],0,4],['noun',1,0,0,5,4,4,1,2,[3,6],[1,15],false,true]]),
    strongEqual: new RPSentenceTemplate([['noun',1,1,1,1,1,1,1,1,false,false,[1,1],[1,1]],['verb',1,1,1,1,1,1,1,false,[1,1],0,1],['noun',1,0,0,1,1,1,1,1,[1,1],[1,1],false,true]]),
    strongEqualAnd: new RPSentenceTemplate([['noun',1,1,1,1,1,1,1,1,false,false,[1,1],[1,1]],['verb',1,1,1,1,1,1,1,false,[1,1],0,1],['noun',1,0,0,1,1,1,1,1,[1,1],[1,1],false,true],'conjunction',['noun',1,0,0,1,1,1,1,1,[1,1],false,false,true]]),
    strongEqualSpeech: new RPSentenceTemplate([['noun',1,1,0,0,1,1,1,1,false,false,false,[1,1]],'directSpeech',['noun',1,1,1,1,1,1,1,1,false,false,[1,1],[1,1]],['verb',1,1,1,1,1,1,1,false,[1,1],0,1],['noun',1,0,0,1,1,1,1,1,[1,1],[1,1],false,true]]),
    strongRequired: new RPSentenceTemplate([['noun',1,1,1,0,1,1,1,1,false,false,true,[1,1]],['verb',1,1,1,1,1,1,1,false,[1,1],0,1],['noun',1,0,0,0,1,1,1,1,true,true,false,true]]),
    strongRequiredAnd: new RPSentenceTemplate([['noun',1,1,1,0,1,1,1,1,false,false,true,[1,1]],['verb',1,1,1,1,1,1,1,false,[1,1],0,1],['noun',1,0,,0,1,1,1,1,true,true,false,true],'conjunction',['noun',1,0,0,0,1,1,1,1,true,false,false,true]]),
    strongRequiredSpeech: new RPSentenceTemplate([['noun',1,1,0,0,1,1,1,1,false,false,false,[1,1]],'directSpeech',['noun',1,1,1,0,1,1,1,1,false,false,true,[1,1]],['verb',1,1,1,1,1,1,1,false,[1,1],0,1],['noun',1,0,0,0,1,1,1,1,true,true,false,true]]),
    insane: new RPSentenceTemplate([['noun',8,0,1,5,4,4,1,2,[3,6],false,[1,3],[7,3]],['verb',10,10,10,5,5,5,5,[3,10],[1,8],1,5],['noun',1,0,0,5,4,4,1,2,[3,6],[2,8],false,[7,3]]]),
    insaneAnd: new RPSentenceTemplate([['noun',8,0,1,5,4,4,1,2,[3,6],false,[1,3],[7,3]],['verb',10,10,10,5,5,5,5,[3,10],[1,8],1,5],['noun',1,0,0,5,4,4,1,2,[3,6],[2,8],false,[7,3]],'conjunction',['noun',1,0,0,5,4,4,1,2,[3,6],false,false,[7,3]]]),
    insaneSpeech: new RPSentenceTemplate([['noun',7,1,0,0,4,4,1,2,[3,6],false,false,[7,3]],'directSpeech',['noun',8,0,1,5,4,4,1,2,[3,6],false,[1,3],[7,3]],['verb',10,10,10,5,5,5,5,[3,10],[1,8],1,5],['noun',1,0,0,5,4,4,1,2,[3,6],[2,8],false,[7,3]]]),
    insaneEqual: new RPSentenceTemplate([['noun',1,0,1,1,1,1,1,1,[1,1],false,true,[1,1]],['verb',1,1,1,1,1,1,1,[1,1],[1,1],1,1],['noun',1,0,0,1,1,1,1,1,[1,1],[1,1],false,[1,1]]]),
    insaneEqualAnd: new RPSentenceTemplate([['noun',1,0,1,1,1,1,1,1,[1,1],false,[1,1],[1,1]],['verb',1,1,1,1,1,1,1,[1,1],[1,1],1,1],['noun',1,0,0,1,1,1,1,1,[1,1],[1,1],false,[1,1]],'conjunction',['noun',1,0,0,1,1,1,1,1,[1,1],false,false,[1,1]]]),
    insaneEqualSpeech: new RPSentenceTemplate([['noun',1,1,0,0,1,1,1,1,[1,1],false,false,[1,1]],'directSpeech',['noun',1,0,1,1,1,1,1,1,[1,1],false,[1,1],[1,1]],['verb',1,1,1,1,1,1,1,[1,1],[1,1],1,1],['noun',1,0,0,1,1,1,1,1,[1,1],[1,1],false,[1,1]]]),
    insaneRequired: new RPSentenceTemplate([['noun',1,0,1,0,1,1,1,1,true,false,true,[1,1]],['verb',1,1,1,1,1,1,1,true,[1,1],1,1],['noun',1,0,0,0,1,1,1,1,true,true,false,[1,1]]]),
    insaneRequiredAnd: new RPSentenceTemplate([['noun',1,0,1,0,1,1,1,1,true,false,true,[1,1]],['verb',1,1,1,1,1,1,1,true,[1,1],1,1],['noun',1,0,0,0,1,1,1,1,true,true,false,[1,1]],'conjunction',['noun',1,0,0,0,1,1,1,1,true,false,false,[1,1]]]),
    insaneRequiredSpeech: new RPSentenceTemplate([['noun',1,1,0,0,1,1,1,1,true,false,false,[1,1]],'directSpeech',['noun',1,0,1,0,1,1,1,1,true,false,true,[1,1]],['verb',1,1,1,1,1,1,1,true,[1,1],1,1],['noun',1,0,0,0,1,1,1,1,true,true,false,[1,1]]])	
};

RPWordList.numbers = new RPWordListNumber( 1, 999 );
RPWordList.indefinitePronouns = new RPWordListIndefinitePronoun([ {singular:'one',personal:true,plural:'ones'}, {singular:'thing',personal:false,plural:'things'} ]);
RPWordList.conjunctions = new RPWordList('conjunction', [ 'and','or','but not','after','before','because of','and even' ]);
RPWordList.personalPronouns = new RPWordListPlural('personalPronoun', [['my','our'],['your','your'],['their','their'],['his','his'],['her','her'],['its','its']]);
RPWordList.demonstratives = new RPWordListPlural('demonstrative', [['this','these'], ['that','those']]);
RPWordList.interrogatives = new RPWordListPlural('interrogative', [['why does','why do'],['how does','how do'],['when does','when did'],['can','can'],['will','will'],['should','should']]);
RPWordList.articles = new RPWordListArticle([{definite:'the',indefiniteBeforeVowel:'an',indefinite:'a'}]);

RPWordList.adjectives = new RPWordList('adjective', [
  'downsized','scuffed','cadged','embattled','milky','dim','neuter','drooping','double','heated','zealous','starboard','yesterday','smarter','obtruding',
  'fit','numbed','premature','lucid','waggish','invited','stunted','menacing','unblocked','tinniest','retinal','drugged','sublime','snuggling','velvet',
  'reserved','hitched','forlorn','plumb','human','swish','edible','fourth','new','recent','feisty','ocular','fleeting','rigid','cheesy',
  'crummy','flaky','plaid','slouchy','huge','synthetic','overgrown','purple','onshore','sporty','abrupt','wheezy','manly','cranky','foul',
  'vellum','squeaky','lazy','temporary','ethnic','intricate','underpaid','vegan','impartial','creaky','motly','cellular','piercing','dizzy','floating',
  'dustless','depressed','deceitful','top','analogue','bleak','essential','hanging','dandy','unfeeling','lovely','sturdy','frantic','rash','luxuriant',
  'arctic','bad','chrome','platinum','overrun','corrupt','darkened','underfoot','sassy','droll','solo','hotshot','upland','intrinsic','mindful',
  'jaundiced','elaborate','fifth','dwarf','gruesome','hinged','insensed','still','quirky','noble','sixteenth','federal','entwined','rearward','right',
  'mute','trill','smug','haughty','vengeful','pale','unworthy','burlesque','thirteenth','literate','elongated','roomful of','brackish','mild','botanical',
  'bombastic','airborn','crinkly','crisp','dotty','northerly','zestful','trite','grim','tough','front','indolent','comforting','pushy','awestruck',
  'east','forked','debased','sandstone','pitiless','sallow','external','austere','bearded','rare','comfy','jubilant','satirical','thermal','dewy',
  'young','unmanly','symbolic','unsound','fiat','sandy','outbound','upright','uttermost','fiftieth','obsolete','uneasy','angry','stupid','woven',
  'ductless','chintzy','nosy','robust','seasick','cambered','tenth','small','pungent','immutable','luxury','topical','limited','slightest','midstream',
  'dense','flexible','jagged','tender','comical','supreme','semantic','inherent','hostile','exiguous','scurfy','subnormal','teeny','muggy','dull',
  'geeky','gutsy','basic','lowly','shadey','limp','worthy','bass','saltwater','princely','flintlock','spherical','sympathy','timeworn','dry',
  'laudable','dimwitted','prissy','wise','galvanic','related','sullied','electoral','live','empty','snug','nervy','bitter','stuffy','erect',
  'insidious','blond','raspy','disjoint','genetic','ruddy','reluctant','fungal','leaky','aquiline','goofy','eager','quantum','loose','ace',
  'easy','incoming','snobby','fatal','exclusive','spongy','erroneous','tonal','polite','dapper','fuzzy','ceaseless','unfit','white','unfeigned',
  'prefab','sneaky','womanlike','treacherous','airy','treeless','senile','vile','chaotic','tartan','blank','cheerful','legendary','analogous','worldly',
  'sopping','round','wacky','lengthy','venal','cardiac','pragmatic','dignified','rabid','nippy','glassy','festive','leftward','boldface','unproven',
  'calorific','specific','dutiful','humble','flatbed','stellar','lanky','sleek','sensual','cubic','slovenly','racist','crass','queer','slick',
  'woozy','isotropic','classy','fictional','infinite','adoptive','superb','aural','overpriced','glad','tweed','dulcet','turnkey','future','jolly',
  'stale','weak','swampy','loony','compact','umpteenth','express','waxy','conjoined','ambitious','free','clammy','seedy','talented','thrifty',
  'beastly','inept','unsent','brighter','upstate','lenient','acute','ferrous','jumpy','zesty','trenchant','temporal','speedy','priceless','solemn',
  'firm','moody','scabby','frisky','doomed','migratory','grisly','prime','green','even','fashionable','blustery','tribal','outrageous','gaunt',
  'edgy','pokey','spruce','nonhuman','shoddy','invasive','lavish','provable','rough','immobile','musty','paunchy','frigid','default','ruminant',
  'untainted','unfailing','major','unwashed','foggy','tuneless','slim','mammoth','topless','unheeded','snazzy','tattered','baby','musical','corporate',
  'scary','bulimic','dauntless','stealthy','stealth','untried','tall','dazzling','classic','vocational','prim','charred','vaguest','masked','blind',
  'manganese','overnight','bucktooth','excepting','incised','fancy','colonial','confused','sincere','ample','polygamous','servile','printable','plump','armful of',
  'midweek','congruant','brash','medicated','academic','specious','frosty','ranked','cindered','lousy','replica','balsamic','attentive','stout','precise',
  'lofty','smokeless','massive','invidious','brusque','arthritic','leeward','pulpy','mighty','retail','narrow','clanking','maximum','stinky','spacey',
  'pretty','charcoal','unspoken','gummy','dictated','uric','crumby','hopeful','speckled','calypso','wispy','carsick','trotting','hardwood','midwinter',
  'timid','moral','amoral','immoral','tallest','beryllium','misguided','mottled','pedicured','deleted','slain','stateless','punchy','cynical','sullen',
  'dual','hoarse','stonework','reported','surbid','sulky','buzzing','manic','wimpy','condensed','broad','spotty','argumentative','overcast','cola flavoured',
  'dashing','mucky','prior','wanton','prickly','staunch','weird','vehicular','bloodstained','biased','few','nickel','opaque','coercive','horrid',
  'shapely','noisy','populous','easygoing','immense','serial','doggone','nearby','cold','gay','wet','weary','tangled','incorrect','pert',
  'brown','funny','fluffy','snooty','loud','ambiguous','hungry','insightful','swanky','cuddly','medical','sexy','fifteenth','horsey','braided',
  'conniving','eloquent','illegal','steady','divine','faintest','faint','imprudent','flat','modal','nodular','misstated','reclining','perfumed','deceptive',
  'messy','crispest','wackier','grievous','trashy','starless','vitriolic','frightened','squally','sleeker','serious','wooded','elated','slender','coherent',
  'colossal','aliased','tiny','crude','crudest','scanty','tangy','tangiest','relevant','soapy','twin','dubious','infamous','untouched','spicy',
  'spiciest','inorganic','weedy','weedier','retrained','hyper','witless','surplus','buttery','gaseous','intense','cute','mangy','premium','least',
  'immature','yummy','solitary','jazzy','elastic','lacy','sappy','strapless','deflated','misled','nerdy','unplanned','meek','westerly','chilling',
  'notorious','forgetful','artistic','clerical','penal','ripe','unripe','gleeful','equable','overspent','safe','divergent','droopy','decimal','unscrewed',
  'lurid','backhanded','breezy','garaged','uplifting','monastic','oak','wooden','glorious','mock','damp','coded','communist','strict','central',
  'snappy','spiny','dazed','widowed','spiced','curved','portable','oversold','heaped','oval','lovesick','eastbound','dislocated','ritual','envious',
  'nodal','legal','angular','ajoining','primary','binary','bleary','frazzled','horned','hypo','ritzy','typed','aware','beloved','loved',
  'doctored','anecdotal','powerful','flooded','dangerous','addicted','addictive','tragic','melted','sweet','torched','amethyst','serene','etched','aspiring',
  'crafty','ready','creamy','penitent','mercurial','expected','juicy','bleeping','depleted','thick','unkind','calico','hard','harder','total',
  'flashy','nude','elemental','scant','punitive','perturbed','fiddly','splotchy','curdled','deadbeat','retarded','axial','ironical','terraced','valuable',
  'subsonic','supersonic','sonic','steam','large','fried','friable','prosperous','belching','hoarded','grimy','stiff','aggrieved','aggrievated','relaxed',
  'relaxing','level','chaste','hardy','extinct','nonverbal','aroused','hollow','rocky','fine','paternal','wingless','black','mixed','lesser',
  'sporting','seismic','shrunken','stranded','various','mineral','correct','spirited','cutest','harsh','spasmodic','plentiful','airborne','naive','unready',
  'cannoned','gunked','gunky','orderly','happy','happier','antique','schooled','bronchial','softwood','flopping','tubular','deaf','sarcastic','lush',
  'hygienic','slack','acrostic','racest','racey','endearing','bitchy','winning','curried','light','lightest','husky','crumbling','stringy','low',
  'shortwave','smart','sesame','recessed','voodoo','healthy','dirty','thorough','irate','impure','soluble','sticky','itchy','divorced','foldaway',
  'rowdy','mad','honeycomb','irrigated','chance','sad','fearful','rustic','unknowning','twirling','tangible','busy','sloppy','proper','pulsing',
  'bedside','throaty','scrappy','crazed','noisier','nosier','sorrowful','severe','tipsy','fluent','musky','fizzy','fizzier','national','roughest',
  'lame','binomial','runny','mirky','witty','loveless','plush','committed','loadable','bodily','gusty','enhanced','ghastly','drab','gigantic',
  'bulging','perplexed','segmented','victorious','scythed','jumbo','nice','animist','rugged','textured','doughy','debonair','decoy','outdoor','toneless',
  'swell','certified','curly','perky','coy','offside','sizable','rife','unhinged','course','gloved','unwell','marshy','weekly','plausible',
  'elder','equitible','sadistic','fellow','sleepy','alert','testate','intestate','in vogue','stopgap','zigzag','clueless','lean','rustproof','vaporous',
  'profound','prorata','pebbly','sparkly','safer','odd','stagnant','heavy','shimmering','target','amphibious','secret','downward','bungled','maverick',
  'apt','impatient','bedraggled','single','disruptive','impending','uncooked','cooked','defeatist','bigoted','folded','powdered','premier','waddling','whining',
  'stammering','aligned','great','greatest','bushy','suitable','deep','pinned','unpinned','modest','viscous','eighteen','prudent','tame','bent',
  'unbent','paved','liberal','mature','lunar','bald','listed','torrid','likely','realistic','veneered','suburban','teal','decadent','benchmark',
  'mellow','backless','ironic','beneficial','depraved','giggly','trump','batty','whimsical','reedy','trim','trivial','junior','indigo','mesh',
  'drolly','brief','crested','immediate','bleached','livid','leather','big','civilian','wrinkled','wistful','octagonal','outward','vain','motivated',
  'smarmy','roguish','insured','frayed','chatty','northwest','stable','unstable','misogynic','moist','upstart','metal','seething','passing','miscast',
  'cement','repentant','cautious','occasional','nutty','brainy','aft','token','filleted','courteous','squashy','squishy','athletic','countless','legible',
  'blanched','exchanged','preened','usual','soupy','flaying','tolerant','dependent','neodymium','hazy','head','annual','phosphorus','connected','renowned',
  'cancerous','six','sixth','mangled','finite','poor','poorest','tawny','flaking','charted','uncharted','watery','hulking','untamed','hilly',
  'injured','topaz','punctual','seedless','pricey','slight','movable','immovable','equipped','subtle','proxy','mushy','living','rival','false',
  'enchanted','guided','bottom','nominated','written','aimless','hereabout','bony','sharp','stacked','herbal','skimpy','febrile','starched','delicate',
  'squealing','scottish','neutral','freaky','imitation','absent','allotted','dejected','guest','original','crooked','wordy','clean','excitable','semitone',
  'pure','quiet','legacy','sherbet','lawful','unlawful','full','hot','junk','atypical','monolithic','unsaddled','saddled','kind','bronze',
  'outboard','inboard','satin','sour','anxious','ulterior','bilateral','taut','hesitant','teary','inscribed','brave','anarchic','obtuse','succulent',
  'absurd','swift','septic','studious','projected','lustful','caustic','cloth','snide','glitzy','flint','unbroken','broken','adherent','submersable',
  'submersed','zippy','glass','orbital','arsenic','unplumbed','hurried','tired','esteemed','estimated','chilly','waxing','inspected','ash','immortal',
  'surly','sexist','ageist','teak','winter','grizzly','virgin','virginal','cavernous','bugged','hazardous','ludicrous','dismayed','wounded','sick',
  'composite','mortal','shy','buff','imperial','thematic','famous','dear','headline','stodgy','crucial','woofing','rank','vacant','piggish',
  'long','longish','reusable','atomic','base','underused','averse','fair','fairest','plastic','ordered','endless','epileptic','walleyed','wriggly',
  'abrasive','warm','eminent','gainful','peeved','isotopic','undue','barbed','leafless','bubbly','observant','trusty','summer','grumbling','printed',
  'blurry','heady','eternal','lockable','locked','unlocked','syrupy','ashen','cocoa','godly','auxiliary','lusty','groovy','emotive','emotional',
  'hardened','backward','kosher','phychic','silly','rented','notched','midterm','former','endemic','admirable','alluring','confined','oilskin','ebony',
  'devious','faithful','seventy','standout','inflamed','dreary','crimson','boiled','boiling','bound','bounded','beryl','stricken','agile','unisex',
  'homely','labeled','murky','breezier','wrecked','older','common','old','symmetric','crystal','helical','pitiful','elite','icky','sunken',
  'schmaltzy','imperfect','curvy','vanilla','hysterical','quiescent','fluorescent','customary','overripe','evergreen','royal','touchy','didactic','dietetic','felt',
  'gangrene','ceramic','grooved','larger','cotton','amplified','piggyback','nocturnal','wavy','deluxe','stripped','anatomic','gib','stoic','miniscule',
  'forced','untrue','flammable','planar','daring','grilled','easterly','awkward','angora','bridal','tasty','suede','eight','eighth','stony',
  'acrylic','laughable','lax','triennial','negative','vivid','inspired','infested','revived','jerky','newer','bigger','biggest','broader','softer',
  'soft','softest','dreadful','last','risky','slate','excluded','inner','sheer','tomorrows','middle','dicey','scandalous','ultimate','off',
  'listing','boggy','estranged','just','crochet','nicotine','factual','inbound','glittering','humorous','yellow','yellowed','overrated','quick','dreamy',
  'creaking','deppest','redefined','spiky','jilting','jilted','runaway','complex','disgraced','acclaimed','panicked','yucky','bland','unethical','fifty',
  'slapstick','concerned','trapezoidal','standard','steep','tardy','origami','garish','choosy','dative','tandem','ovarian','noontime','lauded','intellectual',
  'snotty','ordained','flush','transient','pithy','clear','loyal','alkaline','scruffy','savvy','arbitrary','deft','merry','bedridden','unopposed',
  'excited','exciting','inverse','resonant','cruddy','gentle','jaunt','urban','bumptious','malignant','oriental','jealous','arty','artless','curable',
  'airless','deciduous','optimum','prodigal','varnished','reborn','golden','unclaimed','toothy','kinky','crap','taken','stolen','rotten','credible',
  'incredible','local','muddy','strolling','ranting','disused','niggling','spotted','true','federated','shabby','second','flaming','barbarous','halftime',
  'imposing','artsy','queasy','springy','glossy','flannel','radium','tingling','comfier','dawdling','westward','shifty','high','gloats','reticent',
  'veteran','bulky','virtual','tampered','hubristic','plain','vibrating','fantastic','cashmere','unseen','undecided','epicurean','gurgling','dreaming','thieving',
  'coddled','radial','abraded','taxonomic','starchy','matchless','coarse','hexagonal','legit','harrowing','stillborn','convincing','paper','papery','cheery',
  'primal','wide','freight','oviparous','furrowed','zany','simple','frizzy','uniform','uneven','grouchy','hip','drizzly','wettest','third',
  'ungainly','sissy','rude','industrial','clumsy','moudly','dud','sedated','red','untiring','unlatched','saline','covert','sodden','strewn',
  'doctoral','collared','sugared','pudgy','steel','night','acrid','driest','ornamental','abstract','rehearsed','glib','malt','appealing','gunpowder',
  'ninth','kinked','nylon','slanted','slanty','licensed','wasteful','joyous','excessive','metric','worthless','unusual','inanimate','nonfatal','vintage',
  'grafted','nautical','cloaked','azure','crazy','subtitled','draft','dire','kingly','idle','relegated','catchy','foolish','baggy','enticing',
  'autumn','burly','scum','clover','gouty','billion','automated','turgid','roundish','waggling','phonic','sweeter','disfigured','muddled','jarring',
  'tin','tinfoil','nauseous','cruel','shocking','guessable','futile','marauding','bristling','enlarged','iliterate','drudging','clingy','blunt','blunted',
  'malleable','racked','stocked','dusty','contorted','diabetic','cremated','blundering','polar','rumpled','scorching','joyful','little','grand','liquid',
  'romantic','sparkling','rosy','dour','extracted','ruffled','gamey','ergonomic','utmost','bottled','brisk','lumpy','lesbian','dripping','stoked',
  'thin','abusive','abortive','drowsy','polyphonic','remote','educated','thoughtful','sober','dismissed','unnatural','vital','alto','fanciful','modern',
  'oddest','submissive','adjacent','jointed','torpid','showy','overborne','skilled','skillful','drunk','creepy','pearly','mutant','metro','whisked',
  'slanting','lined','tectonic','amazing','superior','tenuous','windy','extra','flayful','umber','best','lucky','slow','online','celestial',
  'choppy','acetic','leaning','harmful','glamourous','blooming','smooth','sound','paisley','offensive','perceptive','polluted','ratified','dynamic','shanty',
  'composed','humane','streaky','sponsored','devoted','planetary','hairy','cracked','patriotic','assisted','roomy','numb','rigorous','decreasing','nubile',
  'mundane','tearful','brittle','cockney','loopy','snowbound','exiled','frowzy','wonderful','solar','unmatched','riffled','woeful','designer','penniless',
  'wild','repressed','urgent','aquatic','inflated','rightful','weighty','unruly','sluggish','enthralled','hungover','anomalous','toasty','cocked','horny',
  'raggedy','glowing','infected','midland','sentient','stary','crossbred','adverse','split','ruling','damned','jobless','dishevelled','fierce','decisive',
  'religious','stolid','corroded','complete','stray','mere','latent','enjoyable','whopping','polished','peripheral','unsteady','unsuited','stifled','diocesan',
  'rampant','twirly','slang','thriving','cool','tense','desolate','vigilant','oscillating','arching','blustering','wry','beaded','dorky','overdone',
  'ideal','filthy','oily','revised','daily','quivering','scratched','furnished','diesel','paltry','dramatic','routine','warring','outgoing','cobbled',
  'gaudy','unbending','frail','widest','giggling','scarlet','spinal','shinning','pesky','baulky','countable','formal','tilled','confusing','oversexed',
  'confident','orphaned','piecemeal','mirthless','mid-air','unusable','towering','aching','aged','blonde','brazen','virulent','exposed','deadly','wholesome',
  'bearish','filial','unsightly','eldest','blissful','unsung','brewed','allied','peculiar','greasy','patchy','trapped','overseas','unequal','pelvic',
  'frothy','submerged','terrified','geologic','geological','turquoise','cortical','soprano','unhelpful','contoured','eerie','disguised','squelchy','petulant','broiled',
  'peach','forward','climactic','cannibal','required','rapturous','naked','dainty','rhodium','patient','subdued','lowest','lawless','unwise','feathered',
  'insulated','gigabit','systemic','sprawling','settled','svelte','hunched','inky','nuanced','heroic','repulsive','chained','pink','sideways','optic',
  'faded','cerebral','rye','unbranded','starry','mutual','wood','worse','unaware','swirly','lighter','stylish','digested','indoor','decorated',
  'quixotic','paralysed','silent','globular','hosed','extrinsic','larval','corrugated','adjusted','emerald','buoyant','overpaid','mystical','garlic','implicit',
  'nuclear','solid','cocooned','tricky','morbid','mulish','orthodox','rewritten','guttural','incisive','slothful','pallid','soviet','pine','serrated',
  'funnier','nonempty','muted','lecherous','dowdy','average','random','mirthful','knightly','downwind','united','untidy','pleasent','resilient','papal',
  'aromatic','iron','studded','better','introverted','unrefined','forseen','unforseen','habitable','unified','threefold','aqua','unbidden','magnum','southern',
  'fused','recycled','dearer','convex','next','stubby','reformed','delirious','raw','crabby','exuberant','scared','real','phonetic','cunning',
  'suave','ballistic','unfilled','toxic','bellicose','sinewy','optical','tawdry','unnerved','misquoted','distant','moaning','boneless','gloomy','chilled',
  'atheistic','flattop','spangled','fumigated','risen','minty','showered','chalky','natty','unlikely','frivolous','afflicted','cursory','stark','elicit',
  'augmented','layered','unsigned','signed','rattan','extreme','hazel','dead','darling','gritty','bifocal','invisible','shortish','overfull','muffled',
  'dark','excess','advanced','flying','variable','homicidal','homemade','tedious','cuneiform','tidy','accustomed','cheeky','mallow','innate','downhill',
  'latched','crackling','dank','amateur','rational','unleaded','squat','tattooed','flagrant','fluoride','quotable','vocative','ravishing','baseline','stretchy',
  'ragged','phantom','crowded','ruinous','ruined','anonymous','custom','hurt','focused','incensed'
]);

RPWordList.adverbs = new RPWordList('adverb', [
  'candidly','with amusement','warmly','with shame','numbly','ominously','adorably','mindfully','genuinely','drowsily','overly','gently','ashamedly','messily','meanly',
  'hollowly','quaintly','memorably','factually','entirely','absently','calmly','dumbly','heavily','lawfully','wearily','tardily','decently','jovially','intently',
  'subtly','stackly','guiltily','capably','blindly','cynically','arduously','helpfully','profanely','cheerily','pertly','pitiably','irritably','flatly','expertly',
  'coolly','endlessly','dubiously','rapidly','sooner','eventually','pettily','snugly','passably','affably','variously','naively','stoutly','irately','fluently',
  'mirkily','ruggedly','equitably','uneasily','secretly','sorely','modestly','maturely','uncannily','lividly','summarily','nearly','actively','tangibly','brusquely',
  'annually','cruelly','obtusely','swiftly','sulkily','equally','dizzily','eminently','corruptly','limply','crassly','hardily','wittily','nimbly','softly',
  'adoringly','daringly','presently','audibly','slavishly','justly','sleepily','steeply','garishly','richly','readily','seldom','cheaply','almost','thickly',
  'credibly','defiantly','plainly','radially','evermore','copiously','heatedly','fourthly','uniformly','concisely','ungainly','sedately','covertly','seriously','frankly',
  'sincerely','dourly','briskly','abusively','remotely','seemingly','tenuously','feasibly','smoothly','suggestivly','humanely','mundanely','legibly','shrewdly','palpably',
  'with gusto','urgently','enviously','nicely','daintily','decisively','crisply','vividly','wryly','craftily','evilly','foully','fatuously','upwards','mightily',
  'brightly','buoyanty','sharply','earlier','frequently','unhappily','inversely','broadly','idly','saucily','hungrily','wisely','unwisely','variably','dankly','glibly','busily'
]);

RPWordList.speechVerbs = new RPWordList('speechVerb', [
  'said','spoke','uttered','yelled','stated','declared','announced','proclaimed','commented','remarked','voiced','sung','squeaked','whispered','thought','cried out','mumbled',
  'muttered','shouted','asserted','prayed','replied','ranted','reasoned','yammered','chanted','wondered','stuttered','drawled','intoned','bragged','croaked','jested','spluttered',
  'scoffed','expounded','babbled','stipulated','swore','slured','discussed','tattled','quipped','rephrased','whined','moaned','rambled','vented','bellowed','quacked','brayed'
]);

RPWordList.properNouns = new RPWordList('properNoun', [
  'Aaron','Abbott','Abby','Abdul','Abel','Abelard','Abelson','Aberdeen','Abex','Abidjan','Abigail','Abilene','Abner','Abraham','Abram',
  'Absalom','Abuja','Abyssinia','Acadia','Achaean','Achebe','Achilles','Acosta','the Acropolis','Acton','Adam','Adana','Adar','Adderley','Addie',
  'Addison','Adela','Adelaide','Adelbert','Adele','Adeline','Adidas','Adkins','Adler','the Admiral','Adolf','Adonis','Adrian','Adriana','the Adriatic',
  'Adrienne','Advil','the Aegean','Aeolia','Aeolus','Aeroflot','Aesop','the Afghan','the Afghans','Africa','the Afrikaans','Agamemnon','Agassi','Agatha','Aggie',
  'Aglaia','Agnes','Agnew','Agni','Agra','Agricola','Agrippa','Aguilar','Ahab','Ahmad','Ahmadabad','Ahmed','Ahriman','Aiken','Aileen',
  'Aimee','Ainu','Aisha','Ajax','Akbar','Akihito','Akita','Akkad','Akron','Ala','Alabama','Aladdin','Alamo','Alan','Alana',
  'Alaric','Alaska','the Alaskan','the Alaskans','Alba','Albania','the Albanian','the Albanians','Albany','Albee','Albert','Alberta','Alberto','Albion','Alborg',
  'Albright','Alcatraz','Alcoa','Alcor','Alcott','Aldan','Aldebaran','Alden','Aldo','Aldrin','Alec','Aleichem','Aleut','Alex','Alexander',
  'Alexandra','Alexei','Alexis','Alfonso','Alfonzo','Alford','Alfred','Alfreda','Alfredo','Algeria','the Algerian','the Algerians','Algernon','Alhena','Ali',
  'Alice','Alicia','Aline','Alisa','Alisha','Alison','Alissa','Alistair','Alkaid','Allah','Allan','Allegra','Allen','Allende','Allie',
  'Allison','Allyn','Allyson','Alma','Almach','Almohad','Alnitak','Alonzo','Alpert','Alphonse','Alphonso','Alpine','thr Alps','Alsop','Alston',
  'Althea','Alton','Altoona','Aludra','Alva','Alvah','Alvarado','Alvin','Alyce','Alyson','Alyssa','Amadeus','Amalia','Amanda','Amaru',
  'Amati','the Amazon','Amber','Amelia','America','the American','the Americas','Amie','Amin','the Amish','Amos','Amsterdam','Amundsen','Amur','Amway',
  'Amy','Ana','Anabel','Ananias','Anasazi','Anastasia','Anatole','Anchorage','Andean','Andersen','Anderson','the Andes','Andorra','Andre','Andrea',
  'Andrei','Andretti','Andrew','Andromeda','Andropov','Andy','Angara','Angel','Angela','Angelia','Angelica','Angelico','Angelina','Angeline','Angelita',
  'Angelo','Angie','Angkor','Anglia','the Anglican','Anglo','Angola','the Angolan','Angora','Anguilla','Angus','Anita','Ankara','Ann','Anna',
  'Annabel','Annabelle','Anne','Annenberg','Annetta','Annette','Annie','Annmarie','Anselm','Anshan','the Antarctic','Anthony','Antigua','Antioch','Antoine',
  'Anton','Antonia','Antoninus','Antonio','Antonius','Antony','Antwan','Antwerp','the Anzac','the Apache','Apennines','Aphrodite','Apollo','Appaloosa','Appleton',
  'Aquarius','Aquila','Aquino','the Arab','Arabella','Arabia','the Arabian','Arafat','Arak','Aral','Arcadia','Archean','Archibald','Archie','the Arctic',
  'Ardell','Ardelle','Arden','Argentina','the Argentine','Argos','Argus','Ariadne','Ariel','Ariosto','Aristotle','Arius','Ariz','Arizona','Arjuna',
  'Arkansan','Arkansas','Arkwright','Arleen','Arlen','Arlene','Arlin','Arline','Arlington','Armani','Armenia','the Armenian','Armstrong','Arnhem','Arno',
  'Arnold','Aron','Arron','Art','Artemis','Arthur','Artie','Arturo','Aruba','Asa','Asama','Asgard','Ashanti','Ashcroft','Ashe',
  'Ashikaga','Ashlee','Ashley','Asia','Asimov','Asoka','Aspen','Asquith','Assad','Assam','Assisi','Assyria','the Assyrian','Astaire','Astana',
  'Aston','Astor','Astoria','Aswan','Athena','the Athenian','Athens','Atkins','Atkinson','Atlanta','the Atlantic','Atlantis','Atreus','Atria','Atropos',
  'Attila','Atwood','Aubrey','Auckland','Auden','Audra','Audrey','Augsburg','Augusta','Augustine','Augustus','Aurelia','Aurelio','Aurelius','Aurora',
  'the Aussie','Austen','Austin','Australia','Austria','the Austrian','Ava','Avalon','Aventine','Averroes','Avesta','Avila','Ayala','Ayers','Aymara',
  'Azana','Azania','Azazel','Azores','the Aztec','Baal','Baath','Babbage','Babbitt','Babel','Babette','Babylon','Bacardi','Bacchus','Bach',
  'Backus','Bactria','Baden','Baghdad','Baguio','the Bahamas','Bahia','Bahrain','Bahrein','Bailey','Bairiki','Baker','Baku','Balaton','Balder',
  'Baldwin','Bale','Balearic','Bali','the Balkans','Balthazar','the Baltic','Baltimore','Bamako','Bambi','Banbridge','Bancroft','Bangalore','Bangkok','Bangor',
  'Banjul','Bantu','Barabbas','Barack','Barbados','Barbara','Barbary','Barbie','Barbra','Barcelona','Barclay','Bardeen','Barker','Barkley','Barlow',
  'Barnabas','Barnaby','Barnard','Barnes','Barnet','Barnett','Barney','Barrett','Barrie','Barry','Barrymore','Bart','Barth','Bartlett','Barton',
  'Baruch','Basel','Basho','Basil','Basra','Bataan','Bates','Bathsheba','Batista','Batman','Batu','Bavaria','Baxter','Bayer','Bayes',
  'Baylor','Bayonne','Beardmore','Beardsley','Bearnaise','Beasley','the Beatles','Beatrice','Beatrix','Beau','Beaumont','Beauvoir','Beaverton','Becker','Becket',
  'Beckett','Becky','Bede','the Bedouin','Beebe','Beelzebub','Beethoven','Beeton','Behring','Beijing','Beirut','Bekesy','Bela','Belarus','Belau',
  'Belem','Belfast','the Belgian','Belgium','Belgrade','Belinda','Belize','Bella','Bellamy','Belle','Bellevue','Bellini','Belmont','Belmopan','Beltane',
  'Beltway','Belushi','Ben','Benchley','Benedict','Benelux','Benet','Benetton','Bengal','the Bengali','Benghazi','Benita','Benito','Benjamin','Bennett',
  'Bennie','Benny','Benson','Bentham','Bentley','Benton','Beowulf','Berenice','Beretta','Berg','Bergen','Berger','Bergman','Bergson','Bering',
  'Berkeley','Berkshire','Berlin','Berlioz','Bermuda','Bern','Bernadine','Bernard','Bernardo','Bernays','Bernhard','Bernhardt','Bernice','Bernie','Bernini',
  'Bernoulli','Bernstein','Berry','Bert','Bertha','Bertie','Bertram','Bertrand','Beryl','Bess','Bessel','Bessemer','Bessie','Beth','Bethany',
  'Bethe','Bethesda','Bethlehem','Betsey','Betsy','Bette','Bettie','Betty','Beverley','Beverly','Bexley','Bianca','Bic','Biden','Biggles',
  'Bilbo','Bill','Billie','Billy','Bimini','Bingham','Bioko','Bird','Biro','Biscay','Bishop','Bismark','Bjork','Blackburn','Blackfoot',
  'Blackmun','Blackwell','Blaine','Blair','Blake','Blanca','Blanche','Blenheim','Blevins','Bligh','Blondie','Blucher','Bluebeard','Blythe','Bob',
  'Bobbi','Bobbie','Bobbitt','Bobby','Boeing','the Boer','Bogart','Bohemia','the Bohemian','Bohr','Boleyn','Bolivar','Bolivia','the Bolivian','Bollywood',
  'the Bolshevik','Boltzmann','Bombay','Bonaparte','Bond','Boniface','Bonita','Bonnie','Bono','Boone','Booth','Bordeaux','Boreas','Boris','Bork',
  'Borneo','Bosch','Bose','Bosnia','Boston','Botswana','Bourbon','Bowell','Bowen','Bowie','Bowman','Boyd','Boyer','Boyle','Brad',
  'Bradbury','Braddock','Bradford','Bradley','Bradly','Bradshaw','Brady','Brahe','Brahma','the Brahman','Brahmas','Brampton','Branden','Brandi','Brandie',
  'Brando','Brandon','Brandt','Brandy','Brant','Braque','Brasilia','Brasov','Brazil','the Brazilian','Brazos','Brecht','Bremen','Brenda','Brendan',
  'Brennan','Brenner','Brent','Brenton','Brest','Bret','Brett','Brewster','Breyer','Brian','Briana','Brianna','Brice','Bridger','Bridges',
  'Bridget','Bridgett','Bridgette','Bridgman','Brie','Briggs','Brighton','Brigitte','Brillo','Brinkley','Brisbane','Bristol','Brit','Britain','Britannia',
  'Britney','the Briton','Britt','Brittany','Brittney','Broadway','Brock','Bronson','Bronte','Brooke','Brooklyn','Bruce','Bruckner','Brunhilde','Bruno',
  'Brunswick','Brussels','Brutus','Bryan','Bryant','Bryce','Bryon','Buber','Bucharest','Buchwald','Buck','Buckley','Budapest','Buddha','the Buddhist',
  'Buddy','Buffy','Buford','the Bulganin','Bulgaria','the Bulgarian','Bunsen','Burgess','Burgundy','Burke','Burma','the Burmese','Burnett','Burnside','Burr',
  'Burt','Burton','Bushnell','Butler','Byrd','Byron','the Byzantine','Byzantium','Caesar','Cagney','Caguas','Cain','Cairo','Caitlin','Calais',
  'Calcutta','Calder','Caldwell','Caleb','Calgary','Caliban','Caligula','Callie','Callisto','Calvary','Calvin','Cambodia','the Cambodian','Cambridge','Camelot',
  'Cameron','Cameroon','Camilla','Campbell','Canaan','Canada','the Canadian','Canberra','Cancer','Candace','Candice','Candy','Canton','Cantrell','Capetown',
  'the Capitol','Capone','the Captain','the Capulet','Cara','Cardiff','Carey','Caribbean','Carina','Carissa','Carl','Carla','Carleton','Carlo','Carlos',
  'Carlotta','Carlson','Carlton','Carly','Carlyle','Carmela','Carmella','Carmen','Carney','Carol','Carole','Carolina','Caroline','Carolyn','Carr',
  'Carrie','Carrier','Carroll','Carson','Carter','Carthage','Caruso','Cary','Caryl','Casandra','Casanova','Casanovas','Casey','Cash','Caspar',
  'Casper','Caspian','Cassandra','Cassie','Castilla','Castillo','Castro','Catalan','Catalina','Catharine','Catherine','Cathie','Cathleen','Cathryn','Cathy',
  'Catullus','Caucasus','Cavendish','Cebus','Cecelia','Cecil','Cecilia','Cedric','Celeste','Celina','Cellini','the Celt','Cerberus','Cerenkov','Cesar',
  'the Cesarean','Cezanne','Chad','Chadwick','Chaitanya','Chaitin','the Chaldean','Chandler','Chandra','Chanel','Chang','Chapman','Charity','Charlene','Charles',
  'Charley','Charlie','Charlotte','Charmaine','Charon','Chase','Chasity','Chaucer','Chekhov','Chelsea','Chen','Cheney','Chengdu','Chennai','Cheri',
  'Cherie','Chernobyl','the Cherokee','Cherry','Cheryl','Cheshire','Chester','Cheviot','Chevron','Chi','Chicago','Chile','the Chilean','Chimera','Chimu',
  'China','Chisholm','Chloe','Chomsky','Chongjin','Chongqing','Chonju','Chopra','Chris','Christa','Christi','Christian','Christie','Christina','Christine',
  'Chrystal','Chuck','Chung','Churchill','Cicero','Cid','Cindy','Claiborne','Clair','Claire','Clancy','Clapton','Clara','Clare','Clarence',
  'Clarice','Clarissa','Clark','Clarke','Claud','Claude','Claudette','Claudia','Claudine','Claudio','Claudius','Claus','Clayton','Clearasil','Clem',
  'Clemens','Clement','Clemons','Clemson','Cleo','Cleopatra','Cleveland','Cliff','Clifford','Clifton','Cline','Clint','Clinton','Clio','Clive',
  'Clovis','Clyde','Cobain','Cobb','Coco','Cody','Coffey','Cohan','Cohen','Colbert','Colby','Cole','Coleen','Coleman','Coleridge',
  'Colette','Colin','Colleen','Collier','Collin','Collins','Cologne','Colombia','the Colombian','Colombo','Colorado','Columbus','the Comanche','the Commander','the Commodore',
  'the Communist','Compton','Concetta','the Confucian','Confucius','Congo','Conn','Conner','Connery','Connie','Connolly','Conrad','Constance','Constanta','Conway',
  'Cook','Cooke','Cookstown','Cooper','Coors','Copeland','Copland','Copley','Corday','Cordelia','Corey','Corfu','Corina','Corine','Corinne',
  'Corinth','Cormack','Cornelia','Cornelius','Cornell','Cornwall','the Corporal','Corrine','Corsica','the Corsican','Cortland','Cory','Cosby','the Cossack','Costello',
  'Costner','Cote','Coulter','the Count','Courtney','Coventry','Cowley','Cowper','Crabbe','Craig','Crane','Cranmer','Crawford','Cray','the Creator',
  'Creighton','Creole','Crest','the Cretan','Crete','Crichton','Crimea','the Crimean','Cristina','Croatia','the Croatian','Crockett','Croesus','Cromwell','Cronin',
  'Cronus','Crookes','Crosby','Crowley','Crusoe','Crux','Cruz','Crystal','Cthulhu','Cuba','the Cuban','Cuchulain','Cucuta','Cumbria','Cummings',
  'Cunard','Cupid','Curie','Currier','Curt','Curtis','Curtiss','Custer','the Cyclops','Cynthia','the Cyprian','Cyprus','Cyril','Cyrus','the Czech',
  'Czechs','Dacron','Daedalus','Dagmar','Dagwood','Dahl','Dahomey','Daimler','Daisy','Dakar','Dakota','Dale','Daley','Dallas','Dalton',
  'Damascus','Damian','Damien','Damion','Dan','Dana','Danang','Dane','Danial','Daniel','Danielle','the Danish','Dannie','Danny','Dante',
  'the Danube','Daphne','Darby','Darcy','Daren','Darin','Dario','Darius','Darla','Darlene','Darling','Darrel','Darrell','Darren','Darrin',
  'Darryl','Darwin','Daryl','Dave','Davenport','David','Davidson','Davies','Davis','Davy','Dawes','Dawn','Dawson','Dayton','Dean',
  'Deana','Deanna','Deanne','Debbie','Debby','Debora','Deborah','Debra','Debs','Dee','Deena','Deere','Defoe','Deidre','Deimos',
  'Deirdre','Delaney','Delano','Delaware','Delhi','Delilah','Delius','Della','Delmar','Delmarva','Delmer','Delmonico','Deloris','Delphi','Demetrius',
  'Deming','Dempsey','Denis','Denise','Denmark','Dennis','Denny','Denpasar','Denver','Deon','Derek','Derick','Derrick','Descartes','Desiree',
  'Desmond','Detroit','Devin','Devon','Dewar','Dewayne','Dewitt','Dexter','Dhaka','Diana','Diane','Dianna','Dianne','DiCaprio','Dick',
  'Dickens','Dickerson','Dickinson','Dickson','Diego','Dijkstra','Dilbert','Dillard','Dillinger','Dillon','Dina','Dinah','Dion','Dionysus','Dirk',
  'Disney','Dixie','Dixieland','Dixon','Dmitri','Dobbin','the Doctor','Dodgson','Dodson','John Doe','Dolby','Dollie','Dolly','Dolores','Domingo',
  'Dominguez','Dominic','Dominica','the Dominican','Dominique','Don','Donahue','Donald','Donaldson','Donatello','Donbas','Donn','Donna','Donnell','Donner',
  'Donnie','Donny','Donovan','Dooley','Dora','Dorcas','Doreen','Dorian','Doric','Doris','Dorothy','Dorset','Dorthy','Dot','Dotson',
  'Dottie','Dotty','Doug','Douglas','Douglass','Dover','Doyle','Draco','Dracula','Drake','Dresden','Drew','Dreyfus','Dryden','Duane',
  'Dubai','Dublin','DuBois','Dubrovnik','Dudley','Duffy','Duke','Dumbo','Duncan','Dunedin','Dunkirk','Dunne','DuPont','Durham','Durius',
  'Durkheim','Durward','Dustin','Dusty','the Dutchman','Dwaine','Dwayne','Dwight','Dylan','Dyson','Eakins','Earhart','Earl','Earle','Earlene',
  'Earline','Earnest','the Easterner','Eastman','Eastwood','Eaton','Ebeneezer','Ebony','Ecuador','the Ecuadoran','Eddie','Eddington','Eddy','Eden','Edgar',
  'Edinburgh','Edison','Edith','Edmond','Edmund','Edson','Edward','Edwardo','Edwards','Edwin','Edwina','Edythe','Effie','Egypt','the Egyptian',
  'Ehrlich','Eichmann','Eiffel','Eileen','Einstein','Elaine','Elanor','Elba','Elbert','Elbrus','Elburz','Eldon','Eleanor','Eleanore','Eleazar',
  'Elena','Elgar','Eli','Elias','Elijah','Elinor','Eliot','Elisa','Elisabeth','Elise','Elisha','Eliza','Elizabeth','Ella','Ellen',
  'Ellice','Ellie','Ellington','Elliot','Elliott','Ellis','Ellsworth','Ellwood','Ellyn','Elma','Elmer','Elmo','Eloise','Elroy','Elsa',
  'Elsie','Elton','Elvia','Elvin','Elvis','Elway','Elwood','Emanuel','Emerson','Emile','Emilia','Emilie','Emily','Eminem','Emma',
  'Emmanuel','Emmet','Emmett','England','the English','Enid','Enkidu','Enoch','Enos','Enrico','Enrique','the Ephesian','Ephesus','Ephraim','the Epicurean',
  'Epicurus','Erasmus','Erebus','Erhard','Eric','Erica','Erich','Erick','Ericka','Erickson','Erie','Erik','Erika','Erin','Erma',
  'Ernest','Ernestine','Ernie','Errol','Erwin','Esau','Escher','Esmeralda','Esperanto','Esperanza','Essen','Essex','Estela','Estella','Estelle',
  'Ester','Esther','Estonia','the Estonian','Ethan','Ethel','Ethiopia','the Ethiopian','Eton','Euclid','Eugene','Eugenia','Eugenie','Eumenides','Eunice',
  'the Euphrates','Eurasia','the Eurasian','Europa','Europe','Eva','Evan','Evans','Eve','Evelyn','Evenki','Everest','Everett','Everette','Evita',
  'Excalibur','Eyre','Ezekiel','Ezra','Fabian','Fairbanks','Fairfield','Faith','the Falklands','Fallopian','Falwell','Fannie','Fanny','Faraday','Fargo',
  'Farley','Farouk','Farrell','Farrow','Farsi','Fatima','Faulkner','Fawkes','Fay','Faye','Federico','Felecia','Felice','Felicia','Felicity',
  'Felipe','Felix','Fellini','Ferber','Ferdinand','Fergus','Ferguson','Fernandez','Fernando','the Ferrari','Ferrell','Ferris','the Fiat','Fidel','Fido',
  'Fielding','Fields','Fiji','the Fijian','Fijians','Filipino','Fillmore','Finch','Finland','Finley','Finn','Finnegan','the Finnish','Fiona','Fischer',
  'Fisher','Fisk','Fitch','Fitzroy','Flanagan','Flanders','Flaubert','Fleming','Fletcher','Flo','Flora','Florence','Florentia','Flores','Florida',
  'the Floridan','Flory','Flossie','Floyd','Flynn','Foley','Forbes','Ford','Formica','Formosa','Forster','Forsyth','Foster','Fowler','Fox',
  'Fran','France','Frances','Francesca','Francine','Francis','Francisca','Franck','Franco','Frank','Frankie','Franklin','Franklyn','Franny','Franz',
  'Fraser','Frazier','Fred','Freddie','Freddy','Frederic','Frederica','Frederick','Fredric','Fredrick','Freeman','the French','the Frenchman','Freud','Freya',
  'Freyja','Frieda','Friedman','Fritz','Frontenac','Frost','Fry','Fuji','Fukuoka','Fulbright','Fuller','Fulton','Fushun','Fuzhou','Gable',
  'Gabon','Gabriel','Gabriela','Gabrielle','Gail','Galahad','Galilee','Galileo','Gall','Galloway','Galvani','Galveston','Gambia','Gandhi','Ganesha',
  'Ganges','Garbo','Garcia','Gardner','Gareth','Garfield','Garfunkel','Garland','Garner','Garrett','Garrick','Garry','Garth','Gary','Gates',
  'Gatsby','Gatun','the Gaul','Gavin','Gay','Gayle','Gehenna','Gemini','Gena','Geneva','Genevieve','Genghis','Geoffrey','George','Georgette',
  'Georgia','the Georgian','Georgina','Gerald','Geraldine','Gerard','Gerardo','Gerber','Gerhard','the German','Germany','Gerry','Gershwin','Gertrude','Ghana',
  'the Ghanaian','Giannini','Gibbon','Gibbs','Gibraltar','Gibson','Gideon','Gil','Gilbert','Gilchrist','Gilead','Giles','Gilgamesh','Gill','Gillian',
  'Gilligan','Gilman','Gilmore','Gina','Ginger','Gino','Ginsu','Giorgione','Giovanni','Giselle','Giuseppe','Giza','Gladstone','Gladys','Glasgow',
  'Glaxo','Gleason','Glen','Glenda','Glendale','Glenlivet','Glenn','Glenna','Gloria','Glover','Gobi','God','Goddard','Godfrey','Godot',
  'Godzilla','Goff','Golan','Goldberg','Goldie','Golding','Goldman','Goldsmith','Goldwater','Goldwyn','Golgotha','Goliath','Gomez','Gomorrah','Gonzales',
  'Gonzalez','Gonzalo','Goodall','Goodman','Goodrich','Goodwill','Goodwin','Gorbachev','Gordon','Gore','Gorey','Gorgas','Gorky','the Goth','Gould',
  'Grable','Grace','Gracie','Graciela','Grady','Graffias','Grafton','Graham','Grahame','Granada','Grant','Granville','Graves','Gray','the Grecian',
  'Greece','Greeley','Greene','Greenland','Greenwich','Greg','Gregg','Gregory','Grenada','Grendel','Grenoble','Gresham','Greta','Gretel','Gretzky',
  'Grey','Grieg','Griffin','Griffith','Grimes','Grimm','Gromyko','Grover','Grundy','Guam','Guangzhou','Guatemala','Gucci','Guenevere','Guernsey',
  'Guinea','Guinevere','Guiyang','Gullah','Gulliver','Gumbel','Gumbo','Gunther','Gupta','the Gurkha','Gus','Gustav','Gutenberg','Guthrie','Guy',
  'Gwen','Gwendolyn','Gwyn','the Gypsy','Haas','Habakkuk','Hades','Hagar','Haggai','the Hague','Hahn','Haifa','the Haikou','Haiti','the Haitian',
  'the Hakka','Haldane','Hale','Haley','Halifax','Halley','Hallie','Hallstatt','Halsey','Hamburg','Hamilton','Hamlet','Hamlin','Hamm','Hammett',
  'Hammond','Hammurabi','Hampshire','Hampton','Han','Hancock','Handel','Handy','Hangzhou','Hank','Hanna','Hannah','Hannibal','Hanoi','Hanover',
  'Hans','Hansel','Hansen','Hanson','Hapsburg','Harare','Harding','Hardy','Harlan','Harland','Harlem','Harlequin','Harley','Harlow','Harold',
  'Harper','Harriette','Harris','Harrison','Harrods','Harry','Hart','Harte','Hartford','Hartman','Harvard','Harvey','Hastings','Hatfield','Hathaway',
  'Hatsheput','Hauptmann','Hausa','Hausdorff','Havana','Havanas','Havel','Hawaii','the Hawaiian','Hawke','Hawking','Hawkins','Hawthorne','Hayden','Haydn',
  'Hayes','Haynes','Hays','Haywood','Hayworth','Hazel','Heaney','Hearst','Heath','Hebert','Hecate','Hector','Hefner','Hegira','Heidi',
  'Heimlich','Heine','Heineken','Heinlein','Heinrich','Helaine','Helen','Helena','Helene','Helga','Helmut','Helsinki','Hemingway','Henderson','Hendricks',
  'Hendrix','Henley','Hennessy','Henri','Henrietta','Henry','Hensley','Henson','Hepburn','Hera','Herbert','Hercules','Herder','Hereford','Herman',
  'Hermes','Hermine','Herminia','Hermitage','Hermite','Hernandez','Herod','Herodotus','Herrick','Herring','Herschel','Hersey','Hershel','Hershey','Hester',
  'Heston','Hettie','Hewitt','Hewlett','Heywood','Hezbollah','Hezekiah','Hibernia','Hickman','Hicks','Higgins','Hilary','Hilbert','Hilda','Hillary',
  'Hillel','Hilton','the Himalayas','Himmler','the Hindi','the Hindu','Hirohito','Hiroshima','Hitchcock','Hitler','the Hittite','Hobart','Hobbes','Hobbs','Hockney',
  'Hodges','Hodgkin','Hoffman','Hogan','Hogwarts','Hokkaido','Holcomb','Holden','Holland','Hollie','Hollis','Holloway','Holly','Hollywood','Holman',
  'Holmes','Holstein','Homer','the Honduran','Honduras','Honiara','Honolulu','Honshu','Hooke','Hooper','Hoover','Hope','Hopkins','Hopper','Horace',
  'Horatio','Hormel','Horne','Horowitz','Horton','Horus','Hosea','Houdini','House','Housman','Houston','Howard','Howell','Hoyle','Huang',
  'Hubbard','Hubble','Hubert','Hudson','Huey','Huffman','Huggins','Hugh','Hughes','Hugo','Hui','Hume','Humphrey','Humphry','the Hun',
  'Hung','the Hungarian','Hungary','Hunter','Huntley','Hurley','Huron','Hurst','Hurston','Hussein','Hutton','Hutu','Huxley','Hyde','Hyderabad',
  'Iago','Ian','Ibadan','Ibague','Iberia','the Iberian','Ibiza','Icahn','Icarus','Iceland','the Icelander','Idaho','Ignatius','Igor','Iguazu',
  'Ike','Ikea','Ilene','Iliad','Illinois','Ilyushin','Imelda','Imogen','Imogene','India','Indiana','Indochina','Indonesia','the Indus','Inglewood',
  'Ingrid','the Innocent','Intel','the Internet','Interpol','the Inuit','Iowa','the iPod','Iran','the Iranian','Iraq','the Iraqi','Ireland','Irene','the Irishman',
  'the Iroquois','Irrawaddy','Irvin','Irwin','Isaac','Isabel','Isabella','Isabelle','Isador','Isadora','Isaiah','Ishmael','Ishtar','Islamabad','Israel',
  'the Israeli','Issac','Issachar','Istanbul','the Italian','Italy','Ivan','Ivanhoe','Ivy','Izanagi','Izmir','Jack','Jackie','Jacklyn','Jackson',
  'Jacky','Jaclyn','Jacob','Jacobson','Jacque','Jacquelin','Jacquelyn','Jacques','Jaime','Jakarta','Jake','Jamaica','the Jamaican','Jamal','James',
  'Jamestown','Jamie','Jan','Jana','Jane','Janelle','Janet','Janette','Janice','Janie','Janine','Janis','Janna','Janus','Japan',
  'the Japanese','Jared','Jarlsberg','Jarred','Jarrett','Jarrod','Jarvis','Jasmine','Jason','Jasper','Jay','Jayne','Jayson','Jean','Jeanette',
  'Jeanie','Jeanine','Jeanne','Jeannette','Jed','the Jedi','Jeeves','Jeff','Jefferey','Jefferson','Jeffery','Jeffrey','Jeffry','Jehovah','Jekyll',
  'Jemima','Jenifer','Jenkins','Jenna','Jennie','Jennifer','Jennings','Jenny','Jensen','Jephthah','Jerald','Jeraldine','Jeremiah','Jeremy','Jeri',
  'Jericho','Jeroboam','Jerold','Jerome','Jerri','Jerrie','Jerrod','Jerrold','Jerry','Jerusalem','Jess','Jesse','Jessica','Jessie','the Jesuit',
  'Jesus','Jezebel','Jill','Jillian','Jim','Jimmie','Jimmy','Jinzhou','Joan','Joanna','Joanne','Job','Jocasta','Jocelin','Jocelyn',
  'Jock','Jodi','Jodie','Joe','Joel','Joesph','Joey','Johann','Johanna','Johannes','John','Johnathan','Johnathon','Johnie','Johnnie',
  'Johnny','Johnson','Johnston','Jolene','Jon','Jonah','Jonathan','Jonathon','Jones','Joplin','Jordan','Jose','Josef','Josefina','Joseph',
  'Josephine','Josephus','Josh','Joshua','Josiah','Josie','Joy','Joyce','Juan','Juanita','Judah','Judas','Judd','Jude','Judea',
  'Judie','Judith','Judy','Jules','Julia','Julian','Juliana','Julianne','Julie','Julien','Juliet','Juliette','Julius','Jun','Junior',
  'Jupiter','Justin','Justina','Justine','Kaaba','Kaaren','Kabbala','Kabul','Kafka','the Kaiser','Kaitlin','the Kalahari','Kampala','Kandahar','Kane',
  'Kansas','Kant','Kara','Karachi','Karakorum','Karen','Karenina','Kari','Karin','Karina','Karl','Karla','Karloff','Karol','Karolyn',
  'Karyn','Kasey','Kashmir','Kasparov','Kate','Katelyn','Katharine','Katherine','Katheryn','Kathie','Kathleen','Kathryn','Kathy','Katie','Katrina',
  'Kay','Kaye','Kayla','Keaton','Keats','Keisha','Keith','Keller','Kelley','Kelli','Kellie','Kelly','Kelvin','Kempis','Ken',
  'Kendall','Kendra','Kendrick','Kenmore','Kennedy','Kenneth','Kennith','Kenny','Kent','Kentucky','Kenya','the Kenyan','Kepler','Kerensky','Keri',
  'Kermit','Kerri','Kerry','Keven','Kevin','Khalid','Kharkov','Khartoum','Khyber','Kidd','Kiel','Kieth','Kiev','Kilroy','Kim',
  'Kimberley','Kimberly','the King','Kingston','Kingstown','Kinshasa','Kipling','Kirk','Kirkland','Kirov','Kirsten','Kissinger','Kit','Kitchener','Kitty',
  'Klan','Klaus','Klein','the Klingon','the Knight','Knowles','Knox','Knoxville','Knuth','Kobe','Koch','Kojak','Kola','King Kong','Konrad',
  'Koontz','Korea','the Korean','Kory','Kosciusko','Kosovo','Kowloon','Krakatoa','Kramer','Kremlin','Kris','Krishna','Krista','Kristen','Kristi',
  'Kristie','Kristin','Kristina','Kristine','Kristy','Kruger','Krupp','Krystal','Kubrick','Kunming','the Kurd','Kurdistan','Kuril','Kurt','Kurtis',
  'Kuwait','the Kuwaiti','Kwan','Kwangju','Kyle','Kyoto','Laban','the Labyrinth','Ladonna','Lafayette','Lagos','Lagrange','Lahore','Lakehurst','Lakewood',
  'Lakisha','Lakota','Lambert','Lamont','L\'Amour','Lana','Lanai','Lancaster','Lance','Lancelot','Landon','Langland','Langley','Langmuir','Lanzhou',
  'Laos','the Laotian','Lara','Largo','Larry','Larsen','Larson','Lassie','Latasha','the Latino','Latisha','Latonya','Latrobe','Latvia','the Latvian',
  'Laura','Laurel','Lauren','Laurence','Lauri','Laurie','Lavinia','Lavonne','Lawrence','Lawson','Layla','Layton','Lazarus','Leah','Leanna',
  'Leanne','Lebanon','Lederberg','Lee','Leeds','Leger','Leicester','Leif','Leigh','Leighton','Leila','Leipzig','Lemuel','Lenard','Lenin',
  'Leningrad','Lennon','Lenny','Leo','Leon','Leonard','Leonardo','Leopold','Leopoldo','Leroy','Les','Lesley','Leslie','Lessie','Lester',
  'Leticia','Letitia','Letterman','Levi','thr Leviathan','Lewinsky','Lewis','Lewisham','Lexington','thr Lexus','Liam','Libby','Liberia','the Liberian','Liberty',
  'Lieberman','Lila','Lilian','Liliana','Lilith','Lille','Lillian','Lillie','Lilly','Lily','Lima','Limoges','Lin','Lincoln','Lincolns',
  'Linda','Lindbergh','Lindsay','Lindsey','Lindy','Linus','Linux','Linwood','Lionel','Lippmann','Lisa','Lisbon','Lisburn','Lister','Lithuania',
  'Litton','Liverpool','Livia','Livy','Liz','Liza','Lizzie','Lizzy','Ljubljana','Llewellyn','Llewelyn','Lloyd','Lochinvar','Lockheed','Logan',
  'Loire','Lois','Loki','Lola','Lolita','Lombard','London','the Londoner','Lonnie','Lonny','Lopez','Loraine','the Lord','Loren','Lorentz',
  'Lorenz','Lorenzo','Lorie','Lorinda','Lorna','Lorraine','Lorrie','Lothian','Lott','Lotta','Lottie','Lotty','Lou','Louie','Louis',
  'Louisa','Louise','Lovecraft','Lovelace','Loyd','Lubbock','Lucas','Luce','Lucia','Luciano','Lucifer','Lucile','Lucille','Lucinda','Lucretia',
  'Lucretius','Lucy','the Luddite','Ludwig','the Luftwaffe','Luigi','Luis','Luke','Lula','Lulu','the Lusitania','Luther','Lydia','Lynch','Lynda',
  'Lynette','Lynn','Lynne','Lynnette','Lyon','Mable','Mac','MacArthur','Macaulay','Macbeth','MacBride','MacDonald','Macedon','Macedonia','Mackenzie',
  'MacLeish','Macmillan','Macy','Madden','Maddox','Madeira','Madeleine','Madeline','Madelyn','Madge','Madison','Madonna','Madras','Madrid','the Mafia',
  'Magdalena','Magdalene','Magellan','Maggie','Magi','Mahayana','Mahdi','Mahican','Maine','Maisie','the Major','Malabar','Malachi','Malawi','the Malayan',
  'Malaysia','the Malaysian','Malcolm','Maldive','Maldives','Mali','the Malian','Malibu','Malinda','Malone','Malory','Malta','Malthus','Mamet','Manasseh',
  'Manchuria','Mandalay','the Mandarin','Mandela','Mandy','Manfred','Manhattan','Manila','Mann','Manning','Mansfield','Manson','Manuel','Manuela','Mao',
  'the Maoist','the Maori','Mara','Maratha','Marathon','Marc','Marceau','Marcel','Marcella','Marcelo','Marci','Marcia','Marcie','Marco','Marconi',
  'Marcus','Marcy','Marduk','Margaret','Marge','Margery','Margie','Margo','Margot','Mari','Maria','Mariana','Marianna','Marianne','Marie',
  'Marietta','Marilee','Marilyn','Marilynn','the Marine','Mario','Marion','Marissa','Mark','Markab','Markov','Marla','Marlene','Marley','the Maronite',
  'Mars','Marsh','Marsha','Marshal','Marshall','Martha','Marti','the Martian','Martin','Martina','Martinez','Marty','Marvin','Mary','Maryann',
  'Maryanne','Maryellen','Maryland','Marylou','Marylyn','Masefield','the Maserati','Mason','Masters','Mather','Mathew','Mathews','Mathewson','Mathias','Mathilda',
  'Matilda','Matlock','Matt','Mattel','Matthew','Matthews','Matthias','Mattie','Maud','Maude','Maureen','Maurice','Mauritius','Mavis','Max',
  'Maxine','Maxwell','the Mayan','the Mayer','Mayfair','the Mayflower','McAdam','McAllen','McBride','McCain','McCall','McCarthy','McCartney','McCarty','McClain',
  'McClellan','McClure','McConnell','McCormick','McCoy','McCray','McDaniel','McDonald','McDonnell','McDowell','McEnroe','McFadden','McFarland','McGee','McGovern',
  'McGowan','McGuffey','McGuire','McIntosh','McIntyre','McKay','McKee','McKenzie','McKinley','McKinney','McKnight','McLean','McLeod','McLuhan','McMahon',
  'McMillan','McNamara','McNeil','McPherson','McQueen','McVeigh','Meadows','Meagan','Mecca','Medicare','Medina','Medusa','Meg','Megan','Meghan',
  'Mekong','Mel','Melanie','Melbourne','Melendez','Melinda','Melissa','Melody','Melville','Melvin','Memphis','Mendel','Mendez','Merak','Mercado',
  'the Mercedes','Mercia','Mercury','Meredith','Merida','Merle','Merlin','Merlot','Merlyn','Merriam','Merrill','Merrimack','Merton','Mervin','Merwyn',
  'Black Mesa','the Messiah','Metallica','the Mexican','Mexico','Meyers','Mia','Miami','Micah','Mich','Michael','Micheal','Michelle','Michelson','Michigan',
  'Mick','Mickey','Mickie','Micky','Microsoft','Middleton','Midland','Midway','Midwest','Miguel','Mike','Mikhail','Mikoyan','Milan','Mildred',
  'Miles','Milford','Millard','Miller','Millet','Millicent','Millie','Mills','Milo','Milosevic','Milton','Miltown','Milwaukee','Mimi','Mimosa',
  'Minamoto','Mindy','Minerva','Mingus','Minnelli','Minnesota','Minnie','the Minotaur','Minsk','Minuit','Miranda','Miriam','Missouri','Missy','Misty',
  'Mitch','Mitchel','Mitchell','Mitford','Mithra','Moab','Moe','Mogadishu','Mohamed','Mohammad','Moira','the Mojave','Moldavia','Moldova','Mollie',
  'Molly','Moloch','the Molotov','Mombasa','Monaco','the Mongol','Mongolia','Monica','Monique','Monroe','Mons','the Montague','Montana','Montcalm','Monte',
  'Monty','Moody','the Moon','Mooney','Moore','Moravia','the Moravian','Morean','Morgan','Moriarty','Morison','Morley','the Mormon','the Moroccan','Morocco',
  'Morpheus','Morris','Morrison','Morse','Mort','Mortimer','Moscow','Mosel','Moseley','Moses','Mosley','Mosul','Motown','Motrin','Mott',
  'Mourne','Mozart','Mubarak','Mueller','Mugabe','Muhammad','Muir','Mulder','Mullen','Muller','Mulligan','Mullins','Mulroney','Multan','Mumbai',
  'Mumford','Munich','Munro','Murchison','Murdoch','Muriel','Murillo','Murmansk','Murphy','Murray','Muscat','Muse','Musharraf','Mussolini','Mutsuhito',
  'Muzak','Myanmar','Myers','Myles','Myra','Myrna','Myrtle','Nader','Nadia','Nadine','Nagasaki','Nagoya','Nahum','Nairobi','Namibia',
  'the Namibian','Nanchang','Nancy','Nanette','Nanjing','Nannette','Nannie','Naomi','Naphtali','Napier','Naples','Napoleon','Narnia','Nashville','Nassau',
  'Nat','Natalia','Natalie','Natasha','Nate','Nathan','Nathaniel','Nauru','the Nautilus','the Navajo','the Nazarene','Nazareth','the Nazi','Neal','Neapolis',
  'Nebraska','Ned','the Negroid','Nehemiah','Neil','Nelda','Nell','Nellie','Nelly','Nelsen','Nelson','the Nemesis','Nepal','the Nepali','Neptune',
  'Nero','Neruda','Ness','Nestorius','Netflix','Netscape','Nevada','Nevil','Neville','Nevis','Nevsky','Newcastle','Newell','Newman','Newport',
  'Newton','the Nexis','Nguyen','Niagara','Nicaragua','Nice','Nicholas','Nichole','Nichols','Nicholson','Nick','Nicklaus','Nickolas','Nicodemus','Nicola',
  'Nicolas','Nicole','Nielsen','Nietzsche','Nigel','Niger','Nigeria','the Nigerian','Nike','Nikita','Nikki','Nikolaev','Nikolai','the Nile','the Nimitz',
  'Nimrod','Nina','Nineveh','Nintendo','Nippon','Nirenberg','Nirvana','Nita','Nixon','Noah','Nobel','Noel','Nokia','Nona','Nora',
  'Nordic','Noreen','Norfolk','Norma','Norman','Normandy','Norris','the Norseman','Norway','the Norwegian','Norwich','Noumea','Nubia','the Nubian','Nuremberg',
  'Oahu','Oakland','Obadiah','Obama','Oberlin','Oberon','O\'Brien','O\'Casey','Oceania','O\'Connell','O\'Connor','Octavia','Octavius','Odell','Odessa',
  'Odin','O\'Donnell','Odysseus','Offenbach','Ogilvy','O\'Hara','O\'Higgins','Ohio','Ojibwa','O\'Keeffe','Okinawa','Oklahoma','the Oklahoman','Ola','Olaf',
  'Oldenburg','Oldfield','Olga','Olive','Oliver','Olivet','Olivetti','Olivia','Olivier','Olsen','Olson','Olympia','the Olympiad','the Olympian','Olympus',
  'Oman','Omar','O\'Neil','O\'Neill','Onsager','Ontario','Ophelia','Oprah','Orbison','Oregon','the Oreo','the Orient','the Oriental','Orion','Orlando',
  'Orleans','O\'Rourke','Orpheus','Orville','Orwell','Osaka','Osbert','Osborn','Osborne','Oscar','Osgood','Osiris','Oslo','Ostwald','Osvaldo',
  'Othello','Otis','O\'Toole','Ottawa','Otto','Ottoman','Ovid','Owen','Oxford','Ozzie','Pablo','Pace','Pacino','Packard','Padilla',
  'the Padre','Page','Paige','Paine','Pakistan','the Pakistani','Palestine','Palmer','Pam','Pamela','Pamir','Pan','Panama','Panasonic','Pandora',
  'the Pantheon','Paraguay','Paris','the Parisian','Parker','Parkinson','Parkman','Parks','Parnell','Paros','Parsons','Parthia','Pascal','Pat','Patagonia',
  'Patel','Paterson','Patrica','Patrice','Patricia','Patrick','Patsy','Patterson','Patti','Pattie','Patton','Patty','Paul','Paula','Pauli',
  'Pauline','the Pavlova','Payne','Peabody','Peace','Pearl','Pearlie','Pearson','Pedro','the Pegasus','Peggy','Peking','Pele','Penelope','Penn',
  'Penney','Penny','the Pentagon','the Pentium','Pepsi','Percival','Percy','Perelman','Perez','Pergamum','Perkins','Perl','Perlman','Perrier','Perry',
  'Perseus','Persia','the Persian','Perth','Peru','the Peruvian','Pete','Peter','Peters','Peterson','Petra','Petrograd','the Peugeot','Pharaoh','the Pharisee',
  'Phelps','Phil','Philip','Philippa','Philippe','Philips','Phillip','Phillipa','Phillips','Phillis','Phobos','Phoebe','Phoenicia','the Phoenix','Phyllis',
  'Picasso','Pickering','Pickett','Pickford','Pickwick','Pierce','Pierre','Pilgrim','Pillsbury','Pinkerton','Pinocchio','Pinochet','Pippin','Pissaro','Pittman',
  'Plato','the Playboy','Pliny','Pluto','Plymouth','Poe','Poirot','Poisson','Poitier','the Pokemon','Poland','the Polaris','Pole','Pollard','Pollock',
  'Pollux','Polly','Pollyanna','Polo','Polynesia','Pompadour','Pompeii','the Pontiac','Pooh Bear','Poole','Popeye','Poppins','the Porsche','Porter','Portland',
  'Portugal','Poseidon','Potsdam','Potter','Potts','Powell','Prague','Pratchett','Pratt','Prentice','Prescott','Presley','Preston','the Pretorian','Price',
  'Priestley','Prince','Princeton','Priscilla','Pristina','the Prius','the Proteus','Proust','Prudence','Prussia','the Prussian','Pryor','Ptolemy','Puccini','Puckett',
  'Pulaski','Pulitzer','Pullman','Punjab','the Punjabi','Purcell','Purdue','Pushkin','Putin','Pygmalion','the Pygmy','Pyle','Pyongyang','the Pyrenees','Qaddafi',
  'Qadhafi','Qatar','Quasimodo','Quayle','Quebec','Queens','Quentin','Quincy','Quinn','Quintin','Rabat','Rabin','Rachael','Rachel','Rachelle',
  'Radcliffe','Rae','Rafael','Rainier','Rajshahi','Raleigh','Ralph','Rama','Ramada','Rambo','Ramesses','Ramsay','Ramses','Ramsey','Ranchi',
  'Randal','Randall','Randell','Randi','Randolph','Randwick','Randy','Rangoon','Raoul','Raphael','Rapunzel','Raquel','Rasputin','Rastaban','Rathaus',
  'Raul','Rawlings','Ray','Rayburn','Rayleigh','Raymond','Raymundo','Reagan','Rebekah','Redbridge','Redford','Redgrave','Redmond','Reese','Reeves',
  'Regina','Reginald','Regulus','Rehnquist','the Reich','Reid','Reinhardt','Reinhold','Rembrandt','Remington','the Renault','Rene','Renee','Renoir','Reuben',
  'Reuters','Rex','Reykjavik','Reynaldo','Reynold','Rheims','Rhiannon','the Rhine','the Rhineland','Rhoda','Rhode Island','Rhona','Rhonda','Ricardo','Rice',
  'Richard','Richards','Richie','Richmond','Richter','Rick','Rickey','Rickie','Ricky','Rico','Riemann','Riga','Rigel','Riggs','Rigoletto',
  'Riley','Ringo','Rio','Ripley','Rita','Rivers','the Riviera','Rob','Robbie','Robbins','Robby','Roberson','Robert','Roberta','Roberto',
  'Roberts','Robertson','Robeson','Robin','Robinson','Robson','Robyn','Rocco','Rochelle','Rochester','Rockford','the Rockies','Rockville','Rockwell','Rocky',
  'Rod','Roderick','Rodger','Rodgers','Rodney','Rodrick','Rodrigo','Rodriguez','Rodriquez','Rogelio','Roger','Rogers','Roget','Roku','Roland',
  'Rolando','the Rolex','Rolland','Rollins','the Roman','the Romanian','Romano','Romanov','Romany','Rome','Romeo','Rommel','Romney','Romulus','Ron',
  'Ronald','Ronda','Ronnie','Ronny','Rooney','Roosevelt','Roquefort','Rory','Rosa','Rosales','Rosalie','Rosalind','Rosalinda','Rosalyn','Rosamond',
  'Rosamund','Rosanna','Rosanne','Rose','Roseann','Roseanne','Rosella','Roselyn','Rosemarie','Rosemary','Rosenberg','Rosetta','Rosie','Rosita','Roslyn',
  'Ross','Rostov','Roswell','Rotterdam','Rourke','Rove','Rover','Rowe','Rowena','Rowland','Rowling','Roxanne','Roxie','Roxy','Roy',
  'Royce','Rozelle','Ruben','Rubik','Rubin','Ruby','Rudolf','Rudolph','Rudy','Rufus','the Ruhr','Rumsfeld','Runyon','Rupert','Rushmore',
  'Ruskin','Russ','Russel','Russell','Russia','the Russian','Russo','Rustbelt','Rusty','Rutgers','Ruth','Ruthie','Rutledge','Rwanda','Ryan',
  'Ryle','the Saab','Saarland','Sabik','Sabin','Sabina','Sabrina','Sachs','Saddam','the Sadducee','Sadie','Sagan','the Sahara','Saigon','Sakha',
  'Sakharov','Saladin','Salazar','Salem','Salinger','Salisbury','Sallie','Sally','Salome','Salvador','Salvatore','Salween','Sam','Samantha','Samara',
  'Samarinda','the Samaritan','Sammie','Sammy','Samoa','the Samoan','Sampson','Samson','Samsung','Samuel','Samuelson','Sana','Sanchez','Sanchung','Sandburg',
  'Sanders','Sandra','Sandy','Sanford','Sanger','Santa','Santana','Santiago','Santos','Sara','Sarah','Sarajevo','Saran','Sardinia','Sargent',
  'Sargon','Sarnoff','Sartre','Sasha','the Sasquatch','Satan','Saturn','the Saudi','Saudis','Saunders','Savannah','Savoy','Sawyer','Saxon','Saxony',
  'Scalia','Scarlatti','Schelling','Schick','Schiller','Schindler','Schlitz','Schmidt','Schneider','Schroeder','Schubert','Schultz','Schulz','Schwartz','Scilly',
  'Scipio','Scopes','Scorpio','Scorpius','the Scot','Scotland','the Scotsman','Scott','Scottie','Scribner','Scrooge','Sculley','Scylla','Scythia','Sean',
  'Sears','Seattle','Sebastian','Segre','Seiko','Seinfeld','Sejong','Selena','Selim','Selma','the Senate','Senegal','Sennett','Seoul','Sequoya',
  'Serbia','the Serbian','Serena','Sergei','Sergio','Seth','Dr Seuss','Seville','Seward','Sexton','Seymour','Shaffer','Shaka','Shandong','Shane',
  'Shanghai','Shankar','Shanna','Shannon','Shari','Sharif','Sharlene','Sharon','Sharpe','Sharron','Shaun','Shauna','Shawna','Shea','Sheba',
  'Sheena','Sheffield','Sheila','Shelby','Sheldon','Shelia','Shell','Shelley','Shelly','Shelton','Shepard','Shepherd','Sheppard','Sheree','Sheri',
  'Sheridan','Sherlock','Sherman','Sherpa','Sherri','Sherrie','Sherrill','Sherry','Sherwin','Sherwood','Sheryl','Shetland','Shields','Shikoku','Shiloh',
  'the Shinto','Shirley','Shiva','Shockley','Short','Shorthorn','Shrek','Shylock','Sibelius','Siberia','the Siberian','Sibyl','the Sicilian','Sicily','Sid',
  'Sidney','Siegfried','Sigmund','the Sikh','Sikorsky','Silas','Silva','Silvester','Silvia','Simmons','Simon','Simone','Simpson','Sinai','Sinatra',
  'Sinclair','Sindbad','Singapore','Singer','Singh','Singleton','Sirius','Skinner','Skippy','Skye','Slater','the Slovak','Slovakia','Slovenia','the Slovenian',
  'Small','Smith','Smithson','Smokey','Smolensk','Snell','Snider','Snoopy','Snowdon','Snyder','Socrates','Sodom','Sofia','Soho','Sol',
  'Solomon','Somalia','the Somalian','the Somme','Sonia','Sonja','Sony','Sonya','Sophia','Sophie','Sousa','Southey','Southwark','the Soviet','Spain',
  'the Spaniard','Sparta','Spartacus','the Spartan','Spears','Spence','Spencer','Spenser','the Sphinx','Spielberg','Spiro','Spock','Sputnik','Stacey','Staci',
  'Stacie','Stacy','Stafford','Stalin','Stallone','Stan','Stanford','Stanley','Stanton','the Starbucks','Stark','Starr','Steele','Stefan','Stefanie',
  'Stella','Stephan','Stephanie','Stephen','Sterling','Steve','Steven','Stevens','Stevenson','Stevie','Stewart','Stirling','Stockholm','the Stoic','Stokes',
  'Stone','Stoppard','Strauss','Streisand','Stu','Stuart','Stuttgart','Sudan','Sudoku','Sue','Suez','Suffolk','the Sufi','Sullivan','Sumatra',
  'Sumeria','the Sumerian','Summers','the Sunni','the Superbowl','Superman','Surat','Surya','Susan','Susana','Susanna','Susannah','Susanne','Susie','Sussex',
  'Sutton','Suva','Suzan','Suzann','Suzanne','Suzette','Suzy','Sven','Swansea','Swanson','Swaziland','the Swede','Sweden','Sweeney','Swinburne',
  'Swindon','the Swiss','Sybil','Sydney','Sykes','Sylvester','Sylvia','Syria','the Syrian','Tabatha','Tabitha','Tacitus','Tadzhik','Taegu','Taejon',
  'Tagore','Tagus','Tahiti','the Tahitian','Tahoe','Taipei','Taiwan','Talbot','the Taliban','the Talmud','Tamara','Tamera','Tami','the Tamil','Tammi',
  'Tammie','Tammy','Tamworth','Tangshan','Tania','Tanisha','Tanner','Tanya','Tanzania','the Tanzanian','the Tao','the Taoist','Tara','Tarantino','Tarbell',
  'Tarim','Tarkenton','Tarzan','Tasha','the Tasman','Tasmania','the Tasmanian','Tate','Tatiana','Tawney','Taylor','Teasdale','Ted','Teddy','Tehran',
  'the Templar','Tennessee','Tennyson','Terence','Teresa','Teri','the Terran','Terrance','Terrence','Terri','Terrie','Terry','Tesla','Tess','Tessa',
  'Tessie','Tex','the Texan','Texas','Thaddeus','the Thai','Thailand','Thalia','Thames','Thanh','Thatcher','Thebes','Thelma','Theodora','Theodore',
  'Theresa','Therese','Thespis','Thimbu','Thomas','Thompson','Thomson','Thor','Thornton','Thorpe','Thoth','Thrace','the Thracian','Thurman','Thurmond',
  'Thurrock','Tia','Tianjin','Tibet','the Tibetan','Tiffany','Tigris','Tijuana','Tillich','Tillman','Tim','Timbuktu','Timmy','Timothy','Tina',
  'the Tinkertoy','Tipperary','Tish','Tisha','the Titan','the Titanic','Tito','Titus','Tobias','Toby','Todd','Tokugawa','Tokyo','Tolkien','Tolstoy',
  'Tom','Tombaugh','Tomlin','Tommie','Tommy','Tompkins','Tomsk','Tonga','the Tongan','Toni','Tonia','Tony','the Torah','Toronto','Torrance',
  'Torvalds','Toshiba','Toto','Toulouse','Townsend','Toyonaka','Toyota','Tracey','Traci','Tracie','Tracy','Trafalgar','Travis','Travolta','the Trekkie',
  'Trent','Trevor','Trey','the Triad','Trina','Trinidad','Trinity','Tripitaka','Tripoli','Trippe','Trisha','Tristan','Tristram','Triton','Troja',
  'Trollope','Trotski','Trotsky','Troy','Trudy','Truk','Truman','Trumbull','Tucker','Tudor','Tulsa','Tunguska','Tunis','Tunisia','the Tunisian',
  'Turing','the Turk','Turkestan','Turkey','Turner','the Tuscan','Tuscany','Tussaud','Tutu','Twain','Tweed','Twitter','Tyler','Tyndale','Tyndall',
  'Tyrone','Tyson','Ubuntu','Uganda','the Ugandan','Ukraine','the Ukrainian','Ulster','Ulysses','Umbriel','Una','Underwood','the Union','Upton','Ural',
  'Uranus','Uriah','Urquhart','Ursula','Ursuline','Uruguay','the Uruguayan','Utah','Utopia','the Uzbek','the Uzi','Darth Vader','Valarie','Valdez','Valencia',
  'Valenti','Valentine','Valentino','Valerie','the Valkyrie','Vance','Vancouver','the Vandal','Vandyke','Vanessa','Vanuatu','Vasari','th eVatican','Vaughan','Vega',
  'Vegemite','Velma','Venezuela','Venice','Venus','the Venusian','Verdi','Verdun','Vermont','Vernon','Verona','Veronica','Vespasian','Vichy','Vicki',
  'Vickie','Vicky','Victor','Victoria','Vienna','the Vietcong','Vietminh','Vietnam','the Viking','Vilma','Vilnius','Vince','Vincent','Vinland','Vinson',
  'Viola','Violet','Virgie','Virgil','Virginia','Virgo','Vishnu','the Visigoth','Vivaldi','Vivian','Vivienne','Vlad','Vladimir','Voldemort','Volga',
  'Volgograd','Voltaire','the Volvo','the Vulcan','Waco','Wade','Wagner','Wahhabi','Waikiki','Waite','Waksman','Walcott','Waldemar','Walden','Waldheim',
  'Waldo','Waldorf','Wales','Walker','Wallace','Wallis','Walls','Walmart','Walpole','Walt','Walter','Wanda','Wang','Wankel','Ward',
  'Warhol','Warley','Warner','Warren','Warsaw','Warwick','Waterbury','Waterford','Watergate','Waterloo','Waters','Watkins','Watson','Watt','Watusi',
  'Waugh','Waverley','Wayne','Weaver','Webb','Weber','Webster','Wedgwood','the Wehrmacht','Weinberg','Weizmann','Weldon','Welland','Weller','Welles',
  'Wells','the Welshman','Wendell','Wendi','Wendy','Werner','Wesley','Wessex','Wesson','the Westerner','Wests','Weyden','Wharton','Wheatley','Wheeler',
  'Whipple','Whistler','White','Whitehall','Whiteley','Whitfield','Whitley','Whitman','Whitney','Wiesel','Wiggins','Wigner','Wikipedia','Wilber','Wilbur',
  'Wilburn','Wilcox','Wilda','Wilde','Wiles','Wiley','Wilford','Wilfred','Wilhelm','Wilkerson','Wilkes','Wilkins','Wilkinson','Will','Willard',
  'William','Willie','Willis','Willy','Wilma','Wilmer','Wilson','Wilton','Wimbledon','Wimsey','Windsor','Windward','Winfield','Winfred','Winfrey',
  'the Winnebago','Winnie','Winston','Winters','Winton','Wisconsin','Wolfe','Wolff','Wolfgang','Wollaston','Wolsey','Wong','Woodard','Woods','Woodstock',
  'Woodward','Woolf','Woolworth','Wooten','Worcester','Wozniak','Wrangell','Wright','Wrigley','Wyat','Wyatt','Wycliffe','Wylie','Wyoming','Xanadu',
  'Xavier','Xenia','Xerox','Xerxes','Yahweh','Yale','Yalta','Yalu','Yamagata','Yang','Yangtze','the Yankie','Yates','Yeager','Yeltsin',
  'Yemen','the Yemeni','Yoda','Yokohama','Yolanda','New York','Yorkshire','Yorktown','Young','YouTube','Ypres','Yuan','the Yugoslav','Yuri','Yvette',
  'Yvonne','Zachariah','Zachary','Zachery','Zagreb','Zaire','the Zairian','Zambezi','Zambia','the Zambian','Zamora','Zane','Zanzibar','Zappa','Zara',
  'Zebedee','Zechariah','Zedekiah','Zelda','Zephaniah','Zeus','Zhengzhou','Zhukov','Ziggy','Zimbabwe','Zimmerman','Zoe','Zorn','Zorro','the Zulu','Zwingli'
]);

RPWordList.prepositions = new RPWordList('preposition', [
  'about','above','across from','according to','after','ahead of','against','alongside','amidst','amoung','apart from','around','as per','as far as','as well as',
  'aside from','because of','before','behind','below','beside','between','beyond','but','by','by means of','close to','except','except for','far from',
  'followed by','from','given','in','in addition to','in front of','in place of','in spite of','inside','into','left of','near','next to','on','on account of',
  'on behalf of','on top of','onto','out','out of','outside','past','plus','prior to','right of','sans','since','thanks to','to','towards',
  'toward','under','until','upon','via','with','within','without'
]);

RPWordList.nouns = new RPWordListPlural('noun', [
  'LED','aardvark','abattoir','abbot','ablution','abode','aborigine','absentee','abstract','abuser','accretion','accrual','ache','acolyte','acorn',
  'acreage','acrobat','activist','actuator','addendum','adder','addict','additive','adherent','adjective','admiral','adornment','adulterer','adverb','advert',
  'adviser','aerator','aerial','aerosol','affect','aide','aileron','airfield','airhead','airlift','airport','airship','airstrip','airwave','alarm',
  'album','alchemist','alcove','ale','algorithm','allergen','allergist','alliance','alloy','alm','almanac','alpaca','altar','altitude','altruist',
  'amateur','amazon','ambush','amethyst','amigo','ammeter','amnesiac','amoeba','amount','amphibian','amplifier','anagram','analyst','anarchist','anchor',
  'anchorite','android','anecdote','anemone','angel','angle','anklet','annal','ant','antelope','anthem','antigen','antique','antler','anvil',
  'aorta','ape','aphorism','appetite','apricot','aquanaut','arachnid','arboretum','arc','archduke','archer','archive','archivist','archway','arena',
  'arm','armband','armhole','armistice','armlet','aroma','arranger','arrival','arrow','arrowroot','artichoke','article','artifice','artisan','artwork',
  'ashtray','aspect','asterisk','asteroid','asylum','atheist','athlete','atoll','attack','attacker','attendant','auction','audience','audit','audition',
  'auditor','author','avatar','avenger','award','awl','awning','axe','axle','azalea','azimuth','backache','backhand','backhoe','backpack',
  'backrest','backside','backspace','backstop','backyard','bailiff','bailout','bait','bale','ball','ballard','ballot','balsam','band','bandage',
  'bandit','bandoleer','bangle','banister','banjo','banknote','banquet','bantam','banyan','baptism','bar','barbarian','barbell','barber','barer',
  'bargain','barge','barmaid','barnacle','baronet','barrack','barrage','barrel','barrette','barricade','basement','basilica','bat','bath','bathmat',
  'bathroom','baton','battle','bauble','bayonet','bayou','bazaar','beacon','bead','beagle','beak','bear','bearer','bearing','bearskin',
  'beat','beater','beaver','bedrock','bedroll','bedsore','bedstead','beehive','beekeeper','begger','behemoth','beholder','bell','bellboy','bellhop',
  'bellyache','belonging','belt','benchmark','benefit','bequest','bib','bicycle','bigamist','bigot','billet','bimbo','binocular','biosphere','birch',
  'bird','birdbath','birth','biscuit','bittern','blackbird','blackout','bladder','blanket','blaster','blazer','blazon','blemish','blender','blimp',
  'blind','blip','bloc','blockage','blockhead','blog','blooper','blossom','blot','blotter','blower','blowgun','blowout','blowup','blubber',
  'bluebell','blueprint','bluff','blunderer','blurb','boar','board','boarder','boatswain','bobble','bobcat','bobsled','bobtail','bog','boiler',
  'bolt','bomb','bomber','bonbon','bond','bone','bonfire','bong','bongo','bonnet','book','bookend','booklet','boom','boomerang',
  'booster','boot','booth','bootie','borer','borough','borrower','bottle','bottom','boudoir','boulder','bound','bouquet','bout','bow',
  'bowel','bowl','bowler','bra','brace','bracelet','braggart','bragger','braid','brain','bramble','brand','brawl','brawler','breach',
  'breakage','breakfast','breast','breeze','brew','brewer','brick','bride','bridge','brigade','brigand','bristle','broach','broiler','broker',
  'brook','broom','broth','brother','brownie','buccaneer','bucket','buckler','bud','budget','bug','bugbear','builder','bull','bulldog',
  'bulldozer','bullet','bullpen','bullring','bum','bundle','bungalow','bunk','bunker','buoy','burden','burglar','burial','burn','burnout',
  'burrow','bursar','busboy','busfare','bush','buster','butcher','buttock','button','buyout','buzzard','bygone','bylaw','byte','byway',
  'cab','cabana','cable','caboodle','cadaver','cadenza','cadet','cafe','cafeteria','cage','cake','calfskin','caliphate','caller','calorie',
  'cam','camcorder','camellia','camp','camper','campfire','can opener','can','canape','canard','canasta','cancer','candidate','cannibal','cannon',
  'canon','canteen','capsule','car','carbine','career','carousal','carp','carpel','carport','carriage','cart','cartridge','case','cashew',
  'cashier','casing','casket','cassette','cast','castanet','caste','cat','catacomb','catamaran','cataract','catcher','cause','cavalcade','cave',
  'caveat','cavern','cedar','ceiling','cell','censer','centurion','certificate','cesspool','chain','chair','chalet','challenge','champion','chance',
  'channel','chapel','chaplain','chaplet','chapter','charge','chariot','chart','chase','checklist','cheek','cheekbone','chef','chemical','chemist',
  'cherub','chestnut','chevron','chicken','chime','chimera','chimney','chink','chinstrap','chip','choir','choker','chuckhole','chum','cicada',
  'cinder','cinema','cipher','circle','circlet','circuit','cistern','citadel','citation','citizen','civilian','clam','clamp','clan','clarinet',
  'classic','classmate','clavicle','claw','cleaner','cleanup','clearing','cleaver','clef','cleric','clerk','climber','clip','clique','cloak',
  'cloakroom','clog','closet','clot','cloth','clover','clown','club','clump','clunker','coast','coat','coauthor','cobble','cochlea',
  'cock','cockatoo','cockfight','cockpit','cocoon','cod','code','coffin','cognate','cohort','coil','coin','cold','collage','collar',
  'collation','collector','colonel','colonist','colosseum','column','columnist','combatant','combo','comedian','comet','comic','commander','commando','communist',
  'competitor','compilation','composer','conclave','condenser','condition','condo','condolance','condom','condor','conduit','conifer','conjurer','connector','conquest',
  'consonant','constant','consul','contagion','contender','content','contest','contour','contrail','convoy','cookbook','cookout','cooler','coop','cooper',
  'cop','copilot','copycat','cord','core','corn','cornball','cornea','corner','cornet','cornice','cornier','corona','coroner','coronet',
  'corporal','corpse','corral','corsage','corsair','corset','cost','counter','coupe','couple','courier','course','court','courtesan','covenant',
  'cow','cowling','coworker','coyote','crab','crack','cradle','crag','crate','crater','cravat','craving','craze','creak','crease',
  'creation','creditor','credo','creed','creole','crescendo','crescent','crest','croc','crocodile','crop','crossbow','crosswalk','crouton','crow',
  'crowd','cruiser','crumb','crumpet','crusade','crust','crypt','crystal','cub','cubbyhole','cubbyhouse','cube','cubical','cue','cuff',
  'cuisine','culvert','cup','cupboard','cupcake','curate','curator','curb','curd','curfew','current','cushion','custom','cuticle','cutlet',
  'cutter','cyberpunk','cycle','cyclist','cygnet','cymbal','cynic','dabbler','dachshund','dad','daffodil','dale','damper','damsel','dance',
  'danger','dapple','dart','database','dawn','day','daydream','deadbolt','deal','dealer','dean','debacle','debt','debtor','debugger',
  'debut','decade','decathlon','decendent','decimal','decision','deck','decoration','decoy','deed','defect','defector','defendant','defogger','delimiter',
  'delusion','demon','denature','dendrite','dent','dentist','deodorant','depot','depth','derrick','descant','desert','deserter','designer','desk',
  'despot','despute','detail','developer','device','devil','diagram','dialogue','diaper','diary','dibble','dictator','dictum','diesel','diet',
  'digest','dike','dilemma','dimension','dimple','din','dinner','dint','diorama','dip','dipstick','direction','directive','director','disaster',
  'disbursement','disc','disco','disease','disguise','dishrag','dispenser','display','dispute','distiller','district','diuretic','diva','diver','divider',
  'divisor','divorce','dock','dockyard','doctor','doctorate','dodger','dogma','dogwood','doll','dollar','dollop','dolt','dome','domino',
  'donation','doodle','doorknob','doormat','dope','dorm','dose','dossier','dot','doubloon','doubter','dough','dove','downturn','draft',
  'dragnet','dragon','dragoon','drain','drama','dramatist','dream','dresser','dribbler','driblet','drier','drifter','drill','drink','drinker',
  'drip','driver','driveway','drone','drug','drumstick','drunk','drunkard','dual','duck','duckbill','duel','dug out','duke','dullard',
  'dumpling','dungaree','dustpan','dye','dyer','dynamo','ear','earache','eardrum','earlobe','earmuff','earthquake','edge','edition','editor',
  'educator','eggbeater','ego','eiderdown','elbow','elder','election','elective','elector','element','elevator','elitist','elixir','elm','ember',
  'emblem','embryo','emcee','emerald','emigrant','emission','empire','employee','employer','emporium','emulator','enchanter','enchilada','encoder','encounter',
  'endorser','entourage','entrail','entrance','entryway','envoy','enzyme','epilogue','epitome','epoch','era','eraser','errand','escapee','esplanade',
  'espresso','essay','estimate','estimator','etcher','euphemism','evergreen','evildoer','examiner','example','excerpt','excision','excretion','exemplar','exemption',
  'exhibit','exorcism','expert','exploit','expo','export','exporter','exposure','extra','extractor','eye','eyeball','eyelid','eyesore','fable',
  'face','facet','fact','faction','factor','fad','failure','fairway','falcon','falsehood','famine','fanzine','fare','farm','farmer',
  'farmhand','fart','fastener','fatalist','fathom','faucet','feast','feat','feather','feature','feedbag','feeder','feeler','fellow','felon',
  'fence','fender','ferret','fetter','feud','fiance','fiasco','fibber','fiddle','fiddler','fielder','fig','fight','fighter','figurine',
  'file','filet','fillet','film','fin','finale','finance','financier','fink','fire','firearm','fireball','firebomb','firefight','firetrap',
  'firm','fishbowl','fixer','fixture','fjord','flag','flagellum','flagon','flagship','flake','flamingo','flank','flannel','flapper','flasher',
  'flask','flat','flattop','flea','fleece','flight','flint','float','floater','flock','floe','flood','floodgate','floor','florist',
  'flotilla','flounder','flour','flower','flume','flute','flyover','foal','fob','foe','foghorn','fold','folder','folio','follicle',
  'fondant','fondue','font','fool','foothill','footpath','footrest','footstep','forager','force','ford','forearm','forehand','foresail','foreskin',
  'forest','forge','formation','fort','fortnight','fortune','forwarder','foul','founder','fount','fountain','fowl','foxhound','foyer','fraction',
  'frame','franchise','frappe','frat','freebie','freeloader','freeway','freighter','fridge','frigate','frock','frond','front','fuel','fugitive',
  'funnel','fur','furrow','fuse','future','gaff','gaggle','gaiter','galley','gambit','game','ganglion','gaol','gap','garage',
  'garb','garland','garment','garrison','gasket','gate','gauntlet','gavel','gazebo','gazelle','gear','gee','geek','geisha','gel',
  'gem','genie','genocide','genome','geologist','geranium','gerbil','germ','getaway','geyser','gherkin','ghost','giant','gibblet','gibbon',
  'giblet','gig','giggler','gigolo','gimmick','gimp','gladiator','gland','glazier','glen','glider','glitch','glob','globule','glove',
  'glowworm','gnome','gnu','goalie','goat','goatee','gob','godparent','godsend','goldsmith','gong','goon','gopher','gospel','goul',
  'gourd','gourmand','governor','graft','grain','grandma','grant','granule','grassland','grate','grave','gravel','grid','grill','gripe',
  'grit','groin','groove','groundhog','group','groupie','grumbler','guard-dog','guardian','guardrail','guardroom','guest','guide','guideline','guild',
  'gull','gum','gun','gunboat','gunfight','gunrunner','guru','gut','guy','hack','hacksaw','haggler','haiku','hailstorm','hair',
  'hairpin','halfback','halibut','halo','halogen','halter','hamlet','hammer','hammock','hamper','hamster','hand','handball','handcart','handler',
  'handmaid','handrail','handset','hanger','hangout','hardliner','hardship','hardware','harem','harlequin','harpist','harpoon','harrow','hat','haul',
  'hawk','hayloft','hazard','hazelnut','heading','headline','headlock','headrest','headset','headstone','heap','hearer','hearse','heartbeat','hearth',
  'heckler','hector','hedge','helm','helmet','hem','hen','heptagon','herb','herring','heuristic','hewer','hexagon','heystack','hideaway',
  'highboy','highland','highlighter','highway','hill','hippo','hireling','hive','hoard','hobbyist','hobnail','hobo','hockshop','hoedown','hog',
  'holdover','holdup','hole','hollyhock','hologram','holster','home','homeland','homicide','homonym','homophone','honeybee','hoodlum','hook','hookup',
  'hoop','hormone','horn','horse','horseshoe','host','hostage','hostel','hotcake','hotel','hotelier','hothead','hotshot','hound','house',
  'household','howitzer','hubcap','huckster','huddle','hue','hula hoop','hulk','hull','human','humanoid','humdinger','hump','hundred','hunk',
  'hurricane','husband','husk','hydra','hydrant','hyena','hygienist','iceberg','icon','idea','idealist','ideogram','idiom','idol','igloo',
  'iguana','image','imbecile','immortal','impact','importer','incision','incline','indicator','infant','inflow','inhalant','inhaler','initiate','inkblot',
  'inkwell','inquirer','insect','inset','insider','inspector','insulator','insurer','integer','interlude','intern','intersection','introvert','intruder','invasion',
  'invoice','ion','iota','irritant','island','issue','jab','jabberer','jack','jackboot','jacket','jail','jalapeno','jam','jaunt',
  'jaw','jawbone','jay','jeep','jell','jellybean','jerk','jersey','jewel','jib','jigsaw','jihad','jock','jockey','jockstrap',
  'joint','joke','joy','joyride','judge','jug','jugular','juice','jujube','jumble','jumbo','jumpsuit','juncture','junta','juror',
  'kazoo','kebab','keel','keeper','kestrel','kettle','key','keynote','keyword','kickback','kicker','kickoff','kid','kiloton','kimono',
  'kingpin','kink','kiosk','kipper','kisser','kit','kitchen','kitten','knack','knave','knee','kneecap','knight','knob','knoll',
  'knot','knuckle','label','labyrinth','lad','ladle','laggard','lair','lake','lamb','lamppost','lance','lancet','landfill','landlord',
  'language','lantern','lap','lapel','lapwing','laser','lasso','lathe','latrine','lawsuit','lawyer','laxative','layer','layette','layout',
  'leaf','league','leapfrog','leasehold','lecture','ledger','leg','legume','lemon','lemonade','length','lentil','leotard','lesbian','lessee',
  'letter','lettuce','lexicon','liar','libretto','license','lifeboat','lift','liftoff','ligament','ligature','lighter','lilt','lime','limerick',
  'limo','linchpin','line','liner','linguist','liniment','linkup','linseed','lintel','lip','liquid','lisp','list','listener','listing',
  'liver','lizard','llama','load','loader','loaf','loafer','loaner','local','locale','lock','locker','lockup','locust','lodge',
  'lodger','loft','log','logarithm','logician','lookout','loom','loop','loophole','looter','lord','loser','lounge','lout','lovebird',
  'lover','lowland','lube','lunatic','luncheon','lunchroom','lunchtime','lymphoma','lyre','macaroon','machete','machine','madam','madhouse','maelstrom',
  'maggot','magnate','magneto','magnifier','magpie','maiden','mainframe','mainsail','major','maker','mall','mama','mammoth','mandarin','mandate',
  'mandrake','mane','manger','manhole','manor','mansion','mantle','map','marathon','marauder','marcher','margin','market','marketer','marquise',
  'marshal','martyr','mascara','mask','masochist','mast','masthead','mat','matador','material','matriarch','matron','matter','mattock','matzoh',
  'maven','maverick','mayflower','mayor','maze','meadow','meal','medal','mediator','medicine','meeting','megacycle','megaphone','melange','melanoma',
  'melon','member','memoir','mentor','meridian','mermaid','message','meteor','meteorite','meter','method','microcode','mile','miler','milestone',
  'militia','milkmaid','milkweed','mill','miller','milliner','mimosa','mind','mine','mineral','minibike','minister','minstrel','mint','minuet',
  'minute','mire','misdeed','misogynist','misprint','mission','mistake','mister','mitt','mitten','mixer','mixture','moat','moccasin','mocker',
  'mode','model','modulator','molecule','moment','monarch','moneybag','monger','monk','monkey','monolith','monologue','monument','moocher','mood',
  'moon','moonbeam','moor','moose','mop','moped','moralist','morgue','morsel','mortal','mosque','mother','motor','motorboat','motorist',
  'motorway','motto','mount','mountain','mourner','mousse','mouth','mouthful','movie','muffler','mug','mum','mumbler','muralist','murderer',
  'murmur','mushroom','musket','musketeer','mussel','mutant','mutineer','mutt','nailbrush','narcotic','narrator','nation','navigator','naysayer','neck',
  'needle','nephew','nest','net','nettle','neutrino','newbie','newborn','newscast','newspaper','newsreel','newt','nib','nibbler','niggle',
  'night','nightcap','nit','node','noggin','noise','nominee','noodle','nose','notice','noun','novel','novelette','novelist','novella',
  'nuance','nub','nudist','nuke','number','nun','nurse','nut','nutmeg','nutrient','nymph','oaf','oak','oat','oath',
  'obelisk','obsession','obstacle','occasion','octagon','octave','octet','odometer','office','officer','offset','offshoot','ogre','oilcloth','ointment',
  'oligarch','olive','omen','onion','onlooker','onslaught','ooze','opal','opera','operation','operetta','opponent','optic','optician','optimist',
  'option','oracle','oration','orator','orb','orbit','orchard','orchid','organ','organism','organist','origin','ornament','orphan','otter',
  'outbreak','outburst','outcast','outcrop','outfitter','outhouse','outlaw','outlay','outline','outrider','outtake','oval','overcoat','overdose','overhang',
  'overlay','overlord','owl','owner','pacifier','pacifist','pack','package','packet','pact','pad','paddock','padlock','padre','page',
  'pageant','pager','pail','pair','palace','paling','palisade','palm','palmist','pamphlet','pan','panacea','pancake','panda','pandemic',
  'pang','panorama','panther','pantie','papaya','parachute','parade','paradigm','paradise','paragon','paragraph','parakeet','parameter','parasol','parcel',
  'parent','parfait','park','parka','parolee','parrot','parsec','parson','part','partition','partner','passage','passbook','passkey','passport',
  'passtime','password','paste','pastor','patch','patella','path','pathogen','patio','patrician','patriot','patrol','patron','pauper','paver',
  'pavilion','paw','pawn','pawnshop','payday','payee','payload','payor','pea','peafowl','peahen','peal','pear','peasant','pebble',
  'pedal','pedant','peeper','peer','peg','pen','penchant','pendant','pendent','pendulum','penguin','peninsula','penlight','pension','pentagon',
  'percentage','performer','perfume','pet','petella','petition','petunia','pew','phantom','phone','photo','photograph','phrase','physicist','piano',
  'piccolo','pickaxe','picker','pickerel','pickle','picnic','picture','pie','pier','pig','pigeon','piglet','pigpen','pigstie','pike',
  'piker','pilaf','pile','pileup','pilferer','pilgrim','pill','pillow','pilot','pin','pinball','pincer','pine','pinhead','pinion',
  'pinnacle','pinprick','pinwheel','pip','pipeline','pippin','piranha','pirate','pirouette','pistachio','pistol','piston','pit','pixel','pizza',
  'placard','place','plague','plain','plaintiff','plait','planner','plant','plastic','plate','platelet','platform','platoon','platter','playbill',
  'player','playoff','playroom','plaything','plea','pleb','plight','plot','plug','plumber','plume','plunger','poacher','pocket','pod',
  'podium','poet','poker','pole','polestar','poll','polyglot','pompom','poncho','ponytail','porcupine','pore','port','porter','porthole',
  'pose','poser','position','positron','possum','post','postcard','postmark','posture','pot','potshot','pottage','potter','pound','powder',
  'powerboat','prank','prankster','prat','prawn','prayer','preacher','preamble','precept','predator','preface','premier','premium','prequel','present',
  'presenter','preserve','president','pretender','preview','previewer','price','prickle','primer','prince','print','privite','prize','pro','processor',
  'procurer','profile','profit','proforma','program','project','projection','prologue','promenade','promise','pronoun','proponent','proposal','protege','protocol',
  'prototype','provider','pub','puck','puddle','puff','pug','pullover','pulpit','pulsar','puma','pumice','pump','pun','punster',
  'punt','punter','puppet','purchase','purchaser','purge','purpose','purveyor','pushcart','pushover','pussycat','putter','pyramid','quadrant','quadruped',
  'quagmire','quail','quake','quark','quarrel','quart','quatrain','quaver','quay','queen','quest','queue','quilt','quirk','quoit',
  'quota','quotient','rabbi','race','racer','racetrack','raceway','rack','racket','racquet','radar','radial','radio','radish','rag',
  'raid','rail','railing','rainbow','rainmaker','raisin','ram','rampart','ranger','rank','ranking','rant','ranter','rapid','rapper',
  'rapture','rascal','ratchet','rate','ratio','rattrap','ravine','ray','razor','reaction','reader','readout','reagent','reaper','receipt',
  'recession','recipe','recliner','record','rectangle','rector','rectum','redcap','redeemer','redwood','reed','reef','reel','ref','referee',
  'refit','refugee','regent','rehearsal','rein','reindeer','reject','relation','relative','relaxant','relay','release','religion','remark','reminder',
  'remote','removalist','renegade','rental','renter','replay','replica','reporter','reprisal','reservoir','residence','resister','resistor','resource','response',
  'result','retailer','retainer','retard','retardant','retreat','returnee','review','reviler','revival','revolver','revue','rhyme','rhythm','rib',
  'ricket','ride','rim','ringer','rink','rioter','risk','ritual','riverbed','roamer','robe','robot','rock','rodent','rogue',
  'rollback','romantic','rook','room','roommate','roost','root','rope','rose','route','router','routine','row','rower','royalist',
  'rucksack','ruffian','rug','ruin','rule','ruler','ruminant','runaway','rundown','rune','runner','runoff','runt','rupee','rupture',
  'ruse','rustler','saboteur','saddle','saddlebag','sadist','safari','safe','safeguard','sage','saint','sampan','sample','sanctum','sandbag',
  'sandbank','sandbar','sandhog','sapphire','sapsucker','sardine','satchel','satyr','saucer','sauna','sausage','savanna','savant','sawhorse','sawmill',
  'sawyer','scab','scabbard','scalawag','scale','scallywag','scalp','scalpel','scalper','scam','scandal','scapegoat','scar','scarab','scarf',
  'scavenger','scent','schedule','schematic','schism','schmuck','scholar','school','schoolboy','scissor','scone','scoop','scooter','score','scorer',
  'scout','scrabble','screen','screw','scribble','scribbler','scrip','scrotum','scrubber','scullion','scumbag','scythe','sea','seabed','seal',
  'seam','seashell','seashore','seaside','season','seaway','secret','secretion','sect','section','sedan','sedative','seducer','seed','seer',
  'seesaw','segment','segue','seizure','semicolon','semifinal','semitone','senator','sensation','sensor','sequal','sequence','sequin','seraph','serf',
  'serial','servant','server','servo','sesame','setback','settee','settler','shackle','shade','shadow','shaft','shallot','sham','shamble',
  'shark','shearer','sheathe','sheepfold','sheet','sheikdom','sheikh','shekel','shell','shelter','shin','shinbone','shindig','shingle','shipmate',
  'shipwreck','shipyard','shire','shirt','shoal','shock','shootout','shopper','shortage','shortstop','shotgun','shovel','show','showcase','shower',
  'showgirl','showlace','shredder','shrew','shrimp','shroud','shyster','sibling','sickbed','sidebar','sideboard','sidekick','sidelight','sidewalk','siege',
  'sighting','sightseer','sign','signal','signature','signboard','signpost','silage','silicate','silk','silkworm','silo','simian','sin','sinew',
  'singer','sink','sinner','siphon','siren','sirloin','sister','sitcom','site','situation','skewer','skill','skin','skit','skull',
  'skullcap','skydiver','skylight','skywriter','slacker','slag','slalom','slammer','slat','slate','slave','slaver','slayer','sleeve','sleigh',
  'slide','slider','sling','slipcover','slipknot','slipper','slit','sliver','slob','slogan','sloop','sluggard','slugger','slum','slumlord',
  'slump','slur','slut','smacker','smell','smelter','smidgen','smudge','smuggler','snack','snail','snake','snap','snapshot','snare',
  'sneaker','snifter','snip','sniper','snob','snoop','snooper','snorkeler','snowdrift','snowdrop','snowstop','soapsud','sofa','softball','soil',
  'soldier','solicitor','solo','solstice','solution','solvent','sonnet','sophist','soprano','sorcerer','sore','sortie','sound','sounding','soup',
  'southerner','soybean','space','spark','sparkler','sparrow','spatter','speaker','spear','speck','speckle','speedboat','speller','sphere','spice',
  'spider','spigot','spike','spine','spinnaker','spiral','spirit','spitball','spitfire','splicer','splint','splinter','sponge','spoof','spool',
  'spoon','spoonbill','spot','spotlight','spouse','spout','sprayer','spread','spreader','spree','sprig','spring','spritzer','sprout','spud',
  'spur','squab','squall','squatter','squeak','squeal','squeegee','squiggle','stack','stadium','staffer','stage','stagehand','stair','stake',
  'stakeout','stalemate','stallion','stamen','stampede','stance','stanza','stargazer','starlet','start','starter','station','statute','stead','steak',
  'steed','steer','step','steroid','stevedore','steward','sticker','stickpin','stiletto','stilt','stingray','stint','stockade','stockpile','stone',
  'stopgap','stopover','stopper','stork','stowaway','straggler','strait','strand','stranger','strap','strata','strategem','stream','streamer','street',
  'strobe','stroller','strop','structure','student','stump','stunt','stutterer','stylist','subject','submarine','submersible','submitter','subplot','subpoena',
  'subtitle','subway','sucker','sud','suicide','suit','suite','suitor','summer','summit','summoner','summonse','sump','sunbeam','sunblock',
  'sundial','sunlamp','super nova','superior','supplier','surf','surface','surfer','surname','survivor','suspender','suture','swab','swaddle','swag',
  'swallow','swami','swamp','swarm','swatter','sweeper','sweet','swimmer','swindler','swing','swirl','syllable','symbol','synapse','syndicate',
  'synod','synonym','syrup','system','tab','tabloid','tabulator','tackle','tackler','taco','tadpole','tag','tail','taillight','tailor',
  'tailpipe','takeoff','talent','tampon','tangent','tangerine','tangle','tankard','tanner','tape','tapeworm','tapir','taproot','tarantula','tariff',
  'tarmac','tarot card','tarragon','tart','task','taste','tattoo','taxicab','taxidermist','teabag','teacher','teak','team','teammate','tear',
  'tearoom','tease','teaser','teat','technique','telegram','telemeter','telephone','telethon','temple','temptation','tempura','tenant','tendril','tenet',
  'tent','tentacle','terabyte','terminal','terminator','terrace','terror','terrorist','test','text','texture','theft','theist','theme','therapist',
  'thespian','thistle','thought','threat','thriller','throwback','thrower','thug','thumb','thumbnail','thyroid','tiara','tide','tidewater','tightwad',
  'tilde','timepiece','timing','tinge','tithe','toad','toboggan','toe','toilet','token','toll','tollgate','tomb','tomboy','tone',
  'tongue','tonic','tonsil','toolbar','toolkit','toothpick','topknot','torso','tort','tortoise','torturer','totem','towel','tower','towhead',
  'township','toxin','toy','track','tracker','tractor','trader','trail','trainer','traitor','tramp','trap','trapdoor','trapezoid','trapper',
  'trashcan','tray','treasure','treat','treetop','trek','trench','trend','trestle','triad','triangle','triathlon','tribe','tribune','trick',
  'trickle','trickster','tricycle','trifle','trifler','trike','trilogy','triplet','troop','trotter','troupe','trouser','truant','truck','trucker',
  'truckload','truffle','truism','trump','trustee','tsunami','tuba','tube','tuber','tubercle','tugboat','tune','tuner','tunnel','turban',
  'turbojet','turncoat','turnover','turret','tussle','tutor','tweet','tweezer','twig','twin','twinge','twirler','twister','twit','twosome',
  'tycoon','tyke','typhoon','typo','undergrad','underline','undertow','unicorn','uniform','uniquest','unit','universe','upheaval','uppercut','upshot',
  'upstart','urinal','urn','usher','usurper','vacation','vaccine','valley','valuable','van','vandal','vanguard','vantage','vapor','vector',
  'vegan','vehicle','veil','vending machine','vent','verge','vessel','vestibule','vestment','vet','veteran','vicarage','victim','victor','video',
  'videodisk','vigil','vigilante','villain','vine','vineyard','violin','violinist','virgin','vision','visit','vitamin','vocation','voice','void',
  'volcano','volley','voltmeter','vortex','vote','voter','voucher','voyage','wafer','wage','wager','waist','waiter','waiver','walkout',
  'walkway','wallboard','walnut','wanderer','wannabe','war','ward','warhorse','warlord','warrant','warren','warrior','warship','wart','washbowl',
  'washtub','watchdog','water','waterline','waterway','wave','wavelet','waver','way','wearer','weasel','web','week','weekend','weeper',
  'weight','weld','welder','well','welt','whale','whaler','wheel','whiner','whisk','whisker','whistle','whittler','whopper','wicket',
  'widow','widower','wiener','wigwag','wiki','wildcat','wimp','win','winch','windbreak','windfall','windower','windpipe','windstorm','windsurfer',
  'wink','winner','winter','wire','wiretap','wishbone','wisher','wisp','woe','wombat','woodchuck','woodland','word','workload','workout',
  'workweek','world','wound','wraffle','wrangler','wreck','wrecker','wrestler','wriggler','wrinkle','wristband','writ','writing','yacht','yard',
  'yardarm','yawl','yolk','youth','zero','zigzag','zinger','zinnia','zipper','zit','zither','zombie','zoo',
  ['absurdity','absurdities'],
  ['abyss','abysses'],
  ['academy','academies'],
  ['accessory','accessories'],
  ['actuary','actuaries'],
  ['airman','airmen'],
  ['alias','aliases'],
  ['alimony','alimonies'],
  ['ally','allies'],
  ['aloe vera',0],
  ['amnesty','amnesties'],
  ['anatomy','anatomies'],
  ['anchorman','anchormen'],
  ['annex','annexes'],
  ['annuity','annuities'],
  ['anomaly','anomalies'],
  ['antipasto','antipasti'],
  ['arch','arches'],
  ['army','armies'],
  ['art','art'],
  ['artery','arteries'],
  ['ash','ashes'],
  ['ass','asses'],
  ['assembly','assemblies'],
  ['baby','babies'],
  ['bacterium','bacteria'],
  ['bakery','bakeries'],
  ['balcony','balconies'],
  ['ballet','ballet'],
  ['barrel of gunpowder','gunpowder'],
  ['batch','batches'],
  ['beach','beaches'],
  ['belfry','belfries'],
  ['bench','benches'],
  ['berry','berries'],
  ['binary','binaries'],
  ['bingo',0],
  ['biopsy','biopsies'],
  ['bison','bison'],
  ['bitch','bitches'],
  ['blood',0],
  ['blotch','blotches'],
  ['boatman','boatmen'],
  ['bobby','bobbies'],
  ['bondsman','bondsmen'],
  ['booby','boobies'],
  ['bosom','bosomes'],
  ['bounty','bounties'],
  ['bowman','bowmen'],
  ['box','boxes'],
  ['branch','branches'],
  ['brandy',0],
  ['breadth',0],
  ['brewery','breweries'],
  ['broccoli','broccoli'],
  ['brunch','brunches'],
  ['bunch','bunches'],
  ['butter','butter'],
  ['bypass','bypasses'],
  ['cabby','cabbies'],
  ['cacophony','cacophonies'],
  ['cactus','cacti'],
  ['caddy','caddies'],
  ['canopy','canopies'],
  ['canvas','canvasses'],
  ['carcass','carcasses'],
  ['cash',0],
  ['catchment','catchment'],
  ['category','categories'],
  ['catfish','catfish'],
  ['catnip',0],
  ['cattleman','cattlemen'],
  ['caucus','caucuses'],
  ['caveman','cavemen'],
  ['cavity','cavities'],
  ['census','censuses'],
  ['chairman','chairmen'],
  ['chairwoman','chairwomen'],
  ['champagne',0],
  ['chedder',0],
  ['chessman','chessmen'],
  ['chicory','chicories'],
  ['chorus','choruses'],
  ['church','churches'],
  ['circus','circuses'],
  ['class','classes'],
  ['clay',0],
  ['clergyman','clergymen'],
  ['climax','climaxes'],
  ['colony','colonies'],
  ['colossus','colossui'],
  ['compass','compasses'],
  ['compost',0],
  ['congress','congresses'],
  ['consensus','consensuses'],
  ['constume','costumes'],
  ['copy','copies'],
  ['cortex','cortices'],
  ['cosmogony','cosmogonies'],
  ['cosmology',0],
  ['cosmos','cosmoses'],
  ['couch','couches'],
  ['country','countries'],
  ['cowbird','cowbird'],
  ['craftsman','craftsmen'],
  ['crash','crashes'],
  ['crayfish','crayfish'],
  ['credit','credit'],
  ['cribbage',0],
  ['crisis','crises'],
  ['crotch','crotches'],
  ['crutch','crutches'],
  ['crux','cruxes'],
  ['currency','currencies'],
  ['cypress','cypresses'],
  ['daisy','daisies'],
  ['dash','dashes'],
  ['deaconess','deaconesses'],
  ['delivery','deliveries'],
  ['deputy','deputies'],
  ['dervish','dervishes'],
  ['destiny','destinies'],
  ['detergent',0],
  ['dichotomy','dichotomies'],
  ['die','dice'],
  ['dish','dishes'],
  ['distillery','distilleries'],
  ['doohicky','doohickies'],
  ['doorman','doormen'],
  ['dormitory','dormitories'],
  ['drivel','drivel'],
  ['duchess','duchesses'],
  ['dump','dump'],
  ['duplex','duplexes'],
  ['dusk',0],
  ['dynasty','dynasties'],
  ['economy','economies'],
  ['effort',0],
  ['elect','elect'],
  ['elf','elves'],
  ['embargo','embargoes'],
  ['enemy','enemies'],
  ['entity','entities'],
  ['equity','equities'],
  ['ether','ether'],
  ['exam','exam'],
  ['excise','excise'],
  ['extremity','extremities'],
  ['eyetooth','eyeteeth'],
  ['faculty','faculties'],
  ['family','families'],
  ['fanfare',0],
  ['fanny','fannies'],
  ['fax','faxes'],
  ['fear',0],
  ['ferry','ferries'],
  ['fez','fezzes'],
  ['fifteen',0],
  ['filament','filament'],
  ['firefly','fireflies'],
  ['fireman','firemen'],
  ['fish','fish'],
  ['fisherman','fishermen'],
  ['fishery','fisheries'],
  ['floaty','floaties'],
  ['flu','flu'],
  ['flux','fluxes'],
  ['fly','flies'],
  ['flyleaf','flyleaves'],
  ['foam',0],
  ['fog','fog'],
  ['foot','feet'],
  ['footman','footmen'],
  ['forgery','forgeries'],
  ['formality','formalities'],
  ['fortress','fortresses'],
  ['frensy','frensies'],
  ['friction',0],
  ['frippery','fripperies'],
  ['frogman','frogmen'],
  ['funk',0],
  ['galaxy','galaxies'],
  ['gallery','galleries'],
  ['garnish','garnishes'],
  ['gas','gases'],
  ['gasworks',0],
  ['gearbox','gearboxes'],
  ['gemstone','gemstone'],
  ['genius','geniuses'],
  ['gentleman','gentlemen'],
  ['genus','genuses'],
  ['glass','glasses'],
  ['glassware','glassware'],
  ['glory','glories'],
  ['gloss','glosses'],
  ['glycerol',0],
  ['goose','geese'],
  ['goulash','goulashes'],
  ['granny','grannies'],
  ['grass','grass'],
  ['gravity',0],
  ['gravy',0],
  ['grotto','grottoes'],
  ['grouch','grouches'],
  ['gruel','gruel'],
  ['guess','guesses'],
  ['gulch','gulches'],
  ['gully','gullies'],
  ['gunk','gunk'],
  ['gunman','gunmen'],
  ['guppy','guppies'],
  ['half','halves'],
  ['halftime',0],
  ['handyman','handymen'],
  ['hangman','hangmen'],
  ['harmony','harmonies'],
  ['hash','hashes'],
  ['haversack','haversack'],
  ['helix','helixes'],
  ['hemp plant','hemp'],
  ['henchman','henchmen'],
  ['hiatus','hiatuses'],
  ['hoax','hoaxes'],
  ['hobby','hobbies'],
  ['horsefly','horseflies'],
  ['hourglass','hourglasses'],
  ['hunch','hunches'],
  ['huntsman','huntsmen'],
  ['ibex','ibexes'],
  ['ibis','ibises'],
  ['icebox','iceboxes'],
  ['identity','identities'],
  ['illness','illnesses'],
  ['index','indexes'],
  ['industry','industries'],
  ['ingress','ingresses'],
  ['injury','injuries'],
  ['ioniser','ioniser'],
  ['ironwork',0],
  ['irony','ironies'],
  ['jackass','jackasses'],
  ['jalopy','jalopies'],
  ['jelly','jellies'],
  ['journey','journies'],
  ['jury','juries'],
  ['kinswoman','kinswomen'],
  ['kiss','kisses'],
  ['klutz','klutzes'],
  ['knife','knives'],
  ['lady','ladies'],
  ['landmass','landmasses'],
  ['lanyard','lanyard'],
  ['larch','larches'],
  ['larynx','larynxes'],
  ['latch','latches'],
  ['layman','laymen'],
  ['laywoman','laywomen'],
  ['leach','leaches'],
  ['leech','leeches'],
  ['liability','liabilities'],
  ['life','lives'],
  ['lineman','linemen'],
  ['lira','lire'],
  ['liturgy','liturgies'],
  ['loot','loot'],
  ['lorry','lorries'],
  ['lottery','lotteries'],
  ['lotus','lotus'],
  ['lummox','lummoxes'],
  ['lump of coal','coal'],
  ['lunch','lunches'],
  ['luxury','luxuries'],
  ['mailman','mailmen'],
  ['mainmast','mainmast'],
  ['malitia','malitia'],
  ['man','men'],
  ['mantis','mantises'],
  ['marksman','marksmen'],
  ['marquis','marquises'],
  ['marsh','marshes'],
  ['mattress','mattresses'],
  ['mayfly','mayflies'],
  ['meat',0],
  ['menfolk',0],
  ['menswear',0],
  ['merman','mermen'],
  ['microfilm','microfilm'],
  ['middleman','middlemen'],
  ['middy','middies'],
  ['midwife','midwives'],
  ['milkman','milkmen'],
  ['minibus','minibuses'],
  ['ministry','ministries'],
  ['minuteman','minutemen'],
  ['modal','modal'],
  ['monarchy','monarchies'],
  ['monastry','monastries'],
  ['morass','morasses'],
  ['mouse','mice'],
  ['muck','muck'],
  ['mummy','mummies'],
  ['murderess','murdersses'],
  ['mutiny','mutinies'],
  ['nappy','nappies'],
  ['napsack','napsack'],
  ['necessity','necessities'],
  ['networks','networks'],
  ['newsflash','newsflashes'],
  ['nighty','nighties'],
  ['nobleman','noblemen'],
  ['notch','notches'],
  ['nucleus','nuclei'],
  ['nunnery','nunneries'],
  ['nutmeat',0],
  ['oddity','oddities'],
  ['optometry',0],
  ['orderly','orderlies'],
  ['origami','origami'],
  ['outcry','outcries'],
  ['ovary','ovaries'],
  ['pair of nylons','nylons'],
  ['pair of tights','tights'],
  ['palladium','palladium'],
  ['pantry','pantries'],
  ['paradox','paradoxes'],
  ['parody','parodies'],
  ['party','parties'],
  ['passerby','passersby'],
  ['peach','peaches'],
  ['pelvis','pelvises'],
  ['penis','penises'],
  ['person','people'],
  ['pessimism',0],
  ['petrol',0],
  ['pharmacy','pharmacies'],
  ['physics',0],
  ['piece of jewelry','jewelry'],
  ['pile of clothes','clothes'],
  ['pillory','pillories'],
  ['plinth','plinthes'],
  ['ploy','ploies'],
  ['policeman','policemen'],
  ['pooch','pooches'],
  ['porch','porches'],
  ['pork',0],
  ['postman','postmen'],
  ['potato','potatoes'],
  ['pottery','potteries'],
  ['pouch','pouches'],
  ['press','presses'],
  ['process','processes'],
  ['profanity','profanities'],
  ['prognoses',0],
  ['property','properties'],
  ['proxy','proxies'],
  ['prude','purdes'],
  ['pulp','pulp'],
  ['pulse','pulsed'],
  ['punch','punches'],
  ['puppy','puppies'],
  ['quantum','quanta'],
  ['quarry','quarries'],
  ['quary','quarries'],
  ['query','queries'],
  ['radiology',0],
  ['radius','radii'],
  ['rally','rallies'],
  ['rash','rashes'],
  ['raucous',0],
  ['reactor','reactor'],
  ['recess','recesses'],
  ['rectory','rectories'],
  ['refinery','refineries'],
  ['remains',0],
  ['residency','residencies'],
  ['retch','retches'],
  ['rifleman','riflemen'],
  ['rivalry','rivalries'],
  ['royalty','royalties'],
  ['rumba',0],
  ['salami','salami'],
  ['salsa',0],
  ['sampler','sampler'],
  ['sand',0],
  ['sandbox','sandboxes'],
  ['sash','sashes'],
  ['scotch','bottles of scotch'],
  ['scratch','scratches'],
  ['screech','screeches'],
  ['scullery','sculleries'],
  ['secretary','secretaries'],
  ['sentry','sentries'],
  ['seventy','seventies'],
  ['shaman','shamen'],
  ['shanty','shanties'],
  ['sheep','sheep'],
  ['shellfish','shellfish'],
  ['shrubbery','shrubberies'],
  ['signatory','signatories'],
  ['sixties',0],
  ['sketch','sketches'],
  ['skinhead','skinhead'],
  ['skivvy','skivvies'],
  ['slobber','slobber'],
  ['smoke','smoke'],
  ['snitch','snitches'],
  ['soap','soap'],
  ['soapbox','soapboxes'],
  ['soliloquy','soliloquies'],
  ['sorority','sororities'],
  ['sorrow',0],
  ['speakeasy','speakeasies'],
  ['sperm','sperm'],
  ['splotch','splotches'],
  ['stable','stabled'],
  ['staff','staff'],
  ['starch',0],
  ['stash','stashes'],
  ['statesman','statesmen'],
  ['stench','stenches'],
  ['steppe',0],
  ['stitch','stitches'],
  ['stonework',0],
  ['stuff',0],
  ['stuntman','stuntmen'],
  ['subsidy','subsidies'],
  ['suffix','suffixes'],
  ['sulky','sulkies'],
  ['summons','summonses'],
  ['sun','son'],
  ['supply','supplies'],
  ['switch','switches'],
  ['tabby','tabbies'],
  ['target','targets '],
  ['taxi','taxies'],
  ['teargas','teargases'],
  ['telex','telexes'],
  ['testical','testes'],
  ['theory','theories'],
  ['thermos','thermoses'],
  ['thesaurus','thesauruses'],
  ['thief','thieves'],
  ['tic','tic'],
  ['toast','toast'],
  ['tomato','tomatoes'],
  ['tooth','teeth'],
  ['torch','torches'],
  ['tornado','tornadoes'],
  ['total','total'],
  ['tourist','tourisim'],
  ['tragedy','tragedies'],
  ['trash','trash'],
  ['trellis','trellises'],
  ['trolley','trollies'],
  ['tube of eyeliner','eyeliner'],
  ['tumult',0],
  ['tuna','tuna'],
  ['tutorial','tutorial'],
  ['twine','twine'],
  ['urine','urine'],
  ['uterus','uteri'],
  ['utility','utilities'],
  ['vacancy','vacancies'],
  ['variety','varieties'],
  ['varsity','varsities'],
  ['vertex','verticies'],
  ['vestry','vestries'],
  ['viceroy','viceroies'],
  ['victory','victories'],
  ['viewpoint','viewpoint'],
  ['vistitor','visitors'],
  ['voodoo',0],
  ['walrus','walrus'],
  ['watchman','watchmen'],
  ['waxworks','waxworks'],
  ['weather',0],
  ['wench','wenches'],
  ['whammy','whammies'],
  ['windlass','windlasses'],
  ['winery','wineries'],
  ['wisterias','wisterias'],
  ['witch','witches'],
  ['witchery','witcheries'],
  ['witness','witnesses'],
  ['wolf','wolves'],
  ['woodman','woodmen'],
  ['woodwork',0],
  ['wuss','wusses'],
  ['yen','yen'],
  ['zinc',0],
  [0,'abalone'],
  [0,'acid'],
  [0,'aerospace'],
  [0,'air'],
  [0,'airmails'],
  [0,'airspace'],
  [0,'argon'],
  [0,'aspirin'],
  [0,'attire'],
  [0,'aura'],
  [0,'baloney'],
  [0,'bandwidth'],
  [0,'banter'],
  [0,'bark'],
  [0,'basil'],
  [0,'beef'],
  [0,'beryllium'],
  [0,'bile'],
  [0,'birdseed'],
  [0,'bleach'],
  [0,'booze'],
  [0,'braille'],
  [0,'breath'],
  [0,'brine'],
  [0,'brouhaha'],
  [0,'buckwheat'],
  [0,'bullion'],
  [0,'calculus'],
  [0,'calico'],
  [0,'cattle'],
  [0,'celery'],
  [0,'cement'],
  [0,'chaff'],
  [0,'chalk'],
  [0,'chess'],
  [0,'childcare'],
  [0,'clientele'],
  [0,'cocaine'],
  [0,'cocoa'],
  [0,'coleslaw'],
  [0,'cornbread'],
  [0,'cotton'],
  [0,'crackling'],
  [0,'cream'],
  [0,'crossfire'],
  [0,'cud'],
  [0,'deadwood'],
  [0,'desiccate'],
  [0,'dioxide'],
  [0,'dirt'],
  [0,'discourse'],
  [0,'dishwater'],
  [0,'drapery'],
  [0,'dribble'],
  [0,'drizzle'],
  [0,'drool'],
  [0,'dust'],
  [0,'eMusic'],
  [0,'envy'],
  [0,'epoxy'],
  [0,'eternity'],
  [0,'evidence'],
  [0,'fennel'],
  [0,'filth'],
  [0,'firewood'],
  [0,'flack'],
  [0,'flotsam'],
  [0,'fluff'],
  [0,'froth'],
  [0,'fruit'],
  [0,'fungicide'],
  [0,'garlic'],
  [0,'genetics'],
  [0,'gibberish'],
  [0,'gloom'],
  [0,'glue'],
  [0,'goodwill'],
  [0,'graffiti'],
  [0,'grammar'],
  [0,'graphics'],
  [0,'grease'],
  [0,'greenery'],
  [0,'grime'],
  [0,'grog'],
  [0,'grout'],
  [0,'hay'],
  [0,'headgear'],
  [0,'heat'],
  [0,'herpes'],
  [0,'homework'],
  [0,'honeycomb'],
  [0,'housing'],
  [0,'hydrogen'],
  [0,'indoors'],
  [0,'inks'],
  [0,'insulation'],
  [0,'judiciary'],
  [0,'junk'],
  [0,'kale'],
  [0,'karma'],
  [0,'keratin'],
  [0,'kinfold'],
  [0,'kitsch'],
  [0,'knitting'],
  [0,'lace'],
  [0,'lard'],
  [0,'latitude'],
  [0,'licorice'],
  [0,'liquor'],
  [0,'longitude'],
  [0,'lubricant'],
  [0,'magma'],
  [0,'malaria'],
  [0,'malarkey'],
  [0,'mania'],
  [0,'mankind'],
  [0,'marrow'],
  [0,'maths'],
  [0,'matting'],
  [0,'meatloaf'],
  [0,'methane'],
  [0,'middle'],
  [0,'milk'],
  [0,'moisture'],
  [0,'money'],
  [0,'mould'],
  [0,'mouthwash'],
  [0,'mud'],
  [0,'mulch'],
  [0,'mystique'],
  [0,'napalm'],
  [0,'nectar'],
  [0,'news'],
  [0,'niceties'],
  [0,'oil'],
  [0,'outrage'],
  [0,'oxygen'],
  [0,'paperwork'],
  [0,'pasture'],
  [0,'pectin'],
  [0,'pepsin'],
  [0,'personal'],
  [0,'phlegm'],
  [0,'plaster'],
  [0,'pliers'],
  [0,'police'],
  [0,'politics'],
  [0,'pollution'],
  [0,'pooh'],
  [0,'power'],
  [0,'powwow'],
  [0,'presence'],
  [0,'prey'],
  [0,'produce'],
  [0,'radium'],
  [0,'rain'],
  [0,'rainwater'],
  [0,'revelry'],
  [0,'rubbish'],
  [0,'rubble'],
  [0,'rugby'],
  [0,'rye'],
  [0,'salt'],
  [0,'sap'],
  [0,'sauce'],
  [0,'savings'],
  [0,'sawdust'],
  [0,'scampi'],
  [0,'scenery'],
  [0,'scum'],
  [0,'seafood'],
  [0,'sealant'],
  [0,'shampoo'],
  [0,'sherbet'],
  [0,'shuteye'],
  [0,'sky'],
  [0,'slang'],
  [0,'sleep'],
  [0,'sleet'],
  [0,'snot'],
  [0,'snow'],
  [0,'solder'],
  [0,'soot'],
  [0,'spaghetti'],
  [0,'spew'],
  [0,'steam'],
  [0,'straw'],
  [0,'string'],
  [0,'suburbia'],
  [0,'sugar'],
  [0,'sunshine'],
  [0,'tar'],
  [0,'tartar'],
  [0,'taxes'],
  [0,'telemetry'],
  [0,'tequila'],
  [0,'thirty'],
  [0,'tinder'],
  [0,'tobacco'],
  [0,'topsoil'],
  [0,'torque'],
  [0,'totality'],
  [0,'tucker'],
  [0,'turf'],
  [0,'turmeric'],
  [0,'turmoil'],
  [0,'underwear'],
  [0,'veal'],
  [0,'venom'],
  [0,'vinegar'],
  [0,'violence'],
  [0,'wax'],
  [0,'wheat'],
  [0,'wiring'],
  [0,'womankind'],
  [0,'wood'],
  [0,'wreckage']
]);

RPWordList.intransitiveVerbs = new RPWordListVerb('intransitive', [
  'abdicate','abound','alight','amble','appeal','appear','argue','arrive','aspire','atone','attest','audition','avow','babble','back',
  'backfire','backtrack','barf','bargain','bark','barnstorm','bask','bawl','behave','bicker','blare','bleat','blossom','blubber','bluster',
  'bounce','bound','bowl','brawl','budge','bulge','bumble','burble','burp','burrow','cackle','camp','capsize','care','career',
  'catcall','caterwaul','cave','cease','chant','chatter','cheep','chime','chortle','clamber','clatter','clomp','cluck','coast','cogitate',
  'collide','collude','commute','compete','conceive','conspire','contend','coo','copulate','cower','crawl','creak','croon','crow','cruise',
  'dabble','dance','dart','dawdle','dawn','decide','defect','despair','deviate','diet','dine','dither','divulge','dock','doodle',
  'doze','dream','dribble','drift','drool','drudge','duck','dwindle','elapse','elope','emerge','enroll','err','erupt','escape',
  'exist','expire','falter','fart','fast','feast','feign','fester','fizzle','flail','float','flounder','flow','forage','freeload',
  'frolic','frown','gape','gawk','gaze','gesture','giggle','glance','glide','glimmer','glint','glisten','glitter','gloat','glow',
  'gossip','graduate','graze','gripe','growl','grunt','gurgle','gust','gyrate','haggle','happen','hike','hobble','holler','hover',
  'hunger','hurtle','implode','improvise','indulge','innovate','inquire','inscribe','insist','interact','intrude','jabber','jell','jest','jive',
  'joke','knock','land','lapse','laugh','limp','linger','listen','litigate','live','look','lounge','lunge','lust','malt',
  'maraud','meander','meddle','mellow','mingle','minister','mire','moo','mope','motion','motor','mumble','murmur','navigate','nest',
  'nestle','oblige','oscillate','ovulate','palpitate','pant','parade','peer','perspire','piddle','pivot','plead','plunge','pose','pounce',
  'pout','prance','prattle','pray','preside','pretend','prey','profit','prosper','pulse','quack','quake','queue','quibble','quiver',
  'rage','rain','rant','rave','react','reappear','reason','recede','recline','refrain','rejoice','relent','remain','remark','reoccur',
  'repent','resign','resonate','respond','resume','retreat','reverse','revolve','riffle','riot','roost','rumble','rustle','scamper','scoff',
  'score','scout','scramble','scribble','scuttle','seep','seesaw','seethe','shimmer','shiver','shriek','shrivel','sigh','sizzle','skate',
  'skitter','skulk','skylark','slant','slave','slobber','slumber','smirk','snack','snarl','sneer','snoop','snuggle','soar','sojourn',
  'soldier','sparkle','spew','splurge','sprint','squabble','squeak','squeal','stagnate','stammer','star','stay','strain','stray','streak',
  'stroll','stumble','subside','succeed','succumb','suffice','sulk','surf','surface','swagger','sway','sweat','swell','swerve','talk',
  'teem','thrive','tingle','tinker','toddle','toil','toot','totter','tower','tremble','trend','trudge','tumble','twaddle','urinate',
  'veer','venture','vibrate','vomit','vote','vow','waddle','waffle','waft','waggle','wait','wallow','wander','wane','war',
  'waver', 'wheeze', 'whine', 'whisper', 'whistle', 'whither', 'wink', 'wonder', 'woof', 'yammer', 'yearn', 'yield', 'zing', 'zoom',
  ['admit',0,0,0,'were admitting','was admitting','admitted','admitted','have admitted','has admitted','are admitting','is admitting'],
  ['agree',0,0,0,'were agreeing','was agreeing',0,0,0,0,'are agreeing','is agreeing'],
  ['arise',0,0,0,'were rising','was rising','arose','arose','have arisen','has arisen','are rising','is rising'],
  ['awake',0,'will suggest','will awaken','were waking','was waking','awoke','awoke','have awoken','has awoken'],
  ['bat',0,0,0,'were batting','was batting','batted','batted','have batted','has batted','are batting','is batting'],
  ['befall',0,0,0,0,0,'befell','befell','have befallen','has befallen'],
  ['begin',0,0,0,'were beginning','was beginning','began','began','have begun','has begun','are beginning','is beginning'],
  ['bethink',0,0,0,0,0,'bethought','bethought','have bethought','has bethought'],
  ['binge',0,0,0,'were bingeing','was bingeing',0,0,0,0,'are bingeing','is bingeing'],
  ['bitch','bitches'],
  ['blab',0,0,0,'were blabbing','was blabbing','blabbed','blabbed','have blabbed','has blabbed','are blabbing','is blabbing'],
  ['bleed',0,0,0,0,0,'bled','bled','have bled','has bled'],
  ['blog',0,0,0,'were blogging','was blogging','blogged','blogged','have blogged','has blogged','are blogging','is blogging'],
  ['blush','blushes'],
  ['bop','bopped',0,0,'were bopping','was bopping','bopped','bopped','have bopped','has bopped','are bopping','is bopping'],
  ['brag',0,'will bragging','will bragging','were bragging','was bragging','bragged','bragged','have bragged','has bragged','are bragging','is bragging'],
  ['chug',0,0,0,'were chugging','was chugging','chugged','chugged','have chugged','has chugged','are chugging','is chugging'],
  ['clash','clashes'],
  ['climax','climaxes'],
  ['come',0,0,0,0,0,'came','came','have come','has come'],
  ['concur',0,0,0,'were concurring','was concurring','concurred','concurred','have concurred','has concurred','are concurring','is concurring'],
  ['crouch','crouches'],
  ['cuss','cusses'],
  ['dash','dashes'],
  ['digress','digresses'],
  ['disagree',0,0,0,'were disagreeing','was disagreeing',0,0,0,0,'are disagreeing','is disagreeing'],
  ['excel',0,0,0,'were excelling','was excelling','excelled','excelled','have excelled','has excelled','are excelling','is excelling'],
  ['fall',0,0,0,0,0,'fell','fell','have fallen','has fallen'],
  ['fib',0,0,0,'were fibbing','was fibbing','fibbed','fibbed','have fibbed','has fibbed','are fibbing','is fibbing'],
  ['flip',0,0,0,'were flipping','was flipping','flipped','flipped','have flipped','has flipped','are flipping','is flipping'],
  ['focus','focuses'],
  ['fret',0,0,0,'were fretting','was fretting','fretted','fretted','have fretted','has fretted','are fretting','is fretting'],
  ['fuss','fusses'],
  ['gab',0,0,0,'were gabbing','was gabbing','gabbed','gabbed','have gabbed','has gabbed','are gabbing','is gabbing'],
  ['gallop',0,0,0,'were gallop'],
  ['glitch','glitches'],
  ['grin',0,0,0,'were grinning','was grinning','grinned','grinned','have grinned','has grinned','are grinning','is grinning'],
  ['grow',0,0,0,0,0,'grew','grew','have grown','has grown'],
  ['gush','gushes'],
  ['hiss','hisses'],
  ['jib',0,0,0,'were jibbing','was jibbing','jibbed','jibbed','have jibbed','has jibbed','are jibbing','is jibbing'],
  ['jig',0,0,0,'were jigging','was jigging','jigged','jigged','have jigged','has jigged','are jigging','is jigging'],
  ['kneel',0,0,0,0,0,'knelt','knelt','have knelt','has knelt'],
  ['leak',0,0,0,0,0,0,0,'have leaker'],
  ['leap',0,0,0,0,0,'leapt','leapt','have leapt','has leapt'],
  ['lend',0,0,0,0,0,'lent','lent','have lent','has lent'],
  ['lunch','lunches'],
  ['lurch','lurches'],
  ['misspell',0,0,0,0,0,'misspelt','misspelt','have misspelt','has misspelt'],
  ['munch','munches'],
  ['nod',0,0,0,'were nodding','was nodding','nodded','nodded','have nodded','has nodded','are nodding','is nodding'],
  ['nosh','noshes'],
  ['occur',0,0,0,'were occurring','was occurring','occurred','occurred','have occurred','has occurred','are occurring','is occurring'],
  ['oversleep',0,0,0,0,0,'overslept','overslept','have overslept','has overslept'],
  ['pay homage','pays homage',0,0,'were paying homage','was paying homage','paid homage','paid homage','have paid homage','has paid homage','are paying homage','is paying homage'],
  ['pee',0,0,0,'were peeing','was peeing',0,0,0,0,'are peeing','is peeing'],
  ['perish','perishes'],
  ['plan',0,0,0,'were planning','was planning','planned','planned','have planned','has planned','are planning','is planning'],
  ['plot',0,0,0,'were plotting','was plotting','plotted','plotted','have plotted','has plotted','are plotting','is plotting'],
  ['preach','preaches'],
  ['rap',0,0,0,'were rapping','was rapping','rapped','rapped','have rapped','has rapped','are rapping','is rapping'],
  ['rebel',0,0,0,'were rebelling','was rebelling','rebelled','rebelled','have rebelled','has rebelled','are rebelling','is rebelling'],
  ['recess','recesses'],
  ['recur',0,0,0,'were recurring','was recurring','recurred','recurred','have recurred','has recurred','are recurring','is recurring'],
  ['relax','relaxes'],
  ['reply','replies',0,0,0,0,'replied','replied','have replied','has replied'],
  ['retaliate',0,0,0,0,0,0,0,'have toasted','has toasted'],
  ['revel',0,0,0,'were revelling','was revelling','revelled','revelled','have revelled','has revelled','are revelling','is revelling'],
  ['rise',0,0,0,0,0,'rose','rose','have risen','has risen'],
  ['rush','rushes'],
  ['say',0,0,0,0,0,'said','said','have said','has said'],
  ['scurry','scurries',0,0,0,0,'scurried','scurried','have scurried','has scurried'],
  ['sin',0,0,0,'were sinning','was sinning','sinned','sinned','have sinned','has sinned','are sinning','is sinning'],
  ['sing',0,0,0,0,0,'sung','sung','have sung','has sung'],
  ['sit',0,0,0,'were sitting','was sitting','sat','sat','have sat','has sat','are sitting','is sitting'],
  ['sleep',0,0,0,0,0,'slept','slept','have slept','has slept'],
  ['slide',0,0,0,0,0,'slid','slid','have slid','has slid'],
  ['slink',0,0,0,0,0,0,0,'have slunk','has slunk'],
  ['sneak',0,0,0,0,0,'snuck','snuck','have snuck','has snuck'],
  ['sob',0,0,0,'were sobbing','was sobbing','sobbed','sobbed','have sobbed','has sobbed','are sobbing','is sobbing'],
  ['spar',0,0,0,'were sparring','was sparring','sparred','sparred','have sparred','has sparred','are sparring','is sparring'],
  ['speak',0,0,0,0,0,'spoke','spoke','have spoken','has spoken'],
  ['speed',0,0,0,0,0,'sped','sped','have sped','has sped'],
  ['squat',0,0,0,'were squatting','was squatting','squatted','squatted','have squatted','has squatted','are squatting','is squatting'],
  ['step',0,0,0,'were stepping','was stepping','stepped','stepped','have stepped','has stepped','are stepping','is stepping'],
  ['stink',0,0,0,0,0,'stunk','stunk','have stunk','has stunk'],
  ['stride',0,0,0,0,0,'strode','strode','have strode','has strode'],
  ['strive',0,0,0,0,0,'strove','strove','have strove','has strove'],
  ['strut',0,0,0,'were strutting','was strutting','strutted','strutted','have strutted','has strutted','are strutting','is strutting'],
  ['submit',0,0,0,'were submitting','was submitting','submitted','submitted','have submitted','has submitted','are submitting','is submitting'],
  ['swear',0,0,0,0,0,'swore','swore','have sworn','has sworn'],
  ['swim',0,0,0,'were swimming','was swimming','swam','swam','have swum','has swum','are swimming','is swimming'],
  ['swivel',0,0,0,'were swivelling','was swivelling','swivelled','swivelled','have swivelled','has swivelled','are swivelling','is swivelling'],
  ['tarry','tarries',0,0,0,0,'tarried','tarried','have tarried','has tarried'],
  ['testify','testifies',0,0,'were testifing','was testifing','testifed','testified','have testifed','has testifed','are testifing','is testifing'],
  ['think',0,0,0,'were think',0,'thought','thought','have thought','has thought'],
  ['throb',0,0,0,'were throbbing','was throbbing','throbbed','throbbed','have throbbed','has throbbed','are throbbing','is throbbing'],
  ['tiptoe',0,0,0,'were tiptoeing','was tiptoeing',0,0,0,0,'are tiptoeing','is tiptoeing'],
  ['trek',0,0,0,'were trekking','was trekking','trekked','trekked','have trekked','has trekked','are trekking','is trekking'],
  ['trot',0,0,0,'were trotting','was trotting','trotted','trotted','have trotted','has trotted','are trotting','is trotting'],
  ['try','tries',0,0,0,0,'tried','tried','have tried','has tried'],
  ['twitch','twitches'],
  ['vanish','vanishes'],
  ['weep',0,0,0,0,0,'wept','wept','have wept','has wept'],
  ['whoosh','whooshes'],
  ['wish','wishes'],
  ['worry','worries',0,0,0,0,'worryied','worried','have worried','has worried'],
  ['yip',0,0,0,'were yipping','was yipping','yipped','yipped','have yipped','has yipped','are yipping','is yipping']
]);

RPWordList.verbs = new RPWordListVerb('transitive', [  
  'abase','abate','abolish','abort','abrade','abrogate','absorb','abstract','accede','acclaim','accost','accrue','acquire','actuate','adapt',
  'add','adhere','adjust','admire','adopt','adore','adorn','advance','advise','affect','afflict','afford','aggrivate','agitate','aid',
  'air','airlift','alarm','alienate','align','allege','alleviate','allow','allure','alter','amend','amputate','amuse','anger','animate',
  'annotate','anoint','appease','append','applaud','apprise','approve','archive','arouse','arrange','arrest','ask','assay','assert','assign',
  'assist','assure','attack','attain','attend','auction','audit','augment','author','avenge','average','avert','avoid','await','award',
  'awe','backdate','badger','bait','bake','bandage','bank','baptise','barbecue','barge','barricade','barter','baste','batter','battle',
  'bayonet','becalm','beckon','befriend','befuddle','begrudge','beguile','belay','believe','belittle','benefit','bequest','besiege','best','betray',
  'better','bifurcate','bilk','bill','birth','bisect','blacken','blame','blast','blemish','blend','blind','bloat','bluff','blunder',
  'blunt','boggle','boil','bolster','bolt','bomb','bombard','book','boost','borrow','bother','bottle','bow','braid','braise',
  'brake','brand','brave','breath','brew','bribe','brighten','bristle','broaden','broil','brown','buck','bucket','bump','bundle',
  'bungle','bunt','burden','burgle','burn','bushwhack','bust','bustle','butt','cajole','cake','calibrate','calm','carouse','carve',
  'cast','cause','caution','cede','celebrate','cement','censor','censure','chain','chair','challenge','chance','channel','charbroil','charge',
  'chart','charter','chase','chastise','cheapen','cheat','check','cheer','chide','chirp','choke','chomp','christen','chuck','churn',
  'circle','claim','clamp','clank','clasp','claw','clean','cleanse','clear','cleave','click','climb','cloak','clothe','clump',
  'coarsen','coauthor','coddle','coil','collar','collate','collect','combat','combine','comfort','compare','compile','complete','compose','compost',
  'conceal','concede','concern','conclude','concoct','condemn','condense','condone','conduct','confine','confront','confuse','congest','connect','connote',
  'conquer','conserve','consider','construct','construe','consult','contort','convene','convince','convoke','convoy','convulse','cook','cool','correct',
  'corrode','count','couple','course','covet','cradle','craft','crank','crave','cream','crease','create','credit','cremate','crest',
  'crick','crimp','crinkle','criticise','crowd','cuddle','cull','culture','curdle','cure','cycle','damn','dampen','dangle','dare',
  'darn','daze','dazzle','deaden','debase','debit','debrief','debunk','deceive','decimate','decipher','declare','decline','decode','decorate',
  'decoy','decrease','deduce','deduct','deem','deface','defeat','defend','define','deflate','deflect','defray','dehydrate','deice','deject',
  'delete','delight','delimit','delineate','deliver','demand','demerit','demote','denigrate','denote','dent','depict','deplete','deplore','deploy',
  'deport','depose','deprive','derail','derange','deride','descend','describe','desecrate','desert','deserve','design','desire','desist','despise',
  'despoil','despute','destine','detain','detect','detest','devise','devolve','devote','dice','dictate','diddle','diffuse','digest','disarm',
  'disband','disburse','disclaim','disclose','discover','disfigure','disgorge','disgrace','disinfect','dislike','dislocate','dislodge','dismay','disperse','display',
  'dispose','dispute','disrobe','disrupt','dissuade','distill','distract','distrust','disturb','divide','divine','divorce','doctor','dodge','dole',
  'dominate','doom','dope','double','doubt','douse','download','downscale','dowse','draft','drain','dread','dredge','drill','drizzle',
  'droop','drown','dull','dump','dunk','dupe','dye','earmark','earn','ease','edit','educate','eject','elbow','elect',
  'elevate','eliminate','elude','embalm','embark','embezzle','embitter','embolden','embrace','employ','empower','enact','encase','enchant','encipher',
  'encircle','encounter','encrust','encumber','endanger','endorse','endure','enfold','enforce','engage','engineer','engrave','engulf','enhance','enjoin',
  'enjoy','enlarge','enmesh','enqueue','ensnare','ensure','enter','entice','entitle','entomb','entrance','entreat','entrust','entwine','equal',
  'erase','erect','eschew','escrow','espouse','estimate','estrange','evacuate','evade','evaluate','evoke','exact','exalt','examine','excavate',
  'exceed','exchange','excite','exclude','excoriate','excrete','execute','exempt','exercise','exert','exhale','exhibit','exhort','exhume','exile',
  'exonerate','exorcise','exploit','explore','export','expose','expunge','extend','extract','extrude','exude','eyeball','face','fade','fail',
  'famish','farm','fashion','fasten','fathom','feature','fell','fend','fetter','fiddle','field','file','filet','fill','fillet',
  'film','fire','firebomb','fixate','flank','flatten','flatter','flaunt','flick','flood','floor','flower','flunk','fold','follow',
  'foment','fool','force','forewarn','forfeit','forge','foster','foul','found','frame','fray','frazzle','frequent','freshen','frighten',
  'frisk','frizzle','front','fudge','fumble','fumigate','furrow','further','fuse','gain','gall','gamble','garage','garble','garner',
  'gather','gazette','gibbet','gird','glean','glue','gnaw','goof','gorge','gouge','graft','grant','grapple','grill','grope',
  'group','grumble','guide','gutter','guzzle','hack','hail','halve','hammer','hamper','handle','harden','harm','harpoon','hassle',
  'haul','haunt','head','heal','heap','heckle','hector','heed','heft','help','herald','highlight','hijack','hire','hollow',
  'honk','hook','host','hound','house','humble','humiliate','hurl','hustle','hydrate','hypnotise','ignite','ignore','image','imagine',
  'imitate','immerse','impact','impair','impart','implant','implement','implore','import','impose','impound','imprison','incite','increase','incubate',
  'indicate','induce','infect','infest','inflame','inflate','inflict','influence','infringe','infuriate','inhabit','inhale','inherit','initiate','inject',
  'inspect','inspire','install','insulate','insult','insure','interject','intern','intersect','invade','invent','invert','invest','invoke','involve',
  'irk','irrigate','irritate','issue','jail','jangle','jerk','jettison','jingle','join','jolt','judge','juice','jumble','jump',
  'juxtapose','kick','kindle','knead','knife','label','lace','ladle','lambast','lament','laminate','lasso','lather','lease','leaven',
  'lecture','leer','legislate','lick','lift','lighten','line','list','litter','liven','load','loan','loathe','locate','lock',
  'lodge','loft','loop','loose','loot','love','lower','lull','lure','machine','madden','maim','major','mandate','mangle',
  'manicure','maroon','marshal','mask','massage','masticate','measure','meld','melt','mend','mention','mentor','merge','merit','milk',
  'mill','mime','mimic','mince','mint','miscast','miscount','misfire','misjudge','misplay','misprint','misquote','misstate','mistime','misuse',
  'mock','moderate','moisten','molest','mother','motivate','mount','mouth','move','mow','muddle','muffle','mull','murder','muscle',
  'muster','mutate','muzzle','nauseate','near','neglect','neuter','nibble','nitpick','nominate','notice','nuke','number','nurse','nuzzle',
  'obey','obfuscate','obligate','obscure','observe','occlude','offend','offer','offload','ogle','open','operate','oppose','orbit','ordain',
  'orient','orientate','ostracise','oust','out','outplay','outshine','outstay','overawe','overbook','overhaul','overpower','overprint','overrate','overstay',
  'overuse','owe','own','pack','package','page','paginate','panhandle','park','parol','paste','pastor','pave','paw','peal',
  'peck','peddle','peep','penetrate','pension','perceive','permeate','permute','persist','persuade','perturb','peruse','pervert','phone','pick',
  'picture','pile','pilfer','pilot','ping','pique','placard','placate','plague','plant','play','please','pleat','plumb','pocket',
  'poke','police','poll','pollute','ponder','port','post','postpone','pound','powder','power','praise','prank','predict','preempt',
  'preen','preface','prefer','preheat','prejudge','prep','prepare','present','preserve','pressure','prevent','preview','price','prick','primp',
  'print','probe','procure','produce','profile','project','promise','promote','propose','propound','protect','protest','puff','pull','pulp',
  'pump','punctuate','punt','purge','pursue','purvey','quell','quicken','race','rack','radiate','radio','raid','raise','rank',
  'ransack','rate','rattle','readjust','reanimate','rearm','rearrange','reassert','rebuff','rebuke','rebutt','recall','receive','recharge','recheck',
  'recite','reckon','recompile','record','recoupe','recover','recreate','recruit','recycle','redden','redeem','redefine','redeploy','redirect','reduce',
  'reel','reelect','reenact','reenter','refine','reflect','reform','refund','refute','regain','regard','register','regulate','rehearse','rehire',
  'reinvent','reissue','reject','rekindle','relabel','relate','relay','relearn','release','relegate','relieve','relive','reload','relocate','remember',
  'remind','remount','remove','rename','renew','rent','renumber','reorder','repair','repeal','replace','replay','replenish','report','repose',
  'reprint','reproduce','reprove','repudiate','repulse','require','reroute','resemble','resent','reserve','resettle','resize','resolve','resource','respect',
  'restart','restore','restrain','retail','retain','retard','retool','retrace','retract','retread','retrieve','return','reveal','revert','review',
  'revile','revise','revive','revoke','rewire','reword','rework','ripen','risk','roast','robe','rock','roll','roughen','route',
  'row','rue','ruffle','rule','rumple','sabotage','sack','sadden','safeguard','sail','salivate','salt','salute','salvage','sample',
  'sand','sandblast','saturate','save','saver','scare','scatter','scavenge','schmooze','school','scold','scorn','scrabble','scrape','screen',
  'sculpt','seal','season','secede','second','sedate','seduce','segment','seize','sense','serve','settle','sew','shackle','shade',
  'shadow','shame','shampoo','share','sharpen','shatter','shave','shear','sheath','sheathe','shell','shelter','shock','shoplift','shove',
  'show','showcase','shower','shroud','shuffle','shunt','sicken','sideline','sift','sign','simulate','siphon','sire','situate','skew',
  'skewer','skimp','skyjack','slander','sledge','slight','slow','slurp','smack','smarten','smelt','smith','smoke','smother','smudge',
  'smuggle','snaffle','snort','snow','soak','solder','solve','sooth','sort','space','spark','spear','spearhead','spike','spite',
  'splatter','splice','splinter','sponsor','spoof','spool','spout','spray','spring','sprout','squander','squish','stable','stack','staff',
  'stage','start','startle','starve','state','station','steam','stiffen','stifle','still','stipple','stock','stoke','stomp','stow',
  'strangle','strengthen','subdue','subject','subjugate','sublet','submerge','submerse','subpoena','subsidise','subsume','subtract','subvert','suckle','suffer',
  'suffocate','suffuse','suggest','summon','supersede','supervise','suppose','survive','sustain','swaddle','swallow','swarm','swindle','tabulate','tailor',
  'tame','tamper','tangle','taste','tattoo','taunt','team','tease','telephone','temper','tempt','terminate','terrace','terrorise','test',
  'thank','thaw','thrash','thread','threaten','thumb','thump','tickle','tighten','till','tilt','time','tinkle','tithe','toast',
  'toggle','tolerate','torture','tote','tour','tout','trace','track','trade','traipse','tramp','trample','transmute','treasure','treat',
  'treble','trick','trigger','triple','trisect','tromp','trounce','trump','trundle','trust','tuck','tune','tutor','tweak','twiddle',
  'twirl','type','unblock','unbolt','uncoil','underrate','undersign','unearth','unfold','unfurl','unhinge','unhook','unite','unlace','unlearn',
  'unload','unlock','unmask','unscrew','unseal','unseat','unsheathe','unveil','update','upend','upholster','uproot','upstage','usher','usurp',
  'vacate','vacuum','value','vector','veil','venerate','vent','verge','view','vindicate','violate','visit','voice','void','waive',
  'walk','wallop','want','waste','water','wean','weigh','weld','whack','wham','wheel','whiff','whisk','whittle','whoop',
  'widen','widow','wiggle','winnow','wipe','wire','wither','woo','work','worsen','wound','wrangle','wreck','wrestle','wriggle', 'wrinkle',
  ['abet',0,0,0,'were abetting','was abetting','abetted','abetted','have abetted','has abetted','are abetting','is abetting'],
  ['abhor',0,0,0,'were abhorring','was abhorring','abhorred','abhorred','have abhorred','has abhorred','are abhorring','is abhorring'],
  ['accompany','accompanies',0,0,0,0,'accompanied','accompanied','have accompanied','has accompanied'],
  ['acquit',0,0,0,'were acquitting','was acquitting','acquitted','acquitted','have acquitted','has acquitted','are acquitting','is acquitting'],
  ['affix','affixes'],
  ['aim at','aims at',0,0,'were aiming at','was aiming at','aimed at','aimed at','have aimed at','has aimed at','are aiming at','is aiming at'],
  ['airbrush','airbrushes',0,0,0,0,0,0,0,0,0,0,'might bend','might bend'],
  ['allot',0,0,0,'were allotting','was allotting','allotted','allotted','have allotted','has allotted','are allotting','is allotting'],
  ['ambush','ambushes'],
  ['annul',0,0,0,'were annulling','was annulling','annulled','annulled','have annulled','has annulled','are annulling','is annulling'],
  ['apply','applies',0,0,0,0,'applied','applied','have applied','has applied'],
  ['assess','assesses'],
  ['baby','babies',0,0,0,0,'babied','babied','have babied','has babied'],
  ['babysit',0,0,0,'were babysitting','was babysitting','babysat','babysat','have babysat','has babysat','are babysitting','is babysitting'],
  ['bar',0,0,0,'were barring','was barring','barred','barred','have barred','has barred','are barring','is barring'],
  ['bare',0,0,0,0,0,'bore','bore','have born','has born'],
  ['bathe',0,0,0,0,0,0,0,0,0,0,0,'might bath','might bath'],
  ['beat',0,0,0,0,0,'beat','beat','have beaten','has beaten'],
  ['befit',0,0,0,'were befitting','was befitting','befitted','befitted','have befitted','has befitted','are befitting','is befitting'],
  ['beg',0,0,0,'were begging','was begging','begged','begged','have begged','has begged','are begging','is begging'],
  ['beget',0,0,0,'were begetting','was begetting','begot','begot','have begotten','has begotten','are begetting','is begetting'],
  ['behold',0,0,0,0,0,'beheld','beheld','have beheld','has beheld'],
  ['belch','belches'],
  ['bend',0,0,0,0,0,'bent','bent','have bent','has bent'],
  ['bias','biases'],
  ['bide',0,0,0,0,0,'bode','bode','have bode','has bode'],
  ['bind',0,0,0,0,0,'bound','bound','have bound','has bound'],
  ['bite',0,0,0,0,0,'bit','bit','have bitten','has bitten'],
  ['blanch','blanches'],
  ['bleach','bleaches'],
  ['blitz','blitzes'],
  ['blot',0,0,0,'were blotting','was blotting','blotted','blotted','have blotted','has blotted','are blotting','is blotting'],
  ['boot',0,0,0,0,0,'bootted'],
  ['bore',0,0,0,'were boreing','was boreing',0,0,0,0,'are boreing','is boreing'],
  ['breach','breaches'],
  ['break',0,0,0,0,0,'broke','broke','have broken','has broken'],
  ['brim',0,0,0,'were brimming','was brimming','brimmed','brimmed','have brimmed','has brimmed','are brimming','is brimming'],
  ['bring',0,0,0,0,0,'brought','brought','have brought','has brought'],
  ['brush','brushes'],
  ['bug',0,0,0,'were bugging','was bugging','bugged','bugged','have bugged','has bugged','are bugging','is bugging'],
  ['build',0,0,0,0,0,'built','built','have built','has built',0,0,'might buil'],
  ['bury','buries',0,0,0,0,'buried','buried','have buried','has buried'],
  ['buy',0,0,0,0,0,'bought','bought','have bought','has bought'],
  ['bypass','bypasses'],
  ['can',0,0,0,'were canning','was canning','canned','canned','have canned','has canned','are canning','is canning'],
  ['cancel',0,0,0,'were cancelling','was cancelling','cancelled','cancelled','have cancelled','has cancelled','are cancelling','is cancelling'],
  ['canvas','canvasses',0,0,'were canvassing','was canvassing','canvassed','canvassed','have canvassed','has canvassed','are canvassing','is canvassing','might canvass','might canvass'],
  ['caress','caresses'],
  ['carry','carries',0,0,0,0,'carried','carried','have carried','has carried'],
  ['cater for','caters for',0,0,'were catering for','was catering for','catered for','catered for','have catered for','has catered for','are catering for','is catering for'],
  ['certify','certifies',0,0,0,0,'certified','certified','have certified','has certified'],
  ['char',0,0,0,'were charring','was charring','charred','charred','have charred','has charred','are charring','is charring'],
  ['choose',0,0,0,0,0,'chose','chose','have chosen','has chosen'],
  ['chop',0,0,0,'were chopping','was chopping','chopped','chopped','have chopped','has chopped','are chopping','is chopping'],
  ['clap',0,0,0,'were clapping','was clapping','clapped','clapped','have clapped','has clapped','are clapping','is clapping'],
  ['clarify','clarifies',0,0,0,0,'clarified','clarified','have clarified','has clarified'],
  ['clench','clenches'],
  ['clinch','clinches'],
  ['cling to','clings to',0,0,'were clinging to','was clinging to','clung to','clung to','have clung to','has clung to','are clinging to','is clinging to'],
  ['clip',0,0,0,'were clipping','was clipping','clipped','clipped','have clipped','has clipped','are clipping','is clipping'],
  ['clot',0,0,0,'were clotting','was clotting','clotted','clotted','have clotted','has clotted','are clotting','is clotting'],
  ['clutch','clutches'],
  ['codify','codifies',0,0,0,0,'codified','codified','have codified','has codified'],
  ['coincide with','coincides with',0,0,'were coinciding with','was coinciding with','coincided with','coincided with','have coincided with','has coincided with','are coinciding with','is coinciding with'],
  ['commit',0,0,0,'were committing','was committing','committed','committed','have committed','has committed','are committing','is committing'],
  ['compel',0,0,0,'were compelling','was compelling','compelled','compelled','have compelled','has compelled','are compelling','is compelling'],
  ['compress','compresses'],
  ['confess','confesses'],
  ['control',0,0,0,'were controlling','was controlling','controlled','controlled','have controlled','has controlled','are controlling','is controlling'],
  ['copy','copies',0,0,0,0,'copied','copied','have copied','has copied'],
  ['corral',0,0,0,'were corralling','was corralling','corralled','corralled','have corralled','has corralled','are corralling','is corralling'],
  ['cram',0,0,0,'were cramming','was cramming','crammed','crammed','have crammed','has crammed','are cramming','is cramming'],
  ['crash','crashes'],
  ['crop',0,0,0,'were cropping','was cropping','cropped','cropped','have cropped','has cropped','are cropping','is cropping'],
  ['crossbreed',0,0,0,0,0,'crossbread','crossbread','have crossbread','has crossbread'],
  ['crunch','crunches'],
  ['curb',0,'will curbed','will curbed'],
  ['cut',0,0,0,'were cutting','was cutting','cut','cut','have cut','has cut','are cutting','is cutting'],
  ['dab',0,0,0,'were dabbing','was dabbing','dabbed','dabbed','have dabbed','has dabbed','are dabbing','is dabbing'],
  ['dam',0,0,0,'were damming','was damming','dammed','dammed','have dammed','has dammed','are damming','is damming'],
  ['deal',0,0,0,0,0,'dealt','dealt','have dealt','has dealt'],
  ['decry','decries',0,0,0,0,'decried','decried','have decried','has decried'],
  ['defer',0,0,0,'were deferring','was deferring','deferred','deferred','have deferred','has deferred','are deferring','is deferring'],
  ['deify','deifies',0,0,'were deifing','was deifing','deified','deified','have deified','has deified','are deifing','is deifing'],
  ['demolish','demolishes'],
  ['dialogue with','dialogues with',0,0,'were dialoguing with','was dialoguing with','dialogued with','dialogued with','have dialogued with','has dialogued with','are dialoguing with','is dialoguing with'],
  ['differ from','differs from',0,0,'were differing from','was differing from','differed from','differed from','have differed from','has differed from','are differing from','is differing from'],
  ['dig',0,0,0,'were digging','was digging','dug','dug','have dug','has dug','are digging','is digging'],
  ['dignify','dignifies',0,0,0,0,'dignified','dignified','have dignified','has dignified'],
  ['dim',0,0,0,'were dimming','was dimming','dimmed','dimmed','have dimmed','has dimmed','are dimming','is dimming'],
  ['dip',0,0,0,'were dipping','was dipping','dipped','dipped','have dipped','has dipped','are dipping','is dipping'],
  ['dirty','dirties',0,0,0,0,'dirtied','dirtied','have dirtied','has dirtied'],
  ['discuss','discusses'],
  ['disembody','disembodies',0,0,0,0,'disembodied','disembodied','have disembodied','has disembodied'],
  ['dismiss','dismisses'],
  ['dispel',0,0,0,0,'was dispelling','dispelled','dispelled','have dispelled','has dispelled','are dispelling','is dispelling'],
  ['diversify','diversifies',0,0,0,0,'diversified','diversified','have diversified','has diversified'],
  ['dot',0,0,0,'were dotting','was dotting','dotted','dotted','have dotted','has dotted','are dotting','is dotting'],
  ['draw',0,0,0,0,0,'drew','drew','have drawn','has drawn'],
  ['drench','drenches'],
  ['dress','dresses'],
  ['drink',0,0,0,0,0,'drunk','drunk','have drunk','has drunk',0,0,'might drunk'],
  ['drop',0,0,0,'were dropping','was dropping','dropped','dropped','have dropped','has dropped','are dropping','is dropping'],
  ['drub',0,0,0,'were drubbing','was drubbing','drubbed','drubbed','have drubbed','has drubbed','are drubbing','is drubbing'],
  ['dry','dries',0,0,0,0,'dried','dried','have dried','has dried'],
  ['dub',0,0,0,'were dubbing','was dubbing','dubbed','dubbed','have dubbed','has dubbed','are dubbing','is dubbing'],
  ['edify','edifies',0,0,0,0,'edified','edified','have edified','has edified'],
  ['emit',0,0,0,'were emitting','was emitting','emitted','emitted','have emitted','has emitted','are emitting','is emitting'],
  ['empty','empties',0,0,0,0,'emptied','emptied','have emptied','has emptied'],
  ['enrich','enriches'],
  ['enslave',0,'will enslaved','will enslaved'],
  ['entrap',0,0,0,'were entrapping','was entrapping','entrapped','entrapped','have entrapped','has entrapped','are entrapping','is entrapping'],
  ['envision',0,0,0,0,0,'envisionved'],
  ['envy','envies',0,0,0,0,'envied','envied','have envied','has envied'],
  ['equip',0,0,0,'were equipping','was equipping','equipped','equipped','have equipped','has equipped','are equipping','is equipping'],
  ['etch','etches'],
  ['expel',0,0,0,'were expelling','was expelling','expelled','expelled','have expelled','has expelled','are expelling','is expelling'],
  ['express','expresses'],
  ['falsify','falsifies',0,0,0,0,'falsified','falsified','have falsified','has falsified'],
  ['fancy','fancies',0,0,0,0,'fancied','fancied','have fancied','has fancied'],
  ['fax','faxes'],
  ['fear',0,0,0,'were afraid','was afraid',0,0,'have been afraid','has been afraid','are afraid','is afraid'],
  ['feed',0,0,0,0,0,'fed','fed','have fed','has fed'],
  ['feel',0,0,0,0,0,'felt','felt','have felt','has felt'],
  ['ferry','ferries',0,0,0,0,'ferried','ferried','have ferried','has ferried'],
  ['fetch','fetches'],
  ['feud with','feuds with',0,0,'were feuding with','was feuding with','feuded with','feuded with','have feuded with','has feuded with','are feuding with','is feuding with'],
  ['fight',0,0,0,0,0,'faught','faught','have faught','has faught'],
  ['find',0,0,0,0,0,'found','found','have found','has found'],
  ['finish','finishes'],
  ['fit',0,0,0,'were fitting','was fitting','fitted','fitted','have fitted','has fitted','are fitting','is fitting'],
  ['fix','fixes','will fixing','will fixing'],
  ['flee',0,0,0,'were fleeing','was fleeing','fled','fled','have fled','has fled','are fleeing','is fleeing'],
  ['flex','flexes'],
  ['flog',0,0,0,'were flogging','was flogging','flogged','flogged','have flogged','has flogged','are flogging','is flogging'],
  ['flub',0,0,0,'were flubbing','was flubbing','flubbed','flubbed','have flubbed','has flubbed','are flubbing','is flubbing'],
  ['flush','flushes'],
  ['fob',0,0,0,'were fobbing','was fobbing','fobbed','fobbed','have fobbed','has fobbed','are fobbing','is fobbing'],
  ['foresee',0,0,0,'were foreseeing','was foreseeing','foresaw','foresaw','have foreseen','has foreseen','are foreseeing','is foreseeing'],
  ['foretell',0,0,0,0,0,'foretold','foretold','have foretold','has foretold'],
  ['forget',0,0,0,'were forgetting','was forgetting','forgot','forgot','have forgotten','has forgotten','are forgetting','is forgetting'],
  ['forgive',0,0,0,0,0,'forgave','forgave','have forgiven','has forgiven'],
  ['forgo',0,0,0,0,0,'forwent','forwent','have forgone','has forgone'],
  ['format',0,0,0,'were formatting','was formatting','formatted','formatted','have formatted','has formatted','are formatting','is formatting'],
  ['free',0,0,0,'were freeing','was freeing',0,0,0,0,'are freeing','is freeing'],
  ['freeze',0,0,0,0,0,'froze','froze','have frozen','has frozen'],
  ['friz','frizzes',0,0,'were frizzing','was frizzing','frizzed','frizzed','have frizzed','has frizzed','are frizzing','is frizzing'],
  ['fry',0,0,0,0,0,'fried','fried','have fried','has fried'],
  ['funnel',0,0,0,'were funnelling','was funnelling','funnelled','funnelled','have funnelled','has funnelled','are funnelling','is funnelling'],
  ['furbish','furbishes'],
  ['furnish','furnishes',0,0,0,0,0,0,0,0,'are rejoining'],
  ['gag',0,0,0,'were gagging','was gagging','gagged','gagged','have gagged','has gagged','are gagging','is gagging'],
  ['garnish','garnishes'],
  ['get',0,0,0,'were getting','was getting','got','got','have gotten','has gotten','are getting','is getting'],
  ['glimps','glimpses'],
  ['gloss over','glosses over',0,0,'were glossing over','was glossing over','glossed over','glossed over','have glossed over','has glossed over','are glossing over','is glossing over'],
  ['grab',0,0,0,'were grabbing','was grabbing','grabbed','grabbed','have grabbed','has grabbed','are grabbing','is grabbing'],
  ['grind',0,0,0,0,0,'ground','ground','have ground','has ground'],
  ['grip',0,0,0,'were gripping','was gripping','gripped','gripped','have gripped','has gripped','are gripping','is gripping'],
  ['grit',0,0,0,'were gritting','was gritting','gritted','gritted','have gritted','has gritted'],
  ['guess','guesses'],
  ['hamstring',0,0,0,0,0,'hamstrung','hamstrung','have hamstrung','has hamstrung'],
  ['hang',0,0,0,0,0,'hung','hung','have hung','has hung'],
  ['hash','hashes'],
  ['hatch','hatches'],
  ['hear',0,0,0,0,0,'heard','heard','have heard','has heard'],
  ['hem',0,0,0,'were hemming','was hemming','hemmed','hemmed','have hemmed','has hemmed','are hemming','is hemming'],
  ['hide',0,0,0,0,0,'hid','hid','have hidden','has hidden'],
  ['hoards','hoard','will hoard','will hoard','were hoarding','was hoarding','hoarded','hoarded','have hoarded','has hoarded','are hoarding','is hoarding','might hoard','might hoard'],
  ['hog',0,0,0,'were hogging','was hogging','hogged','hogged','have hogged','has hogged','are hogging','is hogging'],
  ['hold',0,0,0,0,0,'held','held','have held','has held'],
  ['hug',0,0,0,'were hugging','was hugging','hugged','hugged','have hugged','has hugged','are hugging','is hugging'],
  ['hurry','hurries',0,0,0,0,'hurried','hurried','have hurried','has hurried'],
  ['hurt',0,0,0,0,0,'hurt','hurt','have hurt','has hurt'],
  ['impede',0,'will impeded','will impeded'],
  ['imply','implies',0,0,0,0,'implied','implied','have implied','has implied'],
  ['indemnify','indemnifies',0,0,0,0,'indemnified','indemnified','have indemnified','has indemnified'],
  ['index','indexes'],
  ['infer',0,0,0,'were inferring','was inferring','inferred','inferred','have inferred','has inferred','are inferring','is inferring'],
  ['inter',0,0,0,'were interring','was interring','interred','interred','have interred','has interred','are interring','is interring'],
  ['jab',0,0,0,'were jabbing','was jabbing','jabbed','jabbed','have jabbed','has jabbed','are jabbing','is jabbing'],
  ['jam',0,0,0,'were jamming','was jamming','jammed','jammed','have jammed','has jammed','are jamming','is jamming'],
  ['jar',0,0,0,'were jarring','was jarring','jarred','jarred','have jarred','has jarred','are jarring','is jarring'],
  ['jazz up','jazzes up',0,0,'were jazzing up','was jazzing up','jazzed up','jazzed up','have jazzed up','has jazzed up','are jazzing up','is jazzing up'],
  ['jimmy','jimmies',0,0,0,0,'jimmied','jimmied','have jimmied','has jimmied'],
  ['jog',0,0,0,'were jogging','was jogging','jogged','jogged','have jogged','has jogged','are jogging','is jogging'],
  ['jot',0,0,0,'were jotting','was jotting','jotted','jotted','have jotted','has jotted','are jotting','is jotting'],
  ['joyride',0,0,0,0,0,'joyrode','joyrode','have joyridden','has joyridden'],
  ['keep',0,0,0,0,0,'kept','kept','have kept','has kept'],
  ['kiss','kisses'],
  ['knit',0,0,0,'were knitting','was knitting','knitted','knitted','have knitted','has knitted','are knitting','is knitting'],
  ['know',0,0,0,0,0,'knew','knew','have known','has known'],
  ['lag',0,0,0,'were lagging','was lagging','lagged','lagged','have lagged','has lagged','are lagging','is lagging'],
  ['lap',0,0,0,'were lapping','was lapping','lapped','lapped','have lapped','has lapped','are lapping','is lapping'],
  ['lash','lashes'],
  ['launch','launches'],
  ['lavish','lavishes'],
  ['leach','leaches'],
  ['lead',0,0,0,0,0,'lead','lead','have lead','has lead'],
  ['leave',0,0,0,0,0,'left','left'],
  ['leech','leeches'],
  ['like',0,0,0,'were likeing','was likeing',0,0,0,0,'are likeing','is likeing'],
  ['line up','lines up',0,0,'were lining up','was lining up','lined up','lined up','have lined up','has lined up','are lining up','is lining up'],
  ['liquefy','liquefies',0,0,0,0,'liquefied','liquefied','have liquefied','has liquefied'],
  ['lob',0,0,0,'were lobbing','was lobbing','lobbed','lobbed','have lobbed','has lobbed','are lobbing','is lobbing'],
  ['log',0,0,0,'were logging','was logging','logged','logged','have logged','has logged','are logging','is logging'],
  ['lop',0,0,0,'were lopping','was lopping','lopped','lopped','have lopped','has lopped','are lopping','is lopping'],
  ['lose',0,0,0,0,0,'lost','lost','have lost','has lost'],
  ['lug',0,0,0,'were lugging','was lugging','lugged','lugged','have lugged','has lugged','are lugging','is lugging'],
  ['lynch','lynches'],
  ['magnifiy','magnifies',0,0,0,0,'magnified','magnified','have magnified','has magnified'],
  ['make',0,0,0,0,0,'made','made','have made','has made'],
  ['man',0,0,0,'were manning','was manning','manned','manned','have manned','has manned','are manning','is manning'],
  ['map',0,0,0,'were mapping','was mapping','mapped','mapped','have mapped','has mapped','are mapping','is mapping'],
  ['marry','marries',0,0,0,0,'married','married','have married','has married'],
  ['mash','mashes'],
  ['match','matches'],
  ['meet',0,0,0,0,0,'met','met','have met','has met'],
  ['mess up','messes up',0,0,'were messing up','was messing up','messed up','messed up','have messed up','has messed up','are messing up','is messing up'],
  ['misapply','misapplies',0,0,0,0,'misapplied','misapplied','have misapplied','has misapplied'],
  ['misdeal',0,0,0,0,0,'misdealt','misdealt','have misdealt','has misdealt'],
  ['mislay',0,0,0,0,0,'mislaid','mislaid','have mislaid','has mislaid'],
  ['mistake',0,0,0,0,0,'mistook','mistook','have mistaken','has mistaken'],
  ['mitigate',0,0,0,0,0,'mitigate'],
  ['mix','mixes'],
  ['model',0,0,0,'were modelling','was modelling','modelled','modelled','have modelled','has modelled','are modelling','is modelling'],
  ['modify','modifies',0,0,0,0,'modified','modified','have modified','has modified'],
  ['mooch','mooches'],
  ['mop',0,0,0,'were mopping','was mopping','mopped','mopped','have mopped','has mopped','are mopping','is mopping'],
  ['morn',0,0,0,0,0,0,0,'have morn','has morn'],
  ['mug',0,0,0,'were mugging','was mugging','mugged','mugged','have mugged','has mugged','are mugging','is mugging'],
  ['mulch','mulches'],
  ['nab',0,0,0,'were nabbing','was nabbing','nabbed','nabbed','have nabbed','has nabbed','are nabbing','is nabbing'],
  ['nag',0,0,0,'were nagging','was nagging','nagged','nagged','have nagged','has nagged','are nagging','is nagging'],
  ['need',0,0,0,null,null,0,0,0,0,null,null],
  ['nix','nixes'],
  ['notch','notches'],
  ['nut out','nuts out',0,0,'were nutting out','was nutting out','nutted out','nutted out','have nutted out','has nutted out','are nutting out','is nutting out'],
  ['occupy','occupies',0,0,0,0,'occupied','occupied','have occupied','has occupied'],
  ['offset',0,0,0,'were offsetting','was offsetting','offset','offset','have offset','has offset','are offsetting','is offsetting'],
  ['omit',0,0,0,'were omitting','was omitting','omitted','omitted','have omitted','has omitted','are omitting','is omitting'],
  ['order',0,0,0,0,0,0,0,0,'has orderd'],
  ['ossify','ossifies',0,0,'were ossifing','was ossifing','ossified','ossified','have ossified','has ossified','are ossifing','is ossifing'],
  ['outbid',0,0,0,'were outbidding','was outbidding','outbidded','outbidded','have outbid','has outbid','are outbidding','is outbidding'],
  ['outdo','outdoes',0,0,0,0,'outdid','outdid','have outdone','has outdone'],
  ['outfit',0,0,0,'were outfitting','was outfitting','outfitted','outfitted','have outfitted','has outfitted','are outfitting','is outfitting'],
  ['outfox','outfoxes'],
  ['outgrow',0,0,0,0,0,'outgrew','outgrew','have outgrown','has outgrown'],
  ['outlay',0,0,0,0,0,'outlaid','outlaid','have outlaid','has outlaid'],
  ['outwear',0,0,0,0,0,'outwore','outwore','have outworn','has outworn'],
  ['outwit',0,0,0,'were outwitting','was outwitting','outwitted','outwitted','have outwitted','has outwitted','are outwitting','is outwitting'],
  ['overcome',0,0,0,0,0,'overcame','overcame','have overcame','has overcame'],
  ['overdraw',0,0,0,0,0,'overdrew','overdrew','have overdrawn','has overdrawn'],
  ['overgrow',0,0,0,0,0,'overgrew','overgrew','have overgrown','has overgrown'],
  ['overhang',0,0,0,0,0,'overhung','overhung','have overhung','has overhung'],
  ['overhear',0,0,0,0,0,'overheard','overheard','have overheard','has overheard'],
  ['overlap',0,0,0,'were overlapping','was overlapping','overlapped','overlapped','have overlapped','has overlapped','are overlapping','is overlapping'],
  ['overlay',0,0,0,0,0,'overlaid','overlaid','have overlaid','has overlaid'],
  ['overlie',0,0,0,'were overlying','was overlying','overlaid','overlaid','have overlaid','has overlaid','are overlying','is overlying'],
  ['override',0,0,0,0,0,'overrode','overrode','have overridden','has overridden'],
  ['oversee',0,0,0,'were overseeing','was overseeing','oversaw','oversaw','have oversaw','has oversaw','are overseeing','is overseeing'],
  ['overwrite',0,0,0,0,0,'overwrote','overwrote','have overwritten','has overwritten'],
  ['pacify','pacifies',0,0,'were pacifing','was pacifing','pacified','pacified','have pacified','has pacified'],
  ['pair',0,0,0,0,0,0,0,0,0,0,0,'might paired','might paired'],
  ['pan',0,0,0,'were panning','was panning','panned','panned','have panned','has panned','are panning','is panning'],
  ['parody','parodies',0,0,0,0,'parodied','parodied','have parodied','has parodied'],
  ['pass','passes'],
  ['pat',0,0,0,'were patting','was patting','patted','patted','have patted','has patted','are patting','is patting'],
  ['patch','patches'],
  ['patrol',0,0,0,'were patrolling','was patrolling','patrolled','patrolled','have patrolled','has patrolled'],
  ['pay',0,0,0,0,0,'paid','paid','have paid','has paid'],
  ['pedal',0,0,0,'were pedalling','was pedalling','pedalled','pedalled','have pedalled','has pedalled','are pedalling','is pedalling'],
  ['peg',0,0,0,'were pegging','was pegging','pegged','pegged','have pegged','has pegged','are pegging','is pegging'],
  ['perch','perches'],
  ['perplex','perplexes'],
  ['personify','personifies',0,0,0,0,'personified','personified','have personified','has personified'],
  ['pertain to','pertains to',0,0,'were pertaining to','was pertaining to','pertained to','pertained to','have pertained to','has pertained to','are pertaining to','is pertaining to'],
  ['pet',0,0,0,'were petting','was petting','petted','petted','have petted','has petted','are petting','is petting'],
  ['pin',0,0,0,'were pinning','was pinning','pinned','pinned','have pinned','has pinned','are pinning','is pinning'],
  ['pinch','pinches'],
  ['pitch','pitches'],
  ['pity','pities',0,0,0,0,'pitied','pitied','have pitied','has pitied'],
  ['plug',0,0,0,'were plugging','was plugging','plugged','plugged','have plugged','has plugged','are plugging','is plugging'],
  ['ply','plies',0,0,0,0,'plied','plied','have plied','has plied'],
  ['polish','polishes'],
  ['pommel',0,0,0,0,0,'pommelled','pommelled','have pommelled','has pommelled'],
  ['pop',0,0,0,'were popping','was popping','popped','popped','have popped','has popped','are popping','is popping'],
  ['possess','possesses'],
  ['press','presses'],
  ['pretty','pretties',0,0,0,0,'prettied','prettied','have prettied','has prettied'],
  ['process','processes'],
  ['prod',0,0,0,'were prodding','was prodding','prodded','prodded','have prodded','has prodded','are prodding','is prodding'],
  ['prop up','props up',0,0,'were nominating','was propping up','propped up','propped up','have propped up','has propped up','are propping up','is propping up'],
  ['propel',0,0,0,'were propelling','was propelling','propelled','propelled','have propelled','has propelled','are propelling','is propelling'],
  ['prove',0,0,0,0,0,0,0,'have proven','has proven'],
  ['publish','publishes'],
  ['punch','punches'],
  ['push','pushes'],
  ['qualify','qualifies',0,0,0,0,'qualified','qualified','have qualified','has qualified'],
  ['quarrel with','quarrels with',0,0,'were quarrelling with','was quarrelling with','quarrelled with','quarrelled with','have quarrelled with','has quarrelled with','are quarrelling with','is quarrelling with'],
  ['quash','quashes'],
  ['query','queries',0,0,0,0,'queried','queried','have queried','has queried'],
  ['quiz','quizzes',0,0,'were quizzing','was quizzing','quizzed','quizzed','have quizzed','has quizzed','are quizzing','is quizzing'],
  ['rally','rallies',0,0,0,0,'rallied','rallied','have rallied','has rallied'],
  ['ram',0,0,0,'were ramming','was ramming','rammed','rammed','have rammed','has rammed','are ramming','is ramming'],
  ['ratify','ratifies',0,0,0,0,'ratified','ratified','have ratified','has ratified'],
  ['read',0,0,0,0,0,'read','read','have read','has read'],
  ['ready','readies',0,0,0,0,'readied','readied','have readied','has readied'],
  ['reapply','reapplies',0,0,0,0,'reapplied','reapplied','have reapplied','has reapplied'],
  ['recast',0,0,0,0,0,'recast','recast','have recast','has recast'],
  ['redress','redresses'],
  ['refer to','refers to',0,0,'were referring to','was referring to','referred to','referred to','have referred to','has referred to','are referring to','is referring to'],
  ['referee',0,0,0,'were refereeing','was refereeing',0,0,0,0,'are refereeing','is refereeing'],
  ['refit',0,0,0,'were refitting','was refitting','refitted','refitted','have refitted','has refitted','are refitting','is refitting'],
  ['rejoin',0,0,0,0,0,0,0,0,0,'are furnish'],
  ['remake',0,0,0,0,0,'remade','remade','have remade','has remade'],
  ['remarry','remarries',0,0,0,0,'remarried','remarried','have remarried','has remarried'],
  ['repay',0,0,0,0,0,'repaid','repaid','have repaid','has repaid'],
  ['repel',0,0,0,'were repelling','was repelling','repelled','repelled','have repelled','has repelled','are repelling','is repelling'],
  ['repress','represses'],
  ['republish','republishes'],
  ['reread',0,0,0,0,0,'reread','reread','have reread','has reread'],
  ['reset',0,0,0,'were resetting','was resetting','reset','reset','have reset','has reset','are resetting','is resetting'],
  ['retake',0,0,0,0,0,'retook','retook','have retaken','has retaken'],
  ['retell',0,0,0,0,0,'retold','retold','have retold','has retold'],
  ['rethink',0,0,0,0,0,'rethought','rethought','have rethought','has rethought'],
  ['retouch','retouches'],
  ['retry','retries',0,0,0,0,'retried','retried','have retried','has retried'],
  ['reunify','reunifies',0,0,'were reunifing','was reunifing','reunified','reunified','have reunified','has reunified','are reunifing','is reunifing'],
  ['rev',0,0,0,'were revving','was revving','revved','revved','have revved','has revved','are revving','is revving'],
  ['rewind',0,0,0,0,0,'rewound','rewound','have rewound','has rewound'],
  ['rewrite',0,0,0,0,0,'rewrote','rewrote','have rewritten','has rewritten'],
  ['ride',0,0,0,0,0,'rode','rode','have ridden','has ridden'],
  ['rip',0,0,0,'were ripping','was ripping','ripped','ripped','have ripped','has ripping','are ripping','is ripping'],
  ['rob',0,0,0,'were robbing','was robbing','robbed','robbed','have robbed','has robbed','are robbing','is robbing'],
  ['ruminate',0,0,0,0,0,0,0,'have ruminate','has ruminate'],
  ['run',0,0,0,'were running','was running','ran','ran','have run','has run','are running','is running'],
  ['saw',0,0,0,0,0,0,0,'have sawn','has sawn'],
  ['scan',0,0,0,'were scanning','was scanning','scanned','scanned','have scanned','has scanned','are scanning','is scanning'],
  ['scar',0,0,0,'were scarring','was scarring','scarred','scarred','have scarred','has scarred','are scarring','is scarring'],
  ['scorch','scorches'],
  ['scratch','scratches'],
  ['scrub',0,0,0,'were scrubbing','was scrubbing','scrubbed','scrubbed','have scrubbed','has scrubbed','are scrubbing','is scrubbing'],
  ['scrunch','scrunches'],
  ['search','searches'],
  ['see',0,0,0,'were seeing','was seeing','saw','saw','have seen','has seen','are seeing','is seeing'],
  ['seek',0,0,0,0,0,'sought','sought','have sought','has sought'],
  ['sell',0,0,0,0,0,'sold','sold','have sold','has sold'],
  ['send',0,0,0,0,0,'sent','sent','have sent','has sent'],
  ['set',0,0,0,'were setting','was setting','set','set','have set','has set','are setting','is setting'],
  ['shag',0,0,0,'were shagging','was shagging','shagged','shagged','have shagged','has shagged','are shagging','is shagging'],
  ['shake',0,0,0,0,0,'shook','shook','have shaken','has shaken'],
  ['shed',0,0,0,'were shedding','was shedding','shedded','shedded','have shed','has shed','are shedding','is shedding'],
  ['shine',0,0,0,0,0,'shone','shone','have shone','has shone'],
  ['shoe',0,0,0,'were shoeing','was shoeing','shod','shod','have shod','has shod','are shoeing','is shoeing'],
  ['shoo','shooes'],
  ['shred',0,0,0,'were shredding','was shredding','shredded','shredded','have shredded','has shredded','are shredding','is shredding'],
  ['shrink',0,0,0,0,0,'shrunk','shrunk','have shrunk','has shrunk'],
  ['shun',0,0,0,'were shunning','was shunning','shunned','shunned','have shunned','has shunned','are shunning','is shunning'],
  ['shush','shushes'],
  ['shut',0,0,0,'were shutting','was shutting','shut','shut','have shut','has shut','are shutting','is shutting'],
  ['signal',0,0,0,'were signalling','was signalling','signalled','signalled','have signalled','has signalled','are signalling','is signalling'],
  ['singe',0,0,0,'were singeing','was singeing',0,0,0,0,'are singeing','is singeing'],
  ['sink',0,0,0,0,0,'sunk','sunk','have sunk','has sunk'],
  ['sip',0,0,0,'were sipping','was sipping','sipped','sipped','have sipped','has sipped','are sipping','is sipping'],
  ['sketch','sketches'],
  ['skin',0,0,0,'were skinning','was skinning','skinned','skinned','have skinned','has skinned','are skinning','is skinning'],
  ['skip',0,0,0,'were skipping','was skipping','skipped','skipped','have skipped','has skipped','are skipping','is skipping'],
  ['slag',0,0,0,'were slagging','was slagging','slagged','slagged','have slagged','has slagged','are slagging','is slagging'],
  ['slam',0,0,0,'were slamming','was slamming','slammed','slammed','have slammed','has slammed','are slamming','is slamming'],
  ['slap',0,0,0,'were slapping','was slapping','slapped','slapped','have slapped','has slapped','are slapping','is slapping'],
  ['slash','slashes'],
  ['slay',0,0,0,0,0,0,0,'have slain','has slain'],
  ['slim',0,0,0,'were slimming','was slimming','slimmed','slimmed','have slimmed','has slimmed','are slimming','is slimming'],
  ['sling',0,0,0,0,0,'slung','slung','have slung','has slung'],
  ['slur',0,0,0,'were slurring','was slurring','slurred','slurred','have slurred','has slurred','are slurring','is slurring'],
  ['smear',0,0,0,0,0,'smears','smears'],
  ['smite',0,0,0,'were smitting','was smitting','smote','smote','have smote','has smote','are smitting','is smitting'],
  ['smooch','smooches'],
  ['snap',0,0,0,'were snapping','was snapping','snapped','snapped','have snapped','has snapped','are snapping','is snapping'],
  ['snatch','snatches'],
  ['snob',0,0,0,'were snobbing','was snobbing','snobbed','snobbed','have snobbed','has snobbed','are snobbing','is snobbing'],
  ['sow',0,0,0,0,0,0,0,'have sown','has sown'],
  ['specify','specifies',0,0,0,0,'specified','specified','have specified','has specified'],
  ['spend',0,0,0,0,0,'spent','spent','have spent','has spent'],
  ['spit',0,0,0,'were spitting','was spitting','spat','spat','have spat','has spat','are spitting','is spitting'],
  ['splash','splashes'],
  ['split',0,0,0,0,0,'split','split','have split','has split'],
  ['spot',0,0,0,'were spotting','was spotting','spotted','spotted','have spotted','has spotted','are spotting','is spotting'],
  ['spread',0,0,0,0,0,'spread','spread','have spread','has spread'],
  ['spur',0,0,0,'were spurring','was spurring','spurred','spurred','have spurred','has spurred','are spurring','is spurring'],
  ['spurt',0,0,0,0,0,'spurt','spurt','have spurt','has spurt'],
  ['spy','spies',0,0,0,0,'spied','spied','have spied','has spied'],
  ['squash','squashes'],
  ['squelch','squelches'],
  ['stab',0,0,0,'were stabbing','was stabbing','stabbed','stabbed','have stabbed','has stabbed','are stabbing','is stabbing'],
  ['stall',0,0,0,0,0,0,0,0,0,'are stall','is stall'],
  ['starch','starches'],
  ['stash','stashes'],
  ['steady','steadies',0,0,0,0,'steadied','steadied','have steadied','has steadied'],
  ['steal',0,0,0,0,0,'stole','stole','have stolen','has stolen'],
  ['stem',0,0,0,'were stemming','was stemming','stemmed','stemmed','have stemmed','has stemmed','are stemming','is stemming'],
  ['stick',0,0,0,0,0,'stuck','stuck','have stuck','has stuck'],
  ['stir',0,0,0,'were stirring','was stirring','stirred','stirred','have stirred','has stirred','are stirring','is stirring'],
  ['stitch','stitches'],
  ['stop',0,0,0,'were stopping','was stopping','stopped','stopped','have stopped','has stopped','are stopping','is stopping'],
  ['strap',0,0,0,'were strapping','was strapping','strapped','strapped','have strapped','has strapped','are strapping','is strapping'],
  ['stretch','stretches'],
  ['strip',0,0,0,'were stripping','was stripping','stripped','stripped','have stripped','has stripped','are stripping','is stripping'],
  ['study','studies',0,0,0,0,'studied','studied','have studied','has studied'],
  ['sully','sullies',0,0,0,0,'sullied','sullied','have sullied','has sullied'],
  ['sup',0,0,0,'were supping','was supping','supped','supped','have supped','has supped','are supping','is supping'],
  ['supply','supplies',0,0,0,0,'supplied','supplied','have supplied','has supplied'],
  ['swab',0,0,0,'were swabbing','was swabbing','swabbed','swabbed','have swabbed','has swabbed','are swabbing','is swabbing'],
  ['swash','swashes'],
  ['swat',0,0,0,'were swatting','was swatting','swatted','swatted','have swatted','has swatted','are swatting','is swatting'],
  ['sweep',0,0,0,0,0,'swept','swept','have swept','has swept'],
  ['swig',0,0,0,'were swigging','was swigging','swigged','swigged','have swigged','has swigged','are swigging','is swigging'],
  ['swing',0,0,0,0,0,'swung','swung','have swung','has swung'],
  ['switch','switches'],
  ['tag',0,0,0,'were tagging','was tagging','tagged','tagged','have tagged','has tagged','are tagging','is tagging'],
  ['take',0,0,0,0,0,'took','took','have taken','has taken'],
  ['tally','tallies',0,0,0,0,'tallied','tallied','have tallied','has tallied'],
  ['teach','teaches',0,0,0,0,'taught','taught','have taught','has taught'],
  ['tear',0,0,0,0,0,'tore','tore','have torn','has torn','are tear'],
  ['terrify','terrifies',0,0,0,0,'terrified','terrified','have terrified','has terrified','are terrifing','is terrifing'],
  ['throw',0,0,0,0,0,'threw','threw','have thrown','has thrown'],
  ['tidy','tidies',0,0,0,0,'tidied','tidied','have tidied','has tidied'],
  ['tie',0,0,0,'were tying','was tying',0,0,0,0,'are tying','is tying'],
  ['torch','torches'],
  ['toss','tosses'],
  ['touch','touches'],
  ['toy with','toys with',0,0,'were toying with','was toying with','toyed with','toyed with','have toyed with','has toyed with','are toying with','is toying with'],
  ['trap',0,0,0,'were trapping','was trapping','trapped','trapped','have trapped','has trapped','are trapping','is trapping'],
  ['trash','trashes'],
  ['trip',0,0,0,'were tripping','was tripping','tripped','tripped','have tripped','has tripped','are tripping','is tripping'],
  ['trumpet',0,0,0,0,0,0,0,0,0,0,0,0,' might trumpet'],
  ['turf out','turfs out',0,0,'were turfing out','was turfing out','turfed out','turfed out','have ceded','has ceded','are turfing out','is turfing out'],
  ['unbend',0,0,0,0,0,'unbent','unbent','have unbent','has unbent'],
  ['underlay',0,0,0,0,0,'underlaid','underlaid','have underlaid','has underlaid'],
  ['undersell',0,0,0,0,0,'undersold','undersold','have undersold','has undersold'],
  ['undo','undoes',0,0,0,0,'undid','undid','have undone','has undone'],
  ['unify','unifies',0,0,0,0,'unified','unified','have unifyied','has unified'],
  ['unpin',0,0,0,'were unpinning','was unpinning','unpinned','unpinned','have unpinned','has unpinned','are unpinning','is unpinning'],
  ['untie',0,0,0,'were untying','was untying',0,0,0,0,'are untying','is untying'],
  ['unwind',0,0,0,0,0,'unwound','unwound','have unwound','has unwound'],
  ['unwrap',0,0,0,'were unwrapping','was unwrapping','unwrapped','unwrapped','have unwrapped','has unwrapped','are unwrapping','is unwrapping'],
  ['unzip',0,0,0,'were unzipping','was unzipping','unzipped','unzipped','have unzipped','has unzipped','are unzipping','is unzipping'],
  ['uphold',0,0,0,0,0,'upheld','upheld','have upheld','has upheld'],
  ['upset',0,0,0,'were upsetting','was upsetting','upset','upset','have upset','has upset','are upsetting','is upsetting'],
  ['varnish','varnishes'],
  ['vary','varies',0,0,0,0,'varied','varied','have varied','has varied'],
  ['verify','verifies',0,0,0,0,'verified','verified','have verified','has verified'],
  ['vet',0,0,0,'were vetting','was vetting','vetted','vetted','have vetted','has vetted','are vetting','is vetting'],
  ['veto','vetoes'],
  ['vilify','vilifies',0,0,'were vilifing','was vilifing','vilified','vilified','have vilified','has vilified','are vilifing','is vilifing'],
  ['vouch for','vouches for',0,0,'were vouching for','was vouching for','vouched for','vouched for','have vouched for','has vouched for','are vouching for','is vouching for'],
  ['wade',0,0,0,'were wade'],
  ['wag',0,0,0,'were wagging','was wagging','wagged','wagged','have wagged','has wagged','are wagging','is wagging'],
  ['wake',0,0,0,0,0,'woke','woke','have woken','has woken'],
  ['ward off','wards off',0,0,'were warding off','was warding off','warded off','warded off','have warded off','has warded off','are warding off','is warding off'],
  ['wash','washes'],
  ['watch','watches'],
  ['wax','waxes'],
  ['weave',0,0,0,0,0,'wove','wove','have woven','has woven'],
  ['wet',0,0,0,'were wetting','was wetting','wetted','wetted','have wetted','has wetted','are wetting','is wetting'],
  ['whet',0,0,0,'were whetting','was whetting','whetted','whetted','have whetted','has whetted','are whetting','is whetting'],
  ['whinny','whinnies',0,0,0,0,'whinnied','whinnied','have whinnied','has whinnied'],
  ['win',0,0,0,'were winning','was winning','won','won','have won','has won','are winning','is winning'],
  ['winch','winches'],
  ['wink at','winks at',0,0,'were winking at','was winking at','winked at','winked at','have winked at','has winked at','are winking at','is winking at'],
  ['withdraw',0,0,0,0,0,'withdrew','withdrew','have withdrawn','has withdrawn'],
  ['withhold',0,0,0,0,0,'withheld','withheld','have withheld','has withheld'],
  ['withstand',0,0,0,0,0,'withstood','withstood','have withstood','has withstood'],
  ['wring',0,0,0,0,0,'wrung','wrung','have wrung','has wrung'],
  ['write',0,0,0,0,0,'wrote','wrote','have written','has written'],
  ['zap',0,0,0,'were zapping','was zapping','zapped','zapped','have zapped','has zapped','are zapping','is zapping'],
  ['zigzag',0,0,0,'were zigzagging','was zigzagging','zigzagged','zigzagged','have zigzagged','has zigzagged','are zigzagging','is zigzagging'],
  ['zip',0,0,0,'were zipping','was zipping','zipped','zipped','have zipped','has zipped','are zipping','is zipping']
]);

if( typeof(ReadablePassphrase_Callback) == 'function' ) { ReadablePassphrase_Callback(); }