import type { CSSProperties } from 'vue'
import type {
	ComputePositionConfig,
	MiddlewareData,
	ReferenceType,
	UseFloatingCofnig,
	UseFloatingOptions,
	UseFloatingReturn,
} from './types.ts'

import { computePosition } from '@floating-ui/dom'
import { computed, isRef, onWatcherCleanup, shallowRef, toValue, watch } from 'vue'
import { useRef } from '../vue/index.ts'
import { getDPR } from './utils/getDPR.ts'
import { roundByDPR } from './utils/roundByDPR.ts'

/**
 * Computes the `x` and `y` coordinates that will place the floating element next to a reference element when it is given a certain CSS positioning strategy.
 * @param options The floating options.
 * @see https://floating-ui.com/docs/vue
 */
export function useFloating<RT extends ReferenceType = ReferenceType>(
	options: UseFloatingOptions<RT> = {},
): UseFloatingReturn<RT> {
	let configValue: UseFloatingCofnig = toValue(options.config || {})

	const rawConfig = options.config
	if (rawConfig && (typeof rawConfig === 'function' || isRef(rawConfig))) {
		watch(rawConfig, (v) => {
			configValue = v

			update()
		})
	}

	const {
		transform = true,
		whileElementsMounted,
		open,
		elements: { reference: externalReference, floating: externalFloating } = {},
	} = options

	const x = shallowRef(0)
	const y = shallowRef(0)
	const strategy = shallowRef(configValue!.strategy ?? 'absolute')
	const placement = shallowRef(configValue!.placement ?? 'bottom')
	const middlewareData = shallowRef<MiddlewareData>({})
	const isPositioned = shallowRef(false)

	const referenceRef = useRef<ReferenceType>()
	const innerReference = shallowRef<RT>()
	const getReference = () => toValue(externalReference) || innerReference.value
	const reference = shallowRef(getReference())

	const floatingRef = useRef<HTMLElement>()
	const innerFloating = shallowRef<HTMLElement>()
	const getFloating = () => externalFloating?.value || innerFloating.value
	const floating = shallowRef(getFloating())

	function update() {
		if (!referenceRef.current || !floatingRef.current) return

		const config: ComputePositionConfig = {
			placement: configValue.placement,
			strategy: configValue.strategy,
			middleware: configValue.middleware,
		}

		if (configValue.platform) config.platform = configValue.platform

		const openVal = toValue(open)

		computePosition(referenceRef.current, floatingRef.current, config).then((data) => {
			x.value = data.x
			y.value = data.y
			strategy.value = data.strategy
			placement.value = data.placement
			middlewareData.value = data.middlewareData
			/**
			 * The floating element's position may be recomputed while it's closed
			 * but still mounted (such as when transitioning out). To ensure
			 * `isPositioned` will be `false` initially on the next open, avoid
			 * setting it to `true` when `open === false` (must be specified).
			 */
			isPositioned.value = openVal !== false
		})
	}

	if (typeof open === 'function' || isRef(open)) {
		watch(
			open,
			(openVal) => {
				if (openVal === false && isPositioned.value) isPositioned.value = false
			},
			{ flush: 'sync' },
		)
	}

	watch(
		[getReference, getFloating],
		([referenceVal, floatingVal]) => {
			floating.value = floatingVal
			reference.value = referenceVal

			if (referenceVal) referenceRef.current = referenceVal

			if (floatingVal) floatingRef.current = floatingVal

			if (!referenceVal || !floatingVal) return

			if (!whileElementsMounted) {
				update()
				return
			}

			onWatcherCleanup(whileElementsMounted(referenceVal, floatingVal, update))
		},
		{ flush: 'sync' },
	)

	const floatingStyles = computed<CSSProperties>(() => {
		const initialStyles = {
			position: strategy.value,
			left: 0,
			top: 0,
		}

		const floatingVal = getFloating()
		if (!floatingVal) return initialStyles

		const xVal = roundByDPR(floatingVal, x.value)
		const yVal = roundByDPR(floatingVal, y.value)

		if (transform) {
			return {
				...initialStyles,
				transform: `translate(${xVal}px, ${yVal}px)`,
				...(getDPR(floatingVal) >= 1.5 && { willChange: 'transform' }),
			}
		}

		return {
			position: strategy.value,
			left: `${xVal}px`,
			top: `${yVal}px`,
		}
	})

	return {
		x,
		y,
		strategy,
		placement,
		middlewareData,
		isPositioned,
		floatingStyles,
		refs: {
			reference: referenceRef,
			floating: floatingRef,
			setReference(node) {
				if (node !== referenceRef.current) {
					referenceRef.current = node
					innerReference.value = node
				}
			},
			setFloating(node) {
				if (node !== floatingRef.current) {
					floatingRef.current = node
					innerFloating.value = node
				}
			},
		},
		elements: {
			reference,
			floating,
		},
		update,
	}
}
