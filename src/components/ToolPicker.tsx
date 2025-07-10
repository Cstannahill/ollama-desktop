
import React from "react";
import { useChatStore } from "../stores/chatStore";

import useSWR from "swr"
import { invoke } from "@tauri-apps/api/core"
import { ScrollArea } from "@/components/ui"
import { Checkbox } from "@/components/ui/checkbox"
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
            <Settings2 className="h-8 w-8 text-blue-500 animate-spin dark:text-blue-400" />
            <Zap className="absolute inset-0 h-8 w-8 text-blue-300 animate-pulse dark:text-blue-500" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Loading available tools...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-full">
            <AlertTriangle className="h-6 w-6 text-red-500 dark:text-red-400" />
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">Failed to load tools</p>
          <button
            onClick={() => mutate()}
            className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
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
  const handleToggle = (tool: ToolMeta) => (checked: boolean) => {
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
          ${isChecked ? 'border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'}
          ${isRisky ? 'border-orange-200 dark:border-orange-700 bg-orange-50/30 dark:bg-orange-900/20' : ''}
        `}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className={`
              flex h-10 w-10 items-center justify-center rounded-lg transition-colors
              ${isChecked ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'}
              ${isRisky ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400' : ''}
            `}>
              <IconComponent className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {tool.name === 'shell_exec' ? 'Shell Execution' : tool.name.replace('_', ' ')}
                </h3>
                {isRisky && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/50 rounded-full">
                    <AlertTriangle className="h-3 w-3" />
                    Risky
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-tight">
                {tool.description || "No description available"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`tool-${tool.name}`}
                checked={isChecked}
                disabled={false}
                onCheckedChange={handleToggle(tool)}
              />
              <label
                htmlFor={`tool-${tool.name}`}
                className={`text-sm font-medium leading-none ${isChecked ? 'text-blue-700 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} select-none`}
              >
                {isChecked ? 'Enabled' : 'Disabled'}
              </label>
            </div>
          </div>
        </div>

        {/* Enhanced gradient overlay when enabled */}
        {isChecked && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 dark:from-blue-400/10 to-transparent pointer-events-none" />
        )}

        {/* Subtle hover effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-500/5 dark:via-gray-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
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
          <CategoryIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
            {category.label}
          </h2>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
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
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tool Configuration</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">Adjust your preferences below</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Zap className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
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