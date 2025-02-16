import type { AriaAttributes, Events, HTMLAttributes, MaybeRefOrGetter, Ref } from 'vue'
import type {
	ReferenceType,
	UseFloatingCofnig as UsePositionCofnig,
	UseFloatingReturn as UsePositionFloatingReturn,
	UseFloatingOptions as UsePositionOptions,
} from './core/index.ts'
import type { ExtendedUserProps } from './hooks/useInteractions.ts'
import type { MutableRefObject } from './vue/index.ts'

// import type {ExtendedUserProps} from './hooks/useInteractions';

// export * from '.';
// export type {FloatingArrowProps} from './components/FloatingArrow';
// export type {FloatingFocusManagerProps} from './components/FloatingFocusManager';
// export type {FloatingOverlayProps} from './components/FloatingOverlay';
// export type {
//   FloatingPortalProps,
//   UseFloatingPortalNodeProps,
// } from './components/FloatingPortal';
// export type {CompositeProps, CompositeItemProps} from './components/Composite';
// export type {UseClickProps} from './hooks/useClick';
// export type {UseClientPointProps} from './hooks/useClientPoint';
// export type {UseDismissProps} from './hooks/useDismiss';
// export type {UseFocusProps} from './hooks/useFocus';
// export type {UseHoverProps} from './hooks/useHover';
// export type {UseListNavigationProps} from './hooks/useListNavigation';
// export type {UseRoleProps} from './hooks/useRole';
// export type {
//   UseTransitionStatusProps,
//   UseTransitionStylesProps,
// } from './hooks/useTransition';
// export type {UseTypeaheadProps} from './hooks/useTypeahead';
// export type {UseFloatingRootContextOptions} from './hooks/useFloatingRootContext';
// export type {InnerProps, UseInnerOffsetProps} from './inner';
// export type {UseInteractionsReturn} from './hooks/useInteractions';
// export type {SafePolygonOptions} from './safePolygon';
// export type {
//   FloatingTreeProps,
//   FloatingNodeProps,
// } from './components/FloatingTree';

export type {
	AlignedPlacement,
	Alignment,
	ArrowOptions,
	AutoPlacementOptions,
	AutoUpdateOptions,
	Axis,
	Boundary,
	ClientRectObject,
	ComputePositionConfig,
	ComputePositionReturn,
	Coords,
	DetectOverflowOptions,
	Dimensions,
	ElementContext,
	ElementRects,
	Elements,
	FlipOptions,
	FloatingElement,
	HideOptions,
	InlineOptions,
	Length,
	Middleware,
	MiddlewareArguments,
	MiddlewareData,
	MiddlewareReturn,
	MiddlewareState,
	NodeScroll,
	OffsetOptions,
	Padding,
	Placement,
	Platform,
	Rect,
	ReferenceElement,
	RootBoundary,
	ShiftOptions,
	Side,
	SideObject,
	SizeOptions,
	Strategy,
	VirtualElement,
} from './core/index.ts'

export {
	arrow,
	autoPlacement,
	autoUpdate,
	computePosition,
	detectOverflow,
	flip,
	getOverflowAncestors,
	hide,
	inline,
	limitShift,
	offset,
	platform,
	shift,
	size,
} from './core/index.ts'

type Prettify<T> = {
	[K in keyof T]: T[K]
} & {}

export type OpenChangeReason =
	| 'outside-press'
	| 'escape-key'
	| 'ancestor-scroll'
	| 'reference-press'
	| 'click'
	| 'hover'
	| 'focus'
	| 'focus-out'
	| 'list-navigation'
	| 'safe-polygon'

export type NarrowedElement<T> = T extends Element ? T : Element

export interface ExtendedRefs<RT> {
	reference: MutableRefObject<ReferenceType | undefined>
	floating: MutableRefObject<HTMLElement | undefined>
	domReference: MutableRefObject<NarrowedElement<RT> | undefined>
	setReference: (node: RT | undefined) => void
	setFloating: (node: HTMLElement | undefined) => void
	setPositionReference: (node: ReferenceType | undefined) => void
}

