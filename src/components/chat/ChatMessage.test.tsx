import { render, screen } from '@testing-library/react'
import { ChatMessage } from './ChatMessage'
import '@testing-library/jest-dom'

describe('ChatMessage', () => {
  it('renders user message', () => {
    render(<ChatMessage role="user" text="hello" />)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
