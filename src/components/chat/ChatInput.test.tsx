import { render, screen, fireEvent } from '@testing-library/react'
import { ChatInput } from './ChatInput'
import '@testing-library/jest-dom'

describe('ChatInput', () => {
  it('calls onSend', () => {
    const fn = vi.fn()
    render(<ChatInput onSend={fn} />)
    const textarea = screen.getByPlaceholderText('Send a message...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'hi' } })
    fireEvent.submit(textarea.closest('form') as HTMLFormElement)
    expect(fn).toHaveBeenCalledWith('hi')
  })
})
