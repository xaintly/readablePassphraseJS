# readablePassphraseJS
Javascript implementation of Murray Grant's readable passphrase generator

Readable Passphrase Generator creates random english sentences.  They may be easier to remember
than a long string of random letters & numbers, or 4 random words.

## When (and when not) to use this

For most passwords today, you should be using a password manager (Bitwarden, KeePass, 1Password,
etc.) with long random strings, or better yet SSH keys/client certs where the site supports them.
A memorable sentence is a *worse* password than a random string of the same length — its value is
being easy to type and remember, not being maximally strong for its length.

That tradeoff is still worth making in a few specific situations:
* **Temporary passwords** you hand to someone and expect them to change on first login.
* **A password manager's own master password** — this is the one place a memorable phrase is
  genuinely appealing, since you *do* have to recall and type it yourself, sometimes under
  pressure, with nothing else to fall back on. Be deliberate about template/mutator choice here:
  a short, un-mutated phrase can be meaningfully weaker than you'd expect (see the table below) —
  this is exactly the password you least want to be a weak link.
* **Offline apps or anything you type often**, where a password manager isn't practical or the
  friction of typing a long random string repeatedly isn't worth it.

### How strong is strong enough?

How fast a phrase can be guessed depends entirely on where an attacker is guessing *against*, not
just on its entropy:

| Scenario | Realistic guess rate (2026) |
|---|---|
| Online, against a reasonably rate-limited login form | ~10/sec |
| Offline, against a password manager's own KDF (bcrypt/Argon2, as KeePass/Bitwarden use) | ~10<sup>3</sup>&ndash;10<sup>4</sup>/sec |
| Offline, against a fast/weak hash (eg. unsalted MD5 — still shows up in real breaches) on a single modern consumer GPU | ~10<sup>11</sup>/sec |

That last row is the important update from a few years ago: a single high-end consumer GPU can
now attempt roughly as many fast hashes per second as there are people on Earth. A guess rate you
might remember as "one thousand a second" is only realistic anymore against a **properly
slow-hashed** target — which is exactly what a password manager's vault is, but is *not* something
you control or know about on a random website.

Average time to guess (bits of entropy computed by `entropyOf()` in this library; "average" means
half the search space, a reasonable planning assumption):

| Passphrase | Entropy | vs. rate-limited login | vs. offline KDF attack | vs. offline weak-hash GPU |
|---|---|---|---|---|
| `randomShort`, no mutator | 34 bits | 29 years | 11 days | instant |
| `random`, no mutator | 47 bits | 224,536 years | 225 years | 7 minutes |
| `random` + `standard` mutator | 63 bits | 1.6&times;10<sup>10</sup> years | 1.6&times;10<sup>7</sup> years | ~1 year |
| `randomForever` + `standard` mutator | 83 bits | 1.5&times;10<sup>16</sup> years | 1.5&times;10<sup>13</sup> years | 964,375 years |
| 4-word [diceware](https://www.eff.org/dice) (EFF large wordlist) | 52 bits | 5.8M years | 5,796 years | 3.2 hours |
| 8 random printable-ASCII characters | 52 bits | 9.7M years | 9,680 years | 5.3 hours |
| 25 random printable-ASCII characters | 164 bits | effectively unguessable in every scenario above |

A few takeaways:
* `random` with no mutator and 4-word diceware land in roughly the same place — neither is
  "stronger" than the other in any way that matters.
* The `standard` mutator (or a longer template) isn't optional flavor — it's the difference between
  "safe against a determined attacker with a GPU" and "not."
* If you can't guarantee your password ends up behind a slow KDF (you generally can't — you don't
  control how a website stores it), don't rely on a mid-strength phrase alone for anything you'd be
  upset to lose.
* If a password manager is storing it for you, there's no cost to going long — 25 random characters
  costs you nothing to store and is effectively immune to brute force in any of these scenarios.
  Only use a memorable phrase where memorability is actually buying you something.

## About the generator & Licensing

