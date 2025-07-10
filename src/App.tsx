import IndexPage from './pages'
import { ThemeProvider } from '@/components/layout'

export default function App() {
  return (
    <ThemeProvider>
      <IndexPage />
    </ThemeProvider>
  )
}
