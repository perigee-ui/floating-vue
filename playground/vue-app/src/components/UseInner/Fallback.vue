<script setup lang="ts">
import type { UseFloatingCofnig } from '@perigee-ui/floating-vue/core'
import { inner, useClick, useDismiss, useFloating, useInnerOffset, useInteractions } from '@perigee-ui/floating-vue'
import { autoUpdate } from '@perigee-ui/floating-vue/core'
import { useRef } from '@perigee-ui/floating-vue/vue'
import { computed, shallowRef, triggerRef } from 'vue'

const list = [...Array.from({ length: 100 })].map((_, index) => `Item ${index + 1}`)

const open = shallowRef(false)
const index = shallowRef(0)
const offset = shallowRef(0)
const fallback = shallowRef(false)

const listRef = useRef<Array<HTMLElement | undefined>>([])
const overflowRef = useRef<any>()

const config = computed<UseFloatingCofnig>(() => {
  if (fallback.value) {
    return {}
  }
  return {
    middleware: [
      inner({
        listRef,
        index,
        offset,
        overflowRef,
        // Once the reference is <25px from the edge of the viewport,
        // fallback positioning mode is activated
        referenceOverflowThreshold: 25,
        onFallbackChange(v) {
          fallback.value = v
        },
        padding: 25,
      }),
    ],
  }
})

const { refs, floatingStyles, context } = useFloating(
  {
    open,
    onOpenChange(value) {
      open.value = value
    },
    whileElementsMounted: autoUpdate,
    config,
  },
)

const innerOffset = useInnerOffset(context, {
  overflowRef,
  enabled: () => !fallback.value,
  onChange(v) {
    offset.value = typeof v === 'number' ? v : v(offset.value)
    triggerRef(config)
  },
})

const { getReferenceProps, getFloatingProps } = useInteractions([
  useClick(context),
  useDismiss(context),
  innerOffset,
])

function onClick(i: number) {
  index.value = i
  offset.value = 0
  triggerRef(config)
}
</script>

<template>
  <div>
    <button
      :ref="(el) => refs.setReference(el as any)"
      class="reference"
      type="button"
      v-bind="getReferenceProps()"
    >
      Anchor {{ index }}
    </button>

    <ul
      v-if="open"
      :ref="(el:any) => refs.setFloating(el)"
      class="floating"
      :style="{
        ...floatingStyles,
        overflow: 'auto',
      }"
      v-bind="getFloatingProps()"
    >
      <li
        v-for="(item, i) in list"
        :key="item"
        :ref="(node: any) => {
          if (!node)
            listRef.current.splice(i, 1)
          else
            listRef.current[i] = node;
        }"
        tabindex="-1"
        :style="{
          color: i === index ? 'cyan' : 'inherit',
          cursor: 'pointer',
        }"

        @click="() => onClick(i)"
      >
        {{ item }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
ul {
  all: unset;
  list-style: none;
  background: rgba(0, 0, 0, 0.5);
  width: 150px;
  color: white;
  z-index: 20;
}

li {
  margin: 0 auto;
  padding: 10px;
}
</style>
