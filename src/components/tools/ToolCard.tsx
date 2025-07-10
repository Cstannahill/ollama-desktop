import { Card, Badge, Checkbox } from '@/components/ui'
/** Props for {@link ToolCard}. */

export interface ToolCardProps {
  name: string
  description: string
  checked: boolean
  onToggle: (checked: boolean) => void
  risky?: boolean
}

/**
 * Card representation of a tool.
 */
export function ToolCard({ name, description, checked, onToggle, risky }: ToolCardProps) {
  return (
    <Card className="p-4 flex items-center gap-4 hover:bg-bg-panel/50">
      <Checkbox checked={checked} onCheckedChange={onToggle} id={`tool-toggle-${name}`} />
      <div className="flex-1">
        <label htmlFor={`tool-toggle-${name}`} className="font-semibold mb-1 cursor-pointer block">{name}</label>
        <p className="text-sm opacity-80 flex items-center gap-2">
          {description}
          {risky && <Badge variant="destructive">risky</Badge>}
        </p>
      </div>
    </Card>
  )
}
