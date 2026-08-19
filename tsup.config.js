import { defineConfig } from 'tsup';

export default defineConfig([
	// ESM + CJS builds for npm consumers
	{
		entry: { 'readable-passphrase': 'src/index.js' },
		format: ['esm', 'cjs'],
		outDir: 'dist',
		outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
		clean: true,
		sourcemap: true,
		minify: false,
		dts: true,
	},
	// Browser global/IIFE build for <script> tag usage
	{
		entry: { 'readable-passphrase': 'src/index.js' },
		format: ['iife'],
		globalName: 'ReadablePassphraseModule',
		outDir: 'dist',
		sourcemap: true,
		minify: true,
		footer: {
			js:
				'window.ReadablePassphrase = ReadablePassphraseModule.default;' +
				'window.RPMutator = ReadablePassphraseModule.RPMutator;' +
				'window.RPSentenceTemplate = ReadablePassphraseModule.RPSentenceTemplate;' +
				'if (typeof ReadablePassphrase_Callback === "function") ReadablePassphrase_Callback();',
		},
	},
]);
