import { ToolCard } from './ToolCard'

/** Description for each available tool. */

const tools = [
  { name: 'RAG', description: 'Retrieval augmented generation' },
  { name: 'shell_exec', description: 'Execute shell commands' },
]

/**
 * List available tools in a scrollable stack.
 */
export function ToolList() {
  return (
    <div className="space-y-2">
      {tools.map((t) => (
        <ToolCard key={t.name} {...t} />
      ))}
    </div>
  )
}
