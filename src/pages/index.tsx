import { useChatStore } from '@/stores/chatStore'
import { ChatLayout } from '@/components/layout'
import { ChatMessage, ChatInput, SkeletonBubble, MessageActions } from '@/components/chat'
import { useAutoScroll } from '@/lib/hooks/useAutoScroll'

export default function IndexPage() {
  const { messages, send } = useChatStore()
  useAutoScroll(messages)

  return (
    <ChatLayout
      sidebarProps={{ chats: [], onNewChat: () => {}, onSelectChat: () => {} }}
    >
      {messages.map((m) => (
        <div key={m.id} className="relative group">
          {m.role === 'assistant' && !m.text ? (
            <SkeletonBubble />
          ) : (
            <ChatMessage role={m.role as any} text={m.text} />
          )}
          {m.text && (
            <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <MessageActions text={m.text} />
            </div>
          )}
        </div>
      ))}
      <ChatInput onSend={(t) => send(t, [], crypto.randomUUID(), [])} />
    </ChatLayout>
  )
}
