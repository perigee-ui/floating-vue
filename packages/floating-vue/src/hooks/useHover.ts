import type { MaybeRefOrGetter, UnwrapRef } from 'vue'
import type { ElementProps, FloatingContext, OpenChangeReason } from '../types'
import { isElement } from '@floating-ui/utils/dom'
import { NOOP } from '@vue/shared'
import { onWatcherCleanup, toValue, watchEffect, watchSyncEffect } from 'vue'
import { contains, getDocument, isMouseLikePointerType } from '../utils.ts'
import { createAttribute } from '../utils/createAttribute.ts'

export interface HandleCloseFn {
  (
    context: {
      x: UnwrapRef<FloatingContext['x']>
      y: UnwrapRef<FloatingContext['y']>
      placement: UnwrapRef<FloatingContext['placement']>
      elements: {
        domReference: UnwrapRef<FloatingContext['elements']['domReference']>
        floating: UnwrapRef<FloatingContext['elements']['floating']>
      }
      onClose: () => void
      // tree?: FloatsingTreeType | null
      leave?: boolean
    },
  ): (event: MouseEvent) => void
  __options: {
    blockPointerEvents: boolean
  }
}

type MaybeValOrGetter<T> = T | (() => T)

export interface UseHoverProps {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean>
  /**
   * Instead of closing the floating element when the cursor leaves its
   * reference, we can leave it open until a certain condition is satisfied,
   * e.g. to let them traverse into the floating element.
   * @default undefined
   */
  handleClose?: HandleCloseFn | undefined
  /**
   * Waits until the user’s cursor is at “rest” over the reference element
   * before changing the `open` state.
   * @default 0
   */
  restMs?: number
  /**
   * Waits for the specified time when the event listener runs before changing
   * the `open` state.
   * @default 0
   */
  delay?: number
    | { open?: MaybeValOrGetter<number>, close?: MaybeValOrGetter<number> }
    | (() => { open?: number, close?: number } | number)
  /**
   * Whether the logic only runs for mouse input, ignoring touch input.
   * Note: due to a bug with Linux Chrome, "pen" inputs are considered "mouse".
   * @default false
   */
  mouseOnly?: boolean
  /**
   * Whether moving the cursor over the floating element will open it, without a
   * regular hover event required.
   * @default true
   */
  move?: boolean
}

const safePolygonIdentifier = createAttribute('safe-polygon')

