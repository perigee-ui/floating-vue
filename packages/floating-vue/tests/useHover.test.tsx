import type { PropType } from 'vue'
import type { UseHoverProps } from '../src/index.ts'
import { userEvent } from '@vitest/browser/context'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-vue'
import { defineComponent, shallowRef } from 'vue'
import { useFloating, useHover, useInteractions } from '../src/index.ts'

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

const App = defineComponent({
	props: {
		showReference: {
			type: Boolean,
			default: true,
		},
		hoverProps: {
			type: Object as PropType<UseHoverProps>,
			default: undefined,
		},
	},
	setup(props) {
		const open = shallowRef(false)
		const { refs, context } = useFloating({
			open,
			onOpenChange(value) {
				open.value = value
			},
		})
		const { getReferenceProps, getFloatingProps } = useInteractions([useHover(context, props.hoverProps)])

		return () => (
			<>
				{props.showReference && (
					<button type="button" ref={(el: any) => refs.setReference(el)} {...getReferenceProps()}>
						button
					</button>
				)}
				{open.value && (
					<div role="tooltip" ref={(el: any) => refs.setFloating(el)} {...getFloatingProps()}>
						tooltip
					</div>
				)}
			</>
		)
	},
})

it('opens on mouseenter', async () => {
	const screen = render(App)

	await userEvent.hover(screen.getByRole('button'))

	await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
})

it('closes on mouseleave', async () => {
	const screen = render(App)

	await userEvent.hover(screen.getByRole('button'))
	await userEvent.unhover(screen.getByRole('button'))

	await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
})

describe('delay', () => {
	it('symmetric number', async () => {
		const screen = render(App, {
			props: {
				hoverProps: {
					delay: 1000,
				},
			},
		})

		await userEvent.hover(screen.getByRole('button'))
		vi.advanceTimersByTime(999)
		await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()

		vi.advanceTimersByTime(1)
		await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
	})

	it('open', async () => {
		const screen = render(App, {
			props: {
				hoverProps: {
					delay: {
						open: 500,
					},
				},
			},
		})

		await userEvent.hover(screen.getByRole('button'))

		vi.advanceTimersByTime(499)

		await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()

		vi.advanceTimersByTime(1)

		await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
	})

	it('close', async () => {
		const screen = render(App, {
			props: {
				hoverProps: {
					delay: {
						close: 500,
					},
				},
			},
		})

		await userEvent.hover(screen.getByRole('button'))
		await userEvent.unhover(screen.getByRole('button'))

		vi.advanceTimersByTime(499)

		await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()

		vi.advanceTimersByTime(1)

		await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
	})

	it('open with close 0', async () => {
		const screen = render(App, {
			props: {
				hoverProps: {
					delay: {
						open: 500,
					},
				},
			},
		})

		await userEvent.hover(screen.getByRole('button'))

		vi.advanceTimersByTime(499)

		await userEvent.unhover(screen.getByRole('button'))

		vi.advanceTimersByTime(1)

		await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
	})

	it('restMs + nullish open delay should respect restMs', async () => {
		const screen = render(App, {
			props: {
				hoverProps: {
					delay: {
						close: 100,
					},
					restMs: 100,
				},
			},
		})

		await userEvent.hover(screen.getByRole('button'))

		vi.advanceTimersByTime(99)

		await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
	})
})

it('restMs', async () => {
	const screen = render(App, {
		props: {
			hoverProps: {
				restMs: 100,
			},
		},
	})

	const button = screen.getByRole('button').query()!

	const originalDispatchEvent = button.dispatchEvent
	const spy = vi.spyOn(button, 'dispatchEvent').mockImplementation((event) => {
		Object.defineProperty(event, 'movementX', { value: 10 })
		Object.defineProperty(event, 'movementY', { value: 10 })
		return originalDispatchEvent.call(button, event)
	})

	button.dispatchEvent(
		new MouseEvent('mouseenter', {
			bubbles: true,
			cancelable: true,
		}),
	)
	await Promise.resolve()
	button.dispatchEvent(
		new MouseEvent('mousemove', {
			bubbles: true,
			cancelable: true,
		}),
	)
	await Promise.resolve()

	vi.advanceTimersByTime(99)

	button.dispatchEvent(
		new MouseEvent('mousemove', {
			bubbles: true,
			cancelable: true,
		}),
	)
	await Promise.resolve()

	vi.advanceTimersByTime(1)

	await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()

	button.dispatchEvent(
		new MouseEvent('mousemove', {
			bubbles: true,
			cancelable: true,
		}),
	)
	await Promise.resolve()

	vi.advanceTimersByTime(100)

	await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()

	spy.mockRestore()
})