export interface ExtendedElements<RT> {
	reference: Ref<ReferenceType | undefined>
	floating: Ref<HTMLElement | undefined>
	domReference: Ref<NarrowedElement<RT> | undefined>
}

export interface FloatingEvents {
	emit: <T extends string>(event: T, data?: any) => void
	on: (event: string, handler: (data: any) => void) => void
	off: (event: string, handler: (data: any) => void) => void
}

export interface ContextData {
	openEvent?: Event
	floatingContext?: FloatingContext
	// /** @deprecated use `onTypingChange` prop in `useTypeahead` */
	// typing?: boolean
	[key: string]: any
}

export interface FloatingRootContext {
	dataRef: ContextData
	open: MaybeRefOrGetter<boolean>
	onOpenChange: (open: boolean, event?: Event, reason?: OpenChangeReason) => void
	elements: {
		domReference: Ref<Element | undefined>
		reference: Ref<ReferenceType | undefined>
		floating: Ref<HTMLElement | undefined>
	}
	events: FloatingEvents
	floatingId: string
	refs: {
		setPositionReference: (node: ReferenceType | undefined) => void
	}
}

export type FloatingContext<RT extends ReferenceType = ReferenceType> = Omit<
	UsePositionFloatingReturn<RT>,
	'refs' | 'elements'
> & {
	open: MaybeRefOrGetter<boolean>
	onOpenChange: (open: boolean, event?: Event, reason?: OpenChangeReason) => void
	events: FloatingEvents
	dataRef: ContextData

	nodeId: string | undefined
	floatingId: string

	refs: ExtendedRefs<RT>
	elements: ExtendedElements<RT>
}

// export interface FloatingNodeType<RT extends ReferenceType = ReferenceType> {
//   id: string
//   parentId: string | null
//   context?: FloatingContext<RT>
// }

// export interface FloatingTreeType<RT extends ReferenceType = ReferenceType> {
//   nodesRef: React.MutableRefObject<Array<FloatingNodeType<RT>>>
//   events: FloatingEvents
//   addNode: (node: FloatingNodeType) => void
//   removeNode: (node: FloatingNodeType) => void
// }

type CombineModifiers<T extends string, U extends string = T> = T extends any
	? T | `${T}${CombineModifiers<Exclude<U, T>>}`
	: never

type EventModifiers = CombineModifiers<'Capture' | 'Once' | 'Passive'>

type AllEventHandlers = {
	[K in keyof Events as K | `${K}${EventModifiers}`]: (payload: Events[K]) => void
}

export type ElAttrs = Partial<AllEventHandlers & Record<string, unknown>> & AriaAttributes & HTMLAttributes
export interface ElementProps {
	reference?: ElAttrs
	floating?: ElAttrs
	item?: ElAttrs | ((props: ExtendedUserProps) => ElAttrs)
}

// export type UseFloatingData = Prettify<UseFloatingReturn>

export type UseFloatingReturn<RT extends ReferenceType = ReferenceType> = Prettify<
	UsePositionFloatingReturn<RT> & {
		/**
		 * `FloatingContext`
		 */
		context: Prettify<FloatingContext<RT>>
		/**
		 * Object containing the reference and floating refs and reactive setters.
		 */
		refs: ExtendedRefs<RT>
		elements: ExtendedElements<RT>
	}
>

export type UseFloatingCofnig = Prettify<UsePositionCofnig>

export interface UseFloatingOptions<RT extends ReferenceType = ReferenceType>
	extends Omit<UsePositionOptions<RT>, 'elements'> {
	rootContext?: FloatingRootContext
	/**
	 * Object of external elements as an alternative to the `refs` object setters.
	 */
	elements?: {
		/**
		 * Externally passed reference element. Store in state.
		 */
		reference?: Ref<Element | undefined>
		/**
		 * Externally passed floating element. Store in state.
		 */
		floating?: Ref<HTMLElement | undefined>
	}
	/**
	 * An event callback that is invoked when the floating element is opened or
	 * closed.
	 */
	onOpenChange?: (open: boolean, event?: Event, reason?: OpenChangeReason) => void
	/**
	 * Unique node id when using `FloatingTree`.
	 */
	nodeId?: string

	config?: MaybeRefOrGetter<UseFloatingCofnig>
}
