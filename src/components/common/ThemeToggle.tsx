import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui'
import { useTheme } from '@/components/layout';
import { cn } from '@/lib/utils';

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
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={cn("hover:bg-accent hover:text-accent-foreground", className)}
      data-testid="theme-toggle"
    >
      {isDark ? (
        <Sun className="h-4 w-4 transition-all" />
      ) : (
        <Moon className="h-4 w-4 transition-all" />
      )}
    </Button>
  )
}

