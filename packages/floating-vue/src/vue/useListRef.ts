import type { MutableRefObject } from './useRef.ts'
import { EMPTY_OBJ } from '@vue/shared'
import { getCurrentInstance } from 'vue'
import { useRef } from './useRef.ts'

export function useListRef<T = HTMLElement, Keys extends string = string>(key: Keys): MutableRefObject<Array<T>> {
	const i = getCurrentInstance()
	const r = useRef<T[]>([])
	if (i) {
		const iRefs = i.refs === EMPTY_OBJ ? (i.refs = {}) : i.refs
		Object.defineProperty(iRefs, key, {
			enumerable: true,
			get: () => {
				return r.current
			},
			set: (val) => {
				r.current = val
			},
		})
	}
	return r
}
