import type { Placement } from '@floating-ui/utils'
import type { CSSProperties } from 'vue'

export interface FloatingArrowProps {
	isRTL?: boolean

	x?: number
	y?: number

	placement: Placement
	/**
	 * Width of the arrow.
	 * @default 14
	 */
	width?: number
	/**
	 * Height of the arrow.
	 * @default 7
	 */
	height?: number
	/**
	 * The corner radius (rounding) of the arrow tip.
	 * @default 0 (sharp)
	 */
	tipRadius?: number
	/**
	 * Forces a static offset over dynamic positioning under a certain condition.
	 */
	staticOffset?: string | number | null
	/**
	 * Custom path string.
	 */
	d?: string
	/**
	 * Stroke (border) color of the arrow.
	 */
	stroke?: string
	/**
	 * Stroke (border) width of the arrow.
	 */
	strokeWidth?: number

	style?: CSSProperties

	fill?: string
}
