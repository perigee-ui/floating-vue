import fs from 'node:fs'

import path from 'node:path'
import process from 'node:process'

import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { externalizeDeps } from 'vite-plugin-externalize-deps'

// Функция для рекурсивного поиска всех файлов index.ts в папке src
function findComponentsEntryPoints(dir: string, baseDir = '') {
	const entries: Record<string, string> = {}
	const files = fs.readdirSync(dir)

	files.forEach((file) => {
		const fullPath = path.join(dir, file)
		const relativePath = path.join(baseDir, file)
		const stat = fs.statSync(fullPath)

		if (stat.isDirectory()) {
			Object.assign(entries, findComponentsEntryPoints(fullPath, relativePath))
		} else if (file === 'index.ts') {
			const name = `${path.relative('.', path.dirname(fullPath)).replace('src/', '')}/index`
			entries[name] = fullPath
		}
	})

	return entries
}

const srcDir = path.resolve(__dirname, 'src')
const input = findComponentsEntryPoints(srcDir)
console.error(input)

// https://vitejs.dev/config/
export default defineConfig({
	define: {
		__DEV__: process.env.NODE_ENV !== 'production',
	},
	plugins: [
		externalizeDeps({
			deps: true,
			peerDeps: true,
		}),
		vue(),
		vueJsx(),
		dts({
			tsconfigPath: 'tsconfig.app.json',
		}),
	],
	build: {
		copyPublicDir: false,
		minify: false,
		sourcemap: false,
		lib: {
			name: 'floating',
			formats: ['es'],
			entry: {
				'vue/index': path.resolve(__dirname, 'src/vue/index.ts'),
				'core/index': path.resolve(__dirname, 'src/core/index.ts'),
				index: path.resolve(__dirname, 'src/index.ts'),
			},
		},
		// rollupOptions: {
		//   output: {
		//     manualChunks: (id) => {
		//       const chunks = id.match(/[/\\]src[/\\](.*?)[/\\]/)
		//       return chunks ? chunks[1] : null
		//     },
		//     exports: 'named',
		//     chunkFileNames: '[name].mjs',
		//     minifyInternalExports: true,
		//   },
		//   //   output: {
		//   //     // dir: 'dist',
		//   //     format: 'es',
		//   //     entryFileNames: '[name].js',
		//   //     preserveModules: true, // Включение режима "файл в файл"
		//   //     preserveModulesRoot: 'src', // Корневая директория для модулей
		//   //   },
		// },
	},
})
