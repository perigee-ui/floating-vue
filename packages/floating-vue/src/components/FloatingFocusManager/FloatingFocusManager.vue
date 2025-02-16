<script setup lang="ts">
import type { FocusableElement } from 'tabbable'
import type { OpenChangeReason } from '../../types.ts'
import type { FloatingFocusManagerProps } from './FloatingFocusManager.ts'
import { isHTMLElement } from '@floating-ui/utils/dom'
// eslint-disable-next-line vue/prefer-import-from-vue
import { isObject } from '@vue/shared'
import { tabbable } from 'tabbable'
import { computed, toValue, watch, watchEffect } from 'vue'
import { activeElement, contains, getDocument, getTarget, isTypeableCombobox, isVirtualClick, isVirtualPointerEvent, stopEvent } from '../../utils.ts'
import { createAttribute } from '../../utils/createAttribute.ts'
import { enqueueFocus } from '../../utils/enqueueFocus.ts'
import { markOthers, supportsInert } from '../../utils/markOthers.ts'
import { getTabbableOptions } from '../../utils/tabbable.ts'
import { addPreviouslyFocusedElement, getPreviouslyFocusedElement, HIDDEN_STYLES, ORDER_DEFAULT } from './FloatingFocusManager.ts'
import FocusGuard from './FocusGuard.vue'

const props = withDefaults(defineProps<FloatingFocusManagerProps>(), {
  disabled: false,
  order: () => ORDER_DEFAULT,
  guards: true,
  initialFocus: 0,
  returnFocus: true,
  restoreFocus: false,
  modal: true,
  visuallyHiddenDismiss: false,
  closeOnFocusOut: true,
})

const context = props.getContext()

const ignoreInitialFocus = () => typeof props.initialFocus === 'number' && props.initialFocus < 0
// If the reference is a combobox and is typeable (e.g. input/textarea),
// there are different focus semantics. The guards should not be rendered, but
// aria-hidden should be applied to all nodes still. Further, the visually
// hidden dismiss button should only appear at the end of the list, not the
// start.
const isUntrappedTypeableCombobox = computed(() => isTypeableCombobox(context.elements.domReference.value) && ignoreInitialFocus())

// Force the guards to be rendered if the `inert` attribute is not supported.
const guards = supportsInert() ? props.guards : true

// const tree = null
const portalContext = null

let startDismissButtonRef: HTMLButtonElement
let endDismissButtonRef: HTMLButtonElement
let preventReturnFocusRef = false
let isPointerDownRef = false
let tabbableIndexRef = -1

const isInsidePortal = portalContext != null

// If the floating element is acting as a positioning wrapper rather than the
// element that receives aria props, use it as the focus root instead.
const floatingFocusNode = computed(() => {
  const firstElementChild = context.elements.floating.value?.firstElementChild
  return firstElementChild?.id === context.floatingId ? firstElementChild : context.elements.floating.value
})

function getTabbableContent(container: Element | null | undefined = floatingFocusNode.value) {
  return container ? tabbable(container, getTabbableOptions()) : []
}

function getTabbableElements(container?: Element) {
  const content = getTabbableContent(container)

  const ret: Array<FocusableElement> = []

  for (const type of props.order) {
    if (context.elements.domReference.value && type === 'reference') {
      ret.push(context.elements.domReference.value as FocusableElement)
    }
    else if (floatingFocusNode.value && type === 'floating') {
      ret.push(floatingFocusNode.value as FocusableElement)
    }
    else {
      ret.push(...content)
    }
  }

  return ret
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab') {
    return
  }
  // The focus guards have nothing to focus, so we need to stop the event.
  if (
    contains(
      floatingFocusNode.value,
      activeElement(getDocument(floatingFocusNode.value)),
    )
    && getTabbableContent().length === 0
    && !isUntrappedTypeableCombobox.value
  ) {
    stopEvent(event)
  }

  const els = getTabbableElements()
  const target = getTarget(event)

  if (props.order[0] === 'reference' && target === context.elements.domReference.value) {
    stopEvent(event)
    if (event.shiftKey) {
      // console.error('enqueueFocus:1')
      enqueueFocus(els[els.length - 1])
    }
    else {
      // console.error('enqueueFocus:2')
      enqueueFocus(els[1])
    }
  }

  if (
    props.order[1] === 'floating'
    && target === floatingFocusNode.value
    && event.shiftKey
  ) {
    stopEvent(event)
    // console.error('enqueueFocus:3')
    enqueueFocus(els[0])
  }
}

watchEffect((onCleanup) => {
  if (props.disabled)
    return
  if (!props.modal)
    return

  const doc = getDocument(floatingFocusNode.value)

  doc.addEventListener('keydown', onKeydown)
  onCleanup(() => {
    doc.removeEventListener('keydown', onKeydown)
  })
})

