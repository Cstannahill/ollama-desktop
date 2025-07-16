import { ReactNode } from 'react'
import { ProjectSidebar } from './ProjectSidebar'
import { ScrollArea } from '@/components/ui'
import ModelPicker from '../ModelPicker'
import { SettingsDialog } from '@/components/SettingsDialog'
import ToolStatusIndicator from '../ToolStatusIndicator'

/** Props for {@link ProjectChatLayout}. */
export interface ProjectChatLayoutProps {
    /** Sidebar configuration. */
    sidebarProps: React.ComponentProps<typeof ProjectSidebar>
    /** Chat content nodes (message bubbles). */
    children: ReactNode
    /** Input element rendered at the bottom. */
    input: ReactNode
}

/**
 * Enhanced application shell with project support, combining project sidebar, message stream and settings dialog.
 */
export function ProjectChatLayout({ sidebarProps, children, input }: ProjectChatLayoutProps) {
    return (
        <div className="flex h-screen bg-background text-foreground">
            <ProjectSidebar {...sidebarProps} />
            <div className="relative flex flex-col flex-1">
                <div className="sticky top-0 z-10 flex items-center justify-between bg-background p-2 border-b border-border">
                    <div className="flex items-center gap-2">
                        {sidebarProps.chats.length > 0 && <span className="font-semibold">Chat</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <ModelPicker />
                        <ToolStatusIndicator />
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
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent" />
                </div>
                <div className="border-t border-border p-2">{input}</div>
            </div>
        </div>
    )
}
