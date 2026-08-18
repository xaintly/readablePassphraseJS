import fs from 'fs';
import path from 'path';
import { compressNouns, compressVerbs } from './dictionary-compression.js';
import nounsSource from '../src/dictionary/source/nouns.js';
import verbsSource from '../src/dictionary/source/verbs.js';
import intransitiveVerbsSource from '../src/dictionary/source/intransitive-verbs.js';

const outDir = new URL('../src/dictionary/generated/', import.meta.url).pathname;
fs.mkdirSync(outDir, { recursive: true });

function write(name, data) {
	fs.writeFileSync(path.join(outDir, `${name}.js`), `export default ${JSON.stringify(data)};\n`);
}

write('nouns', compressNouns(nounsSource));
write('verbs', compressVerbs(verbsSource));
write('intransitive-verbs', compressVerbs(intransitiveVerbsSource));
