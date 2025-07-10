import { Card } from '@/components/ui'

export interface ToolCardProps {
  name: string
  description: string
  onClick?: () => void
}

export function ToolCard({ name, description, onClick }: ToolCardProps) {
  return (
    <Card className="p-4 hover:bg-bg-panel/50 cursor-pointer" onClick={onClick}>
      <h3 className="font-semibold mb-1">{name}</h3>
      <p className="text-sm opacity-80">{description}</p>
    </Card>
  )
}
