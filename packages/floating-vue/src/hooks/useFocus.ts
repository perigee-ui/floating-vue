import type { MaybeRefOrGetter } from 'vue'
import type {
  ElementProps,
  FloatingRootContext,
  OpenChangeReason,
} from '../types'
import { getWindow, isElement, isHTMLElement } from '@floating-ui/utils/dom'
import { onScopeDispose, onWatcherCleanup, toValue, watchEffect } from 'vue'

import {
  activeElement,
  contains,
  getDocument,
  getTarget,
  isMac,
  isSafari,
  isTypeableElement,
  isVirtualPointerEvent,
} from '../utils.ts'
import { createAttribute } from '../utils/createAttribute.ts'

export interface UseFocusProps {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean>
  /**
   * Whether the open state only changes if the focus event is considered
   * visible (`:focus-visible` CSS selector).
   * @default true
   */
  visibleOnly?: boolean
}

const isSafariMac = window === undefined ? true : isSafari() && isMac()

/**
 * Opens the floating element while the reference element has focus, like CSS
 * `:focus`.
 * @see https://floating-ui.com/docs/useFocus
 */
export function useFocus(
  context: FloatingRootContext,
  props: UseFocusProps = {},
): () => ElementProps | undefined {
  const { open, onOpenChange, events, dataRef, elements: { domReference } } = context
  const { enabled = true, visibleOnly = true } = props

  let blockFocusRef = false
  let timeoutRef: number
  let keyboardModalityRef = true

  // If the reference was focused and the user left the tab/window, and the
  // floating element was not open, the focus should be blocked when they
  // return to the tab/window.
  function onBlur() {
    const domReferenceVal = domReference.value

    if (
      !toValue(open)
      && isHTMLElement(domReferenceVal)
      && domReferenceVal === activeElement(getDocument(domReferenceVal))
    ) {
      blockFocusRef = true
    }
  }

  function onKeyDown() {
    keyboardModalityRef = true
  }

  function onFloatingOpenChange({ reason }: { reason: OpenChangeReason }) {
    if (reason === 'reference-press' || reason === 'escape-key')
      blockFocusRef = true
  }

  watchEffect(() => {
    if (!toValue(enabled))
      return

    const win = getWindow(domReference.value)

    win.addEventListener('blur', onBlur)
    win.addEventListener('keydown', onKeyDown, true)

    events.on('openchange', onFloatingOpenChange)

    onWatcherCleanup(() => {
      win.removeEventListener('blur', onBlur)
      win.removeEventListener('keydown', onKeyDown, true)

      events.off('openchange', onFloatingOpenChange)
    })
  })

  onScopeDispose(() => {
    if (timeoutRef) {
      window.clearTimeout(timeoutRef)
      timeoutRef = 0
    }
  })

  const referenceProps: ElementProps['reference'] = {
    onPointerdown(event) {
      if (isVirtualPointerEvent(event))
        return
      keyboardModalityRef = false
    },
    onMouseleave() {
      blockFocusRef = false
    },
    onFocus(event) {
      if (blockFocusRef)
        return

      const target = getTarget(event)

      if (visibleOnly && isElement(target)) {
        try {
          // Mac Safari unreliably matches `:focus-visible` on the reference
          // if focus was outside the page initially - use the fallback
          // instead.
          if (isSafariMac) {
            if (!keyboardModalityRef && !isTypeableElement(target))
              return
          }
          else if (!target.matches(':focus-visible')) {
            return
          }
        }
        catch {
          // Old browsers will throw an error when using `:focus-visible`.
          if (!keyboardModalityRef && !isTypeableElement(target))
            return
        }
      }

      onOpenChange(true, event, 'focus')
    },
    onBlur(event) {
      blockFocusRef = false
      const relatedTarget = event.relatedTarget

      // Hit the non-modal focus management portal guard. Focus will be
      // moved into the floating element immediately after.
      const movedToFocusGuard = relatedTarget && isElement(relatedTarget)
        && relatedTarget.hasAttribute(createAttribute('focus-guard'))
        && relatedTarget.getAttribute('data-type') === 'outside'

      if (movedToFocusGuard)
        return

      // Wait for the window blur listener to fire.
      if (timeoutRef)
        window.clearTimeout(timeoutRef)
      timeoutRef = window.setTimeout(() => {
        timeoutRef = 0
        const domReferenceVal = domReference.value
        const activeEl = activeElement(domReferenceVal ? domReferenceVal.ownerDocument : document)

        // Focus left the page, keep it open.
        if (!relatedTarget && activeEl === domReferenceVal)
          return

        // When focusing the reference element (e.g. regular click), then
        // clicking into the floating element, prevent it from hiding.
        // Note: it must be focusable, e.g. `tabindex="-1"`.
        // We can not rely on relatedTarget to point to the correct element
        // as it will only point to the shadow host of the newly focused element
        // and not the element that actually has received focus if it is located
        // inside a shadow root.
        if (
          contains(domReferenceVal, activeEl)
          || contains(dataRef.floatingContext?.refs.floating.current, activeEl)
        ) {
          return
        }

        onOpenChange(false, event, 'focus')
      })
    },
  }

  return () => toValue(enabled) ? { reference: referenceProps } : undefined
}
