import { FormEvent, useRef, useState } from 'react'
import { Textarea, Button } from '@/components/ui'

export interface ChatInputProps {
  onSend: (text: string) => void
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text)
    setText('')
    textareaRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 p-2 border-t border-white/10">
      <Textarea
        ref={textareaRef}
        className="flex-1 resize-none bg-transparent focus:outline-none"
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
