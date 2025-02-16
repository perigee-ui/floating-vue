import type { PropType } from 'vue'
import type { FloatingFocusManagerProps } from '../src/index.ts'
import userEvent from '@testing-library/user-event'
import { cleanup, fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, shallowRef, watchEffect } from 'vue'
import { FloatingFocusManager, useClick, useDismiss, useFloating, useInteractions, useRole } from '../src/index.ts'
import { useRef } from '../src/vue/index.ts'
import { act } from './utils.ts'

const App = defineComponent({
	props: {
		focusProps: {
			type: Object as PropType<
				Partial<
					Omit<FloatingFocusManagerProps, 'initialFocus'> & {
						initialFocus?: 'two' | number
					}
				>
			>,
			default: () => ({}),
		},
	},
	setup(props, { slots }) {
		const ref = useRef<HTMLElement>()
		const open = shallowRef(false)
		const { refs, context } = useFloating({
			open,
			onOpenChange(v) {
				open.value = v
			},
		})

		return () => (
			<>
				<button
					data-testid="reference"
					ref={(el: any) => refs.setReference(el)}
					onClick={() => {
						open.value = !open.value
					}}
				/>
				{open.value && (
					<FloatingFocusManager
						guards={props.focusProps.guards}
						modal={props.focusProps.modal}
						order={props.focusProps.order}
						returnFocus={props.focusProps.returnFocus}
						initialFocus={props.focusProps.initialFocus === 'two' ? ref : props.focusProps.initialFocus}
						getContext={() => context}
					>
						<div role="dialog" ref={(el: any) => refs.setFloating(el)} data-testid="floating">
							<button data-testid="one">close</button>
							<button
								data-testid="two"
								ref={(el: any) => {
									ref.current = el
								}}
							>
								confirm
							</button>
							<button
								data-testid="three"
								onClick={() => {
									open.value = false
								}}
							>
								x
							</button>
							{slots.default?.()}
						</div>
					</FloatingFocusManager>
				)}
				<div tabindex={0} data-testid="last">
					x
				</div>
			</>
		)
	},
})

describe('initialFocus', () => {
	it('number', async () => {
		const { rerender } = render(App)

		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		expect(screen.getByTestId('one')).toHaveFocus()

		await rerender({
			focusProps: {
				initialFocus: 1,
			},
		})
		expect(screen.getByTestId('two')).not.toHaveFocus()

		await rerender({
			focusProps: {
				initialFocus: 2,
			},
		})

		expect(screen.getByTestId('three')).not.toHaveFocus()

		cleanup()
	})

	it('ref', async () => {
		render(App, {
			props: {
				focusProps: {
					initialFocus: 'two',
				},
			},
		})

		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		expect(screen.getByTestId('two')).toHaveFocus()
		cleanup()
	})

	it('respects autoFocus', async () => {
		const App1 = defineComponent({
			setup() {
				const inputRef = shallowRef<HTMLElement>()

				watchEffect(() => {
					if (inputRef.value) inputRef.value.focus()
				})

				return () => (
					<App>
						{{
							default: () => (
								<input ref={(el: any) => (inputRef.value = el)} autofocus="true" data-testid="input" />
							),
						}}
					</App>
				)
			},
		})

		render(App1)

		await fireEvent.click(screen.getByTestId('reference'))
		await act()
		expect(screen.getByTestId('input')).toHaveFocus()
		await act()

		cleanup()
	})
})