function handleFocusIn(event: FocusEvent) {
  const target = getTarget(event) as Element | null
  const tabbableContent = getTabbableContent() as Array<Element | null>
  const tabbableIndex = tabbableContent.indexOf(target)
  if (tabbableIndex !== -1) {
    tabbableIndexRef = tabbableIndex
  }
}

watchEffect((onCleanup) => {
  if (props.disabled)
    return

  const floating = context.elements.floating.value
  if (!floating)
    return

  floating.addEventListener('focusin', handleFocusIn)

  onCleanup(() => {
    floating.removeEventListener('focusin', handleFocusIn)
  })
})

// In Safari, buttons lose focus when pressing them.
function handlePointerDown() {
  isPointerDownRef = true
  setTimeout(() => {
    isPointerDownRef = false
  })
}

function handleFocusOutside(event: FocusEvent) {
  const relatedTarget = event.relatedTarget as Element | null

  queueMicrotask(() => {
    const movedToUnrelatedNode = !(
      contains(context.elements.domReference.value, relatedTarget)
      || contains(context.elements.floating.value, relatedTarget)
      || contains(relatedTarget, context.elements.floating.value)
      // || contains(portalContext?.portalNode, relatedTarget)
      || relatedTarget?.hasAttribute(createAttribute('focus-guard'))
      // || (tree && (getChildrem(tree.nodesRef.current, nodeId).find(
      //   node =>
      //     contains(node.context?.elements.floating, relatedTarget)
      //     || contains(node.context?.elements.domReference, relatedTarget),
      // )
      // || getAncestors(tree.nodesRef.current, nodeId).find(
      //   node =>
      //     node.context?.elements.floating === relatedTarget
      //     || node.context?.elements.domReference === relatedTarget,
      // )))
    )

    // Restore focus to the previous tabbable element index to prevent
    // focus from being lost outside the floating tree.
    if (
      props.restoreFocus
      && movedToUnrelatedNode
      && activeElement(getDocument(floatingFocusNode.value))
      === getDocument(floatingFocusNode.value).body
    ) {
      // Let `FloatingPortal` effect knows that focus is still inside the
      // floating tree.
      if (isHTMLElement(floatingFocusNode.value)) {
        // console.error('foces:1')
        floatingFocusNode.value?.focus()
      }

      const prevTabbableIndex = tabbableIndexRef
      const tabbableContent = getTabbableContent() as Array<Element | null>
      const nodeToFocus = tabbableContent[prevTabbableIndex]
        || tabbableContent[tabbableContent.length - 1]
        || floatingFocusNode.value

      if (isHTMLElement(nodeToFocus)) {
        // console.error('foces:2')
        nodeToFocus.focus()
      }
    }

    // Focus did not move inside the floating tree, and there are no tabbable
    // portal guards to handle closing.
    if (
      (isUntrappedTypeableCombobox.value ? true : !props.modal)
      && relatedTarget
      && movedToUnrelatedNode
      && !isPointerDownRef
      // Fix React 18 Strict Mode returnFocus due to double rendering.
      && relatedTarget !== getPreviouslyFocusedElement()
    ) {
      preventReturnFocusRef = true
      context.onOpenChange(false, event)
    }
  })
}

watchEffect((onCleanup) => {
  if (props.disabled)
    return
  if (!props.closeOnFocusOut)
    return

  const floating = context.elements.floating.value
  const domReference = context.elements.domReference.value

  if (floating && isHTMLElement(domReference)) {
    domReference.addEventListener('focusout', handleFocusOutside)
    domReference.addEventListener('pointerdown', handlePointerDown)
    floating.addEventListener('focusout', handleFocusOutside)

    onCleanup(() => {
      domReference.removeEventListener('focusout', handleFocusOutside)
      domReference.removeEventListener('pointerdown', handlePointerDown)
      floating.removeEventListener('focusout', handleFocusOutside)
    })
  }
})

watchEffect((onCleanup) => {
  if (props.disabled)
    return

  if (!context.elements.floating.value)
    return

  // Don't hide portals nested within the parent portal.
  // const portalNodes = Array.from(
  //   portalContext?.portalNode?.querySelectorAll(
  //       `[${createAttribute('portal')}]`,
  //   ) || [],
  // )
  // console.error('f')

  const portalNodes: any = []

  const insideElements = [
    context.elements.floating.value,
    ...portalNodes,
    startDismissButtonRef!,
    endDismissButtonRef!,
    props.order.includes('reference') || isUntrappedTypeableCombobox.value
      ? context.elements.domReference.value
      : undefined,
  ].filter((x): x is Element => x != null)

  const cleanup = props.modal || isUntrappedTypeableCombobox.value
    ? markOthers(insideElements, guards, !guards)
    : markOthers(insideElements)

  onCleanup(() => {
    cleanup()
  })
})

