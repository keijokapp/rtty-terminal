import base from '@arbendium/eslint-config-base';
import globals from 'globals';

export default [
	...base,
	{
		languageOptions: {
			globals: globals.browser
		},
		rules: {
			'no-underscore-dangle': 'off',
			'no-bitwise': 'off',
			'no-console': 'off'
		}
	}
];
