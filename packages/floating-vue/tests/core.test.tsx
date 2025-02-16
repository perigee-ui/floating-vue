import { userEvent } from '@vitest/browser/context'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-vue'

import { defineComponent, onMounted, shallowRef, watchEffect } from 'vue'

import { arrow, flip, hide, limitShift, offset, shift, size, useFloating } from '../src/core/index.ts'

it('middleware is always fresh and does not cause an infinite loop', async () => {
	const InlineMiddleware = defineComponent({
		setup() {
			const arrowRef = shallowRef<Element>()
			const { refs } = useFloating({
				config: {
					placement: 'right',
					middleware: [
						offset(),
						offset(10),
						offset(() => 5),
						offset(() => ({ crossAxis: 10 })),
						offset({ crossAxis: 10, mainAxis: 10 }),

						flip({ fallbackPlacements: ['top', 'bottom'] }),

						shift(),
						shift({ crossAxis: true }),
						shift({ boundary: document.createElement('div') }),
						shift({ boundary: [document.createElement('div')] }),
						shift({ limiter: limitShift() }),
						shift({ limiter: limitShift({ offset: 10 }) }),
						shift({ limiter: limitShift({ offset: { crossAxis: 10 } }) }),
						shift({ limiter: limitShift({ offset: () => 5 }) }),
						shift({ limiter: limitShift({ offset: () => ({ crossAxis: 10 }) }) }),

						arrow({ element: arrowRef }),

						hide(),

						size({
							apply({ availableHeight, elements }) {
								Object.assign(elements.floating.style, {
									maxHeight: `${availableHeight}px`,
								})
							},
						}),
					],
				},
			})

			return () => (
				<>
					<div ref={(el: any) => refs.setReference(el)} />
					<div ref={(el: any) => refs.setFloating(el)} />
				</>
			)
		},
	})

	const StateMiddleware = defineComponent({
		setup() {
			const arrowRef = shallowRef<Element>()
			const middleware = shallowRef([
				offset(),
				offset(10),
				offset(() => 5),
				offset(() => ({ crossAxis: 10 })),
				offset({ crossAxis: 10, mainAxis: 10 }),

				// should also test `autoPlacement.allowedPlacements`
				// can't have both `flip` and `autoPlacement` in the same middleware
				// array, or multiple `flip`s
				flip({ fallbackPlacements: ['top', 'bottom'] }),

				shift(),
				shift({ crossAxis: true }),
				shift({ boundary: document.createElement('div') }),
				shift({ boundary: [document.createElement('div')] }),
				shift({ limiter: limitShift() }),
				shift({ limiter: limitShift({ offset: 10 }) }),
				shift({ limiter: limitShift({ offset: { crossAxis: 10 } }) }),
				shift({ limiter: limitShift({ offset: () => 5 }) }),
				shift({ limiter: limitShift({ offset: () => ({ crossAxis: 10 }) }) }),

				arrow({ element: arrowRef }),

				hide(),

				size({
					apply({ availableHeight, elements }) {
						Object.assign(elements.floating.style, {
							maxHeight: `${availableHeight}px`,
						})
					},
				}),
			])

			const setMiddleware = (value: (typeof middleware)['value']) => {
				middleware.value = value
			}
			const { x, y, refs } = useFloating({
				config: () => ({
					placement: 'right',
					middleware: middleware.value,
				}),
			})

			return () => (
				<>
					<span ref={(el: any) => refs.setReference(el)} />
					<div ref={(el: any) => refs.setFloating(el)} />
					<button data-testid="step1" onClick={() => setMiddleware([offset(13)])} />
					<button data-testid="step2" onClick={() => setMiddleware([offset(() => 5)])} />
					<button data-testid="step3" onClick={() => setMiddleware([])} />
					<button data-testid="step4" onClick={() => setMiddleware([flip()])} />
					<div data-testid="x">{x.value}</div>
					<div data-testid="y">{y.value}</div>
				</>
			)
		},
	})

	render(InlineMiddleware)
	const screen = render(StateMiddleware)

	await userEvent.click(screen.getByTestId('step1'))
	await expect.element(screen.getByTestId('x')).toHaveTextContent(/^13$/)

	await userEvent.click(screen.getByTestId('step2'))
	await expect.element(screen.getByTestId('x')).toHaveTextContent(/^5$/)

	await userEvent.click(screen.getByTestId('step3'))
	await userEvent.click(screen.getByTestId('step4'))
})

