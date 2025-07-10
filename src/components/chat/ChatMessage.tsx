import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { Avatar, AvatarFallback, AvatarImage, Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import React, { useEffect, useState } from 'react'

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
  const [chars, setChars] = useState(0)

  useEffect(() => {
    setChars(text.length)
  }, [text])

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
        <motion.div
          className="prose prose-invert text-sm"
          style={{
            WebkitMaskImage: 'linear-gradient(90deg,#fff calc(var(--ch)*1ch),transparent 0)',
            '--ch': 0,
          } as React.CSSProperties}
          animate={{ '--ch': chars } as any}
          transition={{ type: 'spring', mass: 0.5 }}
          aria-live="polite"
        >
          <ReactMarkdown
            components={{
              code({ inline, className, children, ...props }: any) {
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
        </motion.div>
      </div>
    </div>
  )
}
