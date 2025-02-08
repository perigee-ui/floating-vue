import type { PropType } from 'vue'
import type { UseFocusProps } from '../src/hooks/useFocus.ts'
import { userEvent } from '@vitest/browser/context'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-vue'
import { defineComponent, shallowRef } from 'vue'
import { useDismiss } from '../src/hooks/useDismiss.ts'
import { useFloating } from '../src/hooks/useFloating.ts'
import { useFocus } from '../src/hooks/useFocus.ts'
import { useHover } from '../src/hooks/useHover.ts'
import { useInteractions } from '../src/hooks/useInteractions.ts'

customElements.define(
  'render-root',
  class RenderRoot extends HTMLElement {
    constructor() {
      super()
      this.attachShadow({ mode: 'open' }).appendChild(
        document.createElement('div'),
      )
    }
  },
)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const App = defineComponent({
  props: {
    focusProps: {
      type: Object as PropType<UseFocusProps>,
      default: undefined,
    },
    dismiss: {
      type: Boolean,
      defatult: undefined,
    },
    hover: {
      type: Boolean,
      defatult: undefined,
    },
  },
  inheritAttrs: false,
  setup(props) {
    const open = shallowRef(false)
    const { refs, context } = useFloating({
      open,
      onOpenChange(value) {
        open.value = value
      },
    })
    const { getReferenceProps, getFloatingProps } = useInteractions([
      useFocus(context, props.focusProps),
      useDismiss(context, { enabled: !!props.dismiss, referencePress: true }),
      useHover(context, { enabled: !!props.hover }),
    ])

    return () => (
      <>
        <button {...getReferenceProps({ ref: refs.setReference })}>
          <span data-testid="inside-reference" tabindex={0}>reference</span>
        </button>
        {open.value && (
          <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>tooltip</div>
        )}
      </>
    )
  },
})

it('opens on focus', async () => {
  const screen = render(App, {
    props: {
      visibleOnly: false,
    },
  })
  const button = screen.getByRole('button').query() as HTMLElement
  button.focus()
  await Promise.resolve()

  await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
})

it('closes on blur', async () => {
  vi.useRealTimers()
  const screen = render(App, {
    props: {
      visibleOnly: false,
    },
  })
  const button = screen.getByRole('button').query() as HTMLElement
  button.focus()
  await Promise.resolve()
  await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()

  button.blur()
  await Promise.resolve()
  await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
})

// TODO: inspect
it('stays open when focus moves to tooltip rendered inside a shadow root', async () => {
  vi.useRealTimers()
  const container = document.body.appendChild(
    document.createElement('render-root'),
  )
  const renderRoot = container.shadowRoot?.firstElementChild as HTMLElement

  const screen = render(App, {
    container: renderRoot,
  })

  const button = screen.getByRole('button').query() as HTMLElement

  // Open the tooltip by focusing the reference
  button.focus()
  await Promise.resolve()

  // Move focus to the tooltip
  const tooltip = screen.getByRole('tooltip').query() as HTMLElement
  tooltip.focus()

  // trigger the blur event caused by the focus move, note relatedTarget points to the shadow root here
  button.dispatchEvent(new FocusEvent('blur', { relatedTarget: container }))
  await Promise.resolve()

  await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
})

it('stays open when focus moves to element inside reference that is rendered inside a shadow root', async () => {
  vi.useRealTimers()
  const container = document.body.appendChild(
    document.createElement('render-root'),
  )
  const renderRoot = container.shadowRoot?.firstElementChild as HTMLElement

  const screen = render(App, { container: renderRoot })

  // Open the tooltip by focusing the reference
  const button = screen.getByRole('button').query() as HTMLElement
  button.focus()
  await Promise.resolve()

  // Move focus to an element inside the reference
  const insideReference = screen.getByTestId('inside-reference').query() as HTMLElement
  insideReference.focus()
  await Promise.resolve()

  // trigger the blur event caused by the focus move, note relatedTarget points to the shadow root here
  button.dispatchEvent(new FocusEvent('blur', { relatedTarget: container }))
  await Promise.resolve()

  await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
})

