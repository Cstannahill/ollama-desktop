import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import { ThemeProvider } from './theme-provider'
import '@testing-library/jest-dom'

describe('Sidebar', () => {
  it('renders chats', () => {
    const chats = [{ id: '1', title: 'Chat 1' }]
    render(
      <ThemeProvider>
        <Sidebar chats={chats} onNewChat={() => {}} onSelectChat={() => {}} />
      </ThemeProvider>
    )
    expect(screen.getByText('Chat 1')).toBeInTheDocument()
  })
})
