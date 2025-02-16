import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import UnoCSS from 'unocss/vite'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
	define: {
		__DEV__: process.env.NODE_ENV !== 'production',
	},
	plugins: [
		vue(),
		vueJsx(),
		UnoCSS(),
		VueRouter({
			extensions: ['.vue'],
			dts: 'src/typed-router.d.ts',
		}),
	],
	build: {
		minify: false,
	},
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
})
