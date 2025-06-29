import base from '@arbendium/eslint-config-base';
import globals from 'globals';

export default [
	...base,
	{
		languageOptions: {
			globals: globals.browser
		},
		rules: {
			'import/no-unresolved': ['error', { ignore: ['^react$', '^react-dom$', '^react-dom/client$'] }],
			'no-underscore-dangle': 'off',
			'no-bitwise': 'off',
			'no-console': 'off'
		}
	}
];
