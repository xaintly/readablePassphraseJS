#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const HELP = `${pkg.name} v${pkg.version}

Generate memorable, grammatically-structured passphrases.

Usage:
  readable-passphrase [options]

Options:
  -t, --template <name>    Sentence template to use (default: "random")
  -m, --mutator <name>     Mutator to apply, or "none" (default: "none")
  -s, --separator <chars>  String to join words with, eg "-" or "" (default: " ")
  -n, --count <number>     Number of phrases to generate (default: 5)
  -l, --list                List available template and mutator names
  -v, --version             Print the version number
  -h, --help                Show this help

Examples:
  readable-passphrase
  readable-passphrase -t randomLong -m standard -n 3
  readable-passphrase -t normal -s - -n 1
`;

function parseArgs(argv) {
	const options = { template: 'random', mutator: 'none', separator: ' ', count: 5, help: false, list: false, version: false };
	const aliases = { '-t': '--template', '-m': '--mutator', '-s': '--separator', '-n': '--count', '-l': '--list', '-v': '--version', '-h': '--help' };

	for (let i = 0; i < argv.length; i++) {
		let arg = aliases[argv[i]] || argv[i];
		let value;
		if (arg.startsWith('--') && arg.includes('=')) {
			const splitAt = arg.indexOf('=');
			value = arg.slice(splitAt + 1);
			arg = arg.slice(0, splitAt);
		}

		switch (arg) {
			case '--template':
				options.template = value !== undefined ? value : argv[++i];
				break;
			case '--mutator':
				options.mutator = value !== undefined ? value : argv[++i];
				break;
			case '--separator':
				options.separator = value !== undefined ? value : argv[++i];
				break;
			case '--count':
				options.count = Number(value !== undefined ? value : argv[++i]);
				break;
			case '--list':
				options.list = true;
				break;
			case '--version':
				options.version = true;
				break;
			case '--help':
				options.help = true;
				break;
			default:
				throw new Error(`Unknown option: ${argv[i]}`);
		}
	}
	return options;
}

async function main() {
	let options;
	try {
		options = parseArgs(process.argv.slice(2));
	} catch (err) {
		console.error(err.message);
		console.error('Run with --help for usage.');
		process.exitCode = 1;
		return;
	}

	if (options.help) {
		console.log(HELP);
		return;
	}
	if (options.version) {
		console.log(pkg.version);
		return;
	}

	let ReadablePassphrase;
	try {
		({ ReadablePassphrase } = await import('../dist/readable-passphrase.mjs'));
	} catch {
		console.error('Could not load dist/readable-passphrase.mjs - run `npm run build` first.');
		process.exitCode = 1;
		return;
	}

	if (options.list) {
		console.log('Templates:', ReadablePassphrase.templates().join(', '));
		console.log('Mutators: ', ReadablePassphrase.mutators().join(', '));
		return;
	}

	const templates = ReadablePassphrase.templates();
	if (!templates.includes(options.template)) {
		console.error(`Unknown template: "${options.template}". Available: ${templates.join(', ')}`);
		process.exitCode = 1;
		return;
	}

	const mutators = ReadablePassphrase.mutators();
	if (options.mutator !== 'none' && !mutators.includes(options.mutator)) {
		console.error(`Unknown mutator: "${options.mutator}". Available: none, ${mutators.join(', ')}`);
		process.exitCode = 1;
		return;
	}

	if (!Number.isInteger(options.count) || options.count < 1) {
		console.error(`--count must be a positive integer, got: "${options.count}"`);
		process.exitCode = 1;
		return;
	}

	const mutator = options.mutator === 'none' ? undefined : options.mutator;
	for (let i = 0; i < options.count; i++) {
		console.log(new ReadablePassphrase(options.template, mutator).toString(options.separator));
	}
}

main();
