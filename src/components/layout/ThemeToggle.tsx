import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui'
import { useTheme } from './theme-provider'

/** Toggle between light and dark mode. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const toggle = () => setTheme(isDark ? 'light' : 'dark')

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
