import type { PropType } from 'vue'

import type { UseRoleProps } from '../src/hooks/useRole.ts'
import { userEvent } from '@vitest/browser/context'

import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-vue'
import { defineComponent, shallowRef, useId } from 'vue'
import {
  useClick,
  useFloating,
  useInteractions,
  useRole,
} from '../src/index.ts'

const App = defineComponent({
  props: {
    initiallyOpen: {
      type: Boolean,
      default: false,
    },
    roleProps: {
      type: Object as PropType<UseRoleProps>,
      default: undefined,
    },
  },
  setup(props) {
    const open = shallowRef(props.initiallyOpen)
    const { refs, context } = useFloating({
      open,
      onOpenChange(value) {
        open.value = value
      },
    })
    const { getReferenceProps, getFloatingProps } = useInteractions([
      useRole(context, props.roleProps),
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
          button
        </button>

        {open.value && (
          <div
            {...getFloatingProps({ ref: refs.setFloating })}
          >
            Floating
          </div>
        )}
      </>
    )
  },
})

const AppWithExternalRef = defineComponent({
  props: {
    initiallyOpen: {
      type: Boolean,
      default: false,
    },
    roleProps: {
      type: Object as PropType<UseRoleProps>,
      default: undefined,
    },
  },
  setup(props) {
    const open = shallowRef(props.initiallyOpen)
    const nodeId = useId()
    const { refs, context } = useFloating({
      nodeId,
      open,
      onOpenChange(value) {
        open.value = value
      },
    })
    // External ref can use it's own set of interactions hooks, but share context
    const { getFloatingProps } = useInteractions([useRole(context, props.roleProps)])
    const { getReferenceProps } = useInteractions([useRole(context, props.roleProps)])

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
          button
        </button>

        {open.value && (
          <div
            {...getFloatingProps({
              ref: refs.setFloating,
            })}
          >
            Floating
          </div>
        )}
      </>
    )
  },
})

