import { FormEvent, useEffect, useRef, useState } from 'react'
import { Textarea, Button } from '@/components/ui'
import { useHotkeys } from '@/lib/hooks/useHotkeys'
import { useChatStore } from '@/stores/chatStore'
import { SendHorizontal } from 'lucide-react'

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

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

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

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  return (
    <div className="flex justify-center w-full">
      <form
        onSubmit={handleSubmit}
        className="pointer-events-auto w-full max-w-2xl flex items-end gap-2 p-3 rounded-xl bg-[rgba(255,255,255,0.05)] backdrop-blur-sm shadow-lg border border-white/10 focus-within:ring-2 focus-within:ring-brand-500/50"
      >
        <Textarea
          ref={textareaRef}
          className="peer flex-1 resize-none bg-transparent border-0 p-2 max-h-40 focus:outline-none placeholder:text-muted-foreground transition-all"
          value={text}
          onChange={handleChange}
          placeholder="Send a message..."
          rows={1}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim()}
          className="rounded-full transition-transform hover:scale-110 active:shadow-[0_0_8px_rgba(255,255,255,0.4)]"
        >
          <SendHorizontal className="size-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  )
}
