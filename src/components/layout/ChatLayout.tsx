import { ReactNode, useState } from 'react'
import { Sheet, SheetContent, SheetTrigger, Button } from '@/components/ui'
import { Sidebar } from './Sidebar'
import { ScrollArea } from '@/components/ui'
import { cn } from '@/lib/utils'
import { ToolList } from '../tools/ToolList'
import { Menu } from 'lucide-react'

export interface ChatLayoutProps {
  sidebarProps: React.ComponentProps<typeof Sidebar>
  children: ReactNode
}

export function ChatLayout({ sidebarProps, children }: ChatLayoutProps) {
  const [toolsOpen, setToolsOpen] = useState(false)
  return (
    <div className="flex h-screen bg-bg-app text-white">
      <Sidebar {...sidebarProps} />
      <div className="flex flex-col flex-1">
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
        <ScrollArea className="flex-1 p-4 overflow-y-auto" id="chat-scroll">
          {children}
        </ScrollArea>
      </div>
    </div>
  )
}
