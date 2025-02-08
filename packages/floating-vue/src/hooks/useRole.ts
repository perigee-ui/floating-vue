import type { MaybeRefOrGetter } from 'vue'
import type { ElementProps, FloatingRootContext } from '../types.ts'
import type { ExtendedUserProps } from './useInteractions.ts'
import { computed, toValue, useId } from 'vue'

type AriaRole =
  | 'tooltip'
  | 'dialog'
  | 'alertdialog'
  | 'menu'
  | 'listbox'
  | 'grid'
  | 'tree'
type ComponentRole = 'select' | 'label' | 'combobox'

export interface UseRoleProps {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean>
  /**
   * The role of the floating element.
   * @default 'dialog'
   */
  role?: AriaRole | ComponentRole
}

const componentRoleToAriaRoleMap = new Map<
  AriaRole | ComponentRole,
  AriaRole | false
>([
  ['select', 'listbox'],
  ['combobox', 'listbox'],
  ['label', false],
])

export function useRole(
  context: FloatingRootContext,
  props: UseRoleProps = {},
): () => ElementProps | undefined {
  const { open, floatingId } = context
  const { enabled = true, role = 'dialog' } = props

  const ariaRole = (componentRoleToAriaRoleMap.get(role) ?? role) as
    | AriaRole
    | false
    | undefined

  const referenceId = useId()
  // const parentId = useFloatingParentNodeId()
  const parentId = null
  const isNested = parentId != null

  const referenceProps = computed<ElementProps['reference']>(() => {
    const openValue = toValue(open)
    if (ariaRole === 'tooltip' || role === 'label') {
      return {
        [`aria-${role === 'label' ? 'labelledby' : 'describedby'}`]: openValue
          ? floatingId
          : undefined,
      }
    }

    return {
      'aria-expanded': openValue ? 'true' : 'false',
      'aria-haspopup': ariaRole === 'alertdialog' ? 'dialog' : ariaRole,
      'aria-controls': openValue ? floatingId : undefined,
      ...(ariaRole === 'listbox' && { role: 'combobox' }),
      ...(ariaRole === 'menu' && { id: referenceId }),
      ...(ariaRole === 'menu' && isNested && { role: 'menuitem' }),
      ...(role === 'select' && { 'aria-autocomplete': 'none' }),
      ...(role === 'combobox' && { 'aria-autocomplete': 'list' }),
    }
  })

  function getFloating() {
    const floatingProps = {
      id: floatingId,
      ...(ariaRole && { role: ariaRole }),
    }

    if (ariaRole === 'tooltip' || role === 'label') {
      return floatingProps
    }

    return {
      ...floatingProps,
      ...(ariaRole === 'menu' && { 'aria-labelledby': referenceId }),
    }
  }

  const floatingProps: ElementProps['floating'] = getFloating()

  const itemProps: ElementProps['item'] = ({ active, selected }: ExtendedUserProps) => {
    const commonProps = {
      role: 'option',
      ...(active && { id: `${floatingId}-option` }),
    }

    // For `menu`, we are unable to tell if the item is a `menuitemradio`
    // or `menuitemcheckbox`. For backwards-compatibility reasons, also
    // avoid defaulting to `menuitem` as it may overwrite custom role props.
    switch (role) {
      case 'select':
        return {
          ...commonProps,
          'aria-selected': active && selected,
        }
      case 'combobox': {
        return {
          ...commonProps,
          ...(active && { 'aria-selected': true }),
        }
      }
    }

    return {}
  }

  return () => toValue(enabled)
    ? {
        reference: referenceProps.value,
        floating: floatingProps,
        item: itemProps,
      }
    : undefined
}
