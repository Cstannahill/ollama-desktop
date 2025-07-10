import { ToolCard } from './ToolCard'

const tools = [
  { name: 'RAG', description: 'Retrieval augmented generation' },
  { name: 'shell_exec', description: 'Execute shell commands' },
]

export function ToolList() {
  return (
    <div className="space-y-2">
      {tools.map((t) => (
        <ToolCard key={t.name} {...t} />
      ))}
    </div>
  )
}
