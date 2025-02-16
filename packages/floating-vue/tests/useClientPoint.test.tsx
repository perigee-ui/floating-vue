import type { RenderResult } from 'vitest-browser-vue'
import type { PropType } from 'vue'
import type { Coords } from '../src/core/index.ts'

import { userEvent } from '@vitest/browser/context'
import { expect, it } from 'vitest'
import { render } from 'vitest-browser-vue'
import { defineComponent, shallowRef, watchEffect } from 'vue'
import { useClientPoint, useFloating, useInteractions } from '../src/index.ts'
import { act } from './utils.ts'

async function expectLocation(screen: RenderResult<any>, { x, y }: Coords, axis = 'both') {
	await expect.element(screen.getByTestId('x')).toHaveTextContent(`${x}`)
	await expect.element(screen.getByTestId('y')).toHaveTextContent(`${y}`)
	await expect.element(screen.getByTestId('width')).toHaveTextContent(axis === 'y' ? '100' : '0')
	await expect.element(screen.getByTestId('height')).toHaveTextContent(axis === 'x' ? '20' : '0')
}

const App = defineComponent({
	name: 'App',
	props: {
		enabled: {
			type: Boolean,
			default: true,
		},
		point: {
			type: Object,
			default: () => ({}),
		},
		axis: {
			type: String as PropType<'both' | 'x' | 'y'>,
			default: 'both',
		},
	},
	setup(props) {
		const isOpen = shallowRef(false)
		const { refs, elements, context } = useFloating({
			open: isOpen,
			onOpenChange(value) {
				isOpen.value = value
			},
		})
		const clientPoint = useClientPoint(context, {
			enabled: () => props.enabled,
			x: props.point.x !== undefined ? () => props.point.x : undefined,
			y: props.point.y !== undefined ? () => props.point.y : undefined,
			axis: props.axis,
		})
		const { getReferenceProps, getFloatingProps } = useInteractions([clientPoint])

		const rect = shallowRef({ x: 0, y: 0, width: 0, height: 0 })

		watchEffect((onClean) => {
			rect.value = elements.reference.value?.getBoundingClientRect() || rect.value
			elements.domReference.value?.addEventListener('mousemove', update)
			onClean(() => {
				elements.domReference.value?.removeEventListener('mousemove', update)
			})
		})

		async function update() {
			const r = elements.reference.value?.getBoundingClientRect() as DOMRect
			rect.value = r
		}

		return () => (
			<>
				<div
					data-testid="reference"
					ref={(el: any) => refs.setReference(el)}
					{...getReferenceProps()}
					style={{
						width: '100px',
						height: '20px',
					}}
				>
					Reference
				</div>
				{isOpen.value && (
					<div
						data-testid="floating"
						ref={(el: any) => refs.setFloating(el)}
						{...getFloatingProps()}
						style={{
							width: '100px',
							height: '20px',
						}}
					>
						Floating
					</div>
				)}
				<button onClick={() => (isOpen.value = !isOpen.value)}>button</button>
				<div data-testid="x">
					x:
					{rect.value.x}
				</div>
				<div data-testid="y">
					y:
					{rect.value.y}
				</div>
				<div data-testid="width">
					width:
					{rect.value.width}
				</div>
				<div data-testid="height">
					height:
					{rect.value.height}
				</div>
			</>
		)
	},
})

it('renders at explicit client point and can be updated', async () => {
	const screen = render(App, {
		props: {
			point: { x: 0, y: 0 },
		},
	})

	await userEvent.click(screen.getByRole('button'))

	await expectLocation(screen, { x: 0, y: 0 })

	screen.rerender({
		point: { x: 1000, y: 1000 },
	})

	await expectLocation(screen, { x: 1000, y: 1000 })
})

it('renders at mouse event coords', async () => {
	const screen = render(App)

	screen
		.getByTestId('reference')
		.query()
		?.dispatchEvent(
			new MouseEvent('mousemove', {
				bubbles: true,
				clientX: 500,
				clientY: 500,
			}),
		)
	await Promise.resolve()

	await expectLocation(screen, { x: 500, y: 500 })

	screen
		.getByTestId('reference')
		.query()
		?.dispatchEvent(
			new MouseEvent('mousemove', {
				bubbles: true,
				clientX: 1000,
				clientY: 1000,
			}),
		)
	await Promise.resolve()

	await expectLocation(screen, { x: 1000, y: 1000 })

	// Window listener isn't registered unless the floating element is open.
	window.dispatchEvent(
		new MouseEvent('mousemove', {
			bubbles: true,
			clientX: 700,
			clientY: 700,
		}),
	)
	await Promise.resolve()

	await act()

	await expectLocation(screen, { x: 1000, y: 1000 })

	await userEvent.click(screen.getByRole('button'))

	screen
		.getByTestId('reference')
		.query()
		?.dispatchEvent(
			new MouseEvent('mousemove', {
				bubbles: true,
				clientX: 700,
				clientY: 700,
			}),
		)
	await Promise.resolve()

	await expectLocation(screen, { x: 700, y: 700 })

	document.body.dispatchEvent(
		new MouseEvent('mousemove', {
			bubbles: true,
			clientX: 0,
			clientY: 0,
		}),
	)
	await Promise.resolve()

	await expectLocation(screen, { x: 0, y: 0 })
})

