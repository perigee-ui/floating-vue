import { isElement } from '@floating-ui/utils/dom'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-vue'
import { computed, defineComponent, onMounted, shallowRef } from 'vue'
import { useFloating } from '../src/hooks/useFloating.ts'

describe('positionReference', () => {
	it('sets separate refs', async () => {
		const App = defineComponent({
			inheritAttrs: false,
			setup() {
				const { refs, elements } = useFloating<HTMLDivElement>()

				const domReference = computed(() => {
					// eslint-disable-next-line ts/no-unused-expressions
					elements.domReference.value
					return refs.domReference.current?.getAttribute('data-testid')
				})
				const reference = computed(() => {
					// eslint-disable-next-line ts/no-unused-expressions
					elements.domReference.value
					return isElement(refs.reference.current)
				})

				return () => (
					<>
						<div ref={(el: any) => refs.setReference(el)} data-testid="reference" />
						<div ref={(el: any) => refs.setPositionReference(el)} data-testid="position-reference" />
						<div data-testid="reference-text">{String(domReference.value)}</div>
						<div data-testid="position-reference-text">{String(reference.value)}</div>
					</>
				)
			},
		})

		const screen = render(App)
		await expect.element(screen.getByTestId('reference-text')).toHaveTextContent('reference')
		await expect.element(screen.getByTestId('position-reference-text')).toHaveTextContent('false')

		screen.rerender(App)

		await expect.element(screen.getByTestId('reference-text')).toHaveTextContent('reference')
		await expect.element(screen.getByTestId('position-reference-text')).toHaveTextContent('false')
	})

	it('handles unstable reference prop', async () => {
		const App = defineComponent({
			inheritAttrs: false,
			setup() {
				const { refs, elements } = useFloating<HTMLDivElement>()

				const domReference = computed(() => {
					// eslint-disable-next-line ts/no-unused-expressions
					elements.domReference.value
					return refs.domReference.current?.getAttribute('data-testid')
				})
				const reference = computed(() => {
					// eslint-disable-next-line ts/no-unused-expressions
					elements.domReference.value
					return isElement(refs.reference.current)
				})

				return () => (
					<>
						<div ref={(el: any) => refs.setReference(el)} data-testid="reference" />
						<div ref={(el: any) => refs.setPositionReference(el)} data-testid="position-reference" />
						<div data-testid="reference-text">{String(domReference.value)}</div>
						<div data-testid="position-reference-text">{String(reference.value)}</div>
					</>
				)
			},
		})

		const screen = render(App)

		await expect.element(screen.getByTestId('reference-text')).toHaveTextContent('reference')
		await expect.element(screen.getByTestId('position-reference-text')).toHaveTextContent('false')

		screen.rerender(App)

		await expect.element(screen.getByTestId('reference-text')).toHaveTextContent('reference')
		await expect.element(screen.getByTestId('position-reference-text')).toHaveTextContent('false')
	})

	it('handles real virtual element', async () => {
		const App = defineComponent({
			inheritAttrs: false,
			setup() {
				const { refs, elements } = useFloating<HTMLDivElement>()

				const domReference = computed(() => {
					// eslint-disable-next-line ts/no-unused-expressions
					elements.domReference.value
					return refs.domReference.current?.getAttribute('data-testid')
				})
				const reference = shallowRef<number>()

				onMounted(() => {
					refs.setPositionReference({
						getBoundingClientRect: () => ({
							x: 218,
							y: 0,
							width: 0,
							height: 0,
							left: 0,
							right: 0,
							top: 0,
							bottom: 0,
						}),
					})

					reference.value = refs.reference.current?.getBoundingClientRect().x
				})

				return () => (
					<>
						<div ref={(el: any) => refs.setReference(el)} data-testid="reference" />
						<div data-testid="reference-text">{String(domReference.value)}</div>
						<div data-testid="position-reference-text">{String(reference.value)}</div>
					</>
				)
			},
		})

		const screen = render(App)

		await expect.element(screen.getByTestId('reference-text')).toHaveTextContent('reference')
		await expect.element(screen.getByTestId('position-reference-text')).toHaveTextContent('218')

		screen.rerender(App)

		await expect.element(screen.getByTestId('reference-text')).toHaveTextContent('reference')
		await expect.element(screen.getByTestId('position-reference-text')).toHaveTextContent('218')
	})
})

