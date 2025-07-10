import IndexPage from './pages'
import { ThemeProvider } from '@/components/layout'
import { Toaster } from '@/components/common'
import { CommandPalette } from '@/components/commands'
import { ModalProvider } from '@/components/common/ModalContext'

export default function App() {
  return (
    <ThemeProvider>
      <ModalProvider>
        <IndexPage />
        <CommandPalette />
        <Toaster />
      </ModalProvider>
    </ThemeProvider>
  )
}