describe('returnFocus', () => {
	it('true', async () => {
		const { rerender } = render(App, {
			props: {
				focusProps: {
					returnFocus: true,
				},
			},
		})

		screen.getByTestId('reference').focus()
		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		expect(screen.getByTestId('one')).toHaveFocus()

		await screen.getByTestId('two').focus()
		await act()

		await rerender({
			focusProps: {
				returnFocus: false,
			},
		})

		expect(screen.getByTestId('two')).toHaveFocus()

		await fireEvent.click(screen.getByTestId('three'))
		await act()
		expect(screen.getByTestId('reference')).not.toHaveFocus()

		cleanup()
	})

	it('false', async () => {
		render(App, {
			props: {
				focusProps: {
					returnFocus: false,
				},
			},
		})

		await screen.getByTestId('reference').focus()
		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		expect(screen.getByTestId('one')).toHaveFocus()

		await fireEvent.click(screen.getByTestId('three'))
		expect(screen.getByTestId('reference')).not.toHaveFocus()
		await act()

		cleanup()
	})

	// it.todo('always returns to the reference for nested elements', async () => {})

	it('returns focus to next tabbable element after reference element if removed (modal)', async () => {
		const App = defineComponent({
			setup() {
				const isOpen = shallowRef(false)
				const removed = shallowRef(false)

				const { refs, context } = useFloating({
					open: isOpen,
					onOpenChange(v) {
						isOpen.value = v
					},
				})

				const click = useClick(context)

				const { getReferenceProps, getFloatingProps } = useInteractions([click])

				return () => (
					<>
						{!removed.value && (
							<button
								ref={(el: any) => refs.setReference(el)}
								{...getReferenceProps()}
								data-testid="reference"
							/>
						)}
						{isOpen.value && (
							<FloatingFocusManager getContext={() => context}>
								<div ref={(el: any) => refs.setFloating(el)} {...getFloatingProps()}>
									<button
										data-testid="remove"
										onClick={() => {
											removed.value = true
											isOpen.value = false
										}}
									>
										remove
									</button>
								</div>
							</FloatingFocusManager>
						)}
						<button class="fallback" data-testid="fallback" />
					</>
				)
			},
		})

		render(App)

		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		await fireEvent.click(screen.getByTestId('remove'))
		await act()

		expect(screen.getByTestId('fallback')).toHaveFocus()

		cleanup()
	})

	it('returns focus to next tabbable element after reference element if removed (non-modal)', async () => {
		const App = defineComponent({
			setup() {
				const isOpen = shallowRef(false)
				const removed = shallowRef(false)

				const { refs, context } = useFloating({
					open: isOpen,
					onOpenChange(v) {
						isOpen.value = v
					},
				})

				const click = useClick(context)

				const { getReferenceProps, getFloatingProps } = useInteractions([click])

				return () => (
					<>
						{!removed.value && (
							<button
								ref={(el: any) => refs.setReference(el)}
								{...getReferenceProps()}
								data-testid="reference"
							/>
						)}
						{isOpen.value && (
							<FloatingFocusManager getContext={() => context} modal={false}>
								<div ref={(el: any) => refs.setFloating(el)} {...getFloatingProps()}>
									<button
										data-testid="remove"
										onClick={() => {
											removed.value = true
											isOpen.value = false
										}}
									>
										remove
									</button>
								</div>
							</FloatingFocusManager>
						)}
						<button class="fallback" data-testid="fallback" />
					</>
				)
			},
		})

		render(App)

		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		await fireEvent.click(screen.getByTestId('remove'))
		await act()

		expect(screen.getByTestId('fallback')).toHaveFocus()

		cleanup()
	})
})

describe('guards', () => {
	it('true', async () => {
		render(App, {
			props: {
				focusProps: {
					guards: true,
				},
			},
		})

		await fireEvent.click(screen.getByTestId('reference'))

		await userEvent.tab()
		await userEvent.tab()
		await userEvent.tab()

		expect(document.body).not.toHaveFocus()

		cleanup()
	})

	it('false', async () => {
		render(App, {
			props: {
				focusProps: {
					guards: false,
				},
			},
		})

		await fireEvent.click(screen.getByTestId('reference'))

		await userEvent.tab()
		await userEvent.tab()
		await userEvent.tab()

		expect(document.activeElement).toHaveAttribute('data-floating-ui-inert')
		cleanup()
	})
})

