import IndexPage from './pages'
import { ThemeProvider } from '@/components/layout'
import { Toaster } from '@/components/common'
import { CommandPalette } from '@/components/commands'
import ToolPermissionModal from '@/components/ToolPermissionModal'

export default function App() {
  return (
    <ThemeProvider>
      <IndexPage />
      <ToolPermissionModal />
      <CommandPalette />
      <Toaster />
    </ThemeProvider>
  )
}
