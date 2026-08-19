import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const cliPath = fileURLToPath(new URL('../bin/readable-passphrase.js', import.meta.url));
const distExists = existsSync(fileURLToPath(new URL('../dist/readable-passphrase.mjs', import.meta.url)));
const skip = distExists ? false : 'run `npm run build` first (dist/ is not built)';

function runCli(args) {
	return execFileSync('node', [cliPath, ...args], { encoding: 'utf8' });
}

test('generates the default of 5 phrases', { skip }, () => {
	const lines = runCli([]).trim().split('\n');
	assert.equal(lines.length, 5);
	for (const line of lines) assert.ok(line.length > 0);
});

test('--count controls how many phrases are printed', { skip }, () => {
	const lines = runCli(['--count', '3']).trim().split('\n');
	assert.equal(lines.length, 3);
});

test('--separator changes how words are joined', { skip }, () => {
	const lines = runCli(['--template', 'normal', '--count', '2', '--separator', '-']).trim().split('\n');
	for (const line of lines) {
		assert.ok(!line.includes(' '), `expected no spaces in: ${JSON.stringify(line)}`);
		assert.ok(line.includes('-'), `expected a dash-joined phrase: ${JSON.stringify(line)}`);
	}
});

test('--list prints template and mutator names', { skip }, () => {
	const output = runCli(['--list']);
	assert.match(output, /Templates:.*normal/);
	assert.match(output, /Mutators:.*standard/);
});

test('--version prints the package version', { skip }, () => {
	const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
	assert.equal(runCli(['--version']).trim(), pkg.version);
});

test('--help prints usage without generating phrases', { skip }, () => {
	const output = runCli(['--help']);
	assert.match(output, /Usage:/);
});

test('an unknown template errors with a non-zero exit code', { skip }, () => {
	assert.throws(() => runCli(['--template', 'not-a-real-template']), /Command failed/);
});

test('an unknown option errors with a non-zero exit code', { skip }, () => {
	assert.throws(() => runCli(['--bogus-flag']), /Command failed/);
});
