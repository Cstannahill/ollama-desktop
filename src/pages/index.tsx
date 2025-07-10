import { useChatStore } from '@/stores/chatStore'
import { ChatLayout } from '@/components/layout'
import { ChatMessage, ChatInput } from '@/components/chat'
import { useAutoScroll } from '@/lib/hooks/useAutoScroll'

export default function IndexPage() {
  const { messages, send } = useChatStore()
  useAutoScroll(messages)

  return (
    <ChatLayout
      sidebarProps={{ chats: [], onNewChat: () => {}, onSelectChat: () => {} }}
    >
      {messages.map((m) => (
        <ChatMessage key={m.id} role={m.role as any} text={m.text} />
      ))}
      <ChatInput onSend={(t) => send(t, [], crypto.randomUUID(), [])} />
    </ChatLayout>
  )
}
