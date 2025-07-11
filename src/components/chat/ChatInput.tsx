import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  Textarea,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui'
import { useHotkeys } from '@/lib/hooks/useHotkeys'
import { useChatStore, type Attachment } from '@/stores/chatStore'
import { SendHorizontal, Paperclip, File, Image, FileText, X } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'

/** Props for {@link ChatInput}. */
export interface ChatInputProps {
  /** Callback when message is submitted. */
  onSend: (text: string, attachments?: Attachment[]) => void
}

/**
 * Input form for sending chat messages.
 */
export function ChatInput({ onSend }: ChatInputProps) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { messages } = useChatStore()

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const sendMessage = () => {
    if (!text.trim() && attachments.length === 0) return
    onSend(text, attachments)
    setText('')
    setAttachments([])
    textareaRef.current?.focus()
  }

  const handleFileAttachment = async (filters?: { name: string; extensions: string[] }[]) => {
    console.log('📎 handleFileAttachment called with filters:', filters)
    try {
      console.log('📎 Opening file dialog...')

      // Try using Tauri dialog first
      const file = await open({
        multiple: false,
        directory: false,
        filters: filters || [
          {
            name: 'All Files',
            extensions: ['*']
          }
        ]
      })

      console.log('📎 File dialog result:', file)

      if (file) {
        // Extract file name from path
        const fileName = file.split(/[\\/]/).pop() || 'unknown'
        console.log('📎 Creating attachment for file:', fileName)

        // Create attachment object
        const newAttachment: Attachment = {
          name: fileName,
          mime: 'application/octet-stream', // We'll improve this later with proper MIME detection
          status: 'ready'
        }
        setAttachments(prev => [...prev, newAttachment])
        console.log('📎 Attachment added successfully')
      } else {
        console.log('📎 No file selected or dialog cancelled')
      }
    } catch (error) {
      console.error('📎 Tauri dialog failed, falling back to HTML input:', error)

      // Fallback to HTML file input
      const input = document.createElement('input')
      input.type = 'file'

      // Set accept attribute based on filters
      if (filters && filters.length > 0) {
        const extensions = filters.flatMap(f => f.extensions.map(ext => ext === '*' ? '*/*' : `.${ext}`))
        input.accept = extensions.join(',')
      } else {
        input.accept = '*/*'
      }

      input.onchange = (e) => {
        const target = e.target as HTMLInputElement
        const file = target.files?.[0]
        if (file) {
          const newAttachment: Attachment = {
            name: file.name,
            mime: file.type || 'application/octet-stream',
            status: 'ready'
          }
          setAttachments(prev => [...prev, newAttachment])
          console.log('📎 Fallback attachment added:', file.name)
        }
      }

      input.click()
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
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
      <div className="pointer-events-auto w-full max-w-2xl">
        {/* Attachment preview */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-sm"
              >
                <File className="size-3" />
                <span className="truncate max-w-32">{attachment.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeAttachment(index)}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 p-3 rounded-xl bg-card/50 backdrop-blur-sm shadow-lg border border-border focus-within:ring-2 focus-within:ring-ring"
        >
          {/* File attachment dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Paperclip className="size-4" />
                <span className="sr-only">Attach file</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem
                onClick={(e) => {
                  console.log('📎 Clicked: Attach any file')
                  e.preventDefault()
                  // Close the dropdown by clicking outside
                  setTimeout(() => handleFileAttachment(), 100)
                }}
              >
                <File className="size-4 mr-2" />
                Attach any file
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  console.log('📎 Clicked: Attach image')
                  e.preventDefault()
                  setTimeout(() => handleFileAttachment([
                    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }
                  ]), 100)
                }}
              >
                <Image className="size-4 mr-2" />
                Attach image
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  console.log('📎 Clicked: Attach document')
                  e.preventDefault()
                  setTimeout(() => handleFileAttachment([
                    { name: 'Documents', extensions: ['txt', 'pdf', 'doc', 'docx', 'md', 'rtf'] }
                  ]), 100)
                }}
              >
                <FileText className="size-4 mr-2" />
                Attach document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
            disabled={!text.trim() && attachments.length === 0}
            className="rounded-full transition-transform hover:scale-110 active:shadow-[0_0_8px_rgba(255,255,255,0.4)]"
          >
            <SendHorizontal className="size-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  )
}