describe('modal', () => {
	it('true', async () => {
		render(App, {
			props: {
				focusProps: {
					modal: true,
				},
			},
		})

		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		await userEvent.tab()
		expect(screen.getByTestId('two')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('three')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('one')).toHaveFocus()

		await userEvent.tab({ shift: true })
		expect(screen.getByTestId('three')).toHaveFocus()

		await userEvent.tab({ shift: true })
		expect(screen.getByTestId('two')).toHaveFocus()

		await userEvent.tab({ shift: true })
		expect(screen.getByTestId('one')).toHaveFocus()

		await userEvent.tab({ shift: true })
		expect(screen.getByTestId('three')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('one')).toHaveFocus()

		cleanup()
	})

	it('false', async () => {
		render(App, {
			props: {
				focusProps: {
					modal: false,
				},
			},
		})

		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		await userEvent.tab()
		expect(screen.getByTestId('two')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('three')).toHaveFocus()

		await userEvent.tab()

		// Wait for the setTimeout that wraps onOpenChange(false).
		await act()
		await act()

		// Focus leaving the floating element closes it.
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

		expect(screen.getByTestId('last')).toHaveFocus()
		cleanup()
	})

	it('false — shift tabbing does not trap focus when reference is in order', async () => {
		render(App, {
			props: {
				focusProps: {
					modal: false,
					order: ['reference', 'content'],
				},
			},
		})

		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		await userEvent.tab()
		await userEvent.tab({ shift: true })
		await userEvent.tab({ shift: true })

		expect(screen.queryByRole('dialog')).toBeInTheDocument()

		cleanup()
	})

	it('true - comboboxes hide all other nodes', async () => {
		const App = defineComponent({
			setup() {
				const open = shallowRef(false)
				const { refs, context } = useFloating({
					open,
					onOpenChange(v) {
						open.value = v
					},
				})

				return () => (
					<>
						<input
							role="combobox"
							data-testid="reference"
							ref={(el: any) => refs.setReference(el)}
							onFocus={() => {
								open.value = true
							}}
						/>
						<button data-testid="btn-1" />
						<button data-testid="btn-2" />
						{open.value && (
							<FloatingFocusManager getContext={() => context} modal={true} order={['reference']}>
								<div role="listbox" ref={(el: any) => refs.setFloating(el)} data-testid="floating" />
							</FloatingFocusManager>
						)}
					</>
				)
			},
		})

		render(App)

		await fireEvent.focus(screen.getByTestId('reference'))
		await act()

		expect(screen.getByTestId('reference')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('btn-1')).toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('btn-2')).toHaveAttribute('aria-hidden')

		cleanup()
	})

	it('false - comboboxes do not hide all other nodes', async () => {
		const App = defineComponent({
			setup() {
				const open = shallowRef(false)
				const { refs, context } = useFloating({
					open,
					onOpenChange(v) {
						open.value = v
					},
				})

				return () => (
					<>
						<input
							role="combobox"
							data-testid="reference"
							ref={(el: any) => refs.setReference(el)}
							onFocus={() => {
								open.value = true
							}}
						/>
						<button data-testid="btn-1" />
						<button data-testid="btn-2" />
						{open.value && (
							<FloatingFocusManager getContext={() => context} modal={false}>
								<div role="listbox" ref={(el: any) => refs.setFloating(el)} data-testid="floating" />
							</FloatingFocusManager>
						)}
					</>
				)
			},
		})

		render(App)

		await fireEvent.focus(screen.getByTestId('reference'))
		await act()

		expect(screen.getByTestId('reference')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('btn-1')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('btn-2')).not.toHaveAttribute('aria-hidden')
		cleanup()
	})

	it('fallback to floating element when it has no tabbable content', async () => {
		const App = defineComponent({
			setup() {
				const { refs, context } = useFloating({
					open: shallowRef(true),
				})

				return () => (
					<>
						<button data-testid="reference" ref={(el: any) => refs.setReference(el)} />
						<FloatingFocusManager getContext={() => context} modal={true}>
							<div ref={(el: any) => refs.setFloating(el)} data-testid="floating" tabindex={-1} />
						</FloatingFocusManager>
					</>
				)
			},
		})

		render(App)
		await act()

		expect(screen.getByTestId('floating')).toHaveFocus()
		await userEvent.tab()
		expect(screen.getByTestId('floating')).toHaveFocus()
		await userEvent.tab({ shift: true })
		expect(screen.getByTestId('floating')).toHaveFocus()

		cleanup()
	})

	it.todo('mixed modality and nesting')

	it('true - applies aria-hidden to outside nodes', async () => {
		const App = defineComponent({
			setup() {
				const isOpen = shallowRef(false)
				const { refs, context } = useFloating({
					open: isOpen,
					onOpenChange(v) {
						isOpen.value = v
					},
				})
				return () => (
					<>
						<input
							data-testid="reference"
							ref={(el: any) => refs.setReference(el)}
							onClick={() => (isOpen.value = !isOpen.value)}
						/>
						<div>
							<div data-testid="aria-live" aria-live="polite" />
							<button data-testid="btn-1" />
							<button data-testid="btn-2" />
						</div>
						{isOpen.value && (
							<FloatingFocusManager getContext={() => context}>
								<div ref={(el: any) => refs.setFloating(el)} data-testid="floating" />
							</FloatingFocusManager>
						)}
					</>
				)
			},
		})

		render(App)

		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		expect(screen.getByTestId('reference')).toHaveAttribute('aria-hidden', 'true')
		expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('aria-live')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('btn-1')).toHaveAttribute('aria-hidden', 'true')
		expect(screen.getByTestId('btn-2')).toHaveAttribute('aria-hidden', 'true')

		await fireEvent.click(screen.getByTestId('reference'))

		expect(screen.getByTestId('reference')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('aria-live')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('btn-1')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('btn-2')).not.toHaveAttribute('aria-hidden')

		cleanup()
	})

	it('false - does not apply aria-hidden to outside nodes', async () => {
		const App = defineComponent({
			setup() {
				const isOpen = shallowRef(false)
				const { refs, context } = useFloating({
					open: isOpen,
					onOpenChange(v) {
						isOpen.value = v
					},
				})
				return () => (
					<>
						<input
							data-testid="reference"
							ref={(el: any) => refs.setReference(el)}
							onClick={() => (isOpen.value = !isOpen.value)}
						/>
						<div>
							<div data-testid="aria-live" aria-live="polite" />
							<div data-testid="original" aria-hidden="false" />
							<button data-testid="btn-1" />
							<button data-testid="btn-2" />
						</div>
						{isOpen.value && (
							<FloatingFocusManager getContext={() => context} modal={false}>
								<div role="listbox" ref={(el: any) => refs.setFloating(el)} data-testid="floating" />
							</FloatingFocusManager>
						)}
					</>
				)
			},
		})
		render(App)

		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('aria-live')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('btn-1')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('btn-2')).not.toHaveAttribute('aria-hidden')
		expect(screen.getByTestId('reference')).toHaveAttribute('data-floating-ui-inert')
		expect(screen.getByTestId('btn-1')).toHaveAttribute('data-floating-ui-inert')
		expect(screen.getByTestId('btn-2')).toHaveAttribute('data-floating-ui-inert')
		expect(screen.getByTestId('original')).toHaveAttribute('data-floating-ui-inert')
		expect(screen.getByTestId('original')).toHaveAttribute('aria-hidden', 'false')

		await fireEvent.click(screen.getByTestId('reference'))

		expect(screen.getByTestId('reference')).not.toHaveAttribute('data-floating-ui-inert')
		expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-floating-ui-inert')
		expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-floating-ui-inert')
		expect(screen.getByTestId('original')).not.toHaveAttribute('data-floating-ui-inert')
		expect(screen.getByTestId('original')).toHaveAttribute('aria-hidden', 'false')

		cleanup()
	})
})

