import { userEvent } from '@vitest/browser/context'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-vue'
import { defineComponent, shallowRef } from 'vue'
import { normalizeProp } from '../src/hooks/useDismiss.ts'
import { useDismiss, useFloating, useFocus, useInteractions } from '../src/index.ts'

const App = defineComponent({
	props: {
		outsidePress: {
			type: [Boolean, Function],
			default: undefined,
		},
		escapeKey: {
			type: Boolean,
			default: undefined,
		},
		referencePress: {
			type: Boolean,
			default: undefined,
		},
		ancestorScroll: {
			type: Boolean,
			default: undefined,
		},
		outsidePressEvent: {
			type: String,
			default: undefined,
		},
		onClose: Function,
	},
	setup(props) {
		const isOpen = shallowRef(true)
		const { refs, context } = useFloating({
			open: isOpen,
			onOpenChange(open, _, reason) {
				isOpen.value = open
				if (props.outsidePress) {
					expect(reason).toBe('outside-press')
				} else if (props.escapeKey) {
					expect(reason).toBe('escape-key')
					if (!open) {
						props.onClose?.()
					}
				} else if (props.referencePress) {
					expect(reason).toBe('reference-press')
				} else if (props.ancestorScroll) {
					expect(reason).toBe('ancestor-scroll')
				}
			},
		})
		const { getReferenceProps, getFloatingProps } = useInteractions([useDismiss(context, { ...props } as any)])

		return () => (
			<>
				<button type="button" {...getReferenceProps({ ref: refs.setReference })}>
					Reference
				</button>
				{isOpen.value && (
					<div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>
						<input />
					</div>
				)}
			</>
		)
	},
})

