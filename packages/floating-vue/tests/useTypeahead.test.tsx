import type { PropType, Ref } from 'vue'
import type { UseTypeaheadProps } from '../src/index.ts'
import type { ElAttrs } from '../src/types.ts'

import type { MutableRefObject } from '../src/vue/index.ts'
import { userEvent } from '@vitest/browser/context'
import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-vue'

import { defineComponent, shallowRef } from 'vue'
import { useClick, useFloating, useInteractions, useTypeahead } from '../src/index.ts'
import { useRef } from '../src/vue/index.ts'
// import { Main } from '../visual/components/Menu'

vi.useFakeTimers({ shouldAdvanceTime: true })

function useImpl(
	props: Pick<UseTypeaheadProps, 'onMatch' | 'onTypingChange'> & {
		list?: MutableRefObject<Array<string>>
		open?: Ref<boolean>
		onOpenChange?: (open: boolean) => void
		addUseClick?: boolean
	},
) {
	const open = props.open ?? shallowRef(true)

	const activeIndex = shallowRef<number>()
	const { refs, context } = useFloating({
		open,
		onOpenChange:
			props?.onOpenChange ||
			((v: boolean) => {
				open.value = v
			}),
	})
	const list = props?.list ?? useRef(['one', 'two', 'three'])
	const typeahead = useTypeahead(context, {
		listRef: list,
		activeIndex,
		onMatch(index) {
			activeIndex.value = index
			props?.onMatch?.(index)
		},
		onTypingChange: props?.onTypingChange,
	})
	const click = useClick(context, {
		enabled: props?.addUseClick ?? false,
	})

	const { getReferenceProps, getFloatingProps } = useInteractions([typeahead, click])

	return {
		activeIndex,
		open,
		getReferenceProps: (userProps?: ElAttrs) =>
			getReferenceProps({
				role: 'combobox',
				...userProps,
				ref: refs.setReference,
			}),
		getFloatingProps: () =>
			getFloatingProps({
				role: 'listbox',
				ref: refs.setFloating,
			}),
	}
}

const Combobox = defineComponent({
	props: {
		typeahead: {
			type: Object as PropType<
				Pick<UseTypeaheadProps, 'onMatch' | 'onTypingChange'> & { list?: MutableRefObject<Array<string>> }
			>,
			required: true,
		},
	},
	setup(props) {
		const { getReferenceProps, getFloatingProps } = useImpl(props.typeahead)

		return () => (
			<>
				<input {...getReferenceProps()} />
				<div {...getFloatingProps()} />
			</>
		)
	},
})

const Select = defineComponent({
	props: {
		typeahead: {
			type: Object as PropType<
				Pick<UseTypeaheadProps, 'onMatch' | 'onTypingChange'> & { list?: MutableRefObject<Array<string>> }
			>,
			required: true,
		},
	},
	setup(props) {
		const isOpen = shallowRef(false)
		const { getReferenceProps, getFloatingProps } = useImpl({
			onMatch: props.typeahead.onMatch,
			open: isOpen,
			onOpenChange(v) {
				isOpen.value = v
			},
			addUseClick: true,
		})

		return () => (
			<>
				<button tabindex={0} type="button" {...getReferenceProps()}>
					Reference
				</button>
				{isOpen.value && <div {...getFloatingProps()}>Floating</div>}
			</>
		)
	},
})

it('rapidly focuses list items when they start with the same letter', async () => {
	const spy = vi.fn()
	const screen = render(Combobox, {
		props: {
			typeahead: {
				onMatch: spy,
			},
		},
	})

	await userEvent.click(screen.getByRole('combobox'))

	await userEvent.keyboard('t')
	expect(spy).toHaveBeenCalledWith(1)

	await userEvent.keyboard('t')
	expect(spy).toHaveBeenCalledWith(2)

	await userEvent.keyboard('t')
	expect(spy).toHaveBeenCalledWith(1)
})

it('bails out of rapid focus of first letter if the list contains a string that starts with two of the same letter', async () => {
	const spy = vi.fn()
	const screen = render(Combobox, {
		props: {
			typeahead: {
				onMatch: spy,
				list: useRef(['apple', 'aaron', 'apricot']),
			},
		},
	})

	await userEvent.click(screen.getByRole('combobox'))

	await userEvent.keyboard('a')
	expect(spy).toHaveBeenCalledWith(0)

	await userEvent.keyboard('a')
	expect(spy).toHaveBeenCalledWith(0)
})