watchEffect(() => {
  if (props.disabled || !isHTMLElement(floatingFocusNode.value))
    return

  const doc = getDocument(floatingFocusNode.value)

  // Wait for any layout effect state setters to execute to set `tabIndex`.
  queueMicrotask(() => {
    const previouslyFocusedElement = activeElement(doc)

    const focusableElements = getTabbableElements(floatingFocusNode.value)
    const initialFocusValue = isObject(props.initialFocus) ? props.initialFocus.current : props.initialFocus
    const elToFocus = (typeof initialFocusValue === 'number' ? focusableElements[initialFocusValue] : initialFocusValue) || floatingFocusNode.value as FocusableElement | undefined
    const focusAlreadyInsideFloatingEl = contains(floatingFocusNode.value, previouslyFocusedElement)
    // console.error('previouslyFocusedElement::', previouslyFocusedElement)

    // console.error('props.initialFocus', props.initialFocus)
    // console.error('initialFocusValue', initialFocusValue)
    // console.error('elToFocus', elToFocus)
    if (!ignoreInitialFocus() && !focusAlreadyInsideFloatingEl && toValue(context.open)) {
      // console.error('enqueueFocus:4', elToFocus)
      enqueueFocus(elToFocus, {
        preventScroll: elToFocus === floatingFocusNode.value,
      })
    }
  })
})

watch(
  () => !props.disabled ? floatingFocusNode.value : false,
  (_, __, onCleanup) => {
    if (props.disabled || !floatingFocusNode.value)
      return

    let preventReturnFocusScroll = false

    const doc = getDocument(floatingFocusNode.value)
    const previouslyFocusedElement = activeElement(doc)
    const contextData = context.dataRef
    let openEvent = contextData.openEvent
    // const domReference = context.refs.domReference.current
    // const floating = context.elements.floating.value

    addPreviouslyFocusedElement(previouslyFocusedElement)

    // Dismissing via outside press should always ignore `returnFocus` to
    // prevent unwanted scrolling.
    function onOpenChange({ open, reason, event, nested }: { open: boolean, reason: OpenChangeReason, event: Event, nested: boolean }) {
      if (open)
        openEvent = event

      if (reason === 'escape-key' && context.refs.domReference.current)
        addPreviouslyFocusedElement(context.refs.domReference.current)

      if (reason === 'hover' && event.type === 'mouseleave')
        preventReturnFocusRef = true

      if (reason !== 'outside-press')
        return

      if (nested) {
        preventReturnFocusRef = false
        preventReturnFocusScroll = true
      }
      else {
        preventReturnFocusRef = !(isVirtualClick(event as MouseEvent) || isVirtualPointerEvent(event as PointerEvent))
      }
    }

    context.events.on('openchange', onOpenChange)

    onCleanup(() => {
      context.events.off('openchange', onOpenChange)

      const activeEl = activeElement(doc)
      const isFocusInsideFloatingTree = contains(context.elements.floating.value, activeEl)
      // || (tree
      // && getChildren(tree.nodesRef.current, nodeId).some(node =>
      //   contains(node.context?.elements.floating, activeEl),
      // ))
      const shouldFocusReference = isFocusInsideFloatingTree || (openEvent && ['click', 'mousedown'].includes(openEvent.type))

      if (shouldFocusReference && context.refs.domReference.current)
        addPreviouslyFocusedElement(context.refs.domReference.current)

      // const returnContextElement = domReference || previouslyFocusedElement
      // const tabbableElements = tabbable(getDocument(returnContextElement).body, getTabbableOptions())

      // console.error('FF::0::', returnContextElement, domReference, previouslyFocusedElement)

      // Wait for the return element to get potentially disconnected before
      // checking.
      queueMicrotask(() => {
        const returnElement = getPreviouslyFocusedElement()
        // console.error('FF::1::', returnElement)

        // if (!returnElement && isHTMLElement(returnContextElement) && floating) {
        //   returnElement = getClosestTabbableElement(tabbableElements, returnContextElement, floating)
        //   // console.error('FF::2::', returnElement?.className)
        // }

        // console.error('END::', props.returnFocus)

        if (
          props.returnFocus
          && !preventReturnFocusRef
          && isHTMLElement(returnElement)
          // If the focus moved somewhere else after mount, avoid returning focus
          // since it likely entered a different element which should be
          // respected: https://github.com/floating-ui/floating-ui/issues/2607
          && (returnElement !== activeEl && activeEl !== doc.body ? isFocusInsideFloatingTree : true)
        ) {
          // console.error('foces:3', returnElement?.className)
          returnElement.focus({ preventScroll: preventReturnFocusScroll })
        }
      })
    })
  },
)

