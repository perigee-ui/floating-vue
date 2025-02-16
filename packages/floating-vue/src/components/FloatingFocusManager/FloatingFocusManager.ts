// import type { FloatingContext } from '../../types.ts'

import type { CSSProperties } from 'vue'
import type { FloatingContext } from '../../types.ts'
import type { MutableRefObject } from '../../vue/index.ts'
import { getNodeName } from '@floating-ui/utils/dom'
import { isTabbable, tabbable } from 'tabbable'
import { getTabbableOptions } from '../../utils/tabbable.ts'

// eslint-disable-next-line ts/consistent-type-definitions
export type FloatingFocusManagerProps = {
	/**
	 * The floating context returned from `useFloating`.
	 */
	getContext: () => FloatingContext
	/**
	 * Whether or not the focus manager should be disabled. Useful to delay focus
	 * management until after a transition completes or some other conditional
	 * state.
	 * @default false
	 */
	disabled?: boolean
	/**
	 * The order in which focus cycles.
	 * @default ['content']
	 */
	order?: Array<'reference' | 'floating' | 'content'>
	/**
	 * Which element to initially focus. Can be either a number (tabbable index as
	 * specified by the `order`) or a ref.
	 * @default 0
	 */
	initialFocus?: number | MutableRefObject<HTMLElement | undefined> | undefined
	/**
	 * Determines if the focus guards are rendered. If not, focus can escape into
	 * the address bar/console/browser UI, like in native dialogs.
	 * @default true
	 */
	guards?: boolean
	/**
	 * Determines if focus should be returned to the reference element once the
	 * floating element closes/unmounts (or if that is not available, the
	 * previously focused element). This prop is ignored if the floating element
	 * lost focus.
	 * @default true
	 */
	returnFocus?: boolean
	/**
	 * Determines if focus should be restored to the nearest tabbable element if
	 * focus inside the floating element is lost (such as due to the removal of
	 * the currently focused element from the DOM).
	 * @default false
	 */
	restoreFocus?: boolean
	/**
	 * Determines if focus is “modal”, meaning focus is fully trapped inside the
	 * floating element and outside content cannot be accessed. This includes
	 * screen reader virtual cursors.
	 * @default true
	 */
	modal?: boolean
	/**
	 * If your focus management is modal and there is no explicit close button
	 * available, you can use this prop to render a visually-hidden dismiss
	 * button at the start and end of the floating element. This allows
	 * touch-based screen readers to escape the floating element due to lack of
	 * an `esc` key.
	 * @default undefined
	 */
	visuallyHiddenDismiss?: boolean | string
	/**
	 * Determines whether `focusout` event listeners that control whether the
	 * floating element should be closed if the focus moves outside of it are
	 * attached to the reference and floating elements. This affects non-modal
	 * focus management.
	 * @default true
	 */
	closeOnFocusOut?: boolean
}

export const ORDER_DEFAULT: Required<FloatingFocusManagerProps>['order'] = ['content'] as const

const LIST_LIMIT = 20
let previouslyFocusedElements: Element[] = []

export function getPreviouslyFocusedElement(): Element | undefined {
	return previouslyFocusedElements
		.slice()
		.reverse()
		.find((el) => el.isConnected)
}

export function addPreviouslyFocusedElement(element: Element | null): void {
	previouslyFocusedElements = previouslyFocusedElements.filter((el) => el.isConnected)
	let tabbableEl = element
	if (!tabbableEl || getNodeName(tabbableEl) === 'body') return
	if (!isTabbable(tabbableEl, getTabbableOptions())) {
		const tabbableChild = tabbable(tabbableEl, getTabbableOptions())[0]
		if (tabbableChild) {
			tabbableEl = tabbableChild
		}
	}
	previouslyFocusedElements.push(tabbableEl)
	if (previouslyFocusedElements.length > LIST_LIMIT) {
		previouslyFocusedElements = previouslyFocusedElements.slice(-LIST_LIMIT)
	}
}

// See Diego Haz's Sandbox for making this logic work well on Safari/iOS:
// https://codesandbox.io/s/tabbable-portal-f4tng?file=/src/FocusTrap.tsx

export const HIDDEN_STYLES: CSSProperties = {
	border: 0,
	clip: 'rect(0 0 0 0)',
	height: '1px',
	margin: '-1px',
	overflow: 'hidden',
	padding: 0,
	position: 'fixed',
	whiteSpace: 'nowrap',
	width: '1px',
	top: 0,
	left: 0,
}

// eslint-disable-next-line unused-imports/no-unused-vars
let activeElement: HTMLElement | undefined
let timeoutId: number | undefined

export function setActiveElementOnTab(event: KeyboardEvent): void {
	if (event.key === 'Tab') {
		activeElement = event.target as typeof activeElement
		clearTimeout(timeoutId)
	}
}