describe('disabled', () => {
	it('true -> false', async () => {
		const App = defineComponent({
			setup() {
				const isOpen = shallowRef(false)
				const disabled = shallowRef(true)

				const { refs, context } = useFloating({
					open: isOpen,
					onOpenChange(v) {
						isOpen.value = v
					},
				})
				return () => (
					<>
						<button
							data-testid="reference"
							ref={refs.setReference as any}
							onClick={() => {
								isOpen.value = !isOpen.value
							}}
						/>
						<button
							data-testid="toggle"
							onClick={() => {
								disabled.value = !disabled.value
							}}
						/>
						{isOpen.value && (
							<FloatingFocusManager getContext={() => context} disabled={disabled.value}>
								<div ref={refs.setFloating as any} data-testid="floating" />
							</FloatingFocusManager>
						)}
					</>
				)
			},
		})

		render(App)

		await fireEvent.click(screen.getByTestId('reference'))
		await act()
		expect(screen.getByTestId('floating')).not.toHaveFocus()
		await fireEvent.click(screen.getByTestId('toggle'))
		await act()
		expect(screen.getByTestId('floating')).toHaveFocus()
		cleanup()
	})

	it('false', async () => {
		const App = defineComponent({
			setup() {
				const isOpen = shallowRef(false)
				const disabled = shallowRef(false)

				const { refs, context } = useFloating({
					open: isOpen,
					onOpenChange(v) {
						isOpen.value = v
					},
				})
				return () => (
					<>
						<button
							data-testid="reference"
							ref={refs.setReference as any}
							onClick={() => {
								isOpen.value = !isOpen.value
							}}
						/>
						<button
							data-testid="toggle"
							onClick={() => {
								disabled.value = !disabled.value
							}}
						/>
						{isOpen.value && (
							<FloatingFocusManager getContext={() => context} disabled={disabled.value}>
								<div ref={refs.setFloating as any} data-testid="floating" />
							</FloatingFocusManager>
						)}
					</>
				)
			},
		})

		render(App)

		await fireEvent.click(screen.getByTestId('reference'))
		await act()
		expect(screen.getByTestId('floating')).toHaveFocus()
		cleanup()
	})
})

