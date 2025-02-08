import type { CSSProperties, MaybeRefOrGetter, Ref } from 'vue'
import type { ReferenceType } from '../core/types.ts'
import type { FloatingContext, Placement, Side } from '../types.ts'
import { computed, onWatcherCleanup, shallowRef, toValue, watchEffect } from 'vue'

export interface UseTransitionStatusProps {
  /**
   * The duration of the transition in milliseconds, or an object containing
   * `open` and `close` keys for different durations.
   */
  duration?: number | (() => number) | { open?: number | (() => number), close?: number | (() => number) }
}

export type TransitionStatus = 'unmounted' | 'initial' | 'open' | 'close'

/**
 * Provides a status string to apply CSS transitions to a floating element,
 * correctly handling placement-aware transitions.
 * @see https://floating-ui.com/docs/useTransition#usetransitionstatus
 */
export function useTransitionStatus<RT extends ReferenceType = ReferenceType>(
  context: FloatingContext<RT>,
  props: UseTransitionStatusProps = {},
): {
    isMounted: Ref<boolean>
    status: Ref<TransitionStatus>
  } {
  const {
    open,
    elements: { floating },
  } = context
  const { duration = 250 } = props

  const closeDuration = (typeof duration === 'number' || typeof duration === 'function' ? duration : duration.close) || 0

  const status = shallowRef<TransitionStatus>('unmounted')
  const isMounted = useDelayUnmount(open, closeDuration)

  watchEffect(() => {
    if (!isMounted.value && status.value === 'close') {
      status.value = 'unmounted'
    }
  })

  watchEffect(() => {
    if (!floating.value)
      return
    if (toValue(open)) {
      status.value = 'initial'

      let frame = 0
      frame = requestAnimationFrame(() => {
        status.value = 'open'
      })

      onWatcherCleanup(() => {
        if (frame)
          cancelAnimationFrame(frame)
      })
    }
    else {
      status.value = 'close'
    }
  })

  return {
    isMounted,
    status,
  }
}

type CSSStylesProperty =
  | CSSProperties
  | ((params: { side: Side, placement: Placement }) => CSSProperties)

export interface UseTransitionStylesProps extends UseTransitionStatusProps {
  /**
   * The styles to apply when the floating element is initially mounted.
   */
  initial?: CSSStylesProperty
  /**
   * The styles to apply when the floating element is transitioning to the
   * `open` state.
   */
  open?: CSSStylesProperty
  /**
   * The styles to apply when the floating element is transitioning to the
   * `close` state.
   */
  close?: CSSStylesProperty
  /**
   * The styles to apply to all states.
   */
  common?: CSSStylesProperty
}

/**
 * Provides styles to apply CSS transitions to a floating element, correctly
 * handling placement-aware transitions. Wrapper around `useTransitionStatus`.
 * @see https://floating-ui.com/docs/useTransition#usetransitionstyles
 */
export function useTransitionStyles<RT extends ReferenceType = ReferenceType>(
  context: FloatingContext<RT>,
  props: UseTransitionStylesProps = {},
): {
    isMounted: Ref<boolean>
    styles: Ref<CSSProperties>
  } {
  const {
    duration = 250,
    common,
    open,
    close,
  } = props
  const initial = () => props.initial ?? { opacity: 0 }

  const placement = context.placement
  const [openDuration, closeDuration] = normalizeDuration(duration)

  const { isMounted, status } = useTransitionStatus(context, { duration })

  const styles = computed<CSSProperties>((oldStyles) => {
    const placementVal = placement.value
    const fnArgs = { side: placementVal.split('-')[0] as Side, placement: placementVal }

    const initialStyles = execWithArgsOrReturn(initial(), fnArgs)
    const commonStyles = execWithArgsOrReturn(common, fnArgs)

    const statusVal = status.value

    if (statusVal === 'initial') {
      return {
        transitionProperty: oldStyles?.transitionProperty,
        ...commonStyles,
        ...initialStyles,
      }
    }
    if (statusVal === 'open') {
      let openStyles = execWithArgsOrReturn(open, fnArgs)
      if (!openStyles) {
        openStyles = {}
        for (const key of Object.keys(initialStyles)) {
          (openStyles as Record<string, string>)[key] = ''
        }
      }

      return {
        transitionProperty: Object.keys(openStyles)
          .map(camelCaseToKebabCase)
          .join(','),
        transitionDuration: `${openDuration()}ms`,
        ...commonStyles,
        ...openStyles,
      }
    }
    if (statusVal === 'close') {
      const closeStyles = execWithArgsOrReturn(close, fnArgs)
      const _styles = closeStyles || initialStyles
      return {
        transitionProperty: Object.keys(_styles)
          .map(camelCaseToKebabCase)
          .join(','),
        transitionDuration: `${closeDuration()}ms`,
        ...commonStyles,
        ..._styles,
      }
    }

    return {}
  })

  return {
    isMounted,
    styles,
  }
}

function normalizeDuration(duration: UseTransitionStylesProps['duration'] = 250) {
  let open: () => number
  let close: () => number

  switch (typeof duration) {
    case 'function':
      open = duration
      close = duration
      break
    case 'number':
      open = () => duration
      close = () => duration
      break
    default: {
      const _open = duration.open
      const _close = duration.close

      switch (typeof _open) {
        case 'function':
          open = _open
          break
        case 'number':
          open = () => _open
          break
        default:
          open = () => 0
          break
      }

      switch (typeof _close) {
        case 'function':
          close = _close
          break
        case 'number':
          close = () => _close
          break
        default:
          close = () => 0
          break
      }

      break
    }
  }

  return [open, close] as const
}

// Converts a JS style key like `backgroundColor` to a CSS transition-property
// like `background-color`.
function camelCaseToKebabCase(str: string): string {
  return str.replace(
    /[A-Z]+(?![a-z])|[A-Z]/g,
    ($, ofs) => (ofs ? '-' : '') + $.toLowerCase(),
  )
}

function execWithArgsOrReturn<Value extends object | undefined, SidePlacement>(
  valueOrFn: Value | ((args: SidePlacement) => Value),
  args: SidePlacement,
): Value {
  return typeof valueOrFn === 'function' ? valueOrFn(args) : valueOrFn
}

function useDelayUnmount(open: MaybeRefOrGetter<boolean>, durationMs: number | (() => number)): Ref<boolean> {
  const isMounted = shallowRef(toValue(open))

  watchEffect(() => {
    const openVal = toValue(open)
    const isMountedVal = isMounted.value

    if (!openVal && isMountedVal) {
      let timeout = 0
      timeout = setTimeout(() => {
        isMounted.value = false
        timeout = 0
      }, typeof durationMs === 'function' ? durationMs() : durationMs)

      onWatcherCleanup(() => {
        if (timeout)
          clearTimeout(timeout)
      })
    }
    else if (openVal && !isMountedVal) {
      isMounted.value = true
    }
  })

  return isMounted
}