describe('true', () => {
	it('dismisses with escape key', async () => {
		const screen = render(App)
		await userEvent.keyboard('{Escape}')
		await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
	})

	it('does not dismiss with escape key if IME is active', async () => {
		const onClose = vi.fn()

		const screen = render(App, {
			props: { onClose, escapeKey: true },
		})

		const textbox = screen.getByRole('textbox')
		const $textbox = textbox.query()! as HTMLInputElement

		// Simulate behavior when "あ" (Japanese) is entered and Esc is pressed for IME
		// cancellation.
		await userEvent.fill(textbox, 'あ')

		$textbox.dispatchEvent(
			new CompositionEvent('compositionstart', {
				bubbles: true,
				cancelable: true,
			}),
		)
		await Promise.resolve()

		await userEvent.keyboard('{Escape}')

		$textbox.dispatchEvent(
			new CompositionEvent('compositionend', {
				bubbles: true,
				cancelable: true,
			}),
		)
		await Promise.resolve()

		expect(onClose).toHaveBeenCalledTimes(0)

		await userEvent.keyboard('{Escape}')

		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it('dismisses with outside pointer press', async () => {
		const screen = render(App)
		await userEvent.click(document.body)
		await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
	})

	it('dismisses with reference press', async () => {
		const screen = render(App, {
			props: {
				referencePress: true,
			},
		})

		await screen.getByRole('button').click()
		await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
	})

	it('dismisses with native click', async () => {
		const screen = render(App, {
			props: {
				referencePress: true,
			},
		})
		await userEvent.click(screen.getByRole('button'))
		await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
	})

	it('dismisses with ancestor scroll', async () => {
		const screen = render(App, {
			props: {
				ancestorScroll: true,
			},
		})

		window.dispatchEvent(new Event('scroll'))
		await Promise.resolve()

		await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
	})

	it('outsidePress function guard', async () => {
		const screen = render(App, {
			props: {
				outsidePress: () => false,
			},
		})

		await userEvent.click(document.body)
		await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
	})

	// TODO
	// test('outsidePress ignored for third party elements', async () => {
	//   function App() {
	//     const [isOpen, setIsOpen] = useState(true);

	//     const {context, refs} = useFloating({
	//       open: isOpen,
	//       onOpenChange: setIsOpen,
	//     });

	//     const dismiss = useDismiss(context);

	//     const {getReferenceProps, getFloatingProps} = useInteractions([dismiss]);

	//     return (
	//       <>
	//         <button {...getReferenceProps({ref: refs.setReference})} />
	//         {isOpen && (
	//           <FloatingFocusManager context={context}>
	//             <div
	//               role="dialog"
	//               {...getFloatingProps({ref: refs.setFloating})}
	//             />
	//           </FloatingFocusManager>
	//         )}
	//       </>
	//     );
	//   }

	//   render(<App />);
	//   await act(async () => {});

	//   const thirdParty = document.createElement('div');
	//   thirdParty.setAttribute('data-testid', 'third-party');
	//   document.body.append(thirdParty);
	//   await userEvent.click(thirdParty);
	//   expect(screen.queryByRole('dialog')).toBeInTheDocument();
	//   thirdParty.remove();
	// });

	// test('outsidePress not ignored for nested floating elements', async () => {
	//   function Popover({
	//     children,
	//     id,
	//     modal,
	//   }: {
	//     children?: ReactNode;
	//     id: string;
	//     modal?: boolean | null;
	//   }) {
	//     const [isOpen, setIsOpen] = useState(true);

	//     const {context, refs} = useFloating({
	//       open: isOpen,
	//       onOpenChange: setIsOpen,
	//     });

	//     const dismiss = useDismiss(context);

	//     const {getReferenceProps, getFloatingProps} = useInteractions([dismiss]);

	//     const dialogJsx = (
	//       <div
	//         role="dialog"
	//         data-testid={id}
	//         {...getFloatingProps({ref: refs.setFloating})}
	//       >
	//         {children}
	//       </div>
	//     );

	//     return (
	//       <>
	//         <button {...getReferenceProps({ref: refs.setReference})} />
	//         {isOpen && (
	//           <>
	//             {modal == null ? (
	//               dialogJsx
	//             ) : (
	//               <FloatingFocusManager context={context} modal={modal}>
	//                 {dialogJsx}
	//               </FloatingFocusManager>
	//             )}
	//           </>
	//         )}
	//       </>
	//     );
	//   }

	//   function App({modal}: {modal: [boolean, boolean] | null}) {
	//     return (
	//       <Popover id="popover-1" modal={modal ? modal[0] : true}>
	//         <Popover id="popover-2" modal={modal ? modal[1] : null} />
	//       </Popover>
	//     );
	//   }

	//   const {unmount} = render(<App modal={[true, true]} />);
	//   await act(async () => {});

	//   let popover1 = screen.getByTestId('popover-1');
	//   let popover2 = screen.getByTestId('popover-2');
	//   await userEvent.click(popover2);
	//   expect(popover1).toBeInTheDocument();
	//   expect(popover2).toBeInTheDocument();
	//   await userEvent.click(popover1);
	//   expect(popover2).not.toBeInTheDocument();

	//   unmount();

	//   const {unmount: unmount2} = render(<App modal={[true, false]} />);
	//   await act(async () => {});

	//   popover1 = screen.getByTestId('popover-1');
	//   popover2 = screen.getByTestId('popover-2');

	//   await userEvent.click(popover2);
	//   expect(popover1).toBeInTheDocument();
	//   expect(popover2).toBeInTheDocument();
	//   await userEvent.click(popover1);
	//   expect(popover2).not.toBeInTheDocument();

	//   unmount2();

	//   const {unmount: unmount3} = render(<App modal={[false, true]} />);
	//   await act(async () => {});

	//   popover1 = screen.getByTestId('popover-1');
	//   popover2 = screen.getByTestId('popover-2');

	//   await userEvent.click(popover2);
	//   expect(popover1).toBeInTheDocument();
	//   expect(popover2).toBeInTheDocument();
	//   await userEvent.click(popover1);
	//   expect(popover2).not.toBeInTheDocument();

	//   unmount3();

	//   render(<App modal={null} />);
	//   await act(async () => {});

	//   popover1 = screen.getByTestId('popover-1');
	//   popover2 = screen.getByTestId('popover-2');

	//   await userEvent.click(popover2);
	//   expect(popover1).toBeInTheDocument();
	//   expect(popover2).toBeInTheDocument();
	//   await userEvent.click(popover1);
	//   expect(popover2).not.toBeInTheDocument();
	// });
})

describe('false', () => {
	it('dismisses with escape key', async () => {
		const screen = render(App, {
			props: {
				escapeKey: false,
			},
		})
		await userEvent.keyboard('{Escape}')
		await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
	})

	it('dismisses with outside press', async () => {
		const screen = render(App, {
			props: {
				outsidePress: false,
			},
		})
		await userEvent.click(document.body)
		await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
	})

	it('dismisses with reference pointer down', async () => {
		const screen = render(App, {
			props: {
				referencePress: false,
			},
		})
		await userEvent.click(screen.getByRole('button'))
		await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
	})

	it('dismisses with ancestor scroll', async () => {
		const screen = render(App, {
			props: {
				ancestorScroll: false,
			},
		})

		window.dispatchEvent(new Event('scroll'))
		await Promise.resolve()
		await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
	})

	// it('does not dismiss when clicking portaled children', async () => {
	//   function App() {
	//     const [open, setOpen] = useState(true)
	//     const { refs, context } = useFloating({
	//       open,
	//       onOpenChange: setOpen,
	//     })

	//     const { getReferenceProps, getFloatingProps } = useInteractions([
	//       useDismiss(context),
	//     ])

	//     return (
	//       <>
	//         <button ref={refs.setReference} {...getReferenceProps()} />
	//         {open && (
	//           <div ref={refs.setFloating} {...getFloatingProps()}>
	//             <FloatingPortal>
	//               <button data-testid="portaled-button" />
	//             </FloatingPortal>
	//           </div>
	//         )}
	//       </>
	//     )
	//   }

	//   const screen = render(<App />)

	//   fireEvent.pointerDown(screen.getByTestId('portaled-button'), {
	//     bubbles: true,
	//   })

	//   expect(screen.queryByTestId('portaled-button')).toBeInTheDocument()

	//   cleanup()
	// })

	it('outsidePress function guard', async () => {
		const screen = render(App, {
			props: {
				outsidePress: () => true,
			},
		})

		await userEvent.click(document.body)
		await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
	})
})

// describe('bubbles', () => {
//   const Dialog = ({
//     testId,
//     children,
//     ...props
//   }: UseDismissProps & {testId: string; children: ReactNode}) => {
//     const [open, setOpen] = useState(true);
//     const nodeId = useFloatingNodeId();

//     const {refs, context} = useFloating({
//       open,
//       onOpenChange: setOpen,
//       nodeId,
//     });

//     const {getReferenceProps, getFloatingProps} = useInteractions([
//       useDismiss(context, props),
//     ]);

//     return (
//       <FloatingNode id={nodeId}>
//         <button {...getReferenceProps({ref: refs.setReference})} />
//         {open && (
//           <FloatingFocusManager context={context}>
//             <div
//               {...getFloatingProps({ref: refs.setFloating})}
//               data-testid={testId}
//             >
//               {children}
//             </div>
//           </FloatingFocusManager>
//         )}
//       </FloatingNode>
//     );
//   };

//   const NestedDialog = (
//     props: UseDismissProps & {testId: string; children: ReactNode},
//   ) => {
//     const parentId = useFloatingParentNodeId();

//     if (parentId == null) {
//       return (
//         <FloatingTree>
//           <Dialog {...props} />
//         </FloatingTree>
//       );
//     }

//     return <Dialog {...props} />;
//   };

//   describe('prop resolution', () => {
//     test('undefined', () => {
//       const {escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles} =
//         normalizeProp();

//       expect(escapeKeyBubbles).toBe(false);
//       expect(outsidePressBubbles).toBe(true);
//     });

//     test('false', () => {
//       const {escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles} =
//         normalizeProp(false);

//       expect(escapeKeyBubbles).toBe(false);
//       expect(outsidePressBubbles).toBe(false);
//     });

//     test('{}', () => {
//       const {escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles} =
//         normalizeProp({});

//       expect(escapeKeyBubbles).toBe(false);
//       expect(outsidePressBubbles).toBe(true);
//     });

//     test('{ escapeKey: false }', () => {
//       const {escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles} =
//         normalizeProp({
//           escapeKey: false,
//         });

//       expect(escapeKeyBubbles).toBe(false);
//       expect(outsidePressBubbles).toBe(true);
//     });

//     test('{ outsidePress: false }', () => {
//       const {escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles} =
//         normalizeProp({
//           outsidePress: false,
//         });

//       expect(escapeKeyBubbles).toBe(false);
//       expect(outsidePressBubbles).toBe(false);
//     });
//   });

//   describe('outsidePress', () => {
//     test('true', async () => {
//       render(
//         <NestedDialog testId="outer">
//           <NestedDialog testId="inner">
//             <button>test button</button>
//           </NestedDialog>
//         </NestedDialog>,
//       );

//       expect(screen.queryByTestId('outer')).toBeInTheDocument();
//       expect(screen.queryByTestId('inner')).toBeInTheDocument();

//       fireEvent.pointerDown(document.body);

//       expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
//       expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
//       cleanup();
//     });

//     test('false', async () => {
//       render(
//         <NestedDialog testId="outer" bubbles={{outsidePress: false}}>
//           <NestedDialog testId="inner" bubbles={{outsidePress: false}}>
//             <button>test button</button>
//           </NestedDialog>
//         </NestedDialog>,
//       );

//       expect(screen.queryByTestId('outer')).toBeInTheDocument();
//       expect(screen.queryByTestId('inner')).toBeInTheDocument();

//       fireEvent.pointerDown(document.body);

//       expect(screen.queryByTestId('outer')).toBeInTheDocument();
//       expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

//       fireEvent.pointerDown(document.body);

//       expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
//       expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
//       cleanup();
//     });

//     test('mixed', async () => {
//       render(
//         <NestedDialog testId="outer" bubbles={{outsidePress: true}}>
//           <NestedDialog testId="inner" bubbles={{outsidePress: false}}>
//             <button>test button</button>
//           </NestedDialog>
//         </NestedDialog>,
//       );

//       expect(screen.queryByTestId('outer')).toBeInTheDocument();
//       expect(screen.queryByTestId('inner')).toBeInTheDocument();

//       fireEvent.pointerDown(document.body);

//       expect(screen.queryByTestId('outer')).toBeInTheDocument();
//       expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

//       fireEvent.pointerDown(document.body);

//       expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
//       expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
//       cleanup();
//     });
//   });

describe('escapeKey', () => {
	it('without FloatingTree', async () => {
		const App = defineComponent({
			setup() {
				const popoverOpen = shallowRef(true)
				const tooltipOpen = shallowRef(false)

				const popover = useFloating({
					open: popoverOpen,
					onOpenChange(value) {
						popoverOpen.value = value
					},
				})
				const tooltip = useFloating({
					open: tooltipOpen,
					onOpenChange(value) {
						tooltipOpen.value = value
					},
				})

				const popoverInteractions = useInteractions([useDismiss(popover.context)])
				const tooltipInteractions = useInteractions([
					useFocus(tooltip.context, { visibleOnly: false }),
					useDismiss(tooltip.context),
				])

				return () => (
					<>
						<button ref={popover.refs.setReference as any} {...popoverInteractions.getReferenceProps()}>
							button
						</button>
						{popoverOpen.value && (
							<div
								role="dialog"
								ref={popover.refs.setFloating as any}
								{...popoverInteractions.getFloatingProps()}
							>
								<button
									data-testid="focus-button"
									ref={tooltip.refs.setReference as any}
									{...tooltipInteractions.getReferenceProps()}
								>
									button
								</button>
							</div>
						)}
						{tooltipOpen.value && (
							<div
								role="tooltip"
								ref={tooltip.refs.setFloating as any}
								{...tooltipInteractions.getFloatingProps()}
							>
								tooltip
							</div>
						)}
					</>
				)
			},
		})

		const screen = render(App)

		const $focusButton = screen.getByTestId('focus-button').query()! as HTMLElement
		$focusButton.focus()
		await Promise.resolve()

		await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()

		await userEvent.keyboard('{Escape}')

		await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
		await expect.element(screen.getByRole('dialog')).toBeInTheDocument()
	})

	//     test('true', async () => {
	//       render(
	//         <NestedDialog testId="outer" bubbles>
	//           <NestedDialog testId="inner" bubbles>
	//             <button>test button</button>
	//           </NestedDialog>
	//         </NestedDialog>,
	//       );

	//       expect(screen.queryByTestId('outer')).toBeInTheDocument();
	//       expect(screen.queryByTestId('inner')).toBeInTheDocument();

	//       await userEvent.keyboard('{Escape}');

	//       expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
	//       expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
	//       cleanup();
	//     });
	//     test('false', async () => {
	//       render(
	//         <NestedDialog testId="outer" bubbles={{escapeKey: false}}>
	//           <NestedDialog testId="inner" bubbles={{escapeKey: false}}>
	//             <button>test button</button>
	//           </NestedDialog>
	//         </NestedDialog>,
	//       );

	//       expect(screen.queryByTestId('outer')).toBeInTheDocument();
	//       expect(screen.queryByTestId('inner')).toBeInTheDocument();

	//       await userEvent.keyboard('{Escape}');

	//       expect(screen.queryByTestId('outer')).toBeInTheDocument();
	//       expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

	//       await userEvent.keyboard('{Escape}');

	//       expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
	//       expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
	//       cleanup();
	//     });

	//     test('mixed', async () => {
	//       render(
	//         <NestedDialog testId="outer" bubbles={{escapeKey: true}}>
	//           <NestedDialog testId="inner" bubbles={{escapeKey: false}}>
	//             <button>test button</button>
	//           </NestedDialog>
	//         </NestedDialog>,
	//       );

	//       expect(screen.queryByTestId('outer')).toBeInTheDocument();
	//       expect(screen.queryByTestId('inner')).toBeInTheDocument();

	//       await userEvent.keyboard('{Escape}');

	//       expect(screen.queryByTestId('outer')).toBeInTheDocument();
	//       expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

	//       await userEvent.keyboard('{Escape}');

	//       expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
	//       expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
	//       cleanup();
	//     });
	//   });
})

describe('capture', () => {
	describe('prop resolution', () => {
		it('undefined', () => {
			const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp()

			expect(escapeKeyCapture).toBe(false)
			expect(outsidePressCapture).toBe(true)
		})

		it('{}', () => {
			const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp({})

			expect(escapeKeyCapture).toBe(false)
			expect(outsidePressCapture).toBe(true)
		})

		it('true', () => {
			const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp(true)

			expect(escapeKeyCapture).toBe(true)
			expect(outsidePressCapture).toBe(true)
		})

		it('false', () => {
			const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp(false)

			expect(escapeKeyCapture).toBe(false)
			expect(outsidePressCapture).toBe(false)
		})

		it('{ escapeKey: true }', () => {
			const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp({
				escapeKey: true,
			})

			expect(escapeKeyCapture).toBe(true)
			expect(outsidePressCapture).toBe(true)
		})

		it('{ outsidePress: false }', () => {
			const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp({
				outsidePress: false,
			})

			expect(escapeKeyCapture).toBe(false)
			expect(outsidePressCapture).toBe(false)
		})
	})

	// const Overlay = ({ children }: { children: ReactNode }) => {
	//   return (
	//     <div
	//       style={{ width: '100vw', height: '100vh' }}
	//       onPointerDown={e => e.stopPropagation()}
	//       onKeyDown={(e) => {
	//         if (e.key === 'Escape') {
	//           e.stopPropagation()
	//         }
	//       }}
	//     >
	//       <span>outside</span>
	//       {children}
	//     </div>
	//   )
	// }

	// const Dialog = ({
	//   id,
	//   children,
	//   ...props
	// }: UseDismissProps & { id: string, children: ReactNode }) => {
	//   const [open, setOpen] = useState(true)
	//   const nodeId = useFloatingNodeId()

	//   const { refs, context } = useFloating({
	//     open,
	//     onOpenChange: setOpen,
	//     nodeId,
	//   })

	//   const { getReferenceProps, getFloatingProps } = useInteractions([
	//     useDismiss(context, props),
	//   ])

	//   return (
	//     <FloatingNode id={nodeId}>
	//       <button {...getReferenceProps({ ref: refs.setReference })} />
	//       {open && (
	//         <FloatingPortal>
	//           <FloatingFocusManager context={context}>
	//             <div {...getFloatingProps({ ref: refs.setFloating })}>
	//               <span>{id}</span>
	//               {children}
	//             </div>
	//           </FloatingFocusManager>
	//         </FloatingPortal>
	//       )}
	//     </FloatingNode>
	//   )
	// }

	// const NestedDialog = (
	//   props: UseDismissProps & { id: string, children: ReactNode },
	// ) => {
	//   const parentId = useFloatingParentNodeId()

	//   if (parentId == null) {
	//     return (
	//       <FloatingTree>
	//         <Dialog {...props} />
	//       </FloatingTree>
	//     )
	//   }

	//   return <Dialog {...props} />
	// }

	// describe('outsidePress', () => {
	//   it('false', async () => {
	//     const user = userEvent.setup()

	//     render(
	//       <Overlay>
	//         <NestedDialog id="outer" capture={{ outsidePress: false }}>
	//           <NestedDialog id="inner" capture={{ outsidePress: false }}>
	//             {null}
	//           </NestedDialog>
	//         </NestedDialog>
	//       </Overlay>,
	//     )

	//     expect(screen.getByText('outer')).toBeInTheDocument()
	//     expect(screen.getByText('inner')).toBeInTheDocument()

	//     await user.click(screen.getByText('outer'))

	//     expect(screen.getByText('outer')).toBeInTheDocument()
	//     expect(screen.getByText('inner')).toBeInTheDocument()

	//     await user.click(screen.getByText('outside'))

	//     expect(screen.getByText('outer')).toBeInTheDocument()
	//     expect(screen.getByText('inner')).toBeInTheDocument()
	//     cleanup()
	//   })

	//   it('true', async () => {
	//     const user = userEvent.setup()

	//     render(
	//       <Overlay>
	//         <NestedDialog id="outer" capture={{ outsidePress: true }}>
	//           <NestedDialog id="inner" capture={{ outsidePress: true }}>
	//             {null}
	//           </NestedDialog>
	//         </NestedDialog>
	//       </Overlay>,
	//     )

	//     expect(screen.getByText('outer')).toBeInTheDocument()
	//     expect(screen.getByText('inner')).toBeInTheDocument()

	//     await user.click(screen.getByText('outer'))

	//     expect(screen.getByText('outer')).toBeInTheDocument()
	//     expect(screen.queryByText('inner')).not.toBeInTheDocument()

	//     await user.click(screen.getByText('outside'))

	//     expect(screen.queryByText('outer')).not.toBeInTheDocument()
	//     expect(screen.queryByText('inner')).not.toBeInTheDocument()
	//     cleanup()
	//   })
	// })

	// describe('escapeKey', () => {
	//   it('false', async () => {
	//     const user = userEvent.setup()

	//     render(
	//       <Overlay>
	//         <NestedDialog id="outer" capture={{ escapeKey: false }}>
	//           <NestedDialog id="inner" capture={{ escapeKey: false }}>
	//             {null}
	//           </NestedDialog>
	//         </NestedDialog>
	//       </Overlay>,
	//     )

	//     expect(screen.getByText('outer')).toBeInTheDocument()
	//     expect(screen.getByText('inner')).toBeInTheDocument()

	//     await user.keyboard('{Escape}')

	//     expect(screen.getByText('outer')).toBeInTheDocument()
	//     expect(screen.queryByText('inner')).not.toBeInTheDocument()

	//     await user.keyboard('{Escape}')

	//     expect(screen.queryByText('outer')).not.toBeInTheDocument()
	//     expect(screen.queryByText('inner')).not.toBeInTheDocument()
	//     cleanup()
	//   })

	//   it('true', async () => {
	//     const user = userEvent.setup()

	//     render(
	//       <Overlay>
	//         <NestedDialog id="outer" capture={{ escapeKey: true }}>
	//           <NestedDialog id="inner" capture={{ escapeKey: true }}>
	//             {null}
	//           </NestedDialog>
	//         </NestedDialog>
	//       </Overlay>,
	//     )

	//     expect(screen.getByText('outer')).toBeInTheDocument()
	//     expect(screen.getByText('inner')).toBeInTheDocument()

	//     await user.keyboard('{Escape}')

	//     expect(screen.getByText('outer')).toBeInTheDocument()
	//     expect(screen.queryByText('inner')).not.toBeInTheDocument()

	//     await user.keyboard('{Escape}')

	//     expect(screen.queryByText('outer')).not.toBeInTheDocument()
	//     expect(screen.queryByText('inner')).not.toBeInTheDocument()
	//     cleanup()
	//   })
	// })
})

describe('outsidePressEvent click', () => {
	it('dragging outside the floating element does not close', async () => {
		const screen = render(App, {
			props: {
				outsidePressEvent: 'click',
			},
		})
		const $tooltip = screen.getByRole('tooltip').query()! as HTMLElement

		$tooltip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
		await Promise.resolve()
		document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
		await Promise.resolve()

		await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
	})

	it('dragging inside the floating element does not close', async () => {
		const screen = render(App, {
			props: {
				outsidePressEvent: 'click',
			},
		})
		const $tooltip = screen.getByRole('tooltip').query()! as HTMLElement

		document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
		await Promise.resolve()
		$tooltip.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
		await Promise.resolve()

		await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
	})

	it('dragging outside the floating element then clicking outside closes', async () => {
		const screen = render(App, {
			props: {
				outsidePressEvent: 'click',
			},
		})
		const $tooltip = screen.getByRole('tooltip').query()! as HTMLElement

		$tooltip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
		await Promise.resolve()
		document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
		await Promise.resolve()

		// A click event will have fired before the proper outside click.
		await userEvent.click(document.body)
		await userEvent.click(document.body)
		await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
	})
})
