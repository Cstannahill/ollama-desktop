import { useEffect, useState } from 'react'
import { ScrollArea, Button } from '@/components/ui'
import { ThemeToggle } from './ThemeToggle'
import { cn } from '@/lib/utils'
import { Menu } from 'lucide-react'

export interface SidebarProps {
  chats: { id: string; title: string }[]
  onNewChat: () => void
  onSelectChat: (id: string) => void
}

export function Sidebar({ chats, onNewChat, onSelectChat }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)')
    setCollapsed(mql.matches)
    const handler = (e: MediaQueryListEvent) => setCollapsed(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return (
    <aside
      className={cn(
        'bg-bg-panel text-white flex flex-col h-full transition-all',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)}>
          <Menu className="size-5" />
        </Button>
        {!collapsed && <span className="font-bold text-lg">Ollama</span>}
      </div>
      {!collapsed && (
        <Button className="mx-4 mb-2" onClick={onNewChat}>
          New Chat
        </Button>
      )}
      <ScrollArea className="flex-1 px-2">
        <ul className="space-y-1">
          {chats.map((c) => (
            <li key={c.id}>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => onSelectChat(c.id)}
              >
                {collapsed ? <span className="sr-only">{c.title}</span> : c.title}
              </Button>
            </li>
          ))}
        </ul>
      </ScrollArea>
      <div className="p-4 flex items-center justify-between text-xs border-t border-white/10">
        <ThemeToggle />
        {!collapsed && <span className="opacity-60">v0.1.0</span>}
      </div>
    </aside>
  )
}
