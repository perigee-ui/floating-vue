import type { PropType } from 'vue'
import type { UseListNavigationProps } from '../src/index.ts'
// import userEvent from '@testing-library/user-event'
// import { expect, it, vi } from 'vitest'

import type { MutableRefObject } from '../src/vue/index.ts'
import userEvent from '@testing-library/user-event'
import { cleanup, fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, shallowRef, watchSyncEffect } from 'vue'
import { useInteractions } from '../src/hooks/useInteractions.ts'
import { useClick, useDismiss, useFloating, useListNavigation } from '../src/index.ts'
import { useRef } from '../src/vue/index.ts'
import { act } from './utils.ts'
// import { useFloating } from '../hooks/useFloating.ts'

const App = defineComponent({
  props: {
    list: {
      type: Object as PropType<Omit<Partial<UseListNavigationProps>, 'list'>>,
      default: undefined,
    },
  },
  setup(props) {
    const open = shallowRef(false)
    const activeIndex = shallowRef<number | undefined>(undefined)

    const listRef = useRef<(HTMLLIElement | undefined)[]>([])

    const { refs, context } = useFloating({
      open,
      onOpenChange(val) {
        open.value = val
      },
    })

    const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
      useClick(context),
      useListNavigation(
        context,
        {
          loop: props.list?.loop,
          orientation: props.list?.orientation,
          focusItemOnOpen: props.list?.focusItemOnOpen,
          allowEscape: props.list?.allowEscape,
          virtual: props.list?.virtual,
          openOnArrowKeyDown: props.list?.openOnArrowKeyDown,
          disabledIndices: props.list?.disabledIndices,
          focusItemOnHover: props.list?.focusItemOnHover,
          listRef,
          activeIndex,
          onNavigate(index) {
            props.list?.onNavigate?.(index)
            activeIndex.value = index
          },
        },
      ),
    ])

    const items = ['one', 'two', 'three']

    return () => (
      <>
        <button type="button" {...getReferenceProps({ ref: refs.setReference })} />
        {open.value && (
          <div role="menu" {...getFloatingProps({ ref: refs.setFloating })}>
            <ul>
              {items.map((string, index) => (
                <li
                  data-testid={`item-${index}`}
                  aria-selected={activeIndex.value === index}
                  key={string}
                  tabindex={-1}
                  {...getItemProps({
                    ref(node: HTMLLIElement) {
                      if (!node) {
                        listRef.current.splice(index, 1)
                      }
                      else {
                        listRef.current[index] = node
                      }
                    },
                  })}
                >
                  {string}
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    )
  },
})

it('opens on ArrowDown and focuses first item', async () => {
  render(App)
  await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
  await act()
  await act()

  expect(screen.getByRole('menu')).toBeInTheDocument()
  expect(screen.getByTestId('item-0')).toHaveFocus()
  cleanup()
})

it('navigates down on ArrowDown', async () => {
  render(App)

  await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
  expect(screen.queryByRole('menu')).toBeInTheDocument()
  expect(screen.getByTestId('item-0')).toHaveFocus()

  await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
  expect(screen.getByTestId('item-1')).toHaveFocus()

  await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
  expect(screen.getByTestId('item-2')).toHaveFocus()

  // Reached the end of the list.
  await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
  expect(screen.getByTestId('item-2')).toHaveFocus()

  cleanup()
})

it('navigates up on ArrowUp', async () => {
  render(App)

  await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' })
  expect(screen.queryByRole('menu')).toBeInTheDocument()
  expect(screen.getByTestId('item-2')).toHaveFocus()

  await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
  expect(screen.getByTestId('item-1')).toHaveFocus()

  await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
  expect(screen.getByTestId('item-0')).toHaveFocus()

  // Reached the end of the list.
  await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
  expect(screen.getByTestId('item-0')).toHaveFocus()

  cleanup()
})

it('resets indexRef to -1 upon close', async () => {
  const data = ['a', 'ab', 'abc', 'abcd']
  const Autocomplete = defineComponent({
    setup() {
      const isOpen = shallowRef(false)
      const inputValue = shallowRef('')
      const activeIndex = shallowRef<number | undefined>(undefined)

      const listRef = useRef<(HTMLLIElement | undefined)[]>([])

      const { context, refs } = useFloating<HTMLInputElement>({
        open: isOpen,
        onOpenChange(val) {
          isOpen.value = val
        },
      })

      const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
        useDismiss(context),
        useListNavigation(
          context,
          {
            listRef,
            activeIndex,
            onNavigate(index) {
              activeIndex.value = index
            },
            virtual: true,
            loop: true,
          },
        ),
      ])

      function onInput(event: Event) {
        const value = (event.target as HTMLInputElement).value
        inputValue.value = value

        if (value) {
          activeIndex.value = undefined
          isOpen.value = true
        }
        else {
          isOpen.value = false
        }
      }

      function onItemClick(item: string) {
        inputValue.value = item
        isOpen.value = false
        refs.domReference.current?.focus()
      }

      const items = computed(() => {
        return data.filter(item => item.includes(inputValue.value))
      })

      return () => (
        <>
          <input
            {...getReferenceProps({
              'ref': refs.setReference,
              onInput,
              'value': inputValue.value,
              'placeholder': 'Enter fruit',
              'aria-autocomplete': 'list',
            })}
            data-testid="reference"
          />
          {isOpen.value && (
            <div
              {...getFloatingProps({
                ref: refs.setFloating,
              })}
              data-testid="floating"
            >
              <ul>
                {items.value.map((item, index) => (
                  <li
                    key={item}
                    {...getItemProps({
                      ref(node: any) {
                        if (!node) {
                          listRef.current.splice(index, 1)
                        }
                        else {
                          listRef.current[index] = node
                        }
                      },
                      onClick() {
                        onItemClick(item)
                      },
                    })}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div data-testid="active-index">{activeIndex.value}</div>
        </>
      )
    },
  })

  render(Autocomplete)

  screen.getByTestId('reference').focus()
  await userEvent.keyboard('a')

  expect(screen.getByTestId('floating')).toBeInTheDocument()
  expect(screen.getByTestId('active-index').textContent).toBe('')

  await userEvent.keyboard('{ArrowDown}')
  await userEvent.keyboard('{ArrowDown}')
  await userEvent.keyboard('{ArrowDown}')

  expect(screen.getByTestId('active-index').textContent).toBe('2')

  await userEvent.keyboard('{Escape}')

  expect(screen.getByTestId('active-index').textContent).toBe('')

  await userEvent.keyboard('{Backspace}')
  await userEvent.keyboard('a')

  expect(screen.getByTestId('floating')).toBeInTheDocument()
  expect(screen.getByTestId('active-index').textContent).toBe('')

  await userEvent.keyboard('{ArrowDown}')

  expect(screen.getByTestId('active-index').textContent).toBe('0')

  cleanup()
})

describe('loop', () => {
  it('arrowDown looping', async () => {
    render(App, {
      props: {
        list: {
          loop: true,
        },
      },
    })

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    expect(screen.queryByRole('menu')).toBeInTheDocument()
    expect(screen.getByTestId('item-0')).toHaveFocus()

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
    expect(screen.getByTestId('item-1')).toHaveFocus()

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
    expect(screen.getByTestId('item-2')).toHaveFocus()

    // Reached the end of the list and loops.
    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
    expect(screen.getByTestId('item-0')).toHaveFocus()

    cleanup()
  })

  it('arrowUp looping', async () => {
    render(App, {
      props: {
        list: {
          loop: true,
        },
      },
    })

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' })
    expect(screen.queryByRole('menu')).toBeInTheDocument()
    expect(screen.getByTestId('item-2')).toHaveFocus()

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
    expect(screen.getByTestId('item-1')).toHaveFocus()

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
    expect(screen.getByTestId('item-0')).toHaveFocus()

    // Reached the end of the list and loops.
    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
    expect(screen.getByTestId('item-2')).toHaveFocus()

    cleanup()
  })
})

describe('orientation', () => {
  it('navigates down on ArrowDown', async () => {
    render(App, {
      props: {
        list: {
          orientation: 'horizontal',
        },
      },
    })

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowRight' })
    expect(screen.queryByRole('menu')).toBeInTheDocument()
    expect(screen.getByTestId('item-0')).toHaveFocus()

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' })
    expect(screen.getByTestId('item-1')).toHaveFocus()

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' })
    expect(screen.getByTestId('item-2')).toHaveFocus()

    // Reached the end of the list.
    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' })
    expect(screen.getByTestId('item-2')).toHaveFocus()

    cleanup()
  })

  it('navigates up on ArrowLeft', async () => {
    render(App, {
      props: {
        list: {
          orientation: 'horizontal',
        },
      },
    })

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowLeft' })
    expect(screen.queryByRole('menu')).toBeInTheDocument()
    expect(screen.getByTestId('item-2')).toHaveFocus()

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' })
    expect(screen.getByTestId('item-1')).toHaveFocus()

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' })
    expect(screen.getByTestId('item-0')).toHaveFocus()

    // Reached the end of the list.
    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' })
    expect(screen.getByTestId('item-0')).toHaveFocus()

    cleanup()
  })
})

describe('focusItemOnOpen', () => {
  it('true click', async () => {
    render(App, {
      props: {
        list: {
          focusItemOnOpen: true,
        },
      },
    })
    await fireEvent.click(screen.getByRole('button'))
    expect(screen.getByTestId('item-0')).toHaveFocus()
    cleanup()
  })

  it('false click', async () => {
    render(App, {
      props: {
        list: {
          focusItemOnOpen: false,
        },
      },
    })
    await fireEvent.click(screen.getByRole('button'))
    expect(screen.getByTestId('item-0')).not.toHaveFocus()
    cleanup()
  })
})

describe('allowEscape + virtual', () => {
  it('true', async () => {
    render(App, {
      props: {
        list: {
          allowEscape: true,
          virtual: true,
          loop: true,
        },
      },
    })

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    expect(screen.getByTestId('item-0').getAttribute('aria-selected')).toBe('true')
    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' })
    expect(screen.getByTestId('item-0').getAttribute('aria-selected')).toBe('false')
    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    expect(screen.getByTestId('item-0').getAttribute('aria-selected')).toBe('true')
    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    expect(screen.getByTestId('item-1').getAttribute('aria-selected')).toBe('true')
    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    expect(screen.getByTestId('item-2').getAttribute('aria-selected')).toBe('true')
    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    expect(screen.getByTestId('item-2').getAttribute('aria-selected')).toBe('false')
    cleanup()
  })

  it('false', async () => {
    render(App, {
      props: {
        list: {
          allowEscape: false,
          virtual: true,
          loop: true,
        },
      },
    })
    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    expect(screen.getByTestId('item-0').getAttribute('aria-selected')).toBe('true')
    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    expect(screen.getByTestId('item-1').getAttribute('aria-selected')).toBe('true')
    cleanup()
  })

  it('true - onNavigate is called with `null` when escaped', async () => {
    const spy = vi.fn()
    render(App, {
      props: {
        list: {
          allowEscape: true,
          virtual: true,
          loop: true,
          onNavigate: spy,
        },
      },
    })
    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' })
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenCalledWith(undefined)
    cleanup()
  })
})

describe('openOnArrowKeyDown', () => {
  it('true ArrowDown', async () => {
    render(App, {
      props: {
        list: {
          openOnArrowKeyDown: true,
        },
      },
    })
    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    expect(screen.getByRole('menu')).toBeInTheDocument()
    cleanup()
  })

  it('true ArrowUp', async () => {
    render(App, {
      props: {
        list: {
          openOnArrowKeyDown: true,
        },
      },
    })
    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' })
    expect(screen.getByRole('menu')).toBeInTheDocument()
    cleanup()
  })

  it('false ArrowDown', async () => {
    render(App, {
      props: {
        list: {
          openOnArrowKeyDown: false,
        },
      },
    })
    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    cleanup()
  })

  it('false ArrowUp', async () => {
    render(App, {
      props: {
        list: {
          openOnArrowKeyDown: false,
        },
      },
    })
    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    cleanup()
  })
})

describe('disabledIndices', () => {
  it('indicies are skipped in focus order', async () => {
    render(App, {
      props: {
        list: {
          disabledIndices: [0],
        },
      },
    })

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
    expect(screen.getByTestId('item-1')).toHaveFocus()
    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
    expect(screen.getByTestId('item-1')).toHaveFocus()
    cleanup()
  })
})

describe('focusOnHover', () => {
  it('true - focuses item on hover and syncs the active index', async () => {
    const spy = vi.fn()
    render(App, {
      props: {
        list: {
          onNavigate: spy,
        },
      },
    })
    await fireEvent.click(screen.getByRole('button'))
    await fireEvent.mouseMove(screen.getByTestId('item-1'))
    expect(screen.getByTestId('item-1')).toHaveFocus()
    await fireEvent.pointerLeave(screen.getByTestId('item-1'))
    expect(screen.getByRole('menu')).toHaveFocus()
    expect(spy).toHaveBeenCalledWith(1)
    cleanup()
  })

  it('false - does not focus item on hover and does not sync the active index', async () => {
    const spy = vi.fn()

    render(App, {
      props: {
        list: {
          onNavigate: spy,
          focusItemOnOpen: false,
          focusItemOnHover: false,
        },
      },
    })

    await fireEvent.click(screen.getByRole('button'))
    await fireEvent.mouseMove(screen.getByTestId('item-1'))
    expect(screen.getByTestId('item-1')).not.toHaveFocus()
    expect(spy).toHaveBeenCalledTimes(0)
    cleanup()
  })
})

// TODO: add grid

it('scheduled list population', async () => {
  const Option = defineComponent({
    props: {
      list: {
        type: Object as PropType<MutableRefObject<(HTMLElement | undefined)[]>>,
        required: true,
      },
      active: {
        type: Boolean,
      },
      index: {
        type: Number,
        required: true,
      },
      getItemProps: {
        type: Function as PropType<() => Record<string, unknown>>,
        required: true,
      },
    },
    setup(props) {
      const index = shallowRef(-1)

      watchSyncEffect(() => {
        index.value = props.index
      })

      return () => (
        <div
          role="option"
          aria-selected={props.active}
          tabindex={props.active ? 0 : -1}
          ref={(node: any) => {
            if (index.value !== -1) {
              props.list.current[index.value] = node
            }
          }}
          {...props.getItemProps()}
        />
      )
    },
  })

  const App = defineComponent({
    setup() {
      const open = shallowRef(false)
      const activeIndex = shallowRef<number | undefined>(undefined)

      const listRef = useRef<(HTMLLIElement | undefined)[]>([])

      const { refs, context } = useFloating({
        open,
        onOpenChange(val) {
          open.value = val
        },
      })

      const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
        useListNavigation(
          context,
          {
            listRef,
            activeIndex,
            onNavigate(index) {
              activeIndex.value = index
            },
          },
        ),
      ])

      return () => (
        <>
          <button
            {...getReferenceProps({
              ref: refs.setReference,
              onClick() {
                open.value = !open.value
              },
            })}
          >
            Open
          </button>

          {open.value && (
            <div {...getFloatingProps({ ref: refs.setFloating })}>
              {['one', 'two', 'three'].map((option, index) => (
                <Option
                  key={option}
                  list={listRef}
                  getItemProps={getItemProps}
                  index={index}
                  active={activeIndex.value === index}
                />
              ))}
            </div>
          )}
        </>
      )
    },
  })

  render(App)

  await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' })
  await act()

  expect(screen.getAllByRole('option')[2]).toHaveFocus()

  await fireEvent.click(screen.getByRole('button'))
  await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })

  await act()

  expect(screen.getAllByRole('option')[0]).toHaveFocus()

  cleanup()
})

// TODO: add tests
