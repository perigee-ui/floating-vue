import { shallowRef } from 'vue'
import { isSafari } from '../../utils.ts'
import { setActiveElementOnTab } from './FloatingFocusManager.ts'

function useFocusGuard() {
	let instanceCount = 0
	const role = shallowRef<'button' | undefined>()

	function onMountFocusGuard() {
		instanceCount++

		if (instanceCount === 1) {
			if (isSafari()) {
				// Unlike other screen readers such as NVDA and JAWS, the virtual cursor
				// on VoiceOver does trigger the onFocus event, so we can use the focus
				// trap element. On Safari, only buttons trigger the onFocus event.
				// NB: "group" role in the Sandbox no longer appears to work, must be a
				// button role.
				role.value = 'button'
			}
			document.addEventListener('keydown', setActiveElementOnTab)
		}
	}

	function onBeforeUnmountFocusGuard() {
		instanceCount--

		if (instanceCount <= 0) {
			document.removeEventListener('keydown', setActiveElementOnTab)
		}
	}

	return [onMountFocusGuard, onBeforeUnmountFocusGuard, role] as const
}

export const [onMountFocusGuard, onBeforeUnmountFocusGuard, role] = useFocusGuard()
