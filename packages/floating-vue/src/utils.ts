import { isHTMLElement, isShadowRoot } from '@floating-ui/utils/dom'

export function activeElement(doc: Document): Element | null {
	let activeElement = doc.activeElement

	while (activeElement?.shadowRoot?.activeElement != null) {
		activeElement = activeElement.shadowRoot.activeElement
	}

	return activeElement
}

export function contains(parent?: Element | null | undefined, child?: Element | null | undefined): boolean {
	if (!parent || !child) return false

	// First, attempt with faster native method
	if (parent.contains(child)) return true

	const rootNode = child.getRootNode?.()

	// then fallback to custom implementation with Shadow DOM support
	if (rootNode && isShadowRoot(rootNode)) {
		let next = child
		while (next) {
			if (parent === next) {
				return true
			}
			// @ts-expect-error: `parentNode` is not in the Element interface
			next = next.parentNode || next.host
		}
	}

	// Give up, the result is false
	return false
}

interface NavigatorUAData {
	brands: Array<{ brand: string; version: string }>
	mobile: boolean
	platform: string
}

// Avoid Chrome DevTools blue warning.
export function getPlatform(): string {
	const uaData = (navigator as any).userAgentData as NavigatorUAData | undefined

	if (uaData?.platform) return uaData.platform

	return navigator.platform
}

export function getUserAgent(): string {
	const uaData = (navigator as any).userAgentData as NavigatorUAData | undefined

	if (uaData && Array.isArray(uaData.brands))
		return uaData.brands.map(({ brand, version }) => `${brand}/${version}`).join(' ')

	return navigator.userAgent
}

// License: https://github.com/adobe/react-spectrum/blob/b35d5c02fe900badccd0cf1a8f23bb593419f238/packages/@react-aria/utils/src/isVirtualEvent.ts
export function isVirtualClick(event: MouseEvent | PointerEvent): boolean {
	// FIXME: Firefox is now emitting a deprecation warning for `mozInputSource`.
	// Try to find a workaround for this. `react-aria` source still has the check.
	if ((event as any).mozInputSource === 0 && event.isTrusted) return true

	if (isAndroid() && (event as PointerEvent).pointerType) return event.type === 'click' && event.buttons === 1

	return event.detail === 0 && !(event as PointerEvent).pointerType
}

export function isVirtualPointerEvent(event: PointerEvent): boolean {
	if (isJSDOM()) return false

	return (
		(!isAndroid() && event.width === 0 && event.height === 0) ||
		(isAndroid() &&
			event.width === 1 &&
			event.height === 1 &&
			event.pressure === 0 &&
			event.detail === 0 &&
			event.pointerType === 'mouse') ||
		// iOS VoiceOver returns 0.333• for width/height.
		(event.width < 1 &&
			event.height < 1 &&
			event.pressure === 0 &&
			event.detail === 0 &&
			event.pointerType === 'touch')
	)
}

export function isSafari(): boolean {
	// Chrome DevTools does not complain about navigator.vendor
	return /apple/i.test(navigator.vendor)
}

export function isAndroid(): boolean {
	const re = /android/i
	return re.test(getPlatform()) || re.test(getUserAgent())
}

export function isMac(): boolean {
	return getPlatform().toLowerCase().startsWith('mac') && !navigator.maxTouchPoints
}

export function isJSDOM(): boolean {
	return getUserAgent().includes('jsdom/')
}

export function isMouseLikePointerType(pointerType: string | undefined, strict?: boolean): boolean {
	// On some Linux machines with Chromium, mouse inputs return a `pointerType`
	// of "pen": https://github.com/floating-ui/floating-ui/issues/2015
	const values: Array<string | undefined> = ['mouse', 'pen']

	if (!strict) values.push('', undefined)

	return values.includes(pointerType)
}

export function isRootElement(element: Element): boolean {
	return element.matches('html,body')
}

export function getDocument(node: Element | null | undefined): Document {
	return node?.ownerDocument || document
}

export function isEventTargetWithin(event: Event, node: Node | null | undefined): boolean {
	if (node == null) return false

	if ('composedPath' in event) return event.composedPath().includes(node)

	// TS thinks `event` is of type never as it assumes all browsers support composedPath, but browsers without shadow dom don't
	const e = event as Event

	return e.target != null && node.contains(e.target as Node)
}

export function getTarget(event: Event): EventTarget | null | undefined {
	if ('composedPath' in event) return event.composedPath()[0]

	// TS thinks `event` is of type never as it assumes all browsers support
	// `composedPath()`, but browsers without shadow DOM don't.
	return (event as Event).target
}

export const TYPEABLE_SELECTOR: string =
	"input:not([type='hidden']):not([disabled])," +
	"[contenteditable]:not([contenteditable='false']),textarea:not([disabled])"

export function isTypeableElement(element: unknown): boolean {
	return isHTMLElement(element) && element.matches(TYPEABLE_SELECTOR)
}

export function stopEvent(event: Event): void {
	event.preventDefault()
	event.stopPropagation()
}

export function isTypeableCombobox(element: Element | undefined): boolean {
	if (!element) return false

	return element.getAttribute('role') === 'combobox' && isTypeableElement(element)
}
