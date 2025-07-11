
import { useChatStore } from "../stores/chatStore";

import useSWR from "swr"
import { invoke } from "@tauri-apps/api/core"
import { ScrollArea } from "@/components/ui"
import {
  FileText,
  Search,
  PenTool,
  Terminal,
  Shield,
  Zap,
  AlertTriangle,
  Settings2
} from "lucide-react"

export type ToolMeta = {
  name: string
  description: string
  json_schema: any
}

const TOOL_ICONS = {
  file_read: FileText,
  file_write: PenTool,
  web_search: Search,
  shell_exec: Terminal,
} as const

const TOOL_CATEGORIES = {
  file: {
    label: "File Operations",
    icon: FileText,
    tools: ["file_read", "file_write"]
  },
  web: {
    label: "Web & Research",
    icon: Search,
    tools: ["web_search"]
  },
  system: {
    label: "System Access",
    icon: Shield,
    tools: ["shell_exec"]
  }
} as const

export default function ToolPicker() {
  const {
    data: tools,
    error,
    isValidating: isLoading,
    mutate,
  } = useSWR<ToolMeta[]>("tools", () => invoke("list_tools") as Promise<ToolMeta[]>)

  // Use global enabledTools state for tool enablement
  const enabledTools = useChatStore((s) => s.enabledTools);
  const toggleTool = useChatStore((s) => s.toggleTool);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Settings2 className="h-8 w-8 text-primary animate-spin" />
            <Zap className="absolute inset-0 h-8 w-8 text-primary/60 animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading available tools...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-destructive/10 rounded-full">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <p className="text-sm text-destructive font-medium">Failed to load tools</p>
          <button
            onClick={() => mutate()}
            className="text-xs text-destructive hover:text-destructive/80 underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const categorizeTools = (tools: ToolMeta[]) => {
    const categorized: Record<string, ToolMeta[]> = {}
    const uncategorized: ToolMeta[] = []

    tools.forEach(tool => {
      const category = Object.entries(TOOL_CATEGORIES).find(([_, cat]) =>
        (cat.tools as readonly string[]).includes(tool.name)
      )
      if (category) {
        const [catKey] = category
        if (!categorized[catKey]) categorized[catKey] = []
        categorized[catKey].push(tool)
      } else {
        uncategorized.push(tool)
      }
    })

    return { categorized, uncategorized }
  }

  const { categorized, uncategorized } = categorizeTools(tools!)

  // Use global enabledTools for checked state, and toggleTool for changes
  const handleToggle = (tool: ToolMeta) => () => {
    toggleTool(tool.name);
  };

  const renderToolCard = (tool: ToolMeta, isRisky = false) => {
    const IconComponent = TOOL_ICONS[tool.name as keyof typeof TOOL_ICONS] || Settings2;
    const isChecked = enabledTools.includes(tool.name);
    return (
      <div
        key={tool.name}
        className={`
          group relative overflow-hidden rounded-lg border transition-all duration-200 hover:shadow-md
          ${isChecked ? 'border-primary/30 bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-border/80'}
          ${isRisky ? 'border-orange-500/30 bg-orange-500/5' : ''}
        `}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className={`
              flex h-10 w-10 items-center justify-center rounded-lg transition-colors
              ${isChecked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground group-hover:bg-muted/80'}
              ${isRisky ? 'bg-orange-500/10 text-orange-600' : ''}
            `}>
              <IconComponent className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground">
                  {tool.name === 'shell_exec' ? 'Shell Execution' : tool.name.replace('_', ' ')}
                </h3>
                {isRisky && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded-full">
                    <AlertTriangle className="h-3 w-3" />
                    Risky
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-tight">
                {tool.description || "No description available"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-pressed={isChecked}
              aria-label={isChecked ? `Disable ${tool.name}` : `Enable ${tool.name}`}
              onClick={handleToggle(tool)}
              className={`relative flex items-center group/checkbox focus:outline-none focus:ring-2 focus:ring-ring rounded-full transition-all duration-200
                ${isChecked ? 'bg-primary' : 'bg-muted'}
                w-10 h-6 p-0.5 shadow-inner`}
            >
              <span
                className={`absolute left-0 top-0 w-full h-full rounded-full transition-colors duration-200
                  ${isChecked ? 'bg-primary/30' : 'bg-muted-foreground/20'}`}
                aria-hidden="true"
              />
              <span
                className={`inline-block w-5 h-5 rounded-full bg-background shadow transform transition-transform duration-200
                  ${isChecked ? 'translate-x-4' : 'translate-x-0'}
                  border border-border group-hover/checkbox:scale-105`}
              />
            </button>
            <label
              htmlFor={`tool-${tool.name}`}
              className={`ml-3 text-sm font-medium leading-none select-none transition-colors duration-200
                ${isChecked ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {isChecked ? 'Enabled' : 'Disabled'}
            </label>
          </div>
        </div>

        {/* Enhanced gradient overlay when enabled */}
        {isChecked && (
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
        )}

        {/* Subtle hover effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
      </div>
    );
  };

  const renderCategory = (categoryKey: string, tools: ToolMeta[]) => {
    const category = TOOL_CATEGORIES[categoryKey as keyof typeof TOOL_CATEGORIES]
    const CategoryIcon = category.icon
    const isSystemCategory = categoryKey === 'system'

    return (
      <div key={categoryKey} className="space-y-3">
        <div className="flex items-center gap-2 pb-2">
          <CategoryIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            {category.label}
          </h2>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="space-y-2">
          {tools.map(tool => renderToolCard(tool, isSystemCategory))}
        </div>
      </div>
    )
  }

  const enabledCount = tools ? tools.filter(tool => enabledTools.includes(tool.name)).length : 0;
  const totalCount = tools?.length || 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Tool Configuration</h1>
          <p className="text-sm text-muted-foreground">Adjust your preferences below</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {enabledCount}/{totalCount} active
          </span>
        </div>
      </div>

      <ScrollArea className="h-80 w-full pr-4">
        <div className="space-y-6">
          {/* Render categorized tools */}
          {Object.entries(categorized).map(([categoryKey, tools]) =>
            renderCategory(categoryKey, tools)
          )}

          {/* Render uncategorized tools */}
          {uncategorized.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2">
                <Settings2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                  Other Tools
                </h2>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="space-y-2">
                {uncategorized.map(tool => renderToolCard(tool))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}