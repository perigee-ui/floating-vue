<script setup lang="ts">
import type { Placement } from '@perigee-ui/floating-vue/core'
import { useDelayGroup, useDismiss, useFloating, useFocus, useHover, useInteractions, useRole, useTransitionStyles } from '@perigee-ui/floating-vue'
import { autoUpdate, flip, offset, shift } from '@perigee-ui/floating-vue/core'
import { shallowRef } from 'vue'

type Delay = number | Partial<{ open: number, close: number }>

const props = withDefaults(defineProps<{
  label: string
  placement?: Placement
  delay?: Delay
}>(), {
  placement: 'top',
  delay: 0,
})

const open = shallowRef(false)

const { refs, floatingStyles, context } = useFloating({
  open,
  whileElementsMounted: autoUpdate,
  onOpenChange(v) {
    open.value = v
  },
  config: {
    placement: props.placement,
    middleware: [offset(5), flip(), shift({ padding: 8 })],
  },
})

const delayContext = useDelayGroup(context)

const hover = useHover(context, {
  delay: () => delayContext.state.delay === 0 ? props.delay : delayContext.state.delay,
  move: false,
})
const focus = useFocus(context)
const role = useRole(context, { role: 'tooltip' })
const dismiss = useDismiss(context)

const { getReferenceProps, getFloatingProps } = useInteractions([
  hover,
  focus,
  role,
  dismiss,
])

const instantDuration = 0
const openDuration = 750
const closeDuration = 250

const { isMounted, styles } = useTransitionStyles(context, {
  duration: {
    open: () => delayContext.isInstantPhase.value ? instantDuration : openDuration,
    close: () => delayContext.isInstantPhase.value ? delayContext.currentId.value === context.floatingId ? closeDuration : instantDuration : closeDuration,
  },
  initial: {
    opacity: 0,
    scale: '0.925',
  },
  common: ({ side }) => ({
    transitionTimingFunction: 'cubic-bezier(.18,.87,.4,.97)',
    transformOrigin: {
      top: 'bottom',
      left: 'right',
      bottom: 'top',
      right: 'left',
    }[side],
  }),
})
</script>

<template>
  <div>
    <button
      :ref="(el:any) => refs.setReference(el)"
      class="reference"
      type="button"
      v-bind="getReferenceProps()"
    >
      My button
    </button>
    <!-- <div class="line-height-none">
      {{ delayContext.isInstantPhase.value }}
    </div>
    <div class="line-height-none">
      {{ delayContext.currentId.value }}
    </div>
    <div class="line-height-none">
      {{ context.floatingId }}
    </div> -->

    <div
      v-if="isMounted"
      :ref="(el:any) => refs.setFloating(el)"
      role="presentation"
      :style="floatingStyles"
    >
      <div
        className="bg-black text-white p-1 px-2 rounded"
        :style="styles"
        v-bind="getFloatingProps()"
      >
        {{ label }}
      </div>
    </div>
  </div>
</template>
