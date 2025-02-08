<script setup lang="ts">
import type { Placement } from '@perigee-ui/floating-vue/core'
import type { StyleValue } from 'vue'
import { FloatingArrow, useClick, useFloating, useInteractions } from '@perigee-ui/floating-vue'
import { arrow, offset } from '@perigee-ui/floating-vue/core'
import { computed, shallowRef } from 'vue'

const props = withDefaults(defineProps<{
  floatingClass?: string
  placement: Placement
  arrowProps?: any
  floatingStyle?: StyleValue
  floatingProps?: any
}>(), {
  floatingClass: 'bg-black text-white p-2 bg-clip-padding',
})

const open = shallowRef(true)

const arrowEl = shallowRef<HTMLElement>()

const { context, floatingStyles, refs: { setFloating, setReference }, middlewareData } = useFloating({
  open,
  onOpenChange(value) {
    open.value = value
  },
  config: {
    placement: props.placement,
    middleware: [offset(8), arrow({ element: arrowEl })],
  },
})

const { getReferenceProps, getFloatingProps } = useInteractions([useClick(context)])

const edgeAlignment = computed(() => props.placement.split('-')[1])
</script>

<template>
  <div>
    <button
      :ref="(el:any) => setReference(el)"
      :style="{
        background: 'royalblue',
        padding: '5px',
        color: 'white',
        lineHeight: '1.2',
      }"
      type="button"
      v-bind="getReferenceProps()"
    >
      {{ placement }}
    </button>

    <div
      v-if="open"
      :ref="(el:any) => setFloating(el)"
      :class="floatingClass"
      v-bind="{
        ...getFloatingProps(),
        ...props.floatingProps,
      }"
      :style="[floatingStyles, floatingStyle]"
    >
      Tooltip

      <FloatingArrow
        :ref="(el: any) => arrowEl = (el && el.$el) ?? undefined"
        :placement="placement"
        :x="middlewareData.arrow?.x"
        :y="middlewareData.arrow?.y"
        :static-offset="edgeAlignment ? '15%' : undefined"
        v-bind="arrowProps"
      />
    </div>
  </div>
</template>
