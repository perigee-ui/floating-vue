import type { MaybeRefOrGetter } from 'vue'
import type { ElementProps, FloatingRootContext } from '../types.ts'
import {
	getComputedStyle,
	getParentNode,
	isElement,
	isHTMLElement,
	isLastTraversableNode,
	isWebKit,
} from '@floating-ui/utils/dom'
import { onWatcherCleanup, toValue, watchEffect } from 'vue'
import { getOverflowAncestors } from '../core/index.ts'
import { contains, getDocument, getTarget, isEventTargetWithin, isRootElement } from '../utils.ts'
import { createAttribute } from '../utils/createAttribute.ts'

const bubbleHandlerKeys = {
	pointerdown: 'onPointerdown',
	mousedown: 'onMousedown',
	click: 'onClick',
} as const

const captureHandlerKeys = {
	pointerdown: 'onPointerdownCapture',
	mousedown: 'onMousedownCapture',
	click: 'onClickCapture',
} as const

export interface UseDismissProps {
	/**
	 * Whether the Hook is enabled, including all internal Effects and event
	 * handlers.
	 * @default true
	 */
	enabled?: MaybeRefOrGetter<boolean>
	/**
	 * Whether to dismiss the floating element upon pressing the `esc` key.
	 * @default true
	 */
	escapeKey?: boolean
	/**
	 * Whether to dismiss the floating element upon pressing the reference
	 * element. You likely want to ensure the `move` option in the `useHover()`
	 * Hook has been disabled when this is in use.
	 * @default false
	 */
	referencePress?: boolean
	/**
	 * The type of event to use to determine a “press”.
	 * - `pointerdown` is eager on both mouse + touch input.
	 * - `mousedown` is eager on mouse input, but lazy on touch input.
	 * - `click` is lazy on both mouse + touch input.
	 * @default 'pointerdown'
	 */
	referencePressEvent?: 'pointerdown' | 'mousedown' | 'click'
	/**
	 * Whether to dismiss the floating element upon pressing outside of the
	 * floating element.
	 * If you have another element, like a toast, that is rendered outside the
	 * floating element’s React tree and don’t want the floating element to close
	 * when pressing it, you can guard the check like so:
	 * ```jsx
	 * useDismiss(context, {
	 *   outsidePress: (event) => !event.target.closest('.toast'),
	 * });
	 * ```
	 * @default true
	 */
	outsidePress?: boolean | ((event: MouseEvent) => boolean)
	/**
	 * The type of event to use to determine an outside “press”.
	 * - `pointerdown` is eager on both mouse + touch input.
	 * - `mousedown` is eager on mouse input, but lazy on touch input.
	 * - `click` is lazy on both mouse + touch input.
	 * @default 'pointerdown'
	 */
	outsidePressEvent?: 'pointerdown' | 'mousedown' | 'click'
	/**
	 * Whether to dismiss the floating element upon scrolling an overflow
	 * ancestor.
	 * @default false
	 */
	ancestorScroll?: boolean
	/**
	 * Determines whether event listeners bubble upwards through a tree of
	 * floating elements.
	 */
	bubbles?: boolean | { escapeKey?: boolean; outsidePress?: boolean }
	/**
	 * Determines whether to use capture phase event listeners.
	 */
	capture?: boolean | { escapeKey?: boolean; outsidePress?: boolean }
}

/**
 * Closes the floating element when a dismissal is requested — by default, when
 * the user presses the `escape` key or outside of the floating element.
 * @see https://floating-ui.com/docs/useDismiss
 */