describe('whileElementsMounted', () => {
	it('is called a single time when both elements mount', async () => {
		const spy = vi.fn()

		const App = defineComponent({
			setup() {
				const { refs } = useFloating({
					whileElementsMounted: () => {
						spy()
						return () => {}
					},
				})
				return () => (
					<>
						<button ref={(el: any) => refs.setReference(el)} />
						<div ref={(el: any) => refs.setFloating(el)} />
					</>
				)
			},
		})

		render(App)
		expect(spy).toHaveBeenCalledTimes(1)
	})

	it('is called a single time after floating mounts conditionally', async () => {
		const spy = vi.fn()

		const App = defineComponent({
			setup() {
				const open = shallowRef(false)
				const { refs } = useFloating({
					whileElementsMounted: () => {
						spy()
						return () => {}
					},
				})
				return () => (
					<>
						<button ref={(el: any) => refs.setReference(el)} onClick={() => (open.value = true)} />
						{open.value && <div ref={(el: any) => refs.setFloating(el)} />}
					</>
				)
			},
		})

		const screen = render(App)
		expect(spy).toHaveBeenCalledTimes(0)
		await userEvent.click(screen.getByRole('button'))
		expect(spy).toHaveBeenCalledTimes(1)
	})

	it('is called a single time after reference mounts conditionally', async () => {
		const spy = vi.fn()

		const App = defineComponent({
			setup() {
				const open = shallowRef(false)

				const { refs } = useFloating({
					whileElementsMounted: () => {
						spy()
						return () => {}
					},
				})
				return () => (
					<>
						{open.value && <button ref={(el: any) => refs.setReference(el)} />}
						<button
							role="tooltip"
							ref={(el: any) => refs.setFloating(el)}
							onClick={() => (open.value = true)}
						></button>
					</>
				)
			},
		})

		const screen = render(App)
		expect(spy).toHaveBeenCalledTimes(0)
		await userEvent.click(screen.getByRole('tooltip'))
		expect(spy).toHaveBeenCalledTimes(1)
	})

	it('is called a single time both elements mount conditionally', () => {
		const spy = vi.fn()

		const App = defineComponent({
			setup() {
				const open = shallowRef(false)
				const { refs } = useFloating({
					whileElementsMounted: () => {
						spy()
						return () => {}
					},
				})

				watchEffect(() => {
					open.value = true
				})

				return () => (
					<>
						{open.value && <button ref={(el: any) => refs.setReference(el)} />}
						{open.value && <div role="tooltip" ref={(el: any) => refs.setFloating(el)} />}
					</>
				)
			},
		})

		render(App)
		expect(spy).toHaveBeenCalledTimes(1)
	})

	it('calls the cleanup function', async () => {
		const cleanupSpy = vi.fn()
		const spy = vi.fn(() => cleanupSpy)

		const App = defineComponent({
			setup() {
				const open = shallowRef(true)
				const { refs } = useFloating({
					whileElementsMounted: spy,
				})

				onMounted(() => {
					open.value = false
				})

				return () => (
					<>
						{open.value && <button ref={(el: any) => refs.setReference(el)} />}
						{open.value && <div role="tooltip" ref={(el: any) => refs.setFloating(el)} />}
					</>
				)
			},
		})

		render(App)
		await Promise.resolve()
		expect(cleanupSpy).toHaveBeenCalledTimes(1)

		// Does not get called again post-cleanup
		expect(spy).toHaveBeenCalledTimes(1)
	})
})

it('unstable callback refs', async () => {
	const App = defineComponent({
		setup() {
			const { refs } = useFloating()

			return () => (
				<>
					<div ref={(el: any) => refs.setReference(el)} />
					<div ref={(el: any) => refs.setFloating(el)} />
				</>
			)
		},
	})

	render(App)
})

it('isPositioned', async () => {
	const spy = vi.fn()

	const App = defineComponent({
		setup() {
			const open = shallowRef(false)
			const { refs, isPositioned } = useFloating({
				open,
			})

			watchEffect(() => {
				spy(isPositioned.value)
			})

			return () => (
				<>
					<button ref={(el: any) => refs.setReference(el)} onClick={() => (open.value = !open.value)} />
					{open.value && <div ref={(el: any) => refs.setFloating(el)} />}
				</>
			)
		},
	})

	const screen = render(App)

	await userEvent.click(screen.getByRole('button'))

	expect(spy.mock.calls[0]?.[0]).toBe(false)
	expect(spy.mock.calls[1]?.[0]).toBe(true)

	await userEvent.click(screen.getByRole('button'))

	expect(spy.mock.calls[2]?.[0]).toBe(false)

	await userEvent.click(screen.getByRole('button'))

	expect(spy.mock.calls[3]?.[0]).toBe(true)

	await userEvent.click(screen.getByRole('button'))

	expect(spy.mock.calls[4]?.[0]).toBe(false)
})

