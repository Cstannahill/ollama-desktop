import { ReactNode, useState } from 'react'
import { Sheet, SheetContent, SheetTrigger, Button } from '@/components/ui'
import { Sidebar } from './Sidebar'
import { ScrollArea } from '@/components/ui'
import { ToolList } from '../tools/ToolList'
import { Menu } from 'lucide-react'

/** Props for {@link ChatLayout}. */
export interface ChatLayoutProps {
  /** Sidebar configuration. */
  sidebarProps: React.ComponentProps<typeof Sidebar>
  /** Chat content nodes. */
  children: ReactNode
}

/**
 * Main application shell combining sidebar, message stream and tool drawer.
 */
export function ChatLayout({ sidebarProps, children }: ChatLayoutProps) {
  const [toolsOpen, setToolsOpen] = useState(false)
  return (
    <div className="flex h-screen bg-bg-app text-white">
      <Sidebar {...sidebarProps} />
      <div className="relative flex flex-col flex-1">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-bg-app p-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            {sidebarProps.chats.length > 0 && <span className="font-semibold">Chat</span>}
          </div>
          <div className="flex items-center gap-2">
            <Sheet open={toolsOpen} onOpenChange={setToolsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <ToolList />
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <ScrollArea
          className="flex-1 p-4 overflow-y-auto overscroll-contain scroll-smooth"
          id="chat-scroll"
        >
          {children}
        </ScrollArea>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-bg-app to-transparent" />
      </div>
    </div>
  )
}
