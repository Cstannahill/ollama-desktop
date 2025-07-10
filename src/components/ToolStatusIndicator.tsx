import { useChatStore } from '../stores/chatStore'
import { Badge } from './ui'

export default function ToolStatusIndicator() {
  const { enabledTools } = useChatStore()

  if (enabledTools.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 text-xs">
      {enabledTools.map((tool) => (
        <Badge key={tool} variant="secondary">
          {tool}
        </Badge>
      ))}
    </div>
  )
}
