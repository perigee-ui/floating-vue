import antfu from '@antfu/eslint-config'

export default antfu({
	stylistic: false,
	ignores: [
		'tsconfig.*.json',
	],
}, {
	rules: {
		'import/extensions': ['error', 'ignorePackages'],
	},
})
