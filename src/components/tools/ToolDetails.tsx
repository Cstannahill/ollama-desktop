export interface ToolDetailsProps {
  name: string
  description: string
  children?: React.ReactNode
}

export function ToolDetails({ name, description, children }: ToolDetailsProps) {
  return (
    <div className="p-4 space-y-2">
      <h3 className="font-bold text-lg">{name}</h3>
      <p className="text-sm opacity-80">{description}</p>
      {children}
    </div>
  )
}
