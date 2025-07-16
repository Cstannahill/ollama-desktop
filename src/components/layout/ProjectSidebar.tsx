import { useEffect, useState } from 'react'
import { ScrollArea, Button, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui'
import { ThemeToggle } from '@/components/common'
import { cn } from '@/lib/utils'
import {
    Menu,
    Pencil,
    Trash2,
    Plus,
    FolderOpen,
    Folder,
    MessageSquare,
    Paperclip,
    FolderPlus,
    Upload
} from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { open } from '@tauri-apps/plugin-dialog'

/** Props for {@link ProjectSidebar}. */
export interface ProjectSidebarProps {
    chats: { id: string; title: string; projectId?: string }[]
    currentChatId?: string | null
    onNewChat: (projectId?: string) => void
    onSelectChat: (id: string) => void
    onDeleteChat: (id: string) => void
    onRenameChat: (id: string, newTitle: string) => void
}

/**
 * Enhanced sidebar with project support, organizing chats into expandable project folders.
 */
export function ProjectSidebar({ chats, currentChatId, onNewChat, onSelectChat, onDeleteChat, onRenameChat }: ProjectSidebarProps) {
    const [collapsed, setCollapsed] = useState(false)
    const [editingChat, setEditingChat] = useState<string | null>(null)
    const [editingProject, setEditingProject] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')

    const {
        projects,
        expandedProjects,
        createProject,
        deleteProject,
        renameProject,
        selectProject,
        toggleProjectExpansion,
        attachFileToProject,
        loadProjects
    } = useProjectStore()

    useEffect(() => {
        const mql = window.matchMedia('(max-width: 768px)')
        setCollapsed(mql.matches)
        const handler = (e: MediaQueryListEvent) => setCollapsed(e.matches)
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
    }, [])

    useEffect(() => {
        loadProjects()
    }, [loadProjects])

    // Group chats by project
    const organizedChats = {
        unorganized: chats.filter(chat => !chat.projectId),
        byProject: projects.reduce((acc, project) => {
            acc[project.id] = chats.filter(chat => chat.projectId === project.id)
            return acc
        }, {} as Record<string, typeof chats>)
    }

    const handleCreateProject = () => {
        const name = prompt('Enter project name:')
        if (name?.trim()) {
            createProject(name.trim())
        }
    }

    const handleAttachFile = async (projectId: string) => {
        try {
            const file = await open({
                multiple: false,
                directory: false,
                filters: [
                    { name: 'All Files', extensions: ['*'] },
                    { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
                    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg'] },
                    { name: 'Code', extensions: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c'] }
                ]
            })

            if (file) {
                await attachFileToProject(projectId, file)
            }
        } catch (error) {
            console.error('Failed to attach file:', error)
        }
    }

    const renderChat = (chat: { id: string; title: string }) => (
        <li key={chat.id} className="ml-6">
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div className="w-full">
                        {editingChat === chat.id ? (
                            <div className="w-full px-3 py-1">
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onBlur={() => {
                                        if (editTitle.trim() && editTitle.trim() !== chat.title) {
                                            onRenameChat(chat.id, editTitle.trim())
                                        }
                                        setEditingChat(null)
                                        setEditTitle('')
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            if (editTitle.trim() && editTitle.trim() !== chat.title) {
                                                onRenameChat(chat.id, editTitle.trim())
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
                                size="sm"
                                className={cn(
                                    "w-full justify-start text-left group hover:bg-accent/50",
                                    currentChatId === chat.id && "bg-accent text-accent-foreground"
                                )}
                                onClick={() => onSelectChat(chat.id)}
                            >
                                <MessageSquare className="w-4 h-4 mr-2 opacity-60" />
                                {collapsed ? (
                                    <span className="sr-only">{chat.title}</span>
                                ) : (
                                    <span className="truncate">{chat.title}</span>
                                )}
                            </Button>
                        )}
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem
                        onClick={() => {
                            setEditingChat(chat.id)
                            setEditTitle(chat.title)
                        }}
                    >
                        <Pencil className="w-4 h-4 mr-2" />
                        Rename
                    </ContextMenuItem>
                    <ContextMenuItem
                        onClick={() => onDeleteChat(chat.id)}
                        className="text-destructive"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </li>
    )

    const renderProject = (project: typeof projects[0]) => {
        const isExpanded = expandedProjects.has(project.id)
        const projectChats = organizedChats.byProject[project.id] || []

        return (
            <li key={project.id}>
                <ContextMenu>
                    <ContextMenuTrigger asChild>
                        <div className="w-full">
                            {editingProject === project.id ? (
                                <div className="w-full px-3 py-2">
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        onBlur={() => {
                                            if (editTitle.trim() && editTitle.trim() !== project.name) {
                                                renameProject(project.id, editTitle.trim())
                                            }
                                            setEditingProject(null)
                                            setEditTitle('')
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                if (editTitle.trim() && editTitle.trim() !== project.name) {
                                                    renameProject(project.id, editTitle.trim())
                                                }
                                                setEditingProject(null)
                                                setEditTitle('')
                                            } else if (e.key === 'Escape') {
                                                e.preventDefault()
                                                setEditingProject(null)
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
                                    className="w-full justify-start font-medium group"
                                    onClick={() => {
                                        toggleProjectExpansion(project.id)
                                        selectProject(project.id)
                                    }}
                                >
                                    {isExpanded ? (
                                        <FolderOpen className="w-4 h-4 mr-2 text-primary" />
                                    ) : (
                                        <Folder className="w-4 h-4 mr-2 text-muted-foreground" />
                                    )}
                                    {collapsed ? (
                                        <span className="sr-only">{project.name}</span>
                                    ) : (
                                        <div className="flex items-center justify-between w-full">
                                            <span className="truncate">{project.name}</span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {project.attachments.length > 0 && (
                                                    <span className="text-xs bg-muted px-1 rounded">
                                                        {project.attachments.length}
                                                    </span>
                                                )}
                                                <span className="text-xs text-muted-foreground">
                                                    {projectChats.length}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </Button>
                            )}
                        </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                        <ContextMenuItem onClick={() => onNewChat(project.id)}>
                            <Plus className="w-4 h-4 mr-2" />
                            New Chat
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleAttachFile(project.id)}>
                            <Upload className="w-4 h-4 mr-2" />
                            Attach File
                        </ContextMenuItem>
                        <ContextMenuItem
                            onClick={() => {
                                setEditingProject(project.id)
                                setEditTitle(project.name)
                            }}
                        >
                            <Pencil className="w-4 h-4 mr-2" />
                            Rename
                        </ContextMenuItem>
                        <ContextMenuItem
                            onClick={() => deleteProject(project.id)}
                            className="text-destructive"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Project
                        </ContextMenuItem>
                    </ContextMenuContent>
                </ContextMenu>

                {/* Project attachments indicator */}
                {!collapsed && isExpanded && project.attachments.length > 0 && (
                    <div className="ml-6 mt-1 mb-2">
                        <div className="text-xs text-muted-foreground mb-1 px-3">Files:</div>
                        {project.attachments.map((attachment) => (
                            <div
                                key={attachment.id}
                                className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground hover:bg-accent/30 rounded"
                            >
                                <Paperclip className="w-3 h-3" />
                                <span className="truncate">{attachment.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Project chats */}
                {isExpanded && (
                    <ul className="space-y-1">
                        {projectChats.map(renderChat)}
                    </ul>
                )}
            </li>
        )
    }

    return (
        <aside
            className={cn(
                'bg-card text-card-foreground flex flex-col h-full transition-all group border-r border-border',
                collapsed ? 'w-16 hover:w-24' : 'w-64'
            )}
        >
            <div className="flex items-center justify-between p-4 border-b border-border">
                <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)}>
                    <Menu className="size-5" />
                </Button>
                {!collapsed && <span className="font-bold text-lg">Ollama</span>}
            </div>

            {!collapsed && (
                <div className="flex gap-2 p-4 border-b border-border">
                    <Button size="sm" onClick={() => onNewChat()}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Chat
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCreateProject}>
                        <FolderPlus className="w-4 h-4 mr-2" />
                        Project
                    </Button>
                </div>
            )}

            <ScrollArea className="flex-1 px-2">
                <ul className="space-y-1 py-2">
                    {/* Render Projects */}
                    {projects.map(renderProject)}

                    {/* Render unorganized chats */}
                    {organizedChats.unorganized.length > 0 && (
                        <>
                            {projects.length > 0 && (
                                <li className="py-2">
                                    <div className="h-px bg-border" />
                                </li>
                            )}
                            <li>
                                <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Unorganized Chats
                                </div>
                            </li>
                            {organizedChats.unorganized.map(renderChat)}
                        </>
                    )}
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
