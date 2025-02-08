import type { MaybeRef, PropType } from 'vue'
import type { UseTypeaheadProps } from '../src/hooks/useTypeahead.ts'
import type { ElAttrs } from '../src/types.ts'

import type { MutableRefObject } from '../src/vue/index.ts'
import userEvent from '@testing-library/user-event'
import { cleanup, fireEvent, render, screen } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { computed, defineComponent, shallowRef, unref } from 'vue'
import { useClick, useFloating, useInteractions, useTypeahead } from '../src/index.ts'
import { useRef } from '../src/vue/index.ts'
import { act } from './utils.ts'
// import { Main } from '../visual/components/Menu'

vi.useFakeTimers({ shouldAdvanceTime: true })

function useImpl(props: {
  typeahead?: Pick<UseTypeaheadProps, 'onMatch' | 'onTypingChange'> & {
    list?: MutableRefObject<Array<string>>
    open?: MaybeRef<boolean>
    onOpenChange?: (open: boolean) => void
    addUseClick?: boolean
  }
}) {
  const open = shallowRef(true)
  const activeIndex = shallowRef<number>()
  const { refs, context } = useFloating({
    open: props.typeahead?.open === undefined ? open : computed(() => unref(props.typeahead?.open) ?? false),
    onOpenChange(v) {
      if (props.typeahead?.onOpenChange) {
        props.typeahead?.onOpenChange(v)
      }
      else {
        open.value = v
      }
    },
  })
  const list = props.typeahead?.list ?? useRef(['one', 'two', 'three'])
  const typeahead = useTypeahead(context, {
    listRef: list,
    activeIndex,
    onMatch(index) {
      activeIndex.value = index
      props.typeahead?.onMatch?.(index)
    },
    onTypingChange: props.typeahead?.onTypingChange,
  })
  const click = useClick(context, {
    enabled: props.typeahead?.addUseClick ?? false,
  })

  const { getReferenceProps, getFloatingProps } = useInteractions([
    typeahead,
    click,
  ])

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
      type: Object as PropType<Pick<UseTypeaheadProps, 'onMatch' | 'onTypingChange'> & { list?: MutableRefObject<Array<string>> }>,
      default: undefined,
    },
  },
  setup(props) {
    const { getReferenceProps, getFloatingProps } = useImpl(props)

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
      type: Object as PropType<Pick<UseTypeaheadProps, 'onMatch' | 'onTypingChange'> & { list?: MutableRefObject<Array<string>> }>,
      default: undefined,
    },
  },
  setup(props) {
    const isOpen = shallowRef(false)
    const { getReferenceProps, getFloatingProps } = useImpl({
      typeahead: {
        onMatch: props.typeahead?.onMatch,
        open: isOpen,
        onOpenChange(v) {
          isOpen.value = v
        },
        addUseClick: true,
      },
    })

    return () => (
      <>
        <div tabindex={0} {...getReferenceProps()} />
        {isOpen.value && <div {...getFloatingProps()} />}
      </>
    )
  },
})

it('rapidly focuses list items when they start with the same letter', async () => {
  const spy = vi.fn()
  render(Combobox, {
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

  cleanup()
})

it('bails out of rapid focus of first letter if the list contains a string that starts with two of the same letter', async () => {
  const spy = vi.fn()
  render(Combobox, {
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

  cleanup()
})

it('starts from the current activeIndex and correctly loops', async () => {
  const spy = vi.fn()

  render(Combobox, {
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

  await vi.advanceTimersByTime(750)

  await userEvent.keyboard('t')
  await userEvent.keyboard('o')
  await userEvent.keyboard('y')
  expect(spy).toHaveBeenCalledWith(1)

  await vi.advanceTimersByTime(750)

  await userEvent.keyboard('t')
  await userEvent.keyboard('o')
  await userEvent.keyboard('y')
  expect(spy).toHaveBeenCalledWith(2)

  await vi.advanceTimersByTime(750)

  await userEvent.keyboard('t')
  await userEvent.keyboard('o')
  await userEvent.keyboard('y')
  expect(spy).toHaveBeenCalledWith(0)

  cleanup()
})

it('capslock characters continue to match', async () => {
  const spy = vi.fn()
  render(Combobox, {
    props: {
      typeahead: {
        onMatch: spy,
      },
    },
  })

  await userEvent.click(screen.getByRole('combobox'))

  await userEvent.keyboard('{CapsLock}t')
  expect(spy).toHaveBeenCalledWith(1)

  cleanup()
})

const App1 = defineComponent({
  props: {
    typeahead: {
      type: Object as PropType<Pick<UseTypeaheadProps, 'onMatch'> & { list: MutableRefObject<Array<string>> }>,
      required: true,
    },
  },
  setup(props) {
    const { getReferenceProps, getFloatingProps, activeIndex, open } = useImpl(props)
    let inputRef: HTMLInputElement | undefined

    return () => (
      <>
        <div
          {...getReferenceProps({
            onClick: () => inputRef?.focus(),
          })}
        >
          <input ref={(el: any) => inputRef = el} readonly={true} />
        </div>
        {open.value && (
          <div {...getFloatingProps()}>
            {props.typeahead.list.current.map((value, i) => (
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
  render(App1, {
    props: {
      typeahead: {
        onMatch: spy,
        list: useRef(['one', 'two', 'three']),
      },
    },
  })

  await fireEvent.click(screen.getByRole('combobox'))

  await userEvent.keyboard('t')
  expect(spy).toHaveBeenCalledWith(1)

  cleanup()
})

it('matches when focus is withing floating', async () => {
  const spy = vi.fn()
  render(App1, {
    props: {
      typeahead: {
        onMatch: spy,
        list: useRef(['one', 'two', 'three']),
      },
    },
  })

  await userEvent.click(screen.getByRole('combobox'))
  await userEvent.keyboard('t')
  const option = await screen.findByRole('option', { selected: true })
  expect(option.textContent).toBe('two')
  option.focus()
  expect(option).toHaveFocus()

  await userEvent.keyboard('h')
  expect((await screen.findByRole('option', { selected: true })).textContent).toBe('three')

  cleanup()
})

it('onTypingChange is called when typing starts or stops', async () => {
  const spy = vi.fn()
  render(Combobox, {
    props: {
      typeahead: {
        onTypingChange: spy,
        list: useRef(['one', 'two', 'three']),
      },
    },
  })
  screen.getByRole('combobox').focus()

  await userEvent.keyboard('t')
  expect(spy).toHaveBeenCalledTimes(1)
  expect(spy).toHaveBeenCalledWith(true)

  await vi.advanceTimersByTime(750)
  expect(spy).toHaveBeenCalledTimes(2)
  expect(spy).toHaveBeenCalledWith(false)

  cleanup()
})

// TODO: test Menu component

it('typing spaces on <div> references does not open the menu', async () => {
  const spy = vi.fn()
  render(Select, {
    props: {
      typeahead: {
        onMatch: spy,
      },
    },
  })
  vi.useFakeTimers({ shouldAdvanceTime: true })

  await userEvent.click(screen.getByRole('combobox'))
  expect(screen.queryByRole('listbox')).toBeInTheDocument()

  await userEvent.keyboard('h')
  await userEvent.keyboard(' ')
  await act()

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

  await vi.advanceTimersByTime(750)

  await userEvent.keyboard(' ')
  await act()

  expect(screen.queryByRole('listbox')).toBeInTheDocument()

  cleanup()
})
