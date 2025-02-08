import type { Dimensions } from '@floating-ui/utils'
import type { Ref } from 'vue'
import type { ElementProps, FloatingRootContext } from '../types'
import type { MutableRefObject } from '../vue/index.ts'
import { isHTMLElement } from '@floating-ui/utils/dom'
import { computed, shallowRef, toValue, watch, watchEffect } from 'vue'
import {
  activeElement,
  contains,
  getDocument,
  isMac,
  isSafari,
  isTypeableCombobox,
  isVirtualClick,
  isVirtualPointerEvent,
  stopEvent,
} from '../utils.ts'
import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  buildCellMap,
  findNonDisabledIndex,
  getCellIndexOfCorner,
  getCellIndices,
  getGridNavigatedIndex,
  getMaxIndex,
  getMinIndex,
  isDisabled,
  isIndexOutOfBounds,
} from '../utils/composite.ts'
import { enqueueFocus } from '../utils/enqueueFocus.ts'

let isPreventScrollSupported: boolean | undefined

export interface UseListNavigationProps {
  /**
   * A ref that holds an array of list items.
   * @default empty list
   */
  listRef: MutableRefObject<Array<HTMLElement | undefined>>
  /**
   * The index of the currently active (focused or highlighted) item, which may
   * or may not be selected.
   * @default undefined
   */
  activeIndex: Ref<number | undefined>
  /**
   * A callback that is called when the user navigates to a new active item,
   * passed in a new `activeIndex`.
   */
  onNavigate?: (activeIndex: number | undefined) => void
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean
  /**
   * The currently selected item index, which may or may not be active.
   * @default undefined
   */
  selectedIndex?: Ref<number | undefined>
  /**
   * Whether to focus the item upon opening the floating element. 'auto' infers
   * what to do based on the input type (keyboard vs. pointer), while a boolean
   * value will force the value.
   * @default 'auto'
   */
  focusItemOnOpen?: boolean | 'auto'
  /**
   * Whether hovering an item synchronizes the focus.
   * @default true
   */
  focusItemOnHover?: boolean
  /**
   * Whether pressing an arrow key on the navigation’s main axis opens the
   * floating element.
   * @default true
   */
  openOnArrowKeyDown?: boolean
  /**
   * By default elements with either a `disabled` or `aria-disabled` attribute
   * are skipped in the list navigation — however, this requires the items to
   * be rendered.
   * This prop allows you to manually specify indices which should be disabled,
   * overriding the default logic.
   * For Windows-style select menus, where the menu does not open when
   * navigating via arrow keys, specify an empty array.
   * @default undefined
   */
  disabledIndices?: Array<number>
  /**
   * Determines whether focus can escape the list, such that nothing is selected
   * after navigating beyond the boundary of the list. In some
   * autocomplete/combobox components, this may be desired, as screen
   * readers will return to the input.
   * `loop` must be `true`.
   * @default false
   */
  allowEscape?: boolean
  /**
   * Determines whether focus should loop around when navigating past the first
   * or last item.
   * @default false
   */
  loop?: boolean
  /**
   * If the list is nested within another one (e.g. a nested submenu), the
   * navigation semantics change.
   * @default false
   */
  nested?: boolean
  /**
   * Whether the direction of the floating element’s navigation is in RTL
   * layout.
   * @default false
   */
  rtl?: boolean
  /**
   * Whether the focus is virtual (using `aria-activedescendant`).
   * Use this if you need focus to remain on the reference element
   * (such as an input), but allow arrow keys to navigate list items.
   * This is common in autocomplete listbox components.
   * Your virtually-focused list items must have a unique `id` set on them.
   * If you’re using a component role with the `useRole()` Hook, then an `id` is
   * generated automatically.
   * @default false
   */
  virtual?: boolean
  /**
   * The orientation in which navigation occurs.
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal' | 'both'
  /**
   * Specifies how many columns the list has (i.e., it’s a grid). Use an
   * orientation of 'horizontal' (e.g. for an emoji picker/date picker, where
   * pressing ArrowRight or ArrowLeft can change rows), or 'both' (where the
   * current row cannot be escaped with ArrowRight or ArrowLeft, only ArrowUp
   * and ArrowDown).
   * @default 1
   */
  cols?: number
  /**
   * Whether to scroll the active item into view when navigating. The default
   * value uses nearest options.
   */
  scrollItemIntoView?: boolean | ScrollIntoViewOptions
  /**
   * When using virtual focus management, this holds a ref to the
   * virtually-focused item. This allows nested virtual navigation to be
   * enabled, and lets you know when a nested element is virtually focused from
   * the root reference handling the events. Requires `FloatingTree` to be
   * setup.
   */
  virtualItem?: HTMLElement | undefined
  /**
   * Only for `cols > 1`, specify sizes for grid items.
   * `{ width: 2, height: 2 }` means an item is 2 columns wide and 2 rows tall.
   */
  itemSizes?: Dimensions[]
  /**
   * Only relevant for `cols > 1` and items with different sizes, specify if
   * the grid is dense (as defined in the CSS spec for `grid-auto-flow`).
   * @default false
   */
  dense?: boolean
}

