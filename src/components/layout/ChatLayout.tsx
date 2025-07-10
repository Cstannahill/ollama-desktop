import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { ScrollArea } from '@/components/ui'
import ModelPicker from '../ModelPicker'
import { SettingsDialog } from '@/components/SettingsDialog'

/** Props for {@link ChatLayout}. */
export interface ChatLayoutProps {
  /** Sidebar configuration. */
  sidebarProps: React.ComponentProps<typeof Sidebar>
  /** Chat content nodes (message bubbles). */
  children: ReactNode
  /** Input element rendered at the bottom. */
  input: ReactNode
}

/**
 * Main application shell combining sidebar, message stream and settings dialog.
*/
export function ChatLayout({ sidebarProps, children, input }: ChatLayoutProps) {
  return (
    <div className="flex h-screen bg-bg-app text-foreground">
      <Sidebar {...sidebarProps} />
      <div className="relative flex flex-col flex-1">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-bg-app p-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            {sidebarProps.chats.length > 0 && <span className="font-semibold">Chat</span>}
          </div>
          <div className="flex items-center gap-2">
            <ModelPicker />
            <SettingsDialog />
          </div>
        </div>
        <div className="relative flex-1 min-h-0">
          <ScrollArea
            className="h-full p-4 overflow-y-auto overscroll-contain scroll-smooth"
            id="chat-scroll"
          >
            {children}
          </ScrollArea>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-bg-app to-transparent" />
        </div>
        <div className="border-t border-white/10 p-2">{input}</div>
      </div>
    </div>
  )
}