export function useDismiss(context: FloatingRootContext, props: UseDismissProps = {}): () => ElementProps | undefined {
	const {
		open,
		onOpenChange,
		elements: { domReference, floating },
		dataRef,
	} = context

	const {
		enabled = true,
		escapeKey = true,
		outsidePress = true,
		outsidePressEvent = 'pointerdown',
		referencePress = false,
		referencePressEvent = 'pointerdown',
		ancestorScroll = false,
		bubbles,
		capture,
	} = props

	// const enabled = computed(() => toValue(props.enabled ?? true))

	// const tree = useFloatingTree();
	// const tree = null

	let insideReactTreeRef = false
	let endedOrStartedInsideRef = false

	const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp(bubbles)
	const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp(capture)

	dataRef.__escapeKeyBubbles = escapeKeyBubbles
	dataRef.__outsidePressBubbles = outsidePressBubbles

	let isComposingRef = false

	function closeOnEscapeKeydown(event: KeyboardEvent) {
		// Wait until IME is settled. Pressing `Escape` while composing should
		// close the compose menu, but not the floating element.
		if (isComposingRef) {
			return
		}

		if (event.key !== 'Escape' || !toValue(open)) return

		// const nodeId = dataRef.floatingContext?.nodeId

		// const children = tree ? getChildren(tree.nodesRef.current, nodeId) : []
		const children: any[] = []

		if (!escapeKeyBubbles) {
			event.stopPropagation()

			if (children.length > 0) {
				let shouldDismiss = true

				children.forEach((child) => {
					if (child.context?.open && !child.context.dataRef.current.__escapeKeyBubbles) {
						shouldDismiss = false
					}
				})

				if (!shouldDismiss) {
					return
				}
			}
		}

		onOpenChange(false, event, 'escape-key')
	}

	function closeOnEscapeKeydownCapture(event: KeyboardEvent) {
		const target = getTarget(event)
		if (!target) return
		const callback = () => {
			closeOnEscapeKeydown(event)
			target.removeEventListener('keydown', callback)
		}
		target.addEventListener('keydown', callback)
	}

	function closeOnPressOutside(event: MouseEvent) {
		// Given developers can stop the propagation of the synthetic event,
		// we can only be confident with a positive value.
		const insideReactTree = insideReactTreeRef
		insideReactTreeRef = false

		// When click outside is lazy (`click` event), handle dragging.
		// Don't close if:
		// - The click started inside the floating element.
		// - The click ended inside the floating element.
		const endedOrStartedInside = endedOrStartedInsideRef
		endedOrStartedInsideRef = false

		if (insideReactTree) return

		if (outsidePressEvent === 'click' && endedOrStartedInside) return

		if (typeof outsidePress === 'function' && !outsidePress(event)) return

		if (isEventTargetWithin(event, floating.value) || isEventTargetWithin(event, domReference.value)) return

		const target = getTarget(event)
		const inertSelector = `[${createAttribute('inert')}]`
		const markers = getDocument(floating.value).querySelectorAll(inertSelector)

		let targetRootAncestor = isElement(target) ? target : null
		if (targetRootAncestor && !isLastTraversableNode(targetRootAncestor)) {
			do {
				const nextParent = getParentNode(targetRootAncestor)
				if (isLastTraversableNode(nextParent) || !isElement(nextParent)) {
					break
				}

				targetRootAncestor = nextParent
			} while (true)
		}

		// Check if the click occurred on a third-party element injected after the
		// floating element rendered.
		if (
			markers.length &&
			isElement(target) &&
			!isRootElement(target) &&
			// Clicked on a direct ancestor (e.g. FloatingOverlay).
			!contains(target, floating.value) &&
			// If the target root element contains none of the markers, then the
			// element was injected after the floating element rendered.
			Array.from(markers).every((marker) => !contains(targetRootAncestor, marker))
		) {
			return
		}

		// Check if the click occurred on the scrollbar
		if (isHTMLElement(target)) {
			const lastTraversableNode = isLastTraversableNode(target)
			const style = getComputedStyle(target)
			const scrollRe = /auto|scroll/
			const isScrollableX = lastTraversableNode || scrollRe.test(style.overflowX)
			const isScrollableY = lastTraversableNode || scrollRe.test(style.overflowY)

			const canScrollX = isScrollableX && target.clientWidth > 0 && target.scrollWidth > target.clientWidth
			const canScrollY = isScrollableY && target.clientHeight > 0 && target.scrollHeight > target.clientHeight

			const isRTL = style.direction === 'rtl'

			// Check click position relative to scrollbar.
			// In some browsers it is possible to change the <body> (or window)
			// scrollbar to the left side, but is very rare and is difficult to
			// check for. Plus, for modal dialogs with backdrops, it is more
			// important that the backdrop is checked but not so much the window.
			const pressedVerticalScrollbar =
				canScrollY &&
				(isRTL ? event.offsetX <= target.offsetWidth - target.clientWidth : event.offsetX > target.clientWidth)
			if (pressedVerticalScrollbar) {
				return
			}

			const pressedHorizontalScrollbar = canScrollX && event.offsetY > target.clientHeight
			if (pressedHorizontalScrollbar) {
				return
			}
		}

		// const nodeId = dataRef.floatingContext?.nodeId;

		// const targetIsInsideChildren =
		//   tree &&
		//   getChildren(tree.nodesRef.current, nodeId).some((node) =>
		//     isEventTargetWithin(event, node.context?.elements.floating),
		//   );
		const targetIsInsideChildren = undefined
		if (targetIsInsideChildren) {
			return
		}

		const children: any[] = []
		if (children.length > 0) {
			let shouldDismiss = true

			children.forEach((child) => {
				if (child.context?.open && !child.context.dataRef.current.__outsidePressBubbles) {
					shouldDismiss = false
				}
			})

			if (!shouldDismiss) {
				return
			}
		}

		onOpenChange(false, event, 'outside-press')
	}

	function closeOnPressoutsideCapture(event: MouseEvent) {
		const target = getTarget(event)
		if (!target) return
		const callback = () => {
			closeOnPressOutside(event)
			target.removeEventListener(outsidePressEvent, callback)
		}
		target.addEventListener(outsidePressEvent, callback)
	}

	watchEffect(() => {
		if (!toValue(enabled) || !toValue(open)) return

		let compositionTimeout = 0

		function onScroll(event: Event) {
			onOpenChange(false, event, 'ancestor-scroll')
		}

		function handleCompositionStart() {
			if (compositionTimeout) {
				window.clearTimeout(compositionTimeout)
				compositionTimeout = 0
			}
			isComposingRef = true
		}

		function handleCompositionEnd() {
			// Safari fires `compositionend` before `keydown`, so we need to wait
			// until the next tick to set `isComposing` to `false`.
			// https://bugs.webkit.org/show_bug.cgi?id=165004
			compositionTimeout = window.setTimeout(
				() => {
					compositionTimeout = 0
					isComposingRef = false
				},
				// 0ms or 1ms don't work in Safari. 5ms appears to consistently work.
				// Only apply to WebKit for the test to remain 0ms.
				isWebKit() ? 5 : 0,
			)
		}

		const doc = getDocument(floating.value)

		if (escapeKey) {
			doc.addEventListener(
				'keydown',
				escapeKeyCapture ? closeOnEscapeKeydownCapture : closeOnEscapeKeydown,
				escapeKeyCapture,
			)
			doc.addEventListener('compositionstart', handleCompositionStart)
			doc.addEventListener('compositionend', handleCompositionEnd)
		}

		if (outsidePress) {
			doc.addEventListener(
				outsidePressEvent,
				outsidePressCapture ? closeOnPressoutsideCapture : closeOnPressOutside,
				outsidePressCapture,
			)
		}

		const ancestors: (Element | Window | VisualViewport)[] = []

		if (ancestorScroll) {
			// Ignore the visual viewport for scrolling dismissal (allow pinch-zoom)
			const visualViewport = doc.defaultView?.visualViewport

			const passive = { passive: true }
			const domReferenceVal = domReference.value
			if (isElement(domReferenceVal)) {
				for (const ancestor of getOverflowAncestors(domReferenceVal)) {
					if (ancestor !== visualViewport) {
						ancestor.addEventListener('scroll', onScroll, passive)
						ancestors.push(ancestor)
					}
				}
			}
			// TODO::inspect this
			// const floatingVal = floating.value
			// if (isElement(floatingVal))
			//   ancestors = ancestors.concat(getOverflowAncestors(floatingVal))

			// const referenceVal = reference.value
			// if (!isElement(referenceVal) && referenceVal && referenceVal.contextElement)
			//   ancestors = ancestors.concat(getOverflowAncestors(referenceVal.contextElement))
		}

		onWatcherCleanup(() => {
			if (escapeKey) {
				doc.removeEventListener(
					'keydown',
					escapeKeyCapture ? closeOnEscapeKeydownCapture : closeOnEscapeKeydown,
					escapeKeyCapture,
				)
				doc.removeEventListener('compositionstart', handleCompositionStart)
				doc.removeEventListener('compositionend', handleCompositionEnd)
			}

			if (outsidePress) {
				doc.removeEventListener(
					outsidePressEvent,
					outsidePressCapture ? closeOnPressoutsideCapture : closeOnPressOutside,
					outsidePressCapture,
				)
			}

			if (ancestorScroll) {
				for (const ancestor of ancestors) {
					ancestor.removeEventListener('scroll', onScroll)
				}
			}

			if (compositionTimeout) {
				window.clearTimeout(compositionTimeout)
				compositionTimeout = 0
			}
		})
	})

	// TODO::ads
	// watch(
	//   [outsidePress, outsidePressEvent],
	//   () => {
	//     insideReactTreeRef = false
	//   },
	//   { immediate: true },
	// )

	const referenceProps: ElementProps['reference'] = {
		...(escapeKey && {
			onKeydown: closeOnEscapeKeydown,
		}),
		...(referencePress && {
			[bubbleHandlerKeys[referencePressEvent]](event: Event) {
				onOpenChange(false, event, 'reference-press')
			},
			...(referencePressEvent !== 'click' && {
				onClick(event) {
					onOpenChange(false, event, 'reference-press')
				},
			}),
		}),
	}

	const floatingProps: ElementProps['floating'] = {
		...(escapeKey && {
			onKeydown: closeOnEscapeKeydown,
		}),
		onMousedown() {
			endedOrStartedInsideRef = true
		},
		onMouseup() {
			endedOrStartedInsideRef = true
		},
		[captureHandlerKeys[outsidePressEvent]]() {
			insideReactTreeRef = true
		},
	}

	return () => (toValue(enabled) ? { reference: referenceProps, floating: floatingProps } : undefined)
}

export function normalizeProp(normalizable?: boolean | { escapeKey?: boolean; outsidePress?: boolean }): {
	escapeKey: boolean
	outsidePress: boolean
} {
	return {
		escapeKey: typeof normalizable === 'boolean' ? normalizable : (normalizable?.escapeKey ?? false),
		outsidePress: typeof normalizable === 'boolean' ? normalizable : (normalizable?.outsidePress ?? true),
	}
}
