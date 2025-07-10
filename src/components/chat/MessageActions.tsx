import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui'
import { Copy, Pencil, Trash2, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui'

/** Props for {@link MessageActions}. */
export interface MessageActionsProps {
  /** Message text to operate on. */
  text: string
  /** Callback when delete is clicked. */
  onDelete?: () => void
  className?: string
}

/**
 * Actions available for each message.
 */
export function MessageActions({ text, onDelete, className }: MessageActionsProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    toast('Copied to clipboard')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className} data-testid="message-actions-trigger">
          <span className="sr-only">Actions</span>
          <Copy className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={handleCopy} data-testid="action-copy">
          <Copy className="size-4 mr-2" /> Copy
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="action-edit">
          <Pencil className="size-4 mr-2" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} data-testid="action-delete">
          <Trash2 className="size-4 mr-2" /> Delete
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="action-regenerate">
          <RefreshCcw className="size-4 mr-2" /> Regenerate
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

MessageActions.defaultProps = {
  onDelete: undefined,
  className: undefined,
}
