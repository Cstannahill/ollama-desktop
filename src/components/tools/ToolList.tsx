import { ToolCard } from './ToolCard'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'

/** Description for each available tool. */

const tools = [
  { name: 'RAG', description: 'Retrieval augmented generation', category: 'RAG' },
  { name: 'shell_exec', description: 'Execute shell commands', category: 'Advanced', risky: true },
]

/**
 * List available tools in a scrollable stack.
 */
export function ToolList() {
  return (
    <Tabs defaultValue="All" className="w-full" data-testid="tool-tabs">
      <TabsList>
        <TabsTrigger value="All">All</TabsTrigger>
        <TabsTrigger value="RAG">RAG</TabsTrigger>
        <TabsTrigger value="Advanced">Advanced</TabsTrigger>
      </TabsList>
      <TabsContent value="All" className="space-y-2">
        {tools.map((t) => (
          <ToolCard key={t.name} {...t} />
        ))}
      </TabsContent>
      <TabsContent value="RAG" className="space-y-2">
        {tools
          .filter((t) => t.category === 'RAG')
          .map((t) => (
            <ToolCard key={t.name} {...t} />
          ))}
      </TabsContent>
      <TabsContent value="Advanced" className="space-y-2">
        {tools
          .filter((t) => t.category === 'Advanced')
          .map((t) => (
            <ToolCard key={t.name} {...t} />
          ))}
      </TabsContent>
    </Tabs>
  )
}