it('ignores mouse events when explicit coords are specified', async () => {
	const screen = render(App, {
		props: {
			point: { x: 0, y: 0 },
		},
	})

	screen
		.getByTestId('reference')
		.query()
		?.dispatchEvent(
			new MouseEvent('mousemove', {
				bubbles: true,
				clientX: 500,
				clientY: 500,
			}),
		)
	await Promise.resolve()

	await expectLocation(screen, { x: 0, y: 0 })
})

it('cleans up window listener when closing or disabling', async () => {
	const screen = render(App)

	screen
		.getByRole('button')
		.query()
		?.dispatchEvent(
			new MouseEvent('click', {
				bubbles: true,
			}),
		)
	await Promise.resolve()

	screen
		.getByTestId('reference')
		.query()
		?.dispatchEvent(
			new MouseEvent('mousemove', {
				bubbles: true,
				clientX: 500,
				clientY: 500,
			}),
		)
	await Promise.resolve()

	screen
		.getByRole('button')
		.query()
		?.dispatchEvent(
			new MouseEvent('click', {
				bubbles: true,
			}),
		)
	await Promise.resolve()

	document.body.dispatchEvent(
		new MouseEvent('mousemove', {
			bubbles: true,
			clientX: 0,
			clientY: 0,
		}),
	)
	await Promise.resolve()

	await expectLocation(screen, { x: 500, y: 500 })

	screen
		.getByRole('button')
		.query()
		?.dispatchEvent(
			new MouseEvent('click', {
				bubbles: true,
			}),
		)
	await Promise.resolve()

	document.body.dispatchEvent(
		new MouseEvent('mousemove', {
			bubbles: true,
			clientX: 400,
			clientY: 400,
		}),
	)
	await Promise.resolve()
	await expectLocation(screen, { x: 400, y: 400 })

	screen.rerender({
		enabled: false,
	})
	await Promise.resolve()

	document.body.dispatchEvent(
		new MouseEvent('mousemove', {
			bubbles: true,
			clientX: 0,
			clientY: 0,
		}),
	)
	await Promise.resolve()

	await expectLocation(screen, { x: 400, y: 400 })
})

it('axis x', async () => {
	const screen = render(App, {
		props: {
			axis: 'x',
		},
	})

	screen
		.getByTestId('reference')
		.query()
		?.dispatchEvent(
			new MouseEvent('mousemove', {
				bubbles: true,
				clientX: 500,
				clientY: 500,
			}),
		)
	await Promise.resolve()

	await expectLocation(screen, { x: 500, y: 0 })
})

it('axis y', async () => {
	const screen = render(App, {
		props: {
			axis: 'y',
		},
	})

	screen
		.getByTestId('reference')
		.query()
		?.dispatchEvent(
			new MouseEvent('mousemove', {
				bubbles: true,
				clientX: 500,
				clientY: 500,
			}),
		)
	await Promise.resolve()

	await expectLocation(screen, { x: 0, y: 500 })
})

it('removes window listener when cursor lands on floating element', async () => {
	const screen = render(App)

	await userEvent.click(screen.getByRole('button'))

	screen
		.getByTestId('reference')
		.query()
		?.dispatchEvent(
			new MouseEvent('mousemove', {
				bubbles: true,
				clientX: 500,
				clientY: 500,
			}),
		)
	await Promise.resolve()

	screen
		.getByTestId('floating')
		.query()
		?.dispatchEvent(
			new MouseEvent('mousemove', {
				bubbles: true,
				clientX: 500,
				clientY: 500,
			}),
		)
	await Promise.resolve()

	document.body.dispatchEvent(
		new MouseEvent('mousemove', {
			bubbles: true,
			clientX: 0,
			clientY: 0,
		}),
	)
	await Promise.resolve()
	await expectLocation(screen, { x: 500, y: 500 })
})
