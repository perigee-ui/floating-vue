<script setup lang="ts">
import type { CSSProperties } from 'vue'

import type { Alignment, Side } from '../../types.ts'
import type { FloatingArrowProps } from './FloatingArrow.ts'
import { computed, useId } from 'vue'

defineOptions({
  name: 'NFloatingArrow',
})

const props = withDefaults(defineProps<FloatingArrowProps>(), {
  width: 14,
  height: 7,
  tipRadius: 0,
  strokeWidth: 0,
})

const clipPathId = useId()

// Strokes must be double the border width, this ensures the stroke's width
// works as you'd expect.
const computedStrokeWidth = computed(() => props.strokeWidth * 2)
const halfStrokeWidth = () => props.strokeWidth

const isCustomShape = () => !!props.d

const dValue = computed(() => {
  const svgX = (props.width / 2) * (props.tipRadius / -8 + 1)
  const svgY = ((props.height / 2) * props.tipRadius) / 4

  return props.d
    || 'M0,0'
    + ` H${props.width}`
    + ` L${props.width - svgX},${props.height - svgY}`
    + ` Q${props.width / 2},${props.height} ${svgX},${props.height - svgY}`
    + ' Z'
})

const style = computed(() => {
  const { transform = '', ...restStyle } = props.style || {}

  const [side, alignment] = props.placement.split('-') as [Side, Alignment]

  const yOffsetProp = props.staticOffset && alignment === 'end' ? 'bottom' : 'top'
  let xOffsetProp = props.staticOffset && alignment === 'end' ? 'right' : 'left'
  if (props.staticOffset && props.isRTL) {
    xOffsetProp = alignment === 'end' ? 'left' : 'right'
  }

  const isVerticalSide = side === 'top' || side === 'bottom'

  const arrowX = props?.x != null ? props.staticOffset || props?.x : ''
  const arrowY = props?.y != null ? props.staticOffset || props?.y : ''

  const _isCustomShape = isCustomShape()

  const rotation = {
    top: _isCustomShape ? 'rotate(180deg)' : '',
    left: _isCustomShape ? 'rotate(90deg)' : 'rotate(-90deg)',
    bottom: _isCustomShape ? '' : 'rotate(180deg)',
    right: _isCustomShape ? 'rotate(-90deg)' : 'rotate(90deg)',
  }[side]

  return {
    position: 'absolute',
    pointerEvents: 'none',
    [xOffsetProp]: arrowX,
    [yOffsetProp]: arrowY,
    [side]: isVerticalSide || _isCustomShape ? '100%' : `calc(100% - ${props.strokeWidth / 2}px)`,
    transform: `${rotation}${transform ?? ''}`,
    ...restStyle,
  } as CSSProperties
})
</script>

<template>
  <svg
    aria-hidden
    :width="isCustomShape() ? width : width + strokeWidth"
    :height="width"
    :viewBox="`0 0 ${width} ${height > width ? height : width}`"
    :style="style"
    :fill="fill"
  >
    <path
      v-if="computedStrokeWidth > 0"
      :clip-path="`url(#${clipPathId})`"
      fill="none"
      :stroke="stroke"
      :stroke-width="computedStrokeWidth + (d ? 0 : 1)"
      :d="dValue"
    />
    <path :stroke="computedStrokeWidth && !d ? fill : 'none'" :d="dValue" />
    <clipPath :id="clipPathId">
      <rect
        :x="-halfStrokeWidth()"
        :y="halfStrokeWidth() * (isCustomShape() ? -1 : 1)"
        :width="width + Number(strokeWidth)"
        :height="width"
      />
    </clipPath>
  </svg>
</template>