it('restMs is always 0 for touch input', async () => {
	const screen = render(App, {
		props: {
			hoverProps: {
				restMs: 1000,
			},
		},
	})

	const button = screen.getByRole('button').query()!

	button.dispatchEvent(
		new PointerEvent('pointerdown', {
			bubbles: true,
			cancelable: true,
			pointerType: 'touch',
		}),
	)
	await Promise.resolve()

	button.dispatchEvent(
		new MouseEvent('mouseenter', {
			bubbles: true,
			cancelable: true,
		}),
	)
	await Promise.resolve()
	button.dispatchEvent(
		new MouseEvent('mousemove', {
			bubbles: true,
			cancelable: true,
		}),
	)
	await Promise.resolve()

	await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
})

it('restMs does not cause floating element to open if mouseOnly is true', async () => {
	const screen = render(App, {
		props: {
			hoverProps: {
				restMs: 100,
				mouseOnly: true,
			},
		},
	})

	const button = screen.getByRole('button').query()!

	button.dispatchEvent(
		new PointerEvent('pointerdown', {
			bubbles: true,
			cancelable: true,
			pointerType: 'touch',
		}),
	)
	await Promise.resolve()

	button.dispatchEvent(
		new MouseEvent('mouseenter', {
			bubbles: true,
			cancelable: true,
		}),
	)
	await Promise.resolve()
	button.dispatchEvent(
		new MouseEvent('mousemove', {
			bubbles: true,
			cancelable: true,
		}),
	)
	await Promise.resolve()

	await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
})

it('restMs does not reset timer for minor mouse movement', async () => {
	const screen = render(App, {
		props: {
			hoverProps: {
				restMs: 100,
			},
		},
	})

	const button = screen.getByRole('button').query()!

	const originalDispatchEvent = button.dispatchEvent
	const spy = vi.spyOn(button, 'dispatchEvent').mockImplementation((event) => {
		Object.defineProperty(event, 'movementX', { value: 1 })
		Object.defineProperty(event, 'movementY', { value: 0 })
		return originalDispatchEvent.call(button, event)
	})

	button.dispatchEvent(
		new MouseEvent('mouseenter', {
			bubbles: true,
			cancelable: true,
		}),
	)
	await Promise.resolve()
	button.dispatchEvent(
		new MouseEvent('mousemove', {
			bubbles: true,
			cancelable: true,
		}),
	)
	await Promise.resolve()

	vi.advanceTimersByTime(99)

	button.dispatchEvent(
		new MouseEvent('mousemove', {
			bubbles: true,
			cancelable: true,
		}),
	)
	await Promise.resolve()
	vi.advanceTimersByTime(1)

	await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()

	spy.mockRestore()
})

it('mouseleave on the floating element closes it (mouse)', async () => {
	const screen = render(App)

	await userEvent.hover(screen.getByRole('button'))

	const tooltip = screen.getByRole('button').query()!

	tooltip.dispatchEvent(
		new MouseEvent('mouseleave', {
			bubbles: true,
			cancelable: true,
		}),
	)
	await Promise.resolve()

	await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
})

it('does not show after delay if domReference changes', async () => {
	const screen = render(App, {
		props: {
			hoverProps: {
				delay: 1000,
			},
			showReference: true,
		},
	})

	await userEvent.hover(screen.getByRole('button'))

	vi.advanceTimersByTime(1)

	screen.rerender({
		showReference: false,
	})
	await Promise.resolve()

	vi.advanceTimersByTime(999)

	await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
})

it('reason string', async () => {
	const App = defineComponent({
		setup() {
			const open = shallowRef(false)
			const { refs, context } = useFloating({
				open,
				onOpenChange(value, _, reason) {
					open.value = value
					expect(reason).toBe('hover')
				},
			})
			const hover = useHover(context)
			const { getReferenceProps, getFloatingProps } = useInteractions([hover])

			return () => (
				<>
					<button ref={(el: any) => refs.setReference(el)} {...getReferenceProps()} />
					{open.value && (
						<div role="tooltip" ref={(el: any) => refs.setFloating(el)} {...getFloatingProps()} />
					)}
				</>
			)
		},
	})

	const screen = render(App)
	const button = screen.getByRole('button')
	await userEvent.hover(button)
	await userEvent.unhover(button)
})
