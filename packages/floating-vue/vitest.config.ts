import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      browser: {
        enabled: true,
        instances: [
          {
            browser: 'chromium',
          },
        ],
        provider: 'playwright',
      },
      // environment: 'jsdom',
      root: fileURLToPath(new URL('./', import.meta.url)),
      // exclude: [
      //   ...configDefaults.exclude,
      //   'e2e/**',
      //   './src/__tests__/useClientPoint.test.tsx',
      //   './src/__tests__/useListNavigation.test.tsx',
      //   './src/__tests__/FloatingList.test.tsx',
      //   './src/__tests__/FloatingFocusManager.test.tsx',
      // ],
      include: [
        './tests/core.test.tsx',
        './tests/useFloating.test.tsx',
        './tests/useClick.test.tsx',
        './tests/useClientPoint.test.tsx',
        './tests/useHover.test.tsx',
        './tests/useDismiss.test.tsx',
        './tests/useFocus.test.tsx',
        './tests/useRole.test.tsx',
        './tests/useTypeahead.test.tsx',

        // './tests/useDismiss.test.tsx',
        // './tests/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      ],
      // setupFiles: './tests/setupTests.ts',
    },
  }),
)