it('starts from the current activeIndex and correctly loops', async () => {
	const spy = vi.fn()

	const screen = render(Combobox, {
		props: {
			typeahead: {
				onMatch: spy,
				list: useRef(['Toy Story 2', 'Toy Story 3', 'Toy Story 4']),
			},
		},
	})

	await userEvent.click(screen.getByRole('combobox'))

	await userEvent.keyboard('t')
	await userEvent.keyboard('o')
	await userEvent.keyboard('y')
	expect(spy).toHaveBeenCalledWith(0)

	spy.mockReset()

	await userEvent.keyboard('t')
	await userEvent.keyboard('o')
	await userEvent.keyboard('y')
	expect(spy).not.toHaveBeenCalled()

	vi.advanceTimersByTime(750)

	await userEvent.keyboard('t')
	await userEvent.keyboard('o')
	await userEvent.keyboard('y')
	expect(spy).toHaveBeenCalledWith(1)

	vi.advanceTimersByTime(750)

	await userEvent.keyboard('t')
	await userEvent.keyboard('o')
	await userEvent.keyboard('y')
	expect(spy).toHaveBeenCalledWith(2)

	vi.advanceTimersByTime(750)

	await userEvent.keyboard('t')
	await userEvent.keyboard('o')
	await userEvent.keyboard('y')
	expect(spy).toHaveBeenCalledWith(0)
})

it('capslock characters continue to match', async () => {
	const spy = vi.fn()
	const screen = render(Combobox, {
		props: {
			typeahead: {
				onMatch: spy,
			},
		},
	})

	await userEvent.click(screen.getByRole('combobox'))

	await userEvent.keyboard('{CapsLock}t')
	expect(spy).toHaveBeenCalledWith(1)
})

const App1 = defineComponent({
	props: {
		typeahead: {
			type: Object as PropType<Pick<UseTypeaheadProps, 'onMatch'> & { list: MutableRefObject<Array<string>> }>,
			required: true,
		},
	},
	setup(props) {
		const { getReferenceProps, getFloatingProps, activeIndex, open } = useImpl(props.typeahead)
		let inputRef: HTMLInputElement | undefined
		const list = props.typeahead.list

		return () => (
			<>
				<div
					{...getReferenceProps({
						onClick: () => inputRef?.focus(),
					})}
				>
					<input ref={(el: any) => (inputRef = el)} readonly={true} />
				</div>
				{open.value && (
					<div {...getFloatingProps()}>
						{list.current.map((value, i) => (
							<div
								key={value}
								role="option"
								tabindex={i === activeIndex.value ? 0 : -1}
								aria-selected={i === activeIndex.value}
							>
								{value}
							</div>
						))}
					</div>
				)}
			</>
		)
	},
})

it('matches when focus is withing reference', async () => {
	const spy = vi.fn()
	const screen = render(App1, {
		props: {
			typeahead: {
				onMatch: spy,
				list: useRef(['one', 'two', 'three']),
			},
		},
	})

	await userEvent.click(screen.getByRole('combobox'))

	await userEvent.keyboard('t')
	expect(spy).toHaveBeenCalledWith(1)
})

it('matches when focus is withing floating', async () => {
	const spy = vi.fn()
	const screen = render(App1, {
		props: {
			typeahead: {
				onMatch: spy,
				list: useRef(['one', 'two', 'three']),
			},
		},
	})

	await userEvent.click(screen.getByRole('combobox'))
	await userEvent.keyboard('t')
	const option = screen.getByRole('option', { selected: true })
	await expect.element(option).toHaveTextContent('two')
	;(option.element() as any).focus()
	await expect.element(option).toHaveFocus()

	await userEvent.keyboard('h')
	await expect.element(screen.getByRole('option', { selected: true })).toHaveTextContent('three')
})

it('onTypingChange is called when typing starts or stops', async () => {
	const spy = vi.fn()
	const screen = render(Combobox, {
		props: {
			typeahead: {
				onTypingChange: spy,
				list: useRef(['one', 'two', 'three']),
			},
		},
	})
	;(screen.getByRole('combobox').element() as any).focus()

	await userEvent.keyboard('t')
	expect(spy).toHaveBeenCalledTimes(1)
	expect(spy).toHaveBeenCalledWith(true)

	vi.advanceTimersByTime(750)
	expect(spy).toHaveBeenCalledTimes(2)
	expect(spy).toHaveBeenCalledWith(false)
})

// TODO: test Menu component

it('typing spaces on <div> references does not open the menu', async () => {
	const spy = vi.fn()
	const screen = render(Select, {
		props: {
			typeahead: {
				onMatch: spy,
			},
		},
	})
	vi.useFakeTimers({ shouldAdvanceTime: true })

	expect(1).toBe(1)
	await userEvent.click(screen.getByRole('combobox'))
	await expect.element(screen.getByRole('listbox')).toBeInTheDocument()

	await userEvent.keyboard('h')
	await userEvent.keyboard(' ')

	await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument()

	vi.advanceTimersByTime(750)

	await userEvent.keyboard(' ')

	await expect.element(screen.getByRole('listbox')).toBeInTheDocument()
})