it.todo('#2129: interactions.getFloatingProps as a dep does not cause setState loop', () => {
	// function App() {
	//   const {refs, context} = useFloating({
	//     open: true,
	//   });
	//   const interactions = useInteractions([
	//     useHover(context),
	//     useClick(context),
	//     useFocus(context),
	//     useDismiss(context),
	//   ]);
	//   const Tooltip = useCallback(() => {
	//     return (
	//       <div
	//         data-testid="floating"
	//         ref={refs.setFloating}
	//         {...interactions.getFloatingProps()}
	//       />
	//     );
	//   }, [refs, interactions]);
	//   return (
	//     <>
	//       <div ref={refs.setReference} {...interactions.getReferenceProps()} />
	//       <Tooltip />
	//     </>
	//   );
	// }
	// render(<App />);
	// expect(screen.queryByTestId('floating')).toBeInTheDocument();
})

it.todo('domReference refers to externally synchronized `reference`', async () => {
	// const App = defineComponent({
	//   setup() {
	//     const referenceEl = shallowRef<Element>()
	//     const isOpen = shallowRef(false)
	//     const { refs, context } = useFloating({
	//       open: isOpen,
	//       onOpenChange(open) {
	//         isOpen.value = open
	//       },
	//       elements: { reference: referenceEl },
	//     })
	//     return () => (
	//       <>
	//         <button ref={(el: any) => referenceEl.value = el} onClick={() => isOpen.value = true} />
	//         {isOpen && (
	//           <div role="dialog" ref={(el: any) => refs.setFloating(el)} />
	//         )}
	//       </>
	//     )
	//   },
	// })
	// await render(<App />)
	// await userEvent.hover(screen.getByRole('button'))
	// await act(async () => {})
	// expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it.todo('onOpenChange is passed an event as second param', async () => {
	// const onOpenChange = vi.fn();
	// function App() {
	//   const [isOpen, setIsOpen] = useState(false);
	//   const {refs, context} = useFloating({
	//     open: isOpen,
	//     onOpenChange(open, event) {
	//       onOpenChange(open, event);
	//       setIsOpen(open);
	//     },
	//   });
	//   const hover = useHover(context, {
	//     move: false,
	//   });
	//   const {getReferenceProps, getFloatingProps} = useInteractions([hover]);
	//   return (
	//     <>
	//       <button ref={refs.setReference} {...getReferenceProps()} />
	//       {isOpen && <div ref={refs.setFloating} {...getFloatingProps()} />}
	//     </>
	//   );
	// }
	// render(<App />);
	// await userEvent.hover(screen.getByRole('button'));
	// await act(async () => {});
	// expect(onOpenChange.mock.calls[0][0]).toBe(true);
	// expect(onOpenChange.mock.calls[0][1]).toBeInstanceOf(MouseEvent);
	// await userEvent.unhover(screen.getByRole('button'));
	// expect(onOpenChange.mock.calls[1][0]).toBe(false);
	// expect(onOpenChange.mock.calls[1][1]).toBeInstanceOf(MouseEvent);
})

it.todo('refs.domReference.current is synchronized with external reference', async () => {
	// let isSameNode = false
	// const App = defineComponent(() => {
	//   const referenceEl = shallowRef<Element>()
	//   function setReferenceEl(el: any) {
	//     referenceEl.value = el
	//   }
	//   const { refs } = useFloating<HTMLButtonElement>({
	//     elements: {
	//       reference: referenceEl,
	//     },
	//   })
	//   return () => (
	//     <button
	//       ref={setReferenceEl}
	//       onClick={(event) => {
	//         isSameNode = event.currentTarget === refs.domReference.current
	//       }}
	//     />
	//   )
	// })
	// const { getByRole } = render(<App />)
	// fireEvent.click(getByRole('button'))
	// expect(isSameNode).toBe(true)
	// cleanup()
})
