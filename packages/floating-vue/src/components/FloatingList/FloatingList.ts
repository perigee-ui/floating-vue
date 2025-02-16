import type { Ref } from 'vue'
import type { MutableRefObject } from '../../vue/index.ts'
import { shallowRef, triggerRef, watchEffect } from 'vue'
import { createContext } from '../../vue/index.ts'

export interface FloatingListProps {
	/**
	 * A ref to the list of HTML elements, ordered by their index.
	 * `useListNavigation`'s `listRef` prop.
	 */
	elementsRef: MutableRefObject<Array<HTMLElement | undefined>>
	/**
	 * A ref to the list of element labels, ordered by their index.
	 * `useTypeahead`'s `listRef` prop.
	 */
	labelsRef?: MutableRefObject<Array<string | undefined>>
}

export interface FloatingListContext {
	register: (node: Node) => void
	unregister: (node: Node) => void
	map: Ref<Map<Node, number | undefined>>
	elementsRef: MutableRefObject<Array<HTMLElement | undefined>>
	labelsRef?: MutableRefObject<Array<string | undefined>>
}

export const [provideFloatingListContet, useFloatingListContet] = createContext<FloatingListContext>('FloatingContext')

export function useFloatingList(props: FloatingListProps): void {
	const { elementsRef, labelsRef } = props

	const map = shallowRef<Map<Node, number | undefined>>(new Map())

	function register(node: Node) {
		map.value.set(node, undefined)
		triggerRef(map)
	}

	function unregister(node: Node) {
		map.value.delete(node)
		triggerRef(map)
	}

	watchEffect(() => {
		const newMap = new Map(map.value)
		const nodes = Array.from(newMap.keys()).sort(sortByDocumentPosition)

		nodes.forEach((node, index) => {
			newMap.set(node, index)
		})

		if (!areMapsEqual(map.value, newMap)) map.value = newMap
	})

	provideFloatingListContet({
		register,
		unregister,
		map,
		elementsRef,
		labelsRef,
	})
}

function sortByDocumentPosition(a: Node, b: Node) {
	const position = a.compareDocumentPosition(b)

	if (position & Node.DOCUMENT_POSITION_FOLLOWING || position & Node.DOCUMENT_POSITION_CONTAINED_BY) return -1

	if (position & Node.DOCUMENT_POSITION_PRECEDING || position & Node.DOCUMENT_POSITION_CONTAINS) return 1

	return 0
}

function areMapsEqual(map1: Map<Node, number | undefined>, map2: Map<Node, number | undefined>) {
	if (map1.size !== map2.size) return false

	for (const [key, value] of map1.entries()) {
		if (value !== map2.get(key)) return false
	}

	return true
}