describe('order', () => {
	it('[reference, content]', async () => {
		render(App, {
			props: {
				focusProps: {
					order: ['reference', 'content'],
				},
			},
		})

		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		expect(screen.getByTestId('reference')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('one')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('two')).toHaveFocus()
		cleanup()
	})

	it('[floating, content]', async () => {
		render(App, {
			props: {
				focusProps: {
					order: ['floating', 'content'],
				},
			},
		})

		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		expect(screen.getByTestId('floating')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('one')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('two')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('three')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('floating')).toHaveFocus()

		await userEvent.tab({ shift: true })
		expect(screen.getByTestId('three')).toHaveFocus()

		await userEvent.tab({ shift: true })
		expect(screen.getByTestId('two')).toHaveFocus()

		await userEvent.tab({ shift: true })
		expect(screen.getByTestId('one')).toHaveFocus()

		await userEvent.tab({ shift: true })
		expect(screen.getByTestId('floating')).toHaveFocus()
		cleanup()
	})

	it('[reference, floating, content]', async () => {
		render(App, {
			props: {
				focusProps: {
					order: ['reference', 'floating', 'content'],
				},
			},
		})

		await fireEvent.click(screen.getByTestId('reference'))
		await act()

		expect(screen.getByTestId('reference')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('floating')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('one')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('two')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('three')).toHaveFocus()

		await userEvent.tab()
		expect(screen.getByTestId('reference')).toHaveFocus()

		await userEvent.tab({ shift: true })
		expect(screen.getByTestId('three')).toHaveFocus()

		await userEvent.tab({ shift: true })
		await userEvent.tab({ shift: true })
		await userEvent.tab({ shift: true })
		await userEvent.tab({ shift: true })

		expect(screen.getByTestId('reference')).toHaveFocus()
		cleanup()
	})
})

describe.todo('non-modal + FloatingPortal')

describe.todo('navigation')

describe.todo('drawer')

describe('restoreFocus', () => {
	const App = defineComponent({
		props: {
			restoreFocus: {
				type: Boolean,
				default: true,
			},
		},
		setup(props) {
			const isOpen = shallowRef(false)
			const removedIndex = shallowRef(0)

			const { refs, context } = useFloating({
				open: isOpen,
				onOpenChange(v) {
					isOpen.value = v
				},
			})

			const click = useClick(context)

			const { getReferenceProps, getFloatingProps } = useInteractions([click])

			return () => (
				<>
					<button ref={refs.setReference as any} {...getReferenceProps()} data-testid="reference" />
					{isOpen.value && (
						<FloatingFocusManager
							getContext={() => context}
							initialFocus={1}
							restoreFocus={props.restoreFocus}
						>
							<div ref={refs.setFloating as any} {...getFloatingProps()} data-testid="floating">
								{removedIndex.value < 3 && (
									<button
										onClick={() => {
											removedIndex.value = removedIndex.value + 1
										}}
									>
										three
									</button>
								)}
								{removedIndex.value < 1 && (
									<button
										onClick={() => {
											removedIndex.value = removedIndex.value + 1
										}}
									>
										one
									</button>
								)}
								{removedIndex.value < 2 && (
									<button
										onClick={() => {
											removedIndex.value = removedIndex.value + 1
										}}
									>
										two
									</button>
								)}
							</div>
						</FloatingFocusManager>
					)}
				</>
			)
		},
	})

	it('true: restores focus to nearest tabbable element if currently focused element is removed', async () => {
		render(App)

		await userEvent.click(screen.getByTestId('reference'))
		await act()

		const one = screen.getByRole('button', { name: 'one' })
		const two = screen.getByRole('button', { name: 'two' })
		const three = screen.getByRole('button', { name: 'three' })
		const floating = screen.getByTestId('floating')

		expect(one).toHaveFocus()
		await fireEvent.click(one)
		await fireEvent.focusOut(floating)

		await act()

		expect(two).toHaveFocus()
		await fireEvent.click(two)
		await fireEvent.focusOut(floating)

		await act()

		expect(three).toHaveFocus()
		await fireEvent.click(three)
		await fireEvent.focusOut(floating)

		await act()

		expect(floating).toHaveFocus()
		cleanup()
	})

	it('false: does not restore focus to nearest tabbable element if currently focused element is removed', async () => {
		render(App, {
			props: {
				restoreFocus: false,
			},
		})

		await userEvent.click(screen.getByTestId('reference'))
		await act()

		const one = screen.getByRole('button', { name: 'one' })
		const floating = screen.getByTestId('floating')

		expect(one).toHaveFocus()
		await fireEvent.click(one)
		await fireEvent.focusOut(floating)

		await act()

		expect(document.body).toHaveFocus()
		cleanup()
	})
})

