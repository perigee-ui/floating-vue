import type { MaybeRefOrGetter } from 'vue'
import type { ContextData, ElementProps, FloatingRootContext } from '../types.ts'
import { getWindow } from '@floating-ui/utils/dom'
import { onWatcherCleanup, toValue, watchEffect } from 'vue'
import { contains, getTarget, isMouseLikePointerType } from '../utils.ts'

export interface UseClientPointProps {
	/**
	 * Whether the Hook is enabled, including all internal Effects and event
	 * handlers.
	 * @default true
	 */
	enabled?: MaybeRefOrGetter<boolean>
	/**
	 * Whether to restrict the client point to an axis and use the reference
	 * element (if it exists) as the other axis. This can be useful if the
	 * floating element is also interactive.
	 * @default 'both'
	 */
	axis?: 'x' | 'y' | 'both'
	/**
	 * An explicitly defined `x` client coordinate.
	 * @default undefined
	 */
	x?: MaybeRefOrGetter<number> | undefined
	/**
	 * An explicitly defined `y` client coordinate.
	 * @default undefined
	 */
	y?: MaybeRefOrGetter<number> | undefined
}

/**
 * Positions the floating element relative to a client point (in the viewport),
 * such as the mouse position. By default, it follows the mouse cursor.
 * @see https://floating-ui.com/docs/useClientPoint
 */
export function useClientPoint(
	context: FloatingRootContext,
	props: UseClientPointProps = {},
): () => ElementProps | undefined {
	const {
		open,
		dataRef,
		elements: { floating, domReference },
		refs,
	} = context
	const { enabled = true, axis = 'both', x, y } = props

	let initialRef = false
	let cleanupListenerRef: (() => void) | undefined

	let pointerType: string | undefined

	function setReference(x: number | undefined, y: number | undefined) {
		if (initialRef) return

		// Prevent setting if the open event was not a mouse-like one
		// (e.g. focus to open, then hover over the reference element).
		// Only apply if the event exists.
		if (dataRef.openEvent && !isMouseBasedEvent(dataRef.openEvent)) return

		refs.setPositionReference(
			createVirtualElement(domReference.value, {
				x,
				y,
				axis,
				dataRef,
				pointerType,
			}),
		)
	}

	function handleReferenceMauseEnterOrMove(event: MouseEvent) {
		if (!toValue(open)) {
			setReference(event.clientX, event.clientY)
		} else if (!cleanupListenerRef) {
			// If there's no cleanup, there's no listener, but we want to ensure
			// we add the listener if the cursor landed on the floating element and
			// then back on the reference (i.e. it's interactive).
			addListener()
		}
	}

	// If the pointer is a mouse-like pointer, we want to continue following the
	// mouse even if the floating element is transitioning out. On touch
	// devices, this is undesirable because the floating element will move to
	// the dismissal touch point.
	const openCheck = () => (isMouseLikePointerType(pointerType) ? floating.value : toValue(open))

	function addListener() {
		// Explicitly specified `x`/`y` coordinates shouldn't add a listener.
		if (!toValue(enabled) || !openCheck()) return

		if (!dataRef.openEvent || isMouseBasedEvent(dataRef.openEvent)) {
			const win = getWindow(floating.value)

			function handleMouseMove(event: MouseEvent) {
				const target = getTarget(event) as Element | null

				if (!contains(floating.value, target)) {
					setReference(event.clientX, event.clientY)
				} else {
					win.removeEventListener('mousemove', handleMouseMove)
					cleanupListenerRef = undefined
				}
			}

			win.addEventListener('mousemove', handleMouseMove)

			const cleanup = () => {
				win.removeEventListener('mousemove', handleMouseMove)
				cleanupListenerRef = undefined
			}

			cleanupListenerRef = cleanup

			return cleanup
		}

		refs.setPositionReference(domReference.value)
	}

	let _oldX: number | undefined
	let _oldY: number | undefined

	watchEffect(() => {
		const enabledValue = toValue(enabled)
		if (enabledValue && !floating.value) initialRef = false

		if (!enabledValue && toValue(open)) initialRef = true

		if (enabledValue) {
			if (x != null || y != null) {
				initialRef = false
				const newX = toValue(x)
				const newY = toValue(y)
				if (_oldX !== newX || _oldY !== newY) {
					setReference(newX, newY)
					_oldX = newX
					_oldY = newY
				}
			} else {
				addListener()
			}
		}

		if (cleanupListenerRef) {
			onWatcherCleanup(cleanupListenerRef)
		}
	})

	function setPointerTypeRef(Event: PointerEvent) {
		pointerType = Event.pointerType
	}

	const referenceProps: ElementProps['reference'] = {
		onPointerenter: setPointerTypeRef,
		onPointerdown: setPointerTypeRef,

		...(x === undefined &&
			y === undefined && {
				onMouseenter: handleReferenceMauseEnterOrMove,
				onMousemove: handleReferenceMauseEnterOrMove,
			}),
	}

	return () => (toValue(enabled) ? { reference: referenceProps } : undefined)
}

function createVirtualElement(
	domElement: Element | null | undefined,
	data: {
		axis: 'x' | 'y' | 'both'
		dataRef: ContextData
		pointerType: string | undefined
		x: number | undefined
		y: number | undefined
	},
) {
	let offsetX: number | undefined
	let offsetY: number | undefined
	let isAutoUpdateEvent = false

	return {
		contextElement: domElement || undefined,
		getBoundingClientRect() {
			const domRect = domElement?.getBoundingClientRect() || {
				width: 0,
				height: 0,
				x: 0,
				y: 0,
			}

			const isXAxis = data.axis === 'x' || data.axis === 'both'
			const isYAxis = data.axis === 'y' || data.axis === 'both'
			const canTrackCursorOnAutoUpdate =
				['mouseenter', 'mousemove'].includes(data.dataRef.openEvent?.type || '') && data.pointerType !== 'touch'

			let width = domRect.width
			let height = domRect.height
			let x = domRect.x
			let y = domRect.y

			if (offsetX == null && data.x && isXAxis) {
				offsetX = domRect.x - data.x
			}

			if (offsetY == null && data.y && isYAxis) {
				offsetY = domRect.y - data.y
			}

			x -= offsetX || 0
			y -= offsetY || 0
			width = 0
			height = 0

			if (!isAutoUpdateEvent || canTrackCursorOnAutoUpdate) {
				width = data.axis === 'y' ? domRect.width : 0
				height = data.axis === 'x' ? domRect.height : 0
				x = isXAxis && data.x != null ? data.x : x
				y = isYAxis && data.y != null ? data.y : y
			} else if (isAutoUpdateEvent && !canTrackCursorOnAutoUpdate) {
				height = data.axis === 'x' ? domRect.height : height
				width = data.axis === 'y' ? domRect.width : width
			}

			isAutoUpdateEvent = true

			return {
				width,
				height,
				x,
				y,
				top: y,
				right: x + width,
				bottom: y + height,
				left: x,
			}
		},
	}
}

function isMouseBasedEvent(event: Event | undefined): event is MouseEvent {
	return event != null && (event as MouseEvent).clientX != null
}
