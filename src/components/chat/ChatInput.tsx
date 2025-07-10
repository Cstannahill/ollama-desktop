import { FormEvent, useRef, useState } from 'react'
import { Textarea, Button } from '@/components/ui'
import { useHotkeys } from '@/lib/hooks/useHotkeys'
import { useChatStore } from '@/stores/chatStore'

/** Props for {@link ChatInput}. */
export interface ChatInputProps {
  /** Callback when message is submitted. */
  onSend: (text: string) => void

}

/**
 * Input form for sending chat messages.
 */
export function ChatInput({ onSend }: ChatInputProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { messages } = useChatStore()

  const sendMessage = () => {
    if (!text.trim()) return
    onSend(text)
    setText('')
    textareaRef.current?.focus()
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    sendMessage()
  }

  useHotkeys(['meta+enter', 'ctrl+enter'], sendMessage, [text])

  useHotkeys(
    'up',
    () => {
      const last = [...messages].reverse().find((m) => m.role === 'user')
      if (last) {
        setText(last.text)
        textareaRef.current?.focus()
      }
    },
    [messages]
  )

  useHotkeys(
    ['meta+/'],
    () => {
      window.open('#', '_blank')
    },
    []
  )

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 p-2 border-t border-white/10">
      <Textarea
        ref={textareaRef}
        className="flex-1 resize-none bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Say something..."
        rows={1}
      />
      <Button type="submit" disabled={!text.trim()}>
        Send
      </Button>
    </form>
  )
}
