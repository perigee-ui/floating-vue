import { cleanup, fireEvent, render, screen } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { defineComponent, shallowRef } from 'vue'
import { useDelayGroup, useFloating, useFloatingDelayGroup, useHover, useInteractions } from '../src/index.ts'
import { act } from './utils.ts'

vi.useFakeTimers()

const Tooltip = defineComponent({
  props: {
    label: {
      type: String,
      required: true,
    },
    testid: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const open = shallowRef(false)
    const { x, y, refs, strategy, context } = useFloating({
      open,
      onOpenChange(v) {
        open.value = v
      },
    })

    const ctx = useDelayGroup(context)

    const hover = useHover(context, {
      delay: () => ctx.state.delay,
    })
    const { getReferenceProps } = useInteractions([hover])

    return () => (
      <div>

        <button
          data-testid={props.testid}
          type="button"
          {...getReferenceProps({ ref: refs.setReference })}
        >
          Button
        </button>

        {open.value && (
          <div
            data-testid={`floating-${props.label}`}
            ref={(el: any) => refs.setFloating(el)}
            style={{
              position: strategy.value,
              top: y.value ? `${y.value}px` : '',
              left: x.value ? `${x.value}px` : '',
            }}
          >
            { props.label }
          </div>
        )}
      </div>
    )
  },
})

const App = defineComponent({
  setup() {
    useFloatingDelayGroup({
      delay: {
        open: 1000,
        close: 200,
      },
    })

    return () => (
      <div>
        <Tooltip label="one" testid="reference-one" />
        <Tooltip label="two" testid="reference-two" />
        <Tooltip label="three" testid="reference-three" />
      </div>
    )
  },
})

it('groups delays correctly', async () => {
  render(App)

  await fireEvent.mouseEnter(screen.getByTestId('reference-one'))
  await vi.advanceTimersByTime(1)
  await act()

  expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument()

  await vi.advanceTimersByTime(999)
  await act()

  expect(screen.queryByTestId('floating-one')).toBeInTheDocument()

  await fireEvent.mouseEnter(screen.getByTestId('reference-two'))

  await vi.advanceTimersByTime(1)

  expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument()
  expect(screen.queryByTestId('floating-two')).toBeInTheDocument()

  await fireEvent.mouseEnter(screen.getByTestId('reference-three'))

  await vi.advanceTimersByTime(1)
  await act()

  expect(screen.queryByTestId('floating-two')).not.toBeInTheDocument()
  expect(screen.queryByTestId('floating-three')).toBeInTheDocument()

  await fireEvent.mouseLeave(screen.getByTestId('reference-three'))

  await vi.advanceTimersByTime(1)
  await act()

  expect(screen.queryByTestId('floating-three')).toBeInTheDocument()

  await vi.advanceTimersByTime(199)
  await act()

  expect(screen.queryByTestId('floating-three')).not.toBeInTheDocument()
  cleanup()
})

it('timeoutMs', async () => {
  const App2 = defineComponent({
    setup() {
      useFloatingDelayGroup({
        delay: {
          open: 1000,
          close: 100,
        },
        timeoutMs: 500,
      })

      return () => (
        <div>
          <Tooltip label="one" testid="reference-one" />
          <Tooltip label="two" testid="reference-two" />
          <Tooltip label="three" testid="reference-three" />
        </div>
      )
    },
  })

  render(App2)

  await fireEvent.mouseEnter(screen.getByTestId('reference-one'))
  await vi.advanceTimersByTime(1000)

  await fireEvent.mouseLeave(screen.getByTestId('reference-one'))
  expect(screen.queryByTestId('floating-one')).toBeInTheDocument()

  await vi.advanceTimersByTime(499)

  expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument()

  await fireEvent.mouseEnter(screen.getByTestId('reference-two'))

  await vi.advanceTimersByTime(1)

  expect(screen.queryByTestId('floating-two')).toBeInTheDocument()

  await fireEvent.mouseEnter(screen.getByTestId('reference-three'))
  await vi.advanceTimersByTime(1)

  expect(screen.queryByTestId('floating-two')).not.toBeInTheDocument()
  expect(screen.queryByTestId('floating-three')).toBeInTheDocument()

  await fireEvent.mouseLeave(screen.getByTestId('reference-three'))

  await vi.advanceTimersByTime(1)

  expect(screen.queryByTestId('floating-three')).toBeInTheDocument()

  await vi.advanceTimersByTime(99)

  expect(screen.queryByTestId('floating-three')).not.toBeInTheDocument()

  cleanup()
})
