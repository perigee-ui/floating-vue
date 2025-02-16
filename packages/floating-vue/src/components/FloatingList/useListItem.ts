import { onUpdated, shallowRef, triggerRef, watch } from 'vue'
import { useFloatingListContet } from './FloatingList.ts'

export interface UseListItemProps {
	label?: string | undefined
}

/**
 * Used to register a list item and its index (DOM position) in the
 * `FloatingList`.
 * @see https://floating-ui.com/docs/FloatingList#uselistitem
 */
export function useListItem(props: UseListItemProps = {}): {
	readonly setItem: (node: HTMLElement | undefined) => void
	readonly index: () => number
} {
	const { label } = props

	const { register, unregister, map, elementsRef, labelsRef } = useFloatingListContet('useListItem')

	const index = shallowRef<number>()

	const componentRef = shallowRef<HTMLElement | undefined>()

	function setItem(node: HTMLElement | undefined): void {
		componentRef.value = node

		const indexVal = index.value
		if (indexVal != null) {
			elementsRef.current[indexVal] = node
			if (labelsRef) {
				const isLabelDefined = label != null
				labelsRef.current[indexVal] = isLabelDefined ? label : (node?.textContent ?? undefined)
			}
		}
	}

	onUpdated(() => {
		triggerRef(componentRef)
	})

	watch(componentRef, (node, __, onCleanup) => {
		if (node) {
			register(node)

			onCleanup(() => {
				unregister(node)
			})
		}
	})

	watch(map, () => {
		const node = componentRef?.value

		const _index = node ? map.value.get(node) : undefined
		if (_index != null) index.value = _index
	})

	return {
		setItem,
		index() {
			return index.value == null ? -1 : index.value
		},
	} as const
}
