import IndexPage from './pages'
import { ThemeProvider } from '@/components/layout'
import { Toaster } from '@/components/common'
import { CommandPalette } from '@/components/commands'

export default function App() {
  return (
    <ThemeProvider>
      <IndexPage />
      <CommandPalette />
      <Toaster />
    </ThemeProvider>
  )
}
