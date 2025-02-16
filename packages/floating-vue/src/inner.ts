import type { Derivable, DetectOverflowOptions, Middleware, MiddlewareState } from '@floating-ui/dom'
import type { SideObject } from '@floating-ui/utils'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { ElementProps, FloatingRootContext } from './types'
import type { MutableRefObject } from './vue'
import { detectOverflow, offset } from '@floating-ui/dom'
import { evaluate } from '@floating-ui/utils'
import { toValue, unref, watchEffect } from 'vue'
import { getUserAgent } from './utils.ts'

export interface InnerProps extends DetectOverflowOptions {
	/**
	 * A ref which contains an array of HTML elements.
	 * @default empty list
	 */
	listRef: MutableRefObject<Array<HTMLElement | undefined>>
	/**
	 * The index of the active (focused or highlighted) item in the list.
	 * @default 0
	 */
	index: Ref<number>
	/**
	 * Callback invoked when the fallback state changes.
	 */
	onFallbackChange?: undefined | ((fallback: boolean) => void)
	/**
	 * The offset to apply to the floating element.
	 * @default 0
	 */
	offset?: Ref<number>
	/**
	 * A ref which contains the overflow of the floating element.
	 */
	overflowRef?: MutableRefObject<SideObject | undefined>
	/**
	 * An optional ref containing an HTMLElement. This may be used as the
	 * scrolling container instead of the floating element — for instance,
	 * to position inner elements as direct children without being interfered by
	 * scrolling layout.
	 */
	scrollRef?: MutableRefObject<HTMLElement | undefined>
	/**
	 * The minimum number of items that should be visible in the list.
	 * @default 4
	 */
	minItemsVisible?: number
	/**
	 * The threshold for the reference element's overflow in pixels.
	 * @default 0
	 */
	referenceOverflowThreshold?: number
}

/**
 * Positions the floating element such that an inner element inside of it is
 * anchored to the reference element.
 * @see https://floating-ui.com/docs/inner
 */
export function inner(props: InnerProps | Derivable<InnerProps>): Middleware {
	return {
		name: 'inner',
		options: props,
		async fn(state) {
			const {
				listRef,
				overflowRef,
				onFallbackChange,
				offset: innerOffset = 0,
				index = 0,
				minItemsVisible = 4,
				referenceOverflowThreshold = 0,
				scrollRef,
				...detectOverflowOptions
			} = evaluate(props, state)

			const {
				rects,
				elements: { floating },
			} = state

			const item = listRef.current[unref(index)]

			if (__DEV__) {
				if (!state.placement.startsWith('bottom')) {
					console.warn('`placement` side must be "bottom" when using the `inner`', 'middleware.')
				}
			}

			if (!item) {
				return {}
			}

			const nextArgs = {
				...state,
				...(await offset(
					-item.offsetTop -
						floating.clientTop -
						rects.reference.height / 2 -
						item.offsetHeight / 2 -
						unref(innerOffset),
				).fn(state)),
			}

			const el = scrollRef?.current || floating

			const overflow = await detectOverflow(
				getArgsWithCustomFloatingHeight(nextArgs, el.scrollHeight),
				detectOverflowOptions,
			)
			const refOverflow = await detectOverflow(nextArgs, {
				...detectOverflowOptions,
				elementContext: 'reference',
			})

			const diffY = Math.max(0, overflow.top)
			const nextY = nextArgs.y + diffY

			const maxHeight = Math.max(0, el.scrollHeight - diffY - Math.max(0, overflow.bottom))

			el.style.maxHeight = `${maxHeight}px`
			el.scrollTop = diffY

			// There is not enough space, fallback to standard anchored positioning
			if (onFallbackChange) {
				if (
					el.offsetHeight < item.offsetHeight * Math.min(minItemsVisible, listRef.current.length - 1) - 1 ||
					refOverflow.top >= -referenceOverflowThreshold ||
					refOverflow.bottom >= -referenceOverflowThreshold
				) {
					onFallbackChange(true)
				} else {
					onFallbackChange(false)
				}
			}

			if (overflowRef) {
				overflowRef.current = await detectOverflow(
					getArgsWithCustomFloatingHeight({ ...nextArgs, y: nextY }, el.offsetHeight),
					detectOverflowOptions,
				)
			}

			return {
				y: nextY,
			}
		},
	}
}

