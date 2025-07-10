import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { Avatar, AvatarFallback, AvatarImage, Badge } from '@/components/ui'
import { cn } from '@/lib/utils'

/** Roles supported by {@link ChatMessage}. */
export type ChatRole = 'assistant' | 'user' | 'error' | 'system'

export interface ChatMessageProps {
  /** Sender role. */
  role: ChatRole
  /** Message content. */
  text: string
}

/**
 * Display a single chat message with avatar and Markdown rendering.
 */
export function ChatMessage({ role, text }: ChatMessageProps) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex gap-2 mb-4', isUser && 'justify-end')}>
      {!isUser && (
        <Avatar>
          <AvatarImage asChild>
            <span className="bg-accent text-black rounded-full size-8 flex items-center justify-center uppercase">
              {role.charAt(0)}
            </span>
          </AvatarImage>
          <AvatarFallback>{role.charAt(0)}</AvatarFallback>
        </Avatar>
      )}
      <div className="max-w-[75%] space-y-1">
        <Badge variant={role === 'system' ? 'outline' : role === 'error' ? 'destructive' : 'secondary'}>
          {role}
        </Badge>
        <div className="prose prose-invert text-sm">
          <ReactMarkdown
            components={{
              code({ inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                return !inline && match ? (
                  <SyntaxHighlighter language={match[1]} PreTag="div" {...props}>
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              },
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
