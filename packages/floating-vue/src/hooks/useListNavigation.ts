import type { Dimensions } from '@floating-ui/utils'
import type { MaybeRefOrGetter } from 'vue'
import type { ElementProps, FloatingRootContext } from '../types'
import type { MutableRefObject } from '../vue/index.ts'
import { isHTMLElement } from '@floating-ui/utils/dom'
import { computed, onWatcherCleanup, shallowRef, toValue, watchEffect } from 'vue'
import {
	activeElement,
	contains,
	getDocument,
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
import { getFloatingFocusElement } from '../utils/getFloatingFocusElement.ts'

export const ESCAPE = 'Escape'

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
	activeIndex: MaybeRefOrGetter<number | undefined>
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
	selectedIndex?: MaybeRefOrGetter<number | undefined>
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
	 * @default { block: 'nearest', inline: 'nearest' }
	 */
	scrollItemIntoView?: false | ScrollIntoViewOptions
	/**
	 * When using virtual focus management, this holds a ref to the
	 * virtually-focused item. This allows nested virtual navigation to be
	 * enabled, and lets you know when a nested element is virtually focused from
	 * the root reference handling the events. Requires `FloatingTree` to be
	 * setup.
	 */
	virtualItemRef?: MutableRefObject<HTMLElement | undefined>
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
	const {
		open,
		onOpenChange,
		elements: { floating, domReference },
	} = context
	const {
		enabled = true,
		activeIndex,
		onNavigate: prop_onNavigate = () => {},
		selectedIndex = undefined,
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
		scrollItemIntoView = { block: 'nearest', inline: 'nearest' },
		virtualItemRef,
		itemSizes,
		dense = false,
		listRef,
	} = props

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

	const floatingFocusElement = computed(() => getFloatingFocusElement(floating.value))

	// TODO:
	// const parentId = useFloatingParentNodeId();
	// const tree = useFloatingTree();

	const parentId = null
	const tree: any = null
	context.dataRef.orientation = orientation

	const typeableComboboxReference = computed(() => isTypeableCombobox(domReference.value))

	let focusItemOnOpenRef = focusItemOnOpen
	let indexRef = toValue(selectedIndex) ?? -1
	let keyRef: string | undefined
	let isPointerModalityRef = true
	let previousMountedRef = !!floating.value
	// TODO: previousOpenRef
	let previousOpenRef = toValue(open)
	let forceSyncFocusRef = false
	let forceScrollIntoViewRef = false

	const activeId = shallowRef<string | undefined>()
	const virtualId = shallowRef<string | undefined>()

	function onNavigate() {
		prop_onNavigate(indexRef === -1 ? undefined : indexRef)
	}

	function runFocus(item: HTMLElement) {
		if (virtual) {
			activeId.value = item.id
			tree?.events.emit('virtualfocus', item)
			if (virtualItemRef) {
				virtualItemRef.current = item
			}
		} else {
			enqueueFocus(item, {
				sync: forceSyncFocusRef,
				preventScroll: true,
			})
		}
	}

	function focusItem() {
		const initialItem = listRef.current[indexRef]

		if (initialItem) {
			runFocus(initialItem)
		}

		const scheduler = forceSyncFocusRef ? (v: () => void) => v() : requestAnimationFrame

		scheduler(() => {
			const waitedItem = listRef.current[indexRef] || initialItem

			if (!waitedItem) return

			if (!initialItem) {
				runFocus(waitedItem)
			}

			const shouldScrollIntoView = !!scrollItemIntoView && (forceScrollIntoViewRef || !isPointerModalityRef)

			if (shouldScrollIntoView) {
				waitedItem.scrollIntoView(scrollItemIntoView)
			}
		})
	}

	// Sync `selectedIndex` to be the `activeIndex` upon opening the floating
	// element. Also, reset `activeIndex` upon closing the floating element.
	watchEffect(() => {
		if (!toValue(enabled)) return

		if (toValue(open) && floating.value) {
			if (focusItemOnOpenRef) {
				const selectedIndexValue = toValue(selectedIndex)
				if (selectedIndexValue != null) {
					// Regardless of the pointer modality, we want to ensure the selected
					// item comes into view when the floating element is opened.
					forceScrollIntoViewRef = true
					indexRef = selectedIndexValue
					onNavigate()
				}
			}
		} else if (previousMountedRef) {
			// Since the user can specify `onNavigate` conditionally
			// (onNavigate: open ? setActiveIndex : setSelectedIndex),
			// we store and call the previous function.
			indexRef = -1
			onNavigate()
		}
	})

	// Sync `activeIndex` to be the focused item while the floating element is open.
	watchEffect(() => {
		if (!toValue(enabled) || !toValue(open) || !floating.value) return

		const activeIndexValue = toValue(activeIndex)
		if (activeIndexValue == null) {
			forceSyncFocusRef = false

			if (toValue(selectedIndex) != null) {
				return
			}

			// Reset while the floating element was open (e.g. the list changed).
			if (previousMountedRef) {
				indexRef = -1
				focusItem()
			}

			// Initial sync.
			if (
				(!previousOpenRef || !previousMountedRef) &&
				focusItemOnOpenRef &&
				(keyRef != null || (focusItemOnOpenRef === true && keyRef == null))
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
					} else {
						indexRef =
							keyRef == null || isMainOrientationToEndKey(keyRef, orientation, rtl) || nested
								? getMinIndex(listRef.current, props.disabledIndices)
								: getMaxIndex(listRef.current, props.disabledIndices)
						keyRef = undefined
						onNavigate()
					}
				}

				waitForListPopulated()
			}
		} else if (!isIndexOutOfBounds(listRef.current, activeIndexValue)) {
			indexRef = activeIndexValue
			focusItem()
			forceScrollIntoViewRef = false
		}
	})

	// Ensure the parent floating element has focus when a nested child closes
	// to allow arrow key navigation to work after the pointer leaves the child.
	watchEffect(() => {
		if (!toValue(enabled) || floating.value || !tree || virtual || !previousMountedRef) {
			return
		}

		// TODO: tree
		const nodes: any[] = tree.nodesRef
		const parent = nodes.find((node: any) => node.id === parentId)?.context?.floating
		const activeEl = activeElement(getDocument(floating.value))
		const treeContainsActiveEl = nodes.some((node) => node.context && contains(node.context.floating, activeEl))

		if (parent && !treeContainsActiveEl && isPointerModalityRef) {
			parent.focus({ preventScroll: true })
		}
	})

	watchEffect(() => {
		if (!toValue(enabled) || !tree || !virtual || parentId) return

		function handleVirtualFocus(item: HTMLElement) {
			virtualId.value = item.id

			if (virtualItemRef) {
				virtualItemRef.current = item
			}
		}

		tree.events.on('virtualfocus', handleVirtualFocus)
		onWatcherCleanup(() => {
			tree.events.off('virtualfocus', handleVirtualFocus)
		})
	})

	watchEffect(
		() => {
			previousOpenRef = toValue(open)
			previousMountedRef = !!floating.value
		},
		{ flush: 'sync' },
	)

	watchEffect(() => {
		if (!toValue(open)) {
			keyRef = undefined
		}
	})

	function syncCurrentTarget(currentTarget: HTMLElement | undefined) {
		if (!toValue(open)) return
		const index = listRef.current.indexOf(currentTarget)
		if (index !== -1 && indexRef !== index) {
			indexRef = index
			onNavigate()
		}
	}

	const itemProps: ElementProps['item'] = {
		onFocus({ currentTarget }) {
			forceSyncFocusRef = true
			syncCurrentTarget((currentTarget ?? undefined) as HTMLElement | undefined)
		},
		// Safari
		onClick({ currentTarget }) {
			;(currentTarget as HTMLElement).focus({ preventScroll: true })
		},
		...(focusItemOnHover && {
			onMousemove({ currentTarget }) {
				forceSyncFocusRef = true
				forceScrollIntoViewRef = false
				syncCurrentTarget((currentTarget ?? undefined) as HTMLElement | undefined)
			},
			onPointerleave({ pointerType }) {
				if (!isPointerModalityRef || pointerType === 'touch') return

				forceSyncFocusRef = true
				indexRef = -1
				onNavigate()

				if (!virtual) {
					floatingFocusElement.value?.focus({ preventScroll: true })
				}
			},
		}),
	}

	function commonOnKeydown(event: KeyboardEvent) {
		isPointerModalityRef = false
		forceSyncFocusRef = true

		// When composing a character, Chrome fires ArrowDown twice. Firefox/Safari
		// don't appear to suffer from this. `event.isComposing` is avoided due to
		// Safari not supporting it properly (although it's not needed in the first
		// place for Safari, just avoiding any possible issues).
		if (event.which === 229) {
			return
		}

		// If the floating element is animating out, ignore navigation. Otherwise,
		// the `activeIndex` gets set to 0 despite not being open so the next time
		// the user ArrowDowns, the first item won't be focused.
		if (!toValue(open) && floatingFocusElement.value) {
			return
		}

		const eventKey = event.key

		if (nested && isCrossOrientationCloseKey(eventKey, orientation, rtl, cols)) {
			stopEvent(event)
			onOpenChange(false, event, 'list-navigation')

			const domReferenceVal = domReference.value

			if (isHTMLElement(domReferenceVal)) {
				if (virtual) {
					tree?.events.emit('virtualfocus', domReferenceVal)
				} else {
					domReferenceVal.focus()
				}
			}

			return
		}

		const currentIndex = indexRef
		const list = listRef.current
		const minIndex = getMinIndex(list, disabledIndices)
		const maxIndex = getMaxIndex(list, disabledIndices)

		if (!typeableComboboxReference.value) {
			if (eventKey === 'Home') {
				stopEvent(event)
				indexRef = minIndex
				onNavigate()
			}

			if (eventKey === 'End') {
				stopEvent(event)
				indexRef = maxIndex

				onNavigate()
			}
		}

		// Grid navigation.
		if (cols > 1) {
			const itemSize = {
				width: 1,
				height: 1,
			}

			const sizes = itemSizes || Array.from({ length: list.length }, () => itemSize)
			// To calculate movements on the grid, we use hypothetical cell indices
			// as if every item was 1x1, then convert back to real indices.
			const cellMap = buildCellMap(sizes, cols, dense)

			let minGridIndex = -1
			let maxGridIndex = -1
			let isFindingMin = false

			for (let cellIndex = 0; cellIndex < cellMap.length; cellIndex++) {
				const index = cellMap[cellIndex]
				const isAllowedIndex = index != null && !isDisabled(list, index, disabledIndices)

				if (!isFindingMin && isAllowedIndex) {
					minGridIndex = index
					isFindingMin = true
				}

				// last enabled index
				if (isAllowedIndex) {
					maxGridIndex = cellIndex
				}
			}

			const index =
				cellMap[
					getGridNavigatedIndex(
						cellMap.map((itemIndex) => (itemIndex != null ? list[itemIndex] : undefined)),
						{
							event,
							orientation,
							loop,
							rtl,
							cols,
							// treat undefined (empty grid spaces) as disabled indices so we
							// don't end up in them
							disabledIndices: getCellIndices(
								[
									...(disabledIndices ||
										list.map((_, index) => (isDisabled(list, index) ? index : undefined))),
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
								eventKey === ARROW_DOWN ? 'bl' : eventKey === ARROW_RIGHT ? 'tr' : 'tl',
							),
							stopEvent: true,
						},
					)
				]

			if (index != null) {
				indexRef = index
				onNavigate()
			}

			if (orientation === 'both') {
				return
			}
		}

		if (isMainOrientationKey(eventKey, orientation)) {
			stopEvent(event)

			// Reset the index if no item is focused.
			if (
				!virtual &&
				toValue(open) &&
				activeElement((event.currentTarget as HTMLElement).ownerDocument) === event.currentTarget
			) {
				indexRef = isMainOrientationToEndKey(eventKey, orientation, rtl) ? minIndex : maxIndex
				onNavigate()
				return
			}

			if (isMainOrientationToEndKey(eventKey, orientation, rtl)) {
				if (loop) {
					indexRef =
						currentIndex >= maxIndex
							? allowEscape && currentIndex !== list.length
								? -1
								: minIndex
							: findNonDisabledIndex(list, {
									startingIndex: currentIndex,
									disabledIndices,
								})
				} else {
					indexRef = Math.min(
						maxIndex,
						findNonDisabledIndex(list, {
							startingIndex: currentIndex,
							disabledIndices,
						}),
					)
				}
			} else {
				if (loop) {
					indexRef =
						currentIndex <= minIndex
							? allowEscape && currentIndex !== -1
								? list.length
								: maxIndex
							: findNonDisabledIndex(list, {
									startingIndex: currentIndex,
									decrement: true,
									disabledIndices,
								})
				} else {
					indexRef = Math.max(
						minIndex,
						findNonDisabledIndex(list, {
							startingIndex: currentIndex,
							decrement: true,
							disabledIndices,
						}),
					)
				}
			}

			if (isIndexOutOfBounds(list, indexRef)) {
				indexRef = -1
			}

			onNavigate()
		}
	}

	const ariaActiveDescendantProp = computed(() => {
		if (virtual && toValue(open) && toValue(activeIndex) != null)
			return { 'aria-activedescendant': virtualId.value || activeId.value }

		return undefined
	})

	const floatingProps = computed<ElementProps['floating']>(() => {
		return {
			'aria-orientation': orientation === 'both' ? undefined : orientation,
			...(!typeableComboboxReference.value && ariaActiveDescendantProp.value),
			onKeydown: commonOnKeydown,
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
		if (focusItemOnOpen === 'auto' && isVirtualPointerEvent(event)) {
			focusItemOnOpenRef = true
		}
	}

	const referenceProps = computed<ElementProps['reference']>(() => {
		return {
			...ariaActiveDescendantProp.value,
			onKeydown(event) {
				isPointerModalityRef = false
				const isOpen = toValue(open)
				const eventKey = event.key

				const isArrowKey = eventKey.indexOf('Arrow') === 0
				const isHomeOrEndKey = ['Home', 'End'].includes(eventKey)
				const isMoveKey = isArrowKey || isHomeOrEndKey
				const parentOrientation = tree?.nodesRef.find((node: any) => node.id === parentId)?.context?.dataRef
					?.current.orientation
				const isCrossOpenKey = isCrossOrientationOpenKey(eventKey, orientation, rtl)
				const isCrossCloseKey = isCrossOrientationCloseKey(eventKey, orientation, rtl, cols)
				const isParentCrossOpenKey = isCrossOrientationOpenKey(event.key, parentOrientation, rtl)
				const isMainKey = isMainOrientationKey(eventKey, orientation)
				const isNavigationKey =
					(nested ? isParentCrossOpenKey : isMainKey) || eventKey === 'Enter' || eventKey.trim() === ''

				if (virtual && isOpen) {
					// const rootNode = tree?.nodesRef.current.find((node: any) => node.parentId == null)

					// const deepestNode = tree && rootNode
					//   ? getDeepestNode(tree.nodesRef.current, rootNode.id)
					//   : null
					const deepestNode: any = null

					if (isMoveKey && deepestNode && virtualItemRef) {
						const eventObject = new KeyboardEvent('keydown', {
							key: eventKey,
							bubbles: true,
						})

						if (isCrossOpenKey || isCrossCloseKey) {
							const isCurrentTarget = deepestNode.context?.elements.domReference === event.currentTarget
							const activeIdVal = activeId.value
							const dispatchItem =
								isCrossCloseKey && !isCurrentTarget
									? deepestNode.context?.elements.domReference
									: isCrossOpenKey
										? listRef.current.find((item) => item?.id === activeIdVal)
										: null

							if (dispatchItem) {
								stopEvent(event)
								dispatchItem.dispatchEvent(eventObject)
								virtualId.value = undefined
							}
						}

						if ((isMainKey || isHomeOrEndKey) && deepestNode.context) {
							const deepestNodeContext = deepestNode.context
							if (
								deepestNodeContext.open &&
								deepestNode.parentId &&
								event.currentTarget !== deepestNodeContext.elements.domReference
							) {
								stopEvent(event)
								deepestNodeContext.elements.domReference?.dispatchEvent(eventObject)
								return
							}
						}
					}

					return commonOnKeydown(event)
				}

				// If a floating element should not open on arrow key down, avoid
				// setting `activeIndex` while it's closed.
				if (!isOpen && !openOnArrowKeyDown && isArrowKey) {
					return
				}

				if (isNavigationKey) {
					const isParentMainKey = isMainOrientationKey(event.key, parentOrientation)
					keyRef = nested && isParentMainKey ? undefined : event.key
				}

				if (nested) {
					if (isParentCrossOpenKey) {
						stopEvent(event)

						if (isOpen) {
							indexRef = getMinIndex(listRef.current, disabledIndices)
							onNavigate()
						} else {
							onOpenChange(true, event, 'list-navigation')
						}
					}

					return
				}

				if (isMainKey) {
					const selectedIndexValue = toValue(selectedIndex)
					if (selectedIndexValue != null) {
						indexRef = selectedIndexValue
					}

					stopEvent(event)

					if (!isOpen && openOnArrowKeyDown) {
						onOpenChange(true, event, 'list-navigation')
					} else {
						commonOnKeydown(event)
					}

					if (isOpen) {
						onNavigate()
					}
				}
			},
			onFocus() {
				if (!virtual || toValue(open)) {
					indexRef = -1
					onNavigate()
				}
			},
			onPointerdown: checkVirtualPointer,
			onMousedown: checkVirtualMouse,
			onClick: checkVirtualMouse,
		}
	})

	return () =>
		toValue(enabled)
			? {
					reference: referenceProps.value,
					floating: floatingProps.value,
					item: itemProps,
				}
			: undefined
}

function doSwitch(orientation: UseListNavigationProps['orientation'], vertical: boolean, horizontal: boolean) {
	switch (orientation) {
		case 'vertical':
			return vertical
		case 'horizontal':
			return horizontal
		default:
			return vertical || horizontal
	}
}

function isMainOrientationKey(key: string, orientation: UseListNavigationProps['orientation']) {
	const vertical = key === ARROW_UP || key === ARROW_DOWN
	const horizontal = key === ARROW_LEFT || key === ARROW_RIGHT
	return doSwitch(orientation, vertical, horizontal)
}

function isMainOrientationToEndKey(key: string, orientation: UseListNavigationProps['orientation'], rtl: boolean) {
	const vertical = key === ARROW_DOWN
	const horizontal = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT
	return doSwitch(orientation, vertical, horizontal) || key === 'Enter' || key === ' ' || key === ''
}

function isCrossOrientationOpenKey(key: string, orientation: UseListNavigationProps['orientation'], rtl: boolean) {
	const vertical = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT
	const horizontal = key === ARROW_DOWN
	return doSwitch(orientation, vertical, horizontal)
}

function isCrossOrientationCloseKey(
	key: string,
	orientation: UseListNavigationProps['orientation'],
	rtl: boolean,
	cols?: number,
) {
	const vertical = rtl ? key === ARROW_RIGHT : key === ARROW_LEFT
	const horizontal = key === ARROW_UP

	if (orientation === 'both' || (orientation === 'horizontal' && cols && cols > 1)) {
		return key === ESCAPE
	}

	return doSwitch(orientation, vertical, horizontal)
}