* This is a port of the C# ReadablePassphraseGenerator, by Murray Grant
* Original implementation: [Readable Passphrase](https://bitbucket.org/ligos/readablepassphrasegenerator/wiki/Home)
* Original licensed under the [Apache License](https://www.apache.org/licenses/LICENSE-2.0)
* Dictionaries licensed under [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/deed.en_GB)

* Javascript port created by Steven Zeck <saintly@innocent.com>
* Port licensed under the [Apache License](https://www.apache.org/licenses/LICENSE-2.0)
 
 
## Basic usage

### In a browser

Build the browser bundle (`npm install && npm run build`), then include it on your web page:
   `<script type='text/javascript' src='dist/readable-passphrase.global.js'></script>`

This exposes three globals: `ReadablePassphrase`, `RPMutator`, and `RPSentenceTemplate` (the
internal-only `RPWord`/`RPWordList*`/`RPRandomFactors` classes are not exposed).

Then you can get a passphrase object:
```javascript
   var myPhrase = new ReadablePassphrase( 'random' ); // call with the name of a template, eg 'normal' or 'random'
   console.log( myPhrase.toString() ); // show the generated phrase, eg "an orchid will oversee the fig"
```

### In Node / from npm

```javascript
   import ReadablePassphrase from 'readable-passphrase'; // ESM
   // const { default: ReadablePassphrase } = require('readable-passphrase'); // CJS

   const myPhrase = new ReadablePassphrase('random');
   console.log(myPhrase.toString());
```

If you just want a basic random phrase, use these templates:
* 'randomShort'   -> very short phrases; see "When (and when not) to use this" above for how weak this actually is
* 'random'        -> medium strength phrase
* 'randomLong'    -> high-strength phrase
* 'randomForever' -> very high-strength phrase
   
You can get a list of all available predefined templates:

```javascript
   var templateNames = ReadablePassphrase.templates(); // returns an array: [ 'random', 'randomShort', ... 'normal' ]
```

### Command line

Installing the package also gives you a `readable-passphrase` command for quick terminal use
(eg. generating a temporary password without writing any code):
```
npx readable-passphrase
npx readable-passphrase --template randomLong --mutator standard --count 3
npx readable-passphrase --template normal --separator - --count 1
npx readable-passphrase --list    # show available template/mutator names
npx readable-passphrase --help
```

| Option | Default | Description |
|---|---|---|
| `-t, --template <name>` | `random` | Sentence template to use |
| `-m, --mutator <name>` | `none` | Mutator to apply, or `none` |
| `-s, --separator <chars>` | ` ` (space) | String to join words with, eg `-` or `` (empty) |
| `-n, --count <number>` | `5` | Number of phrases to generate |

## Templates
 

ReadablePassphrase uses a sentence template to generate a phrase.

'normal' is the name of a predefined template that generates a basic noun, then a verb, then another noun.
 
A template part may come out as multiple words in the final phrase. 

The phrase "an orchid will oversee the fig" breaks down as
* noun: "an orchid"
* verb: "will oversee"
* noun: "the fig"
 
A sentence template is an array of part objects.  Each object has a 'type' property.  
 
Currently allowed types: `noun, verb, conjunction, directSpeech`

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
```javascript
	{ common: 1, proper: 4, nounFromAdjective: 0 }
```
	
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
```javascript
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
```
	
To see an existing template, execute this in the console:
```javascript
	console.log( RPSentenceTemplates.byName('normal') ); 
	// some other templates: strongRequired, insaneSpeech
```	


	
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

All random numbers come from a function called `ReadablePassphrase.randomness()`. By default,
this uses `globalThis.crypto.getRandomValues()` — a cryptographically strong source available
natively in modern browsers and in Node.js 19+. It only falls back to `Math.random()` (with a
one-time console warning) if `globalThis.crypto` is genuinely unavailable in your environment;
`Math.random()` is not cryptographically secure and should not be relied on for generating
passwords.

If you want to supply your own randomness source (eg. gathering entropy from mouse movements, a
hardware RNG, random.org, etc.), replace `ReadablePassphrase.randomness` after the library has
finished loading. The function should accept 1 numeric parameter and output a floating-point
number between 0 and the parameter (including 0, but not including the parameter itself; eg:
parameter = 5 should return values between 0 and 4.9999999).

Example:
```javascript
	ReadablePassphrase.randomness = function ( maxValue ) {
		var randomValues = new Uint32Array(1);
		window.crypto.getRandomValues( randomValues );
		return ( randomValues[0] * ( maxValue || 1 ) / 0xFFFFFFFF );
	}
```

One good public javascript randomness library is the Stanford Javascript Crypto Library	
[SJCL](https://crypto.stanford.edu/sjcl/)



## Mutators

By default, phrases are all lowercase and do not contain punctuation, but might contain numbers if
the template calls for them.  To make the phrase more secure, it would be a good idea to add 
random capital letters and throw in some numbers.  This will make the phrase harder to remember,
but a lot more secure.

* Randomly capitalizing one entire word makes your password about 5x harder to crack
* A single number added to the end of a random word makes your password about 50x harder to crack

You can do this yourself after you choose your phrase; just think of a number or pick a word and
make the modification when you use it.  However, this module can do this task for you as well.

Pass a second parameter to ReadablePassphrase when creating the object:
```javascript
	var mutator = {
		upper:   { type: 'WholeWord', count: 1 },
		numbers: { type: 'EndOfWord', count: 2 }
	};
	var mutantPhrase = new ReadablePassphrase( 'random', mutator  );
	console.log(mutantPhrase.toString()); // the seashell IS5 signalling9 a windpipe
```	

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
```javascript
	var mutantPhrase = new ReadablePassphrase( 'random', 'standard'  );
	console.log(mutantPhrase.toString()); // the seashell IS5 signalling9 a windpipe
```

### Word separator

Phrases are joined with a space by default, but plenty of real-world password fields quietly
reject or mangle spaces. Pass a `separator` on the mutator object to join words with anything else
(or nothing at all):
```javascript
	var dashPhrase = new ReadablePassphrase( 'random', { upper: 'none', numbers: 'none', separator: '-' } );
	console.log(dashPhrase.toString()); // the-seashell-signalling-a-windpipe
```

You can also override the separator per call to `.toString()`, without changing the mutator:
```javascript
	var phrase = new ReadablePassphrase('random');
	console.log(phrase.toString());      // the seashell signalling a windpipe
	console.log(phrase.toString('-'));   // the-seashell-signalling-a-windpipe
	console.log(phrase.toString(''));    // theseashellsignallingawindpipe
```

## Entropy

For certain purposes, it is useful to know how much entropy (randomness) is in a
template.  Entropy is expressed as bits, where each bit represents a 50/50 chance.

Flipping a standard coin gives you 1 bit of entropy.  
Choosing a random noun from a list of 3800 nouns gives you almost 12 bits of entropy (as
if you had flipped a coin 12 times).

You can get an estimate of how much entropy is in any template:
```javascript
	var entropyOfNormal = RPSentenceTemplates.entropyOf('normal') // 27.74
```	

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
```javascript
	var entropyOfStandard = new RPMutator('standard').entropy() // 16.15
```	

So normal template + the standard mutator together have about 43.89 bits, which takes the
possible combinations from 112 million (easily crackable) to 1.6 trillion which will be a
lot more annoying.  Still, that's something someone could crack within your lifetime, so it's 
better to use stronger templates than 'normal'.
	
	

## Compression

The noun and verb dictionaries are compressed to reduce the size of what ships in `dist/` (this
roughly halves the gzip-compressed size of the browser bundle). This is a build-time step, not
something you need to think about as a consumer of the library — the `wordList` objects
reconstruct the full dictionary from the compressed form when the library loads.

If you want to edit the dictionaries (eg. to add a verb), edit the human-readable, fully-spelled-out
source in [`src/dictionary/source/`](src/dictionary/source/) — `nouns.js` (singular/plural pairs)
and `verbs.js`/`intransitive-verbs.js` (all 14 tenses spelled out). `npm run build` (or
`npm test`) compresses these into `src/dictionary/generated/` automatically before bundling; you
never need to hand-compress anything.
