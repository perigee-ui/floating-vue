import antfu from '@antfu/eslint-config'

export default antfu({
	stylistic: false,
	ignores: [
		'tsconfig.*.json',
	],
}, {
	rules: {
		'import/extensions': ['error', 'ignorePackages'],
		'vue/prefer-import-from-vue': 'off',
		'vue/no-unused-refs': 'off',
	},
})
