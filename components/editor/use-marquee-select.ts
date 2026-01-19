"use client"

import { useState, useCallback, useRef, MouseEvent } from "react"

interface Rect {
    x: number
    y: number
    width: number
    height: number
}

interface MarqueeState {
    isSelecting: boolean
    startX: number
    startY: number
    currentX: number
    currentY: number
}

interface UseMarqueeSelectResult {
    isSelecting: boolean
    selectionRect: Rect | null
    handlers: {
        onMouseDown: (e: MouseEvent) => void
        onMouseMove: (e: MouseEvent) => void
        onMouseUp: (e: MouseEvent) => void
        onMouseLeave: (e: MouseEvent) => void
    }
    getSelectedIds: (itemRects: Map<string, DOMRect>) => string[]
}

export function useMarqueeSelect(containerRef: React.RefObject<HTMLElement | null>): UseMarqueeSelectResult {
    const [state, setState] = useState<MarqueeState>({
        isSelecting: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
    })

    const onMouseDown = useCallback((e: MouseEvent) => {
        // Only start selection on left click and not on interactive elements
        if (e.button !== 0) return
        const target = e.target as HTMLElement
        if (target.closest('button, input, [role="button"]')) return

        const container = containerRef.current
        if (!container) return

        const rect = container.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        setState({
            isSelecting: true,
            startX: x,
            startY: y,
            currentX: x,
            currentY: y,
        })
    }, [containerRef])

    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!state.isSelecting) return

        const container = containerRef.current
        if (!container) return

        const rect = container.getBoundingClientRect()
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))

        setState(prev => ({
            ...prev,
            currentX: x,
            currentY: y,
        }))
    }, [state.isSelecting, containerRef])

    const onMouseUp = useCallback(() => {
        setState(prev => ({ ...prev, isSelecting: false }))
    }, [])

    const onMouseLeave = useCallback(() => {
        setState(prev => ({ ...prev, isSelecting: false }))
    }, [])

    // Calculate selection rectangle
    const selectionRect: Rect | null = state.isSelecting ? {
        x: Math.min(state.startX, state.currentX),
        y: Math.min(state.startY, state.currentY),
        width: Math.abs(state.currentX - state.startX),
        height: Math.abs(state.currentY - state.startY),
    } : null

    // Check which items intersect with selection
    const getSelectedIds = useCallback((itemRects: Map<string, DOMRect>): string[] => {
        if (!selectionRect || selectionRect.width < 5 || selectionRect.height < 5) return []

        const container = containerRef.current
        if (!container) return []

        const containerRect = container.getBoundingClientRect()
        const selected: string[] = []

        itemRects.forEach((itemRect, id) => {
            // Convert item rect to container-relative coordinates
            const relativeRect = {
                x: itemRect.left - containerRect.left,
                y: itemRect.top - containerRect.top,
                width: itemRect.width,
                height: itemRect.height,
            }

            // Check intersection
            const intersects = !(
                relativeRect.x > selectionRect.x + selectionRect.width ||
                relativeRect.x + relativeRect.width < selectionRect.x ||
                relativeRect.y > selectionRect.y + selectionRect.height ||
                relativeRect.y + relativeRect.height < selectionRect.y
            )

            if (intersects) {
                selected.push(id)
            }
        })

        return selected
    }, [selectionRect, containerRef])

    return {
        isSelecting: state.isSelecting,
        selectionRect,
        handlers: {
            onMouseDown,
            onMouseMove,
            onMouseUp,
            onMouseLeave,
        },
        getSelectedIds,
    }
}
