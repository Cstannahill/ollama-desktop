import { useEffect } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { ChatLayout } from '@/components/layout'
import { ChatMessage, ChatInput, SkeletonBubble, MessageActions } from '@/components/chat'
import { useAutoScroll } from '@/lib/hooks/useAutoScroll'

export default function IndexPage() {
  const { messages, send, chats, newChat, selectChat, loadChats, deleteChat, renameChat } = useChatStore()
  useAutoScroll(messages)

  useEffect(() => {
    // Load saved chats on startup
    loadChats().then(() => {
      // If no chats exist, create a new one
      if (chats.length === 0) {
        newChat()
      }
    })
  }, [loadChats, newChat])

  useEffect(() => {
    if (chats.length === 0) {
      newChat()
    }
  }, [chats.length, newChat])

  return (
    <ChatLayout
      sidebarProps={{
        chats: chats.map((c) => ({ id: c.id, title: c.title })),
        onNewChat: newChat,
        onSelectChat: selectChat,
        onDeleteChat: deleteChat,
        onRenameChat: renameChat,
      }}
      input={<ChatInput onSend={send} />}
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
    </ChatLayout>
  )
}