/**
 * Adds arrow key-based navigation of a list of items, either using real DOM
 * focus or virtual focus.
 * @see https://floating-ui.com/docs/useListNavigation
 */
export function useListNavigation(
  context: FloatingRootContext,
  props: UseListNavigationProps,
): () => ElementProps | undefined {
  const { open, onOpenChange, elements } = context
  const {
    enabled = true,
    activeIndex,
    onNavigate,
    selectedIndex = null,
    allowEscape = false,
    loop = false,
    nested = false,
    rtl = false,
    virtual = false,
    focusItemOnOpen = 'auto',
    focusItemOnHover = true,
    openOnArrowKeyDown = true,
    disabledIndices = undefined,
    orientation = 'vertical',
    cols = 1,
    scrollItemIntoView = true,
    itemSizes,
    dense = false,
    listRef,
  } = props

  let _virtualItem = props.virtualItem

  if (__DEV__) {
    if (allowEscape) {
      if (!loop) {
        console.warn('`useListNavigation` looping must be enabled to allow escaping.')
      }

      if (!virtual) {
        console.warn('`useListNavigation` must be virtual to allow escaping.')
      }
    }

    if (orientation === 'vertical' && cols > 1) {
      console.warn(
        'In grid list navigation mode (`cols` > 1), the `orientation` should',
        'be either "horizontal" or "both".',
      )
    }
  }

  // const parentId = useFloatingParentNodeId();
  // const tree = useFloatingTree();

  const parentId = null
  const tree = null

  let focusItemOnOpenRef = focusItemOnOpen
  let indexRef = selectedIndex?.value ?? -1
  let keyRef = <undefined | string>undefined
  let isPointerModalityRef = true
  let previousMountedRef = !!elements.floating.value
  let previousOpenRef = toValue(open)
  let forceSyncFocus = false
  let forceScrollIntoViewRef = false

  const activeId = shallowRef<string | undefined>()
  const virtualId = shallowRef<string | undefined>()

  function focusItem(
    list: Array<HTMLElement | undefined>,
    indexRef: number,
    forceScrollIntoView = false,
  ) {
    function runFocus(item: HTMLElement) {
      if (virtual) {
        activeId.value = item.id
        // TODO: Emit virtual focus event
        // tree?.events.emit('virtualfocus', item)
        if (_virtualItem) {
          _virtualItem = item
        }
      }
      else {
        enqueueFocus(item, {
          preventScroll: true,
          // Mac Safari does not move the virtual cursor unless the focus call
          // is sync. However, for the very first focus call, we need to wait
          // for the position to be ready in order to prevent unwanted
          // scrolling. This means the virtual cursor will not move to the first
          // item when first opening the floating element, but will on
          // subsequent calls. `preventScroll` is supported in modern Safari,
          // so we can use that instead.
          // iOS Safari must be async or the first item will not be focused.
          sync:
            isMac() && isSafari()
              ? isPreventScrollSupported || forceSyncFocus
              : false,
        })
      }
    }

    const initialItem = list[indexRef]

    if (initialItem) {
      runFocus(initialItem)
    }

    requestAnimationFrame(() => {
      const waitedItem = list[indexRef] || initialItem

      if (!waitedItem)
        return

      if (!initialItem) {
        runFocus(waitedItem)
      }

      const scrollIntoViewOptions = scrollItemIntoView
      const shouldScrollIntoView = scrollIntoViewOptions && (forceScrollIntoView || !isPointerModalityRef)

      if (shouldScrollIntoView) {
        // JSDOM doesn't support `.scrollIntoView()` but it's widely supported
        // by all browsers.
        waitedItem.scrollIntoView?.(
          typeof scrollIntoViewOptions === 'boolean'
            ? { block: 'nearest', inline: 'nearest' }
            : scrollIntoViewOptions,
        )
      }
    })
  }

  if (window !== undefined && isPreventScrollSupported !== undefined) {
    isPreventScrollSupported = false
    document.createElement('div').focus({
      get preventScroll() {
        isPreventScrollSupported = true
        return false
      },
    })
  }

  // Sync `selectedIndex` to be the `activeIndex` upon opening the floating
  // element. Also, reset `activeIndex` upon closing the floating element.
  watchEffect(() => {
    if (!toValue(enabled))
      return

    if (toValue(open) && elements.floating.value) {
      if (focusItemOnOpenRef && selectedIndex?.value != null) {
        // Regardless of the pointer modality, we want to ensure the selected
        // item comes into view when the floating element is opened.
        forceScrollIntoViewRef = true
        indexRef = selectedIndex.value
        onNavigate?.(selectedIndex.value)
      }
    }
    else if (previousMountedRef) {
      // Since the user can specify `onNavigate` conditionally
      // (onNavigate: open ? setActiveIndex : setSelectedIndex),
      // we store and call the previous function.
      indexRef = -1
      onNavigate?.(undefined)
    }
  })

  // Sync `activeIndex` to be the focused item while the floating element is open.
  watch(() => toValue(enabled) && toValue(open) && elements.floating.value ? activeIndex.value : Number.NaN, () => {
    if (!toValue(enabled))
      return

    if (!toValue(open) || !elements.floating.value)
      return

    if (activeIndex.value == null) {
      forceSyncFocus = false

      if (props.selectedIndex?.value != null) {
        return
      }

      // Reset while the floating element was open (e.g. the list changed).
      if (previousMountedRef) {
        indexRef = -1
        focusItem(listRef.current, indexRef)
      }

      // Initial sync.
      if (
        (!previousOpenRef || !previousMountedRef)
        && focusItemOnOpenRef
        && (keyRef != null
          || (focusItemOnOpenRef === true && keyRef == null))
      ) {
        let runs = 0
        const waitForListPopulated = () => {
          if (listRef.current[0] == null) {
            // Avoid letting the browser paint if possible on the first try,
            // otherwise use rAF. Don't try more than twice, since something
            // is wrong otherwise.
            if (runs < 2) {
              const scheduler = runs ? requestAnimationFrame : queueMicrotask
              scheduler(waitForListPopulated)
            }
            runs++
          }
          else {
            indexRef
              = keyRef == null
                || isMainOrientationToEndKey(keyRef, orientation, rtl)
                || nested
                ? getMinIndex(listRef.current, props.disabledIndices)
                : getMaxIndex(listRef.current, props.disabledIndices)
            keyRef = undefined
            onNavigate?.(indexRef)
          }
        }

        waitForListPopulated()
      }
    }
    else if (!isIndexOutOfBounds(listRef.current, activeIndex.value)) {
      indexRef = activeIndex.value
      focusItem(listRef.current, indexRef, forceScrollIntoViewRef)
      forceScrollIntoViewRef = false
    }
  })

  // Ensure the parent floating element has focus when a nested child closes
  // to allow arrow key navigation to work after the pointer leaves the child.
  watchEffect(() => {
    if (
      !toValue(enabled)
      || elements.floating.value
      || !tree
      || virtual
      || !previousMountedRef
    ) {
      return
    }

    // TODO: tree
    const nodes = (tree as any).nodesRef
    const parent = nodes.find((node: any) => node.id === parentId)?.context?.elements.floating
    const activeEl = activeElement(getDocument(elements.floating.value))
    const treeContainsActiveEl = nodes.some(
      (node: any) => node.context && contains(node.context.elements.floating, activeEl),
    )

    if (parent && !treeContainsActiveEl && isPointerModalityRef) {
      parent.focus({ preventScroll: true })
    }
  })

  watchEffect((onCleanup) => {
    if (!toValue(enabled))
      return
    if (!tree)
      return
    if (!virtual)
      return
    if (parentId)
      return

    function handleVirtualFocus(item: HTMLElement) {
      virtualId.value = item.id

      if (_virtualItem) {
        _virtualItem = item
      }
    }

    // TODO: tree
    (tree as any).events.on('virtualfocus', handleVirtualFocus)
    onCleanup(() => {
      (tree as any).events.off('virtualfocus', handleVirtualFocus)
    })
  })

  watchEffect(() => {
    previousMountedRef = !!elements.floating.value
  }, { flush: 'post' })

  watchEffect(() => {
    if (!toValue(open)) {
      keyRef = undefined
    }

    previousOpenRef = toValue(open)
  })

  const hasActiveIndex = () => activeIndex != null

  function syncCurrentTarget(currentTarget: HTMLElement | undefined) {
    if (!toValue(open))
      return
    const index = listRef.current.indexOf(currentTarget)
    if (index !== -1) {
      onNavigate?.(index)
    }
  }

  const itemProps: ElementProps['item'] = {
    onFocus({ currentTarget }) {
      syncCurrentTarget((currentTarget ?? undefined) as HTMLElement | undefined)
    },
    onClick: ({ currentTarget }) => (currentTarget as HTMLElement).focus({ preventScroll: true }), // Safari
    ...(focusItemOnHover && {
      onMousemove({ currentTarget }) {
        syncCurrentTarget((currentTarget ?? undefined) as HTMLElement | undefined)
      },
      onPointerleave({ pointerType }) {
        if (!isPointerModalityRef || pointerType === 'touch')
          return

        indexRef = -1
        focusItem(listRef.current, indexRef)
        onNavigate?.(undefined)

        if (!virtual) {
          enqueueFocus(elements.floating.value, { preventScroll: true })
        }
      },
    }),
  }

  function commonOnKeydown(event: KeyboardEvent) {
    isPointerModalityRef = false
    forceSyncFocus = true

    // If the floating element is animating out, ignore navigation. Otherwise,
    // the `activeIndex` gets set to 0 despite not being open so the next time
    // the user ArrowDowns, the first item won't be focused.
    if (!toValue(open) && event.currentTarget === elements.floating.value) {
      return
    }

    if (nested && isCrossOrientationCloseKey(event.key, orientation, rtl)) {
      stopEvent(event)
      onOpenChange(false, event, 'list-navigation')

      if (isHTMLElement(elements.domReference) && !virtual) {
        elements.domReference.focus()
      }

      return
    }

    const currentIndex = indexRef
    const minIndex = getMinIndex(listRef.current, disabledIndices)
    const maxIndex = getMaxIndex(listRef.current, disabledIndices)

    if (event.key === 'Home') {
      stopEvent(event)
      indexRef = minIndex
      onNavigate?.(indexRef)
    }

    if (event.key === 'End') {
      stopEvent(event)
      indexRef = maxIndex

      onNavigate?.(indexRef)
    }

    // Grid navigation.
    if (cols > 1) {
      const sizes
        = itemSizes
          || Array.from({ length: listRef.current.length }, () => ({
            width: 1,
            height: 1,
          }))
      // To calculate movements on the grid, we use hypothetical cell indices
      // as if every item was 1x1, then convert back to real indices.
      const cellMap = buildCellMap(sizes, cols, dense)
      const minGridIndex = cellMap.findIndex(
        index => index != null && !isDisabled(listRef.current, index, disabledIndices),
      )
      // last enabled index
      const maxGridIndex = cellMap.reduce(
        (foundIndex: number, index, cellIndex) =>
          index != null && !isDisabled(listRef.current, index, disabledIndices)
            ? cellIndex
            : foundIndex,
        -1,
      )
      indexRef = cellMap[
        getGridNavigatedIndex(
          cellMap.map(itemIndex =>
            itemIndex != null ? listRef.current[itemIndex] : undefined,
          ),
          {
            event,
            orientation,
            loop,
            cols,
            // treat undefined (empty grid spaces) as disabled indices so we
            // don't end up in them
            disabledIndices: getCellIndices(
              [
                ...(disabledIndices
                  || listRef.current.map((_, index) =>
                    isDisabled(listRef.current, index) ? index : undefined,
                  )),
                undefined,
              ],
              cellMap,
            ),
            minIndex: minGridIndex,
            maxIndex: maxGridIndex,
            prevIndex: getCellIndexOfCorner(
              indexRef > maxIndex ? minIndex : indexRef,
              sizes,
              cellMap,
              cols,
              // use a corner matching the edge closest to the direction
              // we're moving in so we don't end up in the same item. Prefer
              // top/left over bottom/right.
              event.key === ARROW_DOWN
                ? 'bl'
                : event.key === ARROW_RIGHT
                  ? 'tr'
                  : 'tl',
            ),
            stopEvent: true,
          },
        )
      ] as number // navigated cell will never be nullish

      onNavigate?.(indexRef)

      if (orientation === 'both') {
        return
      }
    }

    if (isMainOrientationKey(event.key, orientation)) {
      stopEvent(event)

      // Reset the index if no item is focused.
      if (
        toValue(open)
        && !virtual
        && activeElement((event.currentTarget as HTMLElement).ownerDocument) === event.currentTarget
      ) {
        indexRef = isMainOrientationToEndKey(
          event.key,
          orientation,
          rtl,
        )
          ? minIndex
          : maxIndex
        onNavigate?.(indexRef)
        return
      }

      if (isMainOrientationToEndKey(event.key, orientation, rtl)) {
        if (loop) {
          indexRef
            = currentIndex >= maxIndex
              ? allowEscape && currentIndex !== listRef.current.length
                ? -1
                : minIndex
              : findNonDisabledIndex(listRef.current, {
                  startingIndex: currentIndex,
                  disabledIndices,
                })
        }
        else {
          indexRef = Math.min(
            maxIndex,
            findNonDisabledIndex(listRef.current, {
              startingIndex: currentIndex,
              disabledIndices,
            }),
          )
        }
      }
      else {
        if (loop) {
          indexRef
            = currentIndex <= minIndex
              ? allowEscape && currentIndex !== -1
                ? listRef.current.length
                : maxIndex
              : findNonDisabledIndex(listRef.current, {
                  startingIndex: currentIndex,
                  decrement: true,
                  disabledIndices,
                })
        }
        else {
          indexRef = Math.max(
            minIndex,
            findNonDisabledIndex(listRef.current, {
              startingIndex: currentIndex,
              decrement: true,
              disabledIndices,
            }),
          )
        }
      }

      if (isIndexOutOfBounds(listRef.current, indexRef)) {
        onNavigate?.(undefined)
      }
      else {
        onNavigate?.(indexRef)
      }
    }
  }

  const ariaActiveDescendantProp = computed(() => {
    return (
      virtual
      && toValue(open)
      && hasActiveIndex() && {
        'aria-activedescendant': virtualId.value || activeId.value,
      }
    ) || undefined
  })

  const floatingProps = computed<ElementProps['floating']>(() => {
    return {
      'aria-orientation': orientation === 'both' ? undefined : orientation,
      ...(!isTypeableCombobox(elements.domReference.value) && ariaActiveDescendantProp.value),
      'onKeydown': commonOnKeydown,
      onPointermove() {
        isPointerModalityRef = true
      },
    }
  })

  function checkVirtualMouse(event: MouseEvent) {
    if (focusItemOnOpen === 'auto' && isVirtualClick(event)) {
      focusItemOnOpenRef = true
    }
  }

  function checkVirtualPointer(event: PointerEvent) {
    // `pointerdown` fires first, reset the state then perform the checks.
    focusItemOnOpenRef = focusItemOnOpen
    if (
      focusItemOnOpen === 'auto'
      && isVirtualPointerEvent(event)
    ) {
      focusItemOnOpenRef = true
    }
  }

  const referenceProps = computed<ElementProps['reference']>(() => {
    return {
      ...ariaActiveDescendantProp.value,
      onKeydown(event) {
        isPointerModalityRef = false
        const isOpen = toValue(open)

        const isArrowKey = event.key.indexOf('Arrow') === 0
        const isCrossOpenKey = isCrossOrientationOpenKey(
          event.key,
          orientation,
          rtl,
        )
        // const isCrossCloseKey = isCrossOrientationCloseKey(
        //   event.key,
        //   orientation,
        //   rtl,
        // )
        const isMainKey = isMainOrientationKey(event.key, orientation)
        const isNavigationKey = (nested ? isCrossOpenKey : isMainKey) || event.key === 'Enter' || event.key.trim() === ''

        if (virtual && isOpen) {
          // const rootNode = (tree as any)?.nodesRef.current.find((node: any) => node.parentId == null)

          // const deepestNode = tree && rootNode
          //   ? getDeepestNode(tree.nodesRef.current, rootNode.id)
          //   : null
          // const deepestNode = null

          // if (isArrowKey && deepestNode && _virtualItem) {
          //   const eventObject = new KeyboardEvent('keydown', {
          //     key: event.key,
          //     bubbles: true,
          //   })

          //   if (isCrossOpenKey || isCrossCloseKey) {
          //     const isCurrentTarget
          //       = deepestNode.context?.elements.domReference
          //       === event.currentTarget
          //     const dispatchItem
          //       = isCrossCloseKey && !isCurrentTarget
          //         ? deepestNode.context?.elements.domReference
          //         : isCrossOpenKey
          //           ? props.list.find(item => item?.id === activeId)
          //           : null

          //     if (dispatchItem) {
          //       stopEvent(event)
          //       dispatchItem.dispatchEvent(eventObject)
          //       setVirtualId(undefined)
          //     }
          //   }

          //   if (isMainKey && deepestNode.context) {
          //     if (
          //       deepestNode.context.open
          //       && deepestNode.parentId
          //       && event.currentTarget
          //       !== deepestNode.context.elements.domReference
          //     ) {
          //       stopEvent(event)
          //       deepestNode.context.elements.domReference?.dispatchEvent(
          //         eventObject,
          //       )
          //       return
          //     }
          //   }
          // }

          return commonOnKeydown(event)
        }

        // If a floating element should not open on arrow key down, avoid
        // setting `activeIndex` while it's closed.
        if (!isOpen && !openOnArrowKeyDown && isArrowKey) {
          return
        }

        if (isNavigationKey) {
          keyRef = nested && isMainKey ? undefined : event.key
        }

        if (nested) {
          if (isCrossOpenKey) {
            stopEvent(event)

            if (isOpen) {
              indexRef = getMinIndex(listRef.current, disabledIndices)
              onNavigate?.(indexRef)
            }
            else {
              onOpenChange(true, event, 'list-navigation')
            }
          }

          return
        }

        if (isMainKey) {
          if (selectedIndex?.value != null) {
            indexRef = selectedIndex.value
          }

          stopEvent(event)

          if (!isOpen && openOnArrowKeyDown) {
            onOpenChange(true, event, 'list-navigation')
          }
          else {
            commonOnKeydown(event)
          }

          if (isOpen) {
            onNavigate?.(indexRef)
          }
        }
      },
      onFocus() {
        if (toValue(open) && !virtual) {
          onNavigate?.(undefined)
        }
      },
      onPointerdown: checkVirtualPointer,
      onMousedown: checkVirtualMouse,
      onClick: checkVirtualMouse,
    }
  })

  return () => toValue(enabled)
    ? {
        reference: referenceProps.value,
        floating: floatingProps.value,
        item: itemProps,
      }
    : undefined
}

function doSwitch(
  orientation: UseListNavigationProps['orientation'],
  vertical: boolean,
  horizontal: boolean,
) {
  switch (orientation) {
    case 'vertical':
      return vertical
    case 'horizontal':
      return horizontal
    default:
      return vertical || horizontal
  }
}

function isMainOrientationKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
) {
  const vertical = key === ARROW_UP || key === ARROW_DOWN
  const horizontal = key === ARROW_LEFT || key === ARROW_RIGHT
  return doSwitch(orientation, vertical, horizontal)
}

function isMainOrientationToEndKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
  rtl: boolean,
) {
  const vertical = key === ARROW_DOWN
  const horizontal = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT
  return (
    doSwitch(orientation, vertical, horizontal)
    || key === 'Enter'
    || key === ' '
    || key === ''
  )
}

function isCrossOrientationOpenKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
  rtl: boolean,
) {
  const vertical = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT
  const horizontal = key === ARROW_DOWN
  return doSwitch(orientation, vertical, horizontal)
}

function isCrossOrientationCloseKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
  rtl: boolean,
) {
  const vertical = rtl ? key === ARROW_RIGHT : key === ARROW_LEFT
  const horizontal = key === ARROW_UP
  return doSwitch(orientation, vertical, horizontal)
}
