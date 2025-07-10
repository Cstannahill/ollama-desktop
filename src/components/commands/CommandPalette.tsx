import { useCallback, useState } from 'react'
import { Command, CommandInput, CommandItem, CommandList } from 'cmdk'
import { useHotkeys } from '@/lib/hooks/useHotkeys'

/** Available command actions. */
interface Action {
  id: string
  label: string
  run: () => void
}

/** Props for {@link CommandPalette}. */
export interface CommandPaletteProps {
  /** Whether the palette is initially open. */
  defaultOpen?: boolean
  className?: string
}

/**
 * Global command palette triggered with meta+k / ctrl+k.
 */
export function CommandPalette({ defaultOpen, className }: CommandPaletteProps) {
  const [open, setOpen] = useState(!!defaultOpen)

  useHotkeys(
    ['meta+k', 'ctrl+k'],
    () => setOpen((o) => !o),
    [setOpen]
  )

  const actions: Action[] = [
    {
      id: 'theme',
      label: 'Toggle theme',
      run: () => document.querySelector<HTMLButtonElement>('[data-testid="theme-toggle"]')?.click(),
    },
  ]

  const handleSelect = useCallback(
    (id: string) => {
      const a = actions.find((x) => x.id === id)
      a?.run()
      setOpen(false)
    },
    [actions]
  )

  if (!open) return null

  return (
    <div className={className} data-testid="command-palette">
      <Command>
        <CommandInput autoFocus placeholder="Type a command" />
        <CommandList>
          {actions.map((a) => (
            <CommandItem key={a.id} onSelect={() => handleSelect(a.id)}>
              {a.label}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </div>
  )
}

CommandPalette.defaultProps = {
  defaultOpen: false,
  className: undefined,
}