export function useHover(context: FloatingContext, props: UseHoverProps = {}): () => ElementProps | undefined {
  const {
    open,
    dataRef,
    onOpenChange,
    events,
    elements: { domReference, floating },
  } = context
  const {
    enabled = true,
    delay = 0,
    handleClose = undefined,
    mouseOnly = false,
    restMs = 0,
    move = true,
  } = props

  // const tree: any = undefined
  // const parentId: string | undefined = undefined

  let pointerTypeRef: string | undefined
  let timeoutRef = 0
  let handlerRef: ((event: MouseEvent) => void) | undefined
  let restTimeoutRef = 0
  let blockMouseMoveRef = true
  let performedPointerEventsMutationRef = false
  let unbindMousemoveRef = NOOP
  let restTimeoutPendingRef = false
  let hasCallDomRefMouseleaveOnce = false

  function isHoverOpen() {
    const type = dataRef.openEvent?.type
    return type?.includes('mouse') && type !== 'mousedown'
  }

  // When closing before opening, clear the delay timeouts to cancel it
  // from showing.
  watchEffect(() => {
    if (!toValue(enabled))
      return

    function onOpenChange({ open }: { open: boolean }) {
      if (open)
        return

      if (timeoutRef)
        window.clearTimeout(timeoutRef)
      if (restTimeoutRef)
        window.clearTimeout(restTimeoutRef)
      blockMouseMoveRef = true
      restTimeoutPendingRef = false
      hasCallDomRefMouseleaveOnce = false
    }

    events.on('openchange', onOpenChange)

    onWatcherCleanup(() => {
      events.off('openchange', onOpenChange)
    })
  })

  if (handleClose) {
    watchEffect(() => {
      if (!toValue(enabled))
        return
      if (!toValue(open))
        return

      function onLeave(event: MouseEvent) {
        if (isHoverOpen()) {
          onOpenChange(false, event, 'hover')
        }
      }

      const html = getDocument(floating.value).documentElement
      html.addEventListener('mouseleave', onLeave)

      onWatcherCleanup(() => {
        html.removeEventListener('mouseleave', onLeave)
      })
    })
  }

  function closeWithDelay(event: Event, runElseBranch = true, reason: OpenChangeReason = 'hover') {
    const closeDelay = getDelay(delay, 'close', pointerTypeRef)
    if (closeDelay && !handlerRef) {
      if (timeoutRef)
        window.clearTimeout(timeoutRef)
      timeoutRef = window.setTimeout(() => {
        onOpenChange(false, event, reason)
        timeoutRef = 0
      }, closeDelay)
    }
    else if (runElseBranch) {
      if (timeoutRef)
        window.clearTimeout(timeoutRef)
      onOpenChange(false, event, reason)
    }
  }

  function cleanupDocMousemoveHandler() {
    unbindMousemoveRef()
    handlerRef = undefined
  }

  function clearPointerEvents() {
    if (!performedPointerEventsMutationRef)
      return

    const body = getDocument(floating.value).body
    body.style.pointerEvents = ''
    body.removeAttribute(safePolygonIdentifier)
    performedPointerEventsMutationRef = false
  }

  function isClickLikeOpenEvent() {
    return dataRef.openEvent ? ['click', 'mousedown'].includes(dataRef.openEvent.type) : false
  }

  // TODO: inspect this
  // Registering the mouse events on the reference directly to bypass React's
  // delegation system. If the cursor was on a disabled element and then entered
  // the reference (no gap), `mouseenter` doesn't fire in the delegation system.
  function onDomRefMouseenter(event: MouseEvent) {
    if (timeoutRef)
      window.clearTimeout(timeoutRef)
    blockMouseMoveRef = false

    if ((mouseOnly && !isMouseLikePointerType(pointerTypeRef)) || (restMs > 0 && !getDelay(props.delay, 'open')))
      return

    const openDelay = getDelay(props.delay, 'open', pointerTypeRef)

    if (openDelay) {
      timeoutRef = window.setTimeout(() => {
        if (!toValue(open))
          onOpenChange(true, event, 'hover')
        timeoutRef = 0
      }, openDelay)
    }
    else if (!toValue(open)) {
      onOpenChange(true, event, 'hover')
    }
  }

  function onDomRefMouseleave(event: MouseEvent) {
    if (isClickLikeOpenEvent())
      return

    unbindMousemoveRef()

    const floatingVal = floating.value
    const doc = getDocument(floatingVal)
    if (restTimeoutRef)
      window.clearTimeout(restTimeoutRef)
    restTimeoutPendingRef = false

    if (handleClose && dataRef.floatingContext) {
      // Prevent clearing `onScrollMouseLeave` timeout.
      if (!toValue(open) && timeoutRef) {
        window.clearTimeout(timeoutRef)
      }

      handlerRef = handleClose({
        // tree,
        x: event.clientX,
        y: event.clientY,
        placement: dataRef.floatingContext.placement.value,
        elements: {
          domReference: event.currentTarget as HTMLElement,
          floating: floatingVal,
        },
        onClose() {
          clearPointerEvents()
          cleanupDocMousemoveHandler()
          if (!isClickLikeOpenEvent()) {
            closeWithDelay(event, true, 'safe-polygon')
          }
        },
      })

      const handler = handlerRef

      doc.addEventListener('mousemove', handler)
      unbindMousemoveRef = () => {
        doc.removeEventListener('mousemove', handler)
      }

      return
    }

    // Allow interactivity without `safePolygon` on touch devices. With a
    // pointer, a short close delay is an alternative, so it should work
    // consistently.
    const shouldClose = pointerTypeRef === 'touch'
      ? !contains(floatingVal, event.relatedTarget as Element | null)
      : true
    if (shouldClose) {
      closeWithDelay(event)
    }
  }

  // watchEffect(() => {
  //   if (!toValue(enabled))
  //     return

  //   const domReference = elements.domReference.value as HTMLElement
  //   if (!isElement(domReference))
  //     return

  //   const openVal = toValue(open)

  //   const floating = elements.floating.value

  //   // Ensure the floating element closes after scrolling even if the pointer
  //   // did not move.
  //   // https://github.com/floating-ui/floating-ui/discussions/1692
  //   function onScrollMouseleave(event: MouseEvent) {
  //     if (isClickLikeOpenEvent())
  //       return

  //     if (!dataRef.floatingContext)
  //       return

  //     handleClose?.({
  //       // tree,
  //       x: event.clientX,
  //       y: event.clientY,
  //       placement: dataRef.floatingContext.placement.value,
  //       elements: {
  //         domReference,
  //         floating,
  //       },
  //       onClose() {
  //         clearPointerEvents()
  //         cleanupDocMousemoveHandler()
  //         if (!isClickLikeOpenEvent()) {
  //           closeWithDelay(event)
  //         }
  //       },
  //     })(event)
  //   }

  //   if (openVal)
  //     domReference.addEventListener('mouseleave', onScrollMouseleave)
  //   floating?.addEventListener('mouseleave', onScrollMouseleave)

  //   onWatcherCleanup(() => {
  //     if (openVal)
  //       domReference.removeEventListener('mouseleave', onScrollMouseleave)
  //     floating?.removeEventListener('mouseleave', onScrollMouseleave)
  //   })
  // })

  // Block pointer-events of every element other than the reference and floating
  // while the floating element is open and has a `handleClose` handler. Also
  // handles nested floating elements.
  // https://github.com/floating-ui/floating-ui/issues/1722
  if (handleClose && handleClose.__options.blockPointerEvents) {
    watchSyncEffect(() => {
      if (!toValue(enabled))
        return

      if (!toValue(open) || !isHoverOpen())
        return
      performedPointerEventsMutationRef = true

      const floatingVal = floating.value
      if (!floatingVal)
        return
      const domReferenceVal = domReference.value as HTMLElement | SVGSVGElement
      if (!isElement(domReferenceVal))
        return

      const body = getDocument(floatingVal).body
      body.setAttribute(safePolygonIdentifier, '')

      // const parentFloating = tree?.nodesRef.current.find(
      //   (node) => node.id === parentId,
      // )?.context?.elements.floating;

      // if (parentFloating) {
      //   parentFloating.style.pointerEvents = '';
      // }

      body.style.pointerEvents = 'none'
      domReferenceVal.style.pointerEvents = 'auto'
      floatingVal.style.pointerEvents = 'auto'

      onWatcherCleanup(() => {
        body.style.pointerEvents = ''
        domReferenceVal.style.pointerEvents = ''
        floatingVal.style.pointerEvents = ''
      })
    })
  }

  watchSyncEffect(() => {
    if (!toValue(open)) {
      pointerTypeRef = undefined
      restTimeoutPendingRef = false
      cleanupDocMousemoveHandler()
      clearPointerEvents()
    }
  })

  watchEffect(() => {
    // eslint-disable-next-line ts/no-unused-expressions
    toValue(enabled) ? domReference.value : undefined

    onWatcherCleanup(() => {
      cleanupDocMousemoveHandler()
      if (timeoutRef)
        window.clearTimeout(timeoutRef)
      if (restTimeoutRef)
        window.clearTimeout(restTimeoutRef)
      clearPointerEvents()
    })
  })

  function setPointerRef(event: PointerEvent) {
    pointerTypeRef = event.pointerType
  }

  const referenceProps: ElementProps['reference'] = {
    onPointerdown: setPointerRef,
    onPointerenter: setPointerRef,
    onMouseenter: onDomRefMouseenter,
    onMousemove(event) {
      if (move && !hasCallDomRefMouseleaveOnce) {
        hasCallDomRefMouseleaveOnce = true
        onDomRefMouseenter(event)
      }
      if (restMs === 0)
        return

      if (mouseOnly && !isMouseLikePointerType(pointerTypeRef))
        return

      if (toValue(open))
        return

      // Ignore insignificant movements to account for tremors.
      if (restTimeoutPendingRef && event.movementX ** 2 + event.movementY ** 2 < 2)
        return

      if (restTimeoutRef)
        window.clearTimeout(restTimeoutRef)

      function handleMouseMove() {
        if (!blockMouseMoveRef && !toValue(open))
          onOpenChange(true, event, 'hover')
      }

      if (pointerTypeRef === 'touch') {
        handleMouseMove()
      }
      else {
        restTimeoutPendingRef = true
        restTimeoutRef = window.setTimeout(() => {
          handleMouseMove()
          restTimeoutRef = 0
        }, restMs)
      }
    },
    onMouseleave: onDomRefMouseleave,
  }

  const floatingProps: ElementProps['floating'] = {
    onMouseenter() {
      if (timeoutRef)
        window.clearTimeout(timeoutRef)
    },
    onMouseleave(event) {
      if (!isClickLikeOpenEvent()) {
        closeWithDelay(event, false)
      }
    },
  }

  return () => toValue(enabled) ? { reference: referenceProps, floating: floatingProps } : undefined
}

export function getDelay(delayProps: UseHoverProps['delay'], prop: 'open' | 'close', pointerType?: PointerEvent['pointerType']): number {
  if (pointerType && !isMouseLikePointerType(pointerType))
    return 0

  if (typeof delayProps === 'function') {
    const delayPropsVal = delayProps()
    return typeof delayPropsVal === 'number' ? delayPropsVal : delayPropsVal[prop] ?? 0
  }

  if (typeof delayProps === 'number')
    return delayProps

  const propsVal = delayProps?.[prop]
  return propsVal ? toValue(propsVal) : 0
}
