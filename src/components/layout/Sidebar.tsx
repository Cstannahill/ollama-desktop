import { useEffect, useState } from 'react'
import { ScrollArea, Button, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui'
import { ThemeToggle } from '@/components/common'
import { cn } from '@/lib/utils'
import { Menu, Pencil, Trash2 } from 'lucide-react'

/** Props for {@link Sidebar}. */
export interface SidebarProps {
  chats: { id: string; title: string }[]
  onNewChat: () => void
  onSelectChat: (id: string) => void
  onDeleteChat: (id: string) => void
  onRenameChat: (id: string, newTitle: string) => void
}

/**
 * Collapsible sidebar listing chats and settings.
 */
export function Sidebar({ chats, onNewChat, onSelectChat, onDeleteChat, onRenameChat }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [editingChat, setEditingChat] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

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
        'bg-card text-card-foreground flex flex-col h-full transition-all group',
        collapsed ? 'w-16 hover:w-24' : 'w-64'
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
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div className="w-full">
                    {editingChat === c.id ? (
                      <div className="w-full px-3 py-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => {
                            if (editTitle.trim() && editTitle.trim() !== c.title) {
                              console.log('🖊️ Saving rename:', c.id, 'from', c.title, 'to', editTitle.trim())
                              onRenameChat(c.id, editTitle.trim())
                            }
                            setEditingChat(null)
                            setEditTitle('')
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (editTitle.trim() && editTitle.trim() !== c.title) {
                                console.log('🖊️ Saving rename (Enter):', c.id, 'from', c.title, 'to', editTitle.trim())
                                onRenameChat(c.id, editTitle.trim())
                              }
                              setEditingChat(null)
                              setEditTitle('')
                            } else if (e.key === 'Escape') {
                              e.preventDefault()
                              setEditingChat(null)
                              setEditTitle('')
                            }
                          }}
                          className="w-full bg-background border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          autoFocus
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        className="w-full justify-start group"
                        onClick={() => onSelectChat(c.id)}
                      >
                        {collapsed ? (
                          <span className="sr-only">{c.title}</span>
                        ) : (
                          <span className="truncate">{c.title}</span>
                        )}
                      </Button>
                    )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('🖊️ Context menu: Rename clicked for chat', c.id)
                      // Use setTimeout to ensure context menu closes first
                      setTimeout(() => {
                        setEditingChat(c.id)
                        setEditTitle(c.title)
                      }, 100)
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('🗑️ Context menu: Delete clicked for chat', c.id)
                      setTimeout(() => {
                        onDeleteChat(c.id)
                      }, 100)
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </li>
          ))}
        </ul>
      </ScrollArea>
      <div className="p-4 flex items-center justify-between text-xs border-t border-border">
        <ThemeToggle />
        {!collapsed && <span className="opacity-60">v0.1.0</span>}
        {collapsed && <span className="sr-only">Theme toggle</span>}
      </div>
    </aside>
  )
}
