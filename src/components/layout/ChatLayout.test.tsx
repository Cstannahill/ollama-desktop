import { render, screen, fireEvent } from '@testing-library/react'
import { ChatLayout } from './ChatLayout'
import { ThemeProvider } from './theme-provider'
import '@testing-library/jest-dom'

const sidebarProps = { chats: [], onNewChat: () => {}, onSelectChat: () => {} }

test('tool drawer opens and closes', () => {
  render(
    <ThemeProvider>
      <ChatLayout sidebarProps={sidebarProps} input={<div>input</div>}>
        <div>chat</div>
      </ChatLayout>
    </ThemeProvider>
  )
  const trigger = screen.getByRole('button', { name: 'Tools' })
  fireEvent.click(trigger)
  expect(screen.getByText('Tools')).toBeInTheDocument()
  const close = screen.getByRole('button', { name: /close/i })
  fireEvent.click(close)
  expect(screen.queryByText('Tools')).not.toBeInTheDocument()
})
