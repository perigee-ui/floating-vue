import { afterEach, expect, it } from 'vitest'
import { markOthers } from '../src/utils/markOthers.ts'

afterEach(() => {
	document.body.innerHTML = ''
})

it('single call', () => {
	const other = document.createElement('div')
	document.body.appendChild(other)
	const target = document.createElement('div')
	document.body.appendChild(target)

	const cleanup = markOthers([target], true)

	expect(other.getAttribute('aria-hidden')).toBe('true')

	cleanup()

	expect(other.getAttribute('aria-hidden')).toBe(null)
})

it('multiple calls', () => {
	const other = document.createElement('div')
	document.body.appendChild(other)
	const target = document.createElement('div')
	document.body.appendChild(target)

	const cleanup = markOthers([target], true)

	expect(other.getAttribute('aria-hidden')).toBe('true')

	const nextTarget = document.createElement('div')
	document.body.appendChild(nextTarget)

	const nextCleanup = markOthers([nextTarget], true)

	expect(target.getAttribute('aria-hidden')).toBe('true')
	expect(nextTarget.getAttribute('aria-hidden')).toBe(null)

	document.body.removeChild(nextTarget)

	nextCleanup()

	expect(target.getAttribute('aria-hidden')).toBe(null)
	expect(other.getAttribute('aria-hidden')).toBe('true')

	cleanup()

	expect(other.getAttribute('aria-hidden')).toBe(null)

	document.body.appendChild(nextTarget)
})

it('out of order cleanup', () => {
	const other = document.createElement('div')
	document.body.appendChild(other)
	const target = document.createElement('div')
	target.setAttribute('data-testid', '')
	document.body.appendChild(target)

	const cleanup = markOthers([target], true)

	expect(other.getAttribute('aria-hidden')).toBe('true')

	const nextTarget = document.createElement('div')
	document.body.appendChild(nextTarget)

	const nextCleanup = markOthers([nextTarget], true)

	expect(target.getAttribute('aria-hidden')).toBe('true')
	expect(nextTarget.getAttribute('aria-hidden')).toBe(null)

	cleanup()

	expect(nextTarget.getAttribute('aria-hidden')).toBe(null)
	expect(target.getAttribute('aria-hidden')).toBe('true')
	expect(other.getAttribute('aria-hidden')).toBe('true')

	nextCleanup()

	expect(nextTarget.getAttribute('aria-hidden')).toBe(null)
	expect(other.getAttribute('aria-hidden')).toBe(null)
	expect(target.getAttribute('aria-hidden')).toBe(null)
})
