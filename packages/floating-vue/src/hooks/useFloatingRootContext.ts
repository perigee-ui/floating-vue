import type { MaybeRefOrGetter, Ref } from 'vue'
import type { ContextData, FloatingRootContext, OpenChangeReason, ReferenceElement } from '../types'
import { computed, shallowRef, useId } from 'vue'
import { createPubSub } from '../utils/createPubSub.ts'

export interface UseFloatingRootContextOptions {
  open?: MaybeRefOrGetter<boolean>
  onOpenChange?: (
    open: boolean,
    event?: Event,
    reason?: OpenChangeReason,
  ) => void
  elements?: {
    reference?: Ref<Element | undefined>
    floating?: Ref<HTMLElement | undefined>
  }
}

export function useFloatingRootContext(options: UseFloatingRootContextOptions): FloatingRootContext {
  const {
    open = false,
    onOpenChange: onOpenChangeProp,
  } = options

  const {
    reference: referenceProp = shallowRef(undefined),
    floating: floatingProp = shallowRef(undefined),
  } = options.elements || {}

  const floatingId = useId()
  const dataRef: ContextData = {}
  const events = createPubSub()
  // const nested = useFloatingParentNodeId() != null;
  const nested = false

  // when pointer click
  const positionReference = shallowRef<ReferenceElement | undefined>(referenceProp.value)

  return {
    dataRef,
    open,
    onOpenChange(open, event, reason) {
      dataRef.openEvent = open ? event : undefined
      events.emit('openchange', { open, event, reason, nested })
      onOpenChangeProp?.(open, event, reason)
    },
    elements: {
      reference: computed(() => positionReference.value || referenceProp.value),
      floating: floatingProp,
      domReference: referenceProp,
    },
    events,
    floatingId,
    refs: {
      setPositionReference(node) {
        positionReference.value = node
      },
    },
  }
}
