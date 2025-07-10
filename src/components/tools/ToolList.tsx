import { ToolCard } from './ToolCard'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'
import { usePermissionStore } from '@/stores/permissionStore'

/** Description for each available tool. */

const tools = [
  { name: 'RAG', description: 'Retrieval augmented generation', category: 'RAG' },
  { name: 'web_search', description: 'Search the web', category: 'Web' },
  { name: 'file_read', description: 'Read a file from the workspace', category: 'File' },
  { name: 'file_write', description: 'Write a file to the workspace', category: 'File' },
  { name: 'shell_exec', description: 'Execute shell commands', category: 'Advanced', risky: true },
]

/**
 * List available tools in a scrollable stack.
 */
const { allowedToolsByThread, currentThreadId, grantPermission, denyPermission } = usePermissionStore();
const allowed = allowedToolsByThread[currentThreadId] || [];

const handleToggle = (toolName: string) => (checked: boolean) => {
  if (checked) {
    grantPermission(toolName);
  } else {
    denyPermission(); // You may want to implement a revokePermission in the store for full toggle support
  }
};

return (
  <Tabs defaultValue="All" className="w-full" data-testid="tool-tabs">
    <TabsList>
      <TabsTrigger value="All">All</TabsTrigger>
      <TabsTrigger value="RAG">RAG</TabsTrigger>
      <TabsTrigger value="Web">Web</TabsTrigger>
      <TabsTrigger value="File">File</TabsTrigger>
      <TabsTrigger value="Advanced">Advanced</TabsTrigger>
    </TabsList>
    <TabsContent value="All" className="space-y-2">
      {tools.map((t) => (
        <ToolCard
          key={t.name}
          name={t.name}
          description={t.description}
          risky={t.risky}
          checked={allowed.includes(t.name)}
          onToggle={handleToggle(t.name)}
        />
      ))}
    </TabsContent>
    <TabsContent value="RAG" className="space-y-2">
      {tools
        .filter((t) => t.category === 'RAG')
        .map((t) => (
          <ToolCard
            key={t.name}
            name={t.name}
            description={t.description}
            risky={t.risky}
            checked={allowed.includes(t.name)}
            onToggle={handleToggle(t.name)}
          />
        ))}
    </TabsContent>
    <TabsContent value="Web" className="space-y-2">
      {tools
        .filter((t) => t.category === 'Web')
        .map((t) => (
          <ToolCard
            key={t.name}
            name={t.name}
            description={t.description}
            risky={t.risky}
            checked={allowed.includes(t.name)}
            onToggle={handleToggle(t.name)}
          />
        ))}
    </TabsContent>
    <TabsContent value="File" className="space-y-2">
      {tools
        .filter((t) => t.category === 'File')
        .map((t) => (
          <ToolCard
            key={t.name}
            name={t.name}
            description={t.description}
            risky={t.risky}
            checked={allowed.includes(t.name)}
            onToggle={handleToggle(t.name)}
          />
        ))}
    </TabsContent>
    <TabsContent value="Advanced" className="space-y-2">
      {tools
        .filter((t) => t.category === 'Advanced')
        .map((t) => (
          <ToolCard
            key={t.name}
            name={t.name}
            description={t.description}
            risky={t.risky}
            checked={allowed.includes(t.name)}
            onToggle={handleToggle(t.name)}
          />
        ))}
    </TabsContent>
  </Tabs>
)
}
