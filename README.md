# readablePassphraseJS
Javascript implementation of Murray Grant's readable passphrase generator

Readable Passphrase Generator creates random english sentences.  They may be easier to remember
than a long string of random letters & numbers, or 4 random words.

## About the generator & Licensing

* This is a port of the C# ReadablePassphraseGenerator, by Murray Grant
* Original implementation: [Readable Passphrase](https://bitbucket.org/ligos/readablepassphrasegenerator/wiki/Home)
* Original licensed under the [Apache License](https://www.apache.org/licenses/LICENSE-2.0)
* Dictionaries licensed under [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/deed.en_GB)

* Javascript port created by Steven Zeck <saintly@innocent.com>
* Port licensed under the [Apache License](https://www.apache.org/licenses/LICENSE-2.0)
 
 
## Basic usage
 
Include the javascript library on your web page;
   `<script type='text/javascript' src='dict-readablepassphrase.js'></script>`
   
Then you can get a passphrase object:
   var myPhrase = new ReadablePassphrase( 'random' ); // call with the name of a template, eg 'normal' or 'random'
   console.log( myPhrase.toString() ); // show the generated phrase, eg "an orchid will oversee the fig"
   
If you just want a basic random phrase, use these templates:
* 'randomShort'   -> very short phrases, can be easily cracked in a day or so
* 'random'        -> medium strength phrase
* 'randomLong'    -> high-strength phrase
* 'randomForever' -> very high-strength phrase
   
You can get a list of all available predefined templates:
   `var templateNames = ReadablePassphrase.templates(); // returns an array: [ 'random', 'randomShort', ... 'normal' ]`
   
   

## Templates
 

ReadablePassphrase uses a sentence template to generate a phrase.
'normal' is the name of a predefined template that generates a basic noun, then a verb, then another noun.
 
A template part may come out as multiple words in the final phrase. 
In the example "an orchid will oversee the fig" breaks down as
* noun: "an orchid"
* verb: "will oversee"
* noun: "the fig"
 
 A sentence template is an array of part objects.  Each object has a 'type' property.  
 Currently allowed types: noun, verb, conjunction, directSpeech
 Noun and Verb have several modifiers to determine the final form of the word.
 
### Noun:
* subtype [choice: common, proper, nounFromAdjective] - form of the noun
* article [choice: none, definite, indefinite, demonstrative, personalPronoun ] 
* adjective [boolean] - whether to include an adjective
* preposition [boolean] - whether to include a preposition
* number [boolean] - whether to add a number before the noun, eg "234 dogs"
* singular [boolean] - whether the noun is singular (plural if false)

### Verb:
* subtype [choice: present, past, future, continuous, continuousPast, perfect, subjunctive ]
* adverb [boolean] - whether to include an adverb
* interrogative [boolean] - whether to make the whole phrase interrogative
* intransitive [choice: noNounClause, preposition] ** both choices can be 0
	
### Modifiers	
When a modifier (called a 'factor' in the code) is a 'choice', it is specified as an object
with the choices as properties, and each property has a numeric weight value.  Example:
	`{ common: 1, proper: 4, nounFromAdjective: 0 }`
	
When the engine evaluates the choice, it randomly picks one of the properties, biased toward
properties with higher weights.  In the example above, it would choose:
* common: 20% [1 in 5]
* proper: 80% [4 in 5]
* nounFromAdjective: 0%
	
It is possible for all choices to be 0, in which case the choice evaluates to 'null'.  Only
the 'intransitive' property of verbs expects this, in other cases, if all choice weights are 0,
it will cause the engine to abort with an error.

When a modifier is a boolean, it can be specified in two ways:
1. as a 2-element array: [ trueWeight, falseWeight ], eg [ 1, 4 ] evaluates true 1 in 5 times
1. as a boolean.  true is equivalent to [ 1, 0 ] and false is equivalent to [ 0, 1 ]

	
### Sample templates parts
	// A simple transitive verb, with a slight chance of being interrogative
	{ type: 'verb',
	  subtype: { 
		present: 10, past: 8, future: 8, 
		continuous: 0, continuousPast: 0, 
		perfect: 0, subjunctive: 0
	  },
	  adverb: false, interrogative: [ 1, 8 ],
	  intransitive: { noNounClause: 0, preposition: 0 }
	}
	
	// A common, singular noun
	{ type: 'noun',
	  subtype: { common: 1, proper: 0, nounFromAdjective: 0 },
	  article: { none: 5, definite: 4, indefinite: 4, demonstrative: 0, personalPronoun: 2 },
	  adjective: false, preposition: false, number: false, single: true
	}
	
	// conjunctions and directSpeech take no other modifiers
	{ type: 'conjunction' }
	{ type: 'directSpeech' }

To see an existing template, execute this in the console:
	console.log( RPSentenceTemplates.byName('normal') ); 
	  // some other templates: strongRequired, insaneSpeech


	
## Dynamic Loading

You can dynamically load this library instead of including it as part of the page.  This will 
allow the page to load faster, and you can save memory by not loading libraries that may not be 
needed every time.  Your javascript can generate a script tag with src=this library, then append
it to the page.

When this library finishes loading, it will call a function named ReadablePassphrase_Callback()
You can define this function to do whatever you like, such as enabling UI elements, replacing the
default randomness source, or generating some initial phrases.

If this function does not exist, nothing will happen.



## Randomness

This library does NOT include a good source of randomness.  All random numbers come from a 
function called  ReadablePassphrase.random(), which just uses Math.random() for random numbers.

In most browsers, Math.random() does not return true random numbers.  Instead, it uses an
algorithm to return 'random-looking' numbers, but if you know the algorithm and the previous
number, you can easily guess the next number.  This is really bad for passwords!  

There are public javascript libraries that generate real random numbers (gathering random
input from the user's mouse movements, etc.), and most platforms and browsers now have an 
built-in alternative.

   Chrome, Firefox, Opera: window.crypto
   Internet Explorer: window.msCrypto
   
window.crypto (and msCrypto) work differently than Math.random(), but can be adapted to serve
as a replacement.

Whatever you choose, you should build your solution into a replacement function for 
ReadablePassphrase.random().  You should do this after the ReadablePassphrase library has
finished loading. 

The function should accept 1 numeric parameter and output a floating-point number between 0 and
the parameter (including 0, but not including the parameter itself; eg: parameter = 5 should
return values between 0 and 4.9999999).

Example:
	ReadablePassphrase.random = function ( maxValue ) {
		var randomValues = new Uint32Array(1);
		window.crypto.getRandomValues( randomValues );
		return ( randomValues * ( maxValue || 1 ) / 0xFFFFFFFF );
	}

One good public javascript randomness library is the Stanford Javascript Crypto Library	(SJCL)
  https://crypto.stanford.edu/sjcl/



## Mutators

By default, phrases are all lowercase and do not contain punctuation, but might contain numbers if
the template calls for them.  To make the phrase more secure, it would be a good idea to add 
random capital letters and throw in some numbers.  This will make the phrase harder to remember,
but a lot more secure.

- Randomly capitalizing one entire word makes your password about 5x harder to crack
- A single number added to the end of a random word makes your password about 50x harder to crack

You can do this yourself after you choose your phrase; just think of a number or pick a word and
make the modification when you use it.  However, this module can do this task for you as well.

Pass a second parameter to ReadablePassphrase when creating the object:
	var mutator = {
		upper:   { type: 'WholeWord', count: 1 },
		numbers: { type: 'EndOfWord', count: 2 }
	};
	var mutantPhrase = new ReadablePassphrase( 'random', mutator  );
	console.log(mutantPhrase.toString()); // the seashell IS5 signalling9 a windpipe

A mutator is an object with the properties seen above.  'upper' describes how to add uppecase
letters, and 'numbers' describes how and where to add numbers.  'count' is the number of 
modifications to make.  An unlimited number of numbers can be added, but 'upper' will not add
extra words if its count is higher than the number of words.

If count is 0, null or not specified, 'upper' will randomly choose the number of words to modify,
and numbers will add 1-5 numbers.  The 'type' determines how/where the modification will be made.

upper types:
* StartOfWord  - the first letter of the word
* WholeWord    - the entire word
* Anywhere     - one random letter in the word
* RunOfLetters - 2 or more letters next to each other in the word
* random       - any of the above, chosen randomly
* none         - no letters will be made uppercase

numbers types: (these determine where a number will be added)
* StartOfWord  - the beginning of a word (eg 5flower)
* EndOfWord    - end of a word (flower3)
* StartOrEndOfWord - either the start or end of the word (50/50 chance)
* EndOfPhrase  - end of the sentence (the flowers grind a cat2)
* Anywhere     - anywhere (flo2wer)
* random       - same as 'anywhere'
* none         - no numbers will be added
	
There are two predefined mutators:
* 'standard' - 1 uppercase word + 2 numbers (added to the end of words)
* 'random'   - completely random mutations (phrase will be hard to remember)
	
You can use the predefined mutators by passing their name as a string:
	var mutantPhrase = new ReadablePassphrase( 'random', 'standard'  );
	console.log(mutantPhrase.toString()); // the seashell IS5 signalling9 a windpipe


## Entropy

For certain purposes, it is useful to know how much entropy (randomness) is in a
template.  Entropy is expressed as bits, where each bit represents a 50/50 chance.

Flipping a standard coin gives you 1 bit of entropy.  
Choosing a random noun from a list of 3800 nouns gives you almost 12 bits of entropy (as
if you had flipped a coin 12 times).

You can get an estimate of how much entropy is in any template:
	var entropyOfNormal = RPSentenceTemplates.entropyOf('normal') // 27.74

If an attacker knows how you generated your password, they can guess your password
in [ 2 ^ (entropy - 1) ] tries, on average.  If you flip 2 coins, you have 4 possible results
(heads/heads, heads/tails, tails/heads, tails/tails), but someone trying to guess your result
will guess it in about 2 tries (on average).  Sometimes they will guess it right away on the
first try, and other times it will take all 4 tries.

The 'normal' template is short, with about 27.74 bits of entropy.  This means an attacker
would guess it in [ 2 ^ 26.74 ] tries = 112,083,603 .  112 million sounds like a lot, but it isn't
when an attacker could reasonably be expected to guess about 10,000 combinations per second.

Each added bit doubles the possibilities, and also doubles the amount of time it would take an
attacker to guess your combination.

If you use a mutator, those have entropy too.  You can add the entropies together:
	var entropyOfStandard = new RPMutator('standard').entropy() // 16.15

So normal template + the standard mutator together have about 43.89 bits, which takes the
possible combinations from 112 million (easily crackable) to 1.6 trillion which will be a
lot more annoying.  Still, that's something someone could crack within your lifetime, so it's 
better to use stronger templates than 'normal'.
	
	

## Compression

The dictionary is somewhat compressed to reduce the total size of the library.  
Uncompressed, the dictionary + library is about 700k.

The wordList objects reconstruct the dictionary when the library is loaded. 
Common patterns are reduced to a set of default transformations.

The uncompressed javascript dictionary is available on request.