it('does not open with a reference pointerDown dismissal', async () => {
  const screen = render(App, {
    props: {
      dismiss: true,
    },
  })
  const button = screen.getByRole('button').query() as HTMLElement

  button.dispatchEvent(new PointerEvent('pointerdown'))
  await Promise.resolve()
  button.focus()
  await Promise.resolve()
  await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
})

it('does not open when window blurs then receives focus', async () => {
  // TODO — not sure how to test this in JSDOM
})

// test('blurs when hitting an "inside" focus guard', async () => {
//   vi.useRealTimers();

//   function Tooltip({children}: {children: React.JSX.Element}) {
//     const [open, setOpen] = useState(false);

//     const {refs, context} = useFloating({
//       open,
//       onOpenChange: setOpen,
//     });

//     const {getReferenceProps, getFloatingProps} = useInteractions([
//       useFocus(context),
//     ]);

//     return (
//       <>
//         {cloneElement(children, getReferenceProps({ref: refs.setReference}))}
//         {open && (
//           <div role="tooltip" ref={refs.setFloating} {...getFloatingProps()}>
//             Label
//           </div>
//         )}
//       </>
//     );
//   }

//   function App() {
//     const [open, setOpen] = useState(false);

//     const {refs, context} = useFloating({
//       open,
//       onOpenChange: setOpen,
//     });

//     const {getReferenceProps, getFloatingProps} = useInteractions([
//       useClick(context),
//     ]);

//     return (
//       <>
//         <button ref={refs.setReference} {...getReferenceProps()} />
//         {open && (
//           <FloatingFocusManager context={context}>
//             <div ref={refs.setFloating} {...getFloatingProps()}>
//               <button />
//               <Tooltip>
//                 <button />
//               </Tooltip>
//             </div>
//           </FloatingFocusManager>
//         )}
//       </>
//     );
//   }

//   render(<App />);

//   await userEvent.click(screen.getByRole('button'));

//   await userEvent.tab();

//   expect(screen.queryByRole('tooltip')).toBeInTheDocument();

//   await userEvent.tab();

//   // Wait for the timeout in `onBlur()`.
//   await act(() => new Promise((resolve) => setTimeout(resolve)));

//   expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

//   cleanup();
// });

it('reason string', async () => {
  const App = defineComponent({
    setup() {
      const isOpen = shallowRef(false)
      const { refs, context } = useFloating({
        open: isOpen,
        onOpenChange(value, _, reason) {
          isOpen.value = value
          expect(reason).toBe('focus')
        },
      })

      const focus = useFocus(context)
      const { getReferenceProps, getFloatingProps } = useInteractions([focus])

      return () => (
        <>
          <button {...getReferenceProps({ ref: refs.setReference })}>button</button>
          {isOpen.value && (
            <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>tooltip</div>
          )}
        </>
      )
    },
  })

  const screen = render(App)
  const button = screen.getByRole('button').query() as HTMLElement
  button.focus()
  await Promise.resolve()
  button.blur()
  await Promise.resolve()
})

describe('visibleOnly prop', () => {
  const App = defineComponent({
    props: {
      visibleOnly: {
        type: Boolean,
        default: undefined,
      },
    },
    inheritAttrs: false,
    setup(props) {
      const isOpen = shallowRef(false)
      const { refs, context } = useFloating({
        open: isOpen,
        onOpenChange(value, _, reason) {
          isOpen.value = value
          expect(reason).toBe('focus')
        },
      })

      const focus = useFocus(context, { visibleOnly: props.visibleOnly })
      const { getReferenceProps, getFloatingProps } = useInteractions([focus])

      return () => (
        <>
          <button {...getReferenceProps({ ref: refs.setReference })}>button</button>
          {isOpen.value && (
            <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>tooltip</div>
          )}
        </>
      )
    },
  })

  it('true', async () => {
    const screen = render(App, {
      props: {
        visibleOnly: true,
      },
    })
    const button = screen.getByRole('button')
    await userEvent.click(button)
    await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
  })

  it('false', async () => {
    const screen = render(App, {
      props: {
        visibleOnly: false,
      },
    })
    const button = screen.getByRole('button')
    await userEvent.click(button)
    await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
  })
})