it('external elements sync', async () => {
	const App = defineComponent({
		setup() {
			const reference = shallowRef<Element>()
			const floating = shallowRef<HTMLElement>()

			const { x, y, refs } = useFloating()

			onMounted(() => {
				refs.setReference(reference.value)
				refs.setFloating(floating.value)
			})

			return () => (
				<>
					<button ref={(el: any) => (reference.value = el)} />
					<div ref={(el: any) => (floating.value = el)} />
					<div data-testid="value">{`${x.value},${y.value}`}</div>
				</>
			)
		},
	})

	const screen = render(App)

	await expect.element(screen.getByTestId('value')).toHaveTextContent('0,0')
})

it('external reference element sync', async () => {
	const App = defineComponent({
		setup() {
			const reference = shallowRef<HTMLElement>()

			const { x, y, refs } = useFloating({
				elements: {
					reference,
				},
			})

			return () => (
				<>
					<div
						data-testid="reference"
						ref={(el: any) => (reference.value = el)}
						style={{
							width: '50px',
							height: '50px',
						}}
					/>
					<span ref={(el: any) => refs.setFloating(el)} />
					<div data-testid="value">{`${x.value},${y.value}`}</div>
				</>
			)
		},
	})

	const screen = render(App)

	await expect.element(screen.getByTestId('value')).toHaveTextContent('25,50')
})

it('external floating element sync', async () => {
	const App = defineComponent({
		setup() {
			const floating = shallowRef<HTMLElement>()

			const { x, y, refs } = useFloating({
				elements: {
					floating,
				},
			})

			return () => (
				<>
					<div
						data-testid="reference"
						ref={(el: any) => refs.setReference(el)}
						style={{
							width: '50px',
							height: '50px',
						}}
					/>
					<span ref={(el: any) => (floating.value = el)} />
					<div data-testid="value">{`${x.value},${y.value}`}</div>
				</>
			)
		},
	})

	const screen = render(App)

	await expect.element(screen.getByTestId('value')).toHaveTextContent('25,50')
})

it('external elements sync :2', async () => {
	const App = defineComponent({
		setup() {
			const reference = shallowRef<Element>()
			const floating = shallowRef<HTMLElement>()

			const { x, y } = useFloating({
				elements: {
					reference,
					floating,
				},
			})

			return () => (
				<>
					<div
						data-testid="reference"
						ref={(el: any) => (reference.value = el)}
						style={{
							width: '50px',
							height: '50px',
						}}
					/>
					<span ref={(el: any) => (floating.value = el)} />
					<div data-testid="value">{`${x.value},${y.value}`}</div>
				</>
			)
		},
	})

	const screen = render(App)

	await expect.element(screen.getByTestId('value')).toHaveTextContent('25,50')
})

it('external elements sync update', async () => {
	const App = defineComponent({
		setup() {
			const reference = shallowRef<Element>()
			const floating = shallowRef<HTMLElement>()

			const { x, y } = useFloating({
				elements: {
					reference,
					floating,
				},
			})

			return () => (
				<>
					<div data-testid="reference" ref={(el: any) => (reference.value = el)} />
					<div ref={(el: any) => (floating.value = el)} />
					<div data-testid="value">{`${x.value},${y.value}`}</div>
				</>
			)
		},
	})

	const screen = render(App)

	await expect.element(screen.getByTestId('value')).toHaveTextContent('0,0')
})

it('floatingStyles no transform', async () => {
	const App = defineComponent({
		setup() {
			const { refs, floatingStyles } = useFloating({
				transform: false,
			})

			return () => (
				<>
					<div
						data-testid="reference"
						ref={(el: any) => refs.setReference(el)}
						style={{
							width: '50px',
							height: '50px',
						}}
					/>
					<div data-testid="floating" ref={(el: any) => refs.setFloating(el)} style={floatingStyles.value} />
				</>
			)
		},
	})

	const screen = render(App)

	await expect.element(screen.getByTestId('floating')).toHaveStyle({
		position: 'absolute',
		top: '0px',
		left: '0px',
	})

	await expect.element(screen.getByTestId('floating')).toHaveStyle({
		position: 'absolute',
		top: '50px',
		left: '25px',
	})
})

it('floatingStyles default', async () => {
	const App = defineComponent({
		setup() {
			const { refs, floatingStyles } = useFloating()

			return () => (
				<>
					<div
						data-testid="reference"
						ref={(el: any) => refs.setReference(el)}
						style={{
							width: '50px',
							height: '50px',
						}}
					/>
					<div data-testid="floating" ref={(el: any) => refs.setFloating(el)} style={floatingStyles.value} />
				</>
			)
		},
	})

	const screen = render(App)

	await expect.element(screen.getByTestId('floating')).toHaveStyle({
		position: 'absolute',
		top: '0px',
		left: '0px',
		transform: 'matrix(1, 0, 0, 1, 0, 0)',
	})

	await expect.element(screen.getByTestId('floating')).toHaveStyle({
		position: 'absolute',
		top: '0px',
		left: '0px',
		transform: 'matrix(1, 0, 0, 1, 25, 50)',
	})
})
