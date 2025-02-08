import type { Ref } from 'vue'
import { createContext } from '@perigee-ui/floating-vue/vue'

export const [provideSelectContext, useSelectContext] = createContext<{
  getItemProps: (paylaod?: any) => Record<string, any>
  activeIndex: Ref<number | undefined>
}>('FloatingListContext')