function getArgsWithCustomFloatingHeight(state: MiddlewareState, height: number) {
	return {
		...state,
		rects: {
			...state.rects,
			floating: {
				...state.rects.floating,
				height,
			},
		},
	}
}

export interface UseInnerOffsetProps {
	/**
	 * Whether the Hook is enabled, including all internal Effects and event
	 * handlers.
	 * @default true
	 */
	enabled?: MaybeRefOrGetter<boolean>
	/**
	 * A ref which contains the overflow of the floating element.
	 */
	overflowRef: MutableRefObject<SideObject | undefined>
	/**
	 * An optional ref containing an HTMLElement. This may be used as the
	 * scrolling container instead of the floating element — for instance,
	 * to position inner elements as direct children without being interfered by
	 * scrolling layout.
	 */
	scrollRef?: MutableRefObject<HTMLElement | undefined>
	/**
	 * Callback invoked when the offset changes.
	 */
	onChange: (offset: number | ((offset: number) => number)) => void
}

/**
 * Changes the `inner` middleware's `offset` upon a `wheel` event to
 * expand the floating element's height, revealing more list items.
 * @see https://floating-ui.com/docs/inner
 */
export function useInnerOffset(
	context: FloatingRootContext,
	props: UseInnerOffsetProps,
): () => ElementProps | undefined {
	const { open, elements } = context
	const { enabled = true, overflowRef, scrollRef, onChange } = props

	let controlledScrollingRef = false
	let prevScrollTopRef: number | undefined
	// let initialOverflowRef: SideObject | undefined

	watchEffect((onCleanup) => {
		if (!toValue(enabled)) return

		const el = scrollRef?.current || elements.floating.value

		function onWheel(e: WheelEvent) {
			if (e.ctrlKey || !el || overflowRef.current == null) {
				return
			}

			const dY = e.deltaY
			const isAtTop = overflowRef.current.top >= -0.5
			const isAtBottom = overflowRef.current.bottom >= -0.5
			const remainingScroll = el.scrollHeight - el.clientHeight
			const sign = dY < 0 ? -1 : 1
			const method = dY < 0 ? 'max' : 'min'

			if (el.scrollHeight <= el.clientHeight) return

			if ((!isAtTop && dY > 0) || (!isAtBottom && dY < 0)) {
				e.preventDefault()
				onChange((d) => d + Math[method](dY, remainingScroll * sign))
			} else if (/firefox/i.test(getUserAgent())) {
				// Needed to propagate scrolling during momentum scrolling phase once
				// it gets limited by the boundary. UX improvement, not critical.
				el.scrollTop += dY
			}
		}

		if (toValue(open) && el) {
			el.addEventListener('wheel', onWheel)

			// Wait for the position to be ready.
			requestAnimationFrame(() => {
				prevScrollTopRef = el.scrollTop

				// if (overflowRef.current != null) {
				//   initialOverflowRef = { ...overflowRef.current }
				// }
			})

			onCleanup(() => {
				prevScrollTopRef = undefined
				// initialOverflowRef = undefined
				el.removeEventListener('wheel', onWheel)
			})
		}
	})

	const floating: ElementProps['floating'] = {
		onKeydown() {
			controlledScrollingRef = true
		},
		onWheel() {
			controlledScrollingRef = false
		},
		onPointermove() {
			controlledScrollingRef = false
		},
		onScroll() {
			const el = scrollRef?.current || elements.floating.value

			if (!overflowRef.current || !el || !controlledScrollingRef) {
				return
			}

			if (prevScrollTopRef != null) {
				const scrollDiff = el.scrollTop - prevScrollTopRef

				if (
					(overflowRef.current.bottom < -0.5 && scrollDiff < -1) ||
					(overflowRef.current.top < -0.5 && scrollDiff > 1)
				) {
					onChange((d) => d + scrollDiff)
				}
			}

			// [Firefox] Wait for the height change to have been applied.
			requestAnimationFrame(() => {
				prevScrollTopRef = el.scrollTop
			})
		},
	}

	return () => (toValue(enabled) ? { floating } : undefined)
}
