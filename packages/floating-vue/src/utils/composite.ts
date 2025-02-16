import type { Dimensions } from '../types.ts'

import { stopEvent } from '../utils.ts'

export const ARROW_UP = 'ArrowUp'
export const ARROW_DOWN = 'ArrowDown'
export const ARROW_LEFT = 'ArrowLeft'
export const ARROW_RIGHT = 'ArrowRight'

export function isDifferentRow(index: number, cols: number, prevRow: number): boolean {
  return Math.floor(index / cols) !== prevRow
}

export function isIndexOutOfBounds(listRef: Array<HTMLElement | undefined>, index: number): boolean {
  return index < 0 || index >= listRef.length
}

export function getMinIndex(listRef: Array<HTMLElement | undefined>, disabledIndices: Array<number> | undefined): number {
  return findNonDisabledIndex(listRef, { disabledIndices })
}

export function getMaxIndex(listRef: Array<HTMLElement | undefined>, disabledIndices: Array<number> | undefined): number {
  return findNonDisabledIndex(listRef, {
    decrement: true,
    startingIndex: listRef.length,
    disabledIndices,
  })
}

export function findNonDisabledIndex(
  listRef: Array<HTMLElement | undefined>,
  {
    startingIndex = -1,
    decrement = false,
    disabledIndices,
    amount = 1,
  }: {
    startingIndex?: number
    decrement?: boolean
    disabledIndices?: Array<number>
    amount?: number
  } = {},
): number {
  let index = startingIndex
  do {
    index += decrement ? -amount : amount
  } while (
    index >= 0
    && index <= listRef.length - 1
    && isDisabled(listRef, index, disabledIndices)
  )

  return index
}

export function getGridNavigatedIndex(
  elementsRef: Array<HTMLElement | undefined>,
  {
    event,
    orientation,
    loop,
    rtl,
    cols,
    disabledIndices,
    minIndex,
    maxIndex,
    prevIndex,
    stopEvent: stop = false,
  }: {
    event: KeyboardEvent
    orientation: 'horizontal' | 'vertical' | 'both'
    loop: boolean
    rtl: boolean
    cols: number
    disabledIndices: Array<number> | undefined
    minIndex: number
    maxIndex: number
    prevIndex: number
    stopEvent?: boolean
  },
): number {
  let nextIndex = prevIndex

  if (event.key === ARROW_UP) {
    if (stop)
      stopEvent(event)

    if (prevIndex === -1) {
      nextIndex = maxIndex
    }
    else {
      nextIndex = findNonDisabledIndex(elementsRef, {
        startingIndex: nextIndex,
        amount: cols,
        decrement: true,
        disabledIndices,
      })

      if (loop && (prevIndex - cols < minIndex || nextIndex < 0)) {
        const col = prevIndex % cols
        const maxCol = maxIndex % cols
        const offset = maxIndex - (maxCol - col)

        if (maxCol === col) {
          nextIndex = maxIndex
        }
        else {
          nextIndex = maxCol > col ? offset : offset - cols
        }
      }
    }

    if (isIndexOutOfBounds(elementsRef, nextIndex)) {
      nextIndex = prevIndex
    }
  }

  if (event.key === ARROW_DOWN) {
    if (stop)
      stopEvent(event)

    if (prevIndex === -1) {
      nextIndex = minIndex
    }
    else {
      nextIndex = findNonDisabledIndex(elementsRef, {
        startingIndex: prevIndex,
        amount: cols,
        disabledIndices,
      })

      if (loop && prevIndex + cols > maxIndex) {
        nextIndex = findNonDisabledIndex(elementsRef, {
          startingIndex: (prevIndex % cols) - cols,
          amount: cols,
          disabledIndices,
        })
      }
    }

    if (isIndexOutOfBounds(elementsRef, nextIndex)) {
      nextIndex = prevIndex
    }
  }

  // Remains on the same row/column.
  if (orientation === 'both') {
    const prevRow = Math.floor(prevIndex / cols)

    if (event.key === (rtl ? ARROW_LEFT : ARROW_RIGHT)) {
      if (stop)
        stopEvent(event)

      if (prevIndex % cols !== cols - 1) {
        nextIndex = findNonDisabledIndex(elementsRef, {
          startingIndex: prevIndex,
          disabledIndices,
        })

        if (loop && isDifferentRow(nextIndex, cols, prevRow)) {
          nextIndex = findNonDisabledIndex(elementsRef, {
            startingIndex: prevIndex - (prevIndex % cols) - 1,
            disabledIndices,
          })
        }
      }
      else if (loop) {
        nextIndex = findNonDisabledIndex(elementsRef, {
          startingIndex: prevIndex - (prevIndex % cols) - 1,
          disabledIndices,
        })
      }

      if (isDifferentRow(nextIndex, cols, prevRow)) {
        nextIndex = prevIndex
      }
    }

    if (event.key === (rtl ? ARROW_RIGHT : ARROW_LEFT)) {
      if (stop)
        stopEvent(event)

      if (prevIndex % cols !== 0) {
        nextIndex = findNonDisabledIndex(elementsRef, {
          startingIndex: prevIndex,
          decrement: true,
          disabledIndices,
        })

        if (loop && isDifferentRow(nextIndex, cols, prevRow)) {
          nextIndex = findNonDisabledIndex(elementsRef, {
            startingIndex: prevIndex + (cols - (prevIndex % cols)),
            decrement: true,
            disabledIndices,
          })
        }
      }
      else if (loop) {
        nextIndex = findNonDisabledIndex(elementsRef, {
          startingIndex: prevIndex + (cols - (prevIndex % cols)),
          decrement: true,
          disabledIndices,
        })
      }

      if (isDifferentRow(nextIndex, cols, prevRow)) {
        nextIndex = prevIndex
      }
    }

    const lastRow = Math.floor(maxIndex / cols) === prevRow

    if (isIndexOutOfBounds(elementsRef, nextIndex)) {
      if (loop && lastRow) {
        nextIndex = event.key === (rtl ? ARROW_RIGHT : ARROW_LEFT)
          ? maxIndex
          : findNonDisabledIndex(elementsRef, {
              startingIndex: prevIndex - (prevIndex % cols) - 1,
              disabledIndices,
            })
      }
      else {
        nextIndex = prevIndex
      }
    }
  }

  return nextIndex
}