describe('tooltip', () => {
  it('has correct role', async () => {
    const screen = render(App, {
      props: {
        initiallyOpen: true,
        roleProps: {
          role: 'tooltip',
        },
      },
    })

    await expect.element(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('sets correct aria attributes based on the open state', async () => {
    const screen = render(App, {
      props: {
        roleProps: {
          role: 'tooltip',
        },
      },
    })
    const button = screen.getByRole('button').query()! as HTMLButtonElement
    await userEvent.click(button)
    expect(button.hasAttribute('aria-describedby')).toBe(true)
    await userEvent.click(button)
    expect(button.hasAttribute('aria-describedby')).toBe(false)
  })
})

describe('label', () => {
  it('sets correct aria attributes based on the open state', async () => {
    const screen = render(App, {
      props: {
        initiallyOpen: true,
        roleProps: {
          role: 'label',
        },
      },
    })
    await Promise.resolve()
    await expect.element(screen.getByRole('tooltip')).not.toBeInTheDocument()
    expect(!!document.querySelector('[aria-labelledby]')).toBe(true)
  })
})

describe('dialog', () => {
  it('sets correct aria attributes based on the open state', async () => {
    const screen = render(App, {
      props: {
        roleProps: {
          role: 'dialog',
        },
      },
    })

    const button = screen.getByRole('button').query()! as HTMLButtonElement

    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    expect(button.getAttribute('aria-expanded')).toBe('false')

    await userEvent.click(button)

    await expect.element(screen.getByRole('dialog')).toBeInTheDocument()
    expect(button.getAttribute('aria-controls')).toBe(
      screen.getByRole('dialog').query()!.getAttribute('id'),
    )
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('true')

    await userEvent.click(button)

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument()
    expect(button.hasAttribute('aria-controls')).toBe(false)
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('sets correct aria attributes with external ref, multiple useRole calls', async () => {
    const screen = render(AppWithExternalRef, {
      props: {
        roleProps: {
          role: 'dialog',
        },
      },
    })

    const button = screen.getByRole('button').query()! as HTMLButtonElement

    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    expect(button.getAttribute('aria-expanded')).toBe('false')

    await userEvent.click(button)

    await expect.element(screen.getByRole('dialog')).toBeInTheDocument()
    expect(button.getAttribute('aria-controls')).toBe(
      screen.getByRole('dialog').query()!.getAttribute('id'),
    )
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('true')

    await userEvent.click(button)

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument()
    expect(button.hasAttribute('aria-controls')).toBe(false)
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('menu', () => {
  it('sets correct aria attributes based on the open state', async () => {
    const screen = render(App, {
      props: {
        roleProps: {
          role: 'menu',
        },
      },
    })

    const button = screen.getByRole('button').query()! as HTMLButtonElement

    expect(button.getAttribute('aria-haspopup')).toBe('menu')
    expect(button.getAttribute('aria-expanded')).toBe('false')

    await userEvent.click(button)

    await expect.element(screen.getByRole('menu')).toBeInTheDocument()
    expect(button.getAttribute('id')).toBe(
      screen.getByRole('menu').query()!.getAttribute('aria-labelledby'),
    )
    expect(button.getAttribute('aria-controls')).toBe(
      screen.getByRole('menu').query()!.getAttribute('id'),
    )
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('true')

    await userEvent.click(button)

    await expect.element(screen.getByRole('menu')).not.toBeInTheDocument()
    expect(button.hasAttribute('aria-controls')).toBe(false)
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('listbox', () => {
  it('sets correct aria attributes based on the open state', async () => {
    const screen = render(App, {
      props: {
        roleProps: {
          role: 'listbox',
        },
      },
    })

    const button = screen.getByRole('combobox').query()! as HTMLButtonElement

    expect(button.getAttribute('aria-haspopup')).toBe('listbox')
    expect(button.getAttribute('aria-expanded')).toBe('false')

    await userEvent.click(button)

    await expect.element(screen.getByRole('listbox')).toBeInTheDocument()
    expect(button.getAttribute('aria-controls')).toBe(
      screen.getByRole('listbox').query()!.getAttribute('id'),
    )
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('true')

    await userEvent.click(button)

    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument()
    expect(button.hasAttribute('aria-controls')).toBe(false)
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('select', () => {
  it('sets correct aria attributes based on the open state', async () => {
    const Select = defineComponent({
      setup() {
        const isOpen = shallowRef(false)
        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange(value) {
            isOpen.value = value
          },
        })
        const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
          useClick(context),
          useRole(context, { role: 'select' }),
        ])
        return () => (
          <>
            <button ref={(el: any) => refs.setReference(el)} {...getReferenceProps()}>button</button>
            {isOpen.value && (
              <div ref={(el: any) => refs.setFloating(el)} {...getFloatingProps()}>
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    data-testid={`item-${i}`}
                    {...getItemProps({ active: i === 2, selected: i === 2 })}
                  >
                    Item
                  </div>
                ))}
              </div>
            )}
          </>
        )
      },
    })

    const screen = render(Select)

    const button = screen.getByRole('combobox').query()! as HTMLButtonElement

    expect(button.getAttribute('aria-haspopup')).toBe('listbox')
    expect(button.getAttribute('aria-expanded')).toBe('false')

    await userEvent.click(button)

    await expect.element(screen.getByRole('listbox')).toBeInTheDocument()
    expect(button.getAttribute('aria-controls')).toBe(
      screen.getByRole('listbox').query()!.getAttribute('id'),
    )
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.getAttribute('aria-autocomplete')).toBe('none')
    expect(screen.getByTestId('item-1').query()!.getAttribute('aria-selected')).toBe(
      'false',
    )
    expect(screen.getByTestId('item-2').query()!.getAttribute('aria-selected')).toBe(
      'true',
    )

    await userEvent.click(button)

    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument()
    expect(button.hasAttribute('aria-controls')).toBe(false)
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('combobox', () => {
  it('sets correct aria attributes based on the open state', async () => {
    const Select = defineComponent({
      setup() {
        const isOpen = shallowRef(false)
        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange(value) {
            isOpen.value = value
          },
        })
        const { getReferenceProps, getFloatingProps, getItemProps }
        = useInteractions([
          useClick(context),
          useRole(context, { role: 'combobox' }),
        ])
        return () => (
          <>
            <input ref={(el: any) => refs.setReference(el)} {...getReferenceProps()} />
            {isOpen.value && (
              <div ref={(el: any) => refs.setFloating(el)} {...getFloatingProps()}>
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    data-testid={`item-${i}`}
                    {...getItemProps({ active: i === 2, selected: i === 2 })}
                  />
                ))}
              </div>
            )}
          </>
        )
      },
    })

    const screen = render(Select)

    const button = screen.getByRole('combobox').query()! as HTMLButtonElement

    expect(button.getAttribute('aria-haspopup')).toBe('listbox')
    expect(button.getAttribute('aria-expanded')).toBe('false')

    await userEvent.click(button)

    await expect.element(screen.getByRole('listbox')).toBeInTheDocument()
    expect(button.getAttribute('aria-controls')).toBe(
      screen.getByRole('listbox').query()!.getAttribute('id'),
    )
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.getAttribute('aria-autocomplete')).toBe('list')
    expect(screen.getByTestId('item-1').query()!.getAttribute('aria-selected')).toBe(
      null,
    )
    expect(screen.getByTestId('item-2').query()!.getAttribute('aria-selected')).toBe(
      'true',
    )

    await userEvent.click(button)

    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument()
    expect(button.hasAttribute('aria-controls')).toBe(false)
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })
})
