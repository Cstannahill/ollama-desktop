
import IndexPage from './pages';
import { ThemeProvider } from '@/components/layout';
import { Toaster } from '@/components/common';
import { CommandPalette } from '@/components/commands';
import { ModalProvider } from '@/components/common/ModalContext';

export default function App() {
  // ThemeProvider must wrap the entire app for shadcn theme to work everywhere
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
