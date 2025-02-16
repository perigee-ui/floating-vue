import type { PropType, Ref } from 'vue'
import { cleanup, fireEvent, render, screen } from '@testing-library/vue'
import { expect, it } from 'vitest'
import { defineComponent, shallowRef } from 'vue'
import {
	useClick,
	useFloating,
	useFloatingList,
	useInteractions,
	useListItem,
	useListNavigation,
	useTypeahead,
} from '../src/index.ts'
import { createContext, useRef } from '../src/vue/index.ts'
import { act } from './utils.ts'

const [provideSelectContext, useSelectContext] = createContext<{
	getItemProps: (paylaod?: any) => Record<string, any>
	activeIndex: Ref<number | undefined>
}>('FloatingListContext')

const Select = defineComponent({
	setup(_, { slots }) {
		const isOpen = shallowRef(false)
		const activeIndex = shallowRef<number>()

		const { refs, context } = useFloating({
			open: isOpen,
			onOpenChange(v) {
				isOpen.value = v
			},
		})

		const elementsRef = useRef<Array<HTMLElement | undefined>>([])
		const labelsRef = useRef<Array<string | undefined>>([])

		const click = useClick(context)
		const listNavigation = useListNavigation(context, {
			listRef: elementsRef,
			activeIndex,
			onNavigate(index) {
				activeIndex.value = index
			},
		})
		const typeahead = useTypeahead(context, {
			listRef: labelsRef,
			activeIndex,
			onMatch(index) {
				activeIndex.value = index
			},
		})

		const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
			click,
			listNavigation,
			typeahead,
		])

		useFloatingList({ elementsRef, labelsRef })

		provideSelectContext({ getItemProps, activeIndex })

		return () => (
			<div>
				<button ref={refs.setReference as any} {...getReferenceProps()}>
					Open select menu
				</button>
				{isOpen.value && (
					<div ref={refs.setFloating as any} role="listbox" {...getFloatingProps()}>
						{slots.default?.()}
					</div>
				)}
			</div>
		)
	},
})

const Option = defineComponent({
	props: {
		label: {
			type: String,
			required: false,
		},
	},
	setup(props, { slots }) {
		const ctx = useSelectContext()

		const { setItem, index } = useListItem({ label: props.label })

		function isActive() {
			const indexVal = index()
			return indexVal === ctx.activeIndex.value && indexVal != null
		}
		return () => (
			<div
				ref={setItem as any}
				role="option"
				aria-selected={isActive()}
				tabindex={isActive() ? 0 : -1}
				{...ctx.getItemProps()}
			>
				{slots.default?.()}
			</div>
		)
	},
})

it('registers element ref and indexes correctly', async () => {
	render(
		<Select>
			<Option>One</Option>
			<div>
				<Option>Two</Option>
				<Option>Three</Option>
				<Option>Four</Option>
			</div>
			<>
				<Option>Five</Option>
				<Option>Six</Option>
			</>
		</Select>,
	)
	await fireEvent.click(screen.getByRole('button'))
	await act()
	expect(screen.getAllByRole('option')[0]).toHaveFocus()

	await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' })

	expect(screen.getAllByRole('option')[1]).toHaveFocus()

	await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' })

	expect(screen.getAllByRole('option')[2]).toHaveFocus()

	await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' })
	await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' })

	expect(screen.getAllByRole('option')[4]).toHaveFocus()
	expect(screen.getAllByRole('option')[4]!.getAttribute('tabindex')).toBe('0')

	cleanup()
})

it('registers an element ref and index correctly', async () => {
	render(
		<Select>
			<Option>One</Option>
		</Select>,
	)

	await fireEvent.click(screen.getByRole('button'))
	await act()

	expect(screen.getAllByRole('option')[0]).toHaveFocus()
	cleanup()
})

it('registers strings correctly (no value)', async () => {
	render(
		<Select>
			<Option>One</Option>
			<div>
				<Option>Two</Option>
				<Option>Three</Option>
				<Option>Four</Option>
			</div>
			<>
				<Option>Five</Option>
				<Option>Six</Option>
			</>
		</Select>,
	)

	await fireEvent.click(screen.getByRole('button'))
	await act()

	expect(screen.getAllByRole('option')[0]).toHaveFocus()

	await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'F' })

	expect(screen.getAllByRole('option')[3]).toHaveFocus()

	await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'I' })

	expect(screen.getAllByRole('option')[4]).toHaveFocus()
	cleanup()
})

it('registers strings correctly (label)', async () => {
	render(
		<Select>
			<Option label="One">One</Option>
			<div>
				<Option label="Two">Two</Option>
				<Option label="Three">Three</Option>
				<Option label="Four">Four</Option>
			</div>
			<>
				<Option label="Five">Five</Option>
				<Option label="Six">Six</Option>
			</>
		</Select>,
	)

	await fireEvent.click(screen.getByRole('button'))
	await act()

	expect(screen.getAllByRole('option')[0]).toHaveFocus()

	await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'F' })

	expect(screen.getAllByRole('option')[3]).toHaveFocus()

	await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'I' })

	expect(screen.getAllByRole('option')[4]).toHaveFocus()
	cleanup()
})

it('handles re-ordering', async () => {
	const App = defineComponent({
		props: {
			list: {
				type: Array as PropType<Array<string>>,
				required: true,
			},
		},
		setup(props) {
			return () => (
				<Select>
					<Option>One</Option>
					<div>
						<Option>Two</Option>
						<Option>Three</Option>
						<Option>Four</Option>
					</div>

					{props.list.map((label) => (
						<Option key={label}>{label}</Option>
					))}
				</Select>
			)
		},
	})

	const { rerender } = render(App, {
		props: {
			list: ['Five', 'Six'],
		},
	})

	await fireEvent.click(screen.getByRole('button'))
	await act()

	expect(screen.getAllByRole('option')[0]).toHaveFocus()

	await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' })

	expect(screen.getAllByRole('option')[1]).toHaveFocus()

	await rerender({
		list: ['Six', 'Five'],
	})

	await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' })
	await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' })
	await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' })
	await fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' })

	expect(screen.getAllByRole('option')[5]).toHaveFocus()
	cleanup()
})
