import antfu from '@antfu/eslint-config'

export default antfu({
	stylistic: false,
	ignores: [
		'.vscode',
		'packages',
		'playground',
	],
}, {
	rules: {
		'import/extensions': ['error', 'ignorePackages'],
	},
})
