import { render, screen, fireEvent } from '@testing-library/react'
import { ChatLayout } from './ChatLayout'
import { ThemeProvider } from './theme-provider'
import '@testing-library/jest-dom'

const sidebarProps = { chats: [], onNewChat: () => {}, onSelectChat: () => {} }

test('settings dialog opens and closes', () => {
  render(
    <ThemeProvider>
      <ChatLayout sidebarProps={sidebarProps} input={<div>input</div>}>
        <div>chat</div>
      </ChatLayout>
    </ThemeProvider>
  )
  const trigger = screen.getByRole('button', { name: 'Settings' })
  fireEvent.click(trigger)
  expect(screen.getByText('Settings')).toBeInTheDocument()
  const close = screen.getByRole('button', { name: /close/i })
  fireEvent.click(close)
  expect(screen.queryByText('Settings')).not.toBeInTheDocument()
})
