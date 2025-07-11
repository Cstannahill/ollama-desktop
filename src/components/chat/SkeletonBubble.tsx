import { cn } from '@/lib/utils'

/** Props for {@link SkeletonBubble}. */
export interface SkeletonBubbleProps {
  /** Additional class names. */
  className?: string
}

/**
 * Placeholder bubble shown while assistant is thinking.
 */
export function SkeletonBubble({ className }: SkeletonBubbleProps = {}) {
  return (
    <div
      className={cn('rounded-lg bg-muted/50 animate-pulse h-8 w-32', className)}
      data-testid="skeleton-bubble"
    />
  )
}

