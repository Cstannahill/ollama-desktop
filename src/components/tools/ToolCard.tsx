import { Card, Badge } from '@/components/ui'
/** Props for {@link ToolCard}. */

export interface ToolCardProps {
  name: string
  description: string
  onClick?: () => void
  risky?: boolean
}

/**
 * Card representation of a tool.
 */
export function ToolCard({ name, description, onClick, risky }: ToolCardProps) {
  return (
    <Card className="p-4 hover:bg-bg-panel/50 cursor-pointer" onClick={onClick}>
      <h3 className="font-semibold mb-1">{name}</h3>
      <p className="text-sm opacity-80 flex items-center gap-2">
        {description}
        {risky && <Badge variant="destructive">risky</Badge>}
      </p>
    </Card>
  )
}