it('trapped combobox prevents focus moving outside floating element', async () => {
	const App = defineComponent({
		setup() {
			const isOpen = shallowRef(false)
			const { refs, floatingStyles, context } = useFloating({
				open: isOpen,
				onOpenChange(v) {
					isOpen.value = v
				},
			})

			const role = useRole(context)
			const dismiss = useDismiss(context)
			const click = useClick(context)

			const { getReferenceProps, getFloatingProps } = useInteractions([role, dismiss, click])

			return () => (
				<div class="App">
					<input
						ref={refs.setReference as any}
						{...getReferenceProps()}
						data-testid="input"
						role="combobox"
					/>
					{isOpen.value && (
						<FloatingFocusManager getContext={() => context}>
							<div ref={refs.setFloating as any} style={floatingStyles.value} {...getFloatingProps()}>
								<button>one</button>
								<button>two</button>
							</div>
						</FloatingFocusManager>
					)}
				</div>
			)
		},
	})

	render(App)
	await userEvent.click(screen.getByTestId('input'))
	await act()
	expect(screen.getByTestId('input')).not.toHaveFocus()
	expect(screen.getByRole('button', { name: 'one' })).toHaveFocus()
	await userEvent.tab()
	expect(screen.getByRole('button', { name: 'two' })).toHaveFocus()
	await userEvent.tab()
	expect(screen.getByRole('button', { name: 'one' })).toHaveFocus()
	cleanup()
})

it.todo('untrapped combobox creates non-modal focus management')

it.todo('returns focus to last connected element')

it('focus is placed on element with floating props when floating element is a wrapper', async () => {
	const App = defineComponent({
		setup() {
			const isOpen = shallowRef(false)

			const { refs, context } = useFloating({
				open: isOpen,
				onOpenChange(v) {
					isOpen.value = v
				},
			})

			const role = useRole(context)

			const { getReferenceProps, getFloatingProps } = useInteractions([role])

			return () => (
				<>
					<button
						ref={refs.setReference as any}
						{...getReferenceProps({
							onClick: () => {
								isOpen.value = !isOpen.value
							},
						})}
					/>
					{isOpen.value && (
						<FloatingFocusManager getContext={() => context}>
							<div ref={refs.setFloating as any} data-testid="outer">
								<div {...getFloatingProps()} data-testid="inner"></div>
							</div>
						</FloatingFocusManager>
					)}
				</>
			)
		},
	})

	render(App)

	await userEvent.click(screen.getByRole('button'))
	await act()

	expect(screen.getByTestId('inner')).toHaveFocus()
	cleanup()
})

it('floating element closes upon tabbing out of modal combobox', async () => {
	const App = defineComponent({
		setup() {
			const isOpen = shallowRef(false)
			const { refs, context } = useFloating({
				open: isOpen,
				onOpenChange(v) {
					isOpen.value = v
				},
			})

			const click = useClick(context)

			const { getReferenceProps, getFloatingProps } = useInteractions([click])

			return () => (
				<>
					<input
						ref={refs.setReference as any}
						{...getReferenceProps()}
						data-testid="input"
						role="combobox"
					/>
					{isOpen.value && (
						<FloatingFocusManager getContext={() => context} initialFocus={-1}>
							<div ref={refs.setFloating as any} {...getFloatingProps()} data-testid="floating">
								<button tabindex={-1}>one</button>
							</div>
						</FloatingFocusManager>
					)}
					<button data-testid="after" />
				</>
			)
		},
	})

	render(<App />)
	await userEvent.click(screen.getByTestId('input'))
	await act()
	expect(screen.getByTestId('input')).toHaveFocus()
	await userEvent.tab()
	await act()
	expect(screen.getByTestId('after')).toHaveFocus()

	cleanup()
})