/** For each cell index, gets the item index that occupies that cell */
export function buildCellMap(sizes: Dimensions[], cols: number, dense: boolean): (number | undefined)[] {
  const cellMap: (number | undefined)[] = []
  let startIndex = 0

  sizes.forEach(({ width, height }, index) => {
    if (width > cols) {
      if (__DEV__)
        throw new Error(`[Floating UI]: Invalid grid - item width at index ${index} is greater than grid columns`)
    }

    let itemPlaced = false
    if (dense)
      startIndex = 0

    while (!itemPlaced) {
      const targetCells: number[] = []
      for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
          targetCells.push(startIndex + i + j * cols)
        }
      }

      if ((startIndex % cols) + width <= cols && targetCells.every(cell => cellMap[cell] == null)) {
        for (const cell of targetCells) {
          cellMap[cell] = index
        }

        itemPlaced = true
      }
      else {
        startIndex++
      }
    }
  })

  // convert into a non-sparse array
  return [...cellMap]
}

/** Gets cell index of an item's corner or -1 when index is -1. */
export function getCellIndexOfCorner(
  index: number,
  sizes: Dimensions[],
  cellMap: (number | undefined)[],
  cols: number,
  corner: 'tl' | 'tr' | 'bl' | 'br',
): number {
  if (index === -1)
    return -1

  const firstCellIndex = cellMap.indexOf(index)
  const sizeItem = sizes[index]

  switch (corner) {
    case 'tl':
      return firstCellIndex
    case 'tr':
      if (!sizeItem)
        return firstCellIndex

      return firstCellIndex + sizeItem.width - 1
    case 'bl':
      if (!sizeItem)
        return firstCellIndex

      return firstCellIndex + (sizeItem.height - 1) * cols
    case 'br':
      return cellMap.lastIndexOf(index)
  }
}

/** Gets all cell indices that correspond to the specified indices */
export function getCellIndices(indices: (number | undefined)[], cellMap: (number | undefined)[]): number[] {
  return cellMap.flatMap((index, cellIndex) => indices.includes(index) ? [cellIndex] : [])
}

export function isDisabled(list: Array<HTMLElement | undefined>, index: number, disabledIndices?: Array<number>): boolean {
  if (disabledIndices)
    return disabledIndices.includes(index)

  const element = list[index]
  return (element == null || element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true')
}
