import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui'
import { useTheme } from '@/components/layout'

/** Props for {@link ThemeToggle}. */
export interface ThemeToggleProps {
  /** Additional class names for the button. */
  className?: string
}

/**
 * Toggle between light and dark theme.
 */
export function ThemeToggle({ className }: ThemeToggleProps = {}) {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  const toggle = () => setTheme(isDark ? 'light' : 'dark')
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
      className={className}
      data-testid="theme-toggle"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

