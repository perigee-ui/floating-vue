import { createLocalFontProcessor } from '@unocss/preset-web-fonts/local'
import {
  defineConfig,
  presetIcons,
  presetTypography,
  presetUno,
  presetWebFonts,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  shortcuts: [
    {
      reference: 'bg-slate-200/90 rounded p-2 px-3 transition-colors hover:bg-slate-200/50 data-[open]:bg-slate-200/50',
      floating: 'bg-black text-white p-1 px-2 rounded z-10',
      listbox: 'flex flex-col rounded bg-white shadow-lg outline-none p-1 border border-slate-900/10 bg-clip-padding min-w-25 z-10',
      input: 'border-2 p-2 rounded border-slate-300 focus:border-blue-500 outline-none',
      box: 'relative grid place-items-center border border-slate-400 rounded lg:w-[30rem] h-[14rem] mb-4 before:absolute before:top-0 before:left-0 before:color-white before:font-medium before:bg-blue-500 before:text-sm  before:rounded-br before:p-1 before:px-3',
    },
  ],
  presets: [
    presetIcons(),
    presetUno(),
    presetTypography(),
    presetWebFonts({
      provider: 'google',
      fonts: {
        sans: 'Roboto',
        mono: ['Fira Code', 'Fira Mono:400,700'],
        lobster: 'Lobster',
        lato: [
          {
            name: 'Lato',
            weights: ['400', '700'],
            italic: true,
          },
          {
            name: 'sans-serif',
            provider: 'none',
          },
        ],
      },
      processors: createLocalFontProcessor(),
    }),

  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
})