// Synchronize the `context` & `modal` value to the FloatingPortal context.
// It will decide whether or not it needs to render its own guards.
// watchEffect(() => {
//   if (props.disabled)
//     return
//   if (!portalContext)
//     return

//   // portalContext.setFocusManagerState({
//   //   modal,
//   //   closeOnFocusOut,
//   //   open,
//   //   onOpenChange,
//   //   refs,
//   // })

//   // return () => {
//   //   portalContext.setFocusManagerState(null)
//   // }
// })

watchEffect((onCleanup) => {
  if (props.disabled)
    return
  const floatingFocusNodeValue = floatingFocusNode.value

  if (!floatingFocusNodeValue)
    return
  if (typeof MutationObserver !== 'function')
    return
  if (ignoreInitialFocus())
    return

  const handleMutation = () => {
    const tabIndex = floatingFocusNodeValue.getAttribute('tabindex')
    const tabbableContent = getTabbableContent() as Array<Element | null>
    const activeEl = activeElement(getDocument(context.elements.floating.value))
    const tabbableIndex = tabbableContent.indexOf(activeEl)

    if (tabbableIndex !== -1) {
      tabbableIndexRef = tabbableIndex
    }

    if (props.order.includes('floating') || (activeEl !== context.refs.domReference.current && tabbableContent.length === 0)) {
      if (tabIndex !== '0')
        floatingFocusNodeValue.setAttribute('tabindex', '0')
    }
    else if (tabIndex !== '-1') {
      floatingFocusNodeValue.setAttribute('tabindex', '-1')
    }
  }

  handleMutation()
  const observer = new MutationObserver(handleMutation)

  observer.observe(floatingFocusNodeValue, {
    childList: true,
    subtree: true,
    attributes: true,
  })

  onCleanup(() => {
    observer.disconnect()
  })
})

const shouldRenderGuards = computed(() =>
  !props.disabled
  && guards
  && (props.modal ? !isUntrappedTypeableCombobox.value : true)
  && (isInsidePortal || props.modal),
)

function onFocusBeforeGuard(_event: FocusEvent) {
  if (props.modal) {
    const els = getTabbableElements()
    // console.error('enqueueFocus:5')
    enqueueFocus(props.order[0] === 'reference' ? els[0] : els[els.length - 1])
  }
  // else if (
  //   portalContext?.preserveTabOrder
  //   && portalContext.portalNode
  // ) {
  //   preventReturnFocusRef.current = false
  //   if (isOutsideEvent(event, portalContext.portalNode)) {
  //     const nextTabbable = getNextTabbable() || domReference
  //     nextTabbable?.focus()
  //   }
  //   else {
  //     portalContext.beforeOutsideRef.current?.focus()
  //   }
  // }
}

function onFocusAfterGuard(_event: FocusEvent) {
  if (props.modal) {
    // console.error('enqueueFocus:6')
    enqueueFocus(getTabbableElements()[0])
  }

  // else if (
  //   portalContext?.preserveTabOrder
  //   && portalContext.portalNode
  // ) {
  //   if (closeOnFocusOut) {
  //     preventReturnFocusRef.current = true
  //   }

  //   if (isOutsideEvent(event, portalContext.portalNode)) {
  //     const prevTabbable = getPreviousTabbable() || domReference
  //     prevTabbable?.focus()
  //   }
  //   else {
  //     portalContext.afterOutsideRef.current?.focus()
  //   }
  // }
}

function onVisuallyHiddenDismissClick(event: Event) {
  context.onOpenChange(false, event)
}
</script>

<template>
  <FocusGuard
    v-if="shouldRenderGuards"
    data-type="inside"
    @focus="onFocusBeforeGuard"
  />

  <button
    v-if="!isUntrappedTypeableCombobox && !disabled && visuallyHiddenDismiss && modal"
    :ref="(el: any) => {
      startDismissButtonRef = el
    }"
    tabindex="-1"
    type="button"
    :style="HIDDEN_STYLES"
    @click="onVisuallyHiddenDismissClick"
  >
    {{ typeof visuallyHiddenDismiss === 'string' ? visuallyHiddenDismiss : 'Dismiss' }}
  </button>

  <slot />

  <button
    v-if="!disabled && visuallyHiddenDismiss && modal"
    :ref="(el: any) => {
      endDismissButtonRef = el
    }"
    tabindex="-1"
    type="button"
    :style="HIDDEN_STYLES"
    @click="onVisuallyHiddenDismissClick"
  >
    {{ typeof visuallyHiddenDismiss === 'string' ? visuallyHiddenDismiss : 'Dismiss' }}
  </button>

  <FocusGuard
    v-if="shouldRenderGuards"
    data-type="inside"
    @focus="onFocusAfterGuard"
  />
</template>
