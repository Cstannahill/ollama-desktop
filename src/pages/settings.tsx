import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'

interface QdrantStatus {
  running: boolean
  port: number
  method: string
  auto_start: boolean
}

export default function SettingsPage() {
  const [isVectorizing, setIsVectorizing] = useState(false)
  const [qdrantStatus, setQdrantStatus] = useState<'checking' | 'available' | 'unavailable'>('checking')
  const [qdrantDetails, setQdrantDetails] = useState<QdrantStatus | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [autoStart, setAutoStart] = useState(true)
  const [useDocker, setUseDocker] = useState(true)

  // Check Qdrant status on mount and periodically
  useEffect(() => {
    const checkQdrant = async () => {
      try {
        const status = await invoke<QdrantStatus>('get_qdrant_status')
        setQdrantDetails(status)
        setQdrantStatus(status.running ? 'available' : 'unavailable')
        setAutoStart(status.auto_start)
        setUseDocker(status.method === 'Docker')
      } catch (error) {
        console.error('Failed to get Qdrant status:', error)
        setQdrantStatus('unavailable')
      }
    }

    checkQdrant()
    
    // Check status every 10 seconds
    const interval = setInterval(checkQdrant, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleStartQdrant = async () => {
    setIsStarting(true)
    try {
      await invoke<string>('start_qdrant')
      toast.success('Qdrant started successfully!')
      
      // Refresh status after a short delay
      setTimeout(async () => {
        try {
          const status = await invoke<QdrantStatus>('get_qdrant_status')
          setQdrantDetails(status)
          setQdrantStatus(status.running ? 'available' : 'unavailable')
        } catch (error) {
          console.error('Failed to refresh status:', error)
        }
      }, 2000)
      
    } catch (error) {
      console.error('Failed to start Qdrant:', error)
      toast.error('Failed to start Qdrant: ' + String(error))
    } finally {
      setIsStarting(false)
    }
  }

  const handleStopQdrant = async () => {
    try {
      await invoke<string>('stop_qdrant')
      toast.success('Qdrant stopped')
      setQdrantStatus('unavailable')
    } catch (error) {
      console.error('Failed to stop Qdrant:', error)
      toast.error('Failed to stop Qdrant: ' + String(error))
    }
  }

  const handleConfigureQdrant = async () => {
    try {
      await invoke<string>('configure_qdrant', {
        autoStart,
        useDocker,
        port: null // Use default port
      })
      toast.success('Qdrant configuration updated')
    } catch (error) {
      console.error('Failed to configure Qdrant:', error)
      toast.error('Failed to configure Qdrant: ' + String(error))
    }
  }

  const handleVectorizeConversations = async () => {
    if (qdrantStatus !== 'available') {
      toast.error('Qdrant vector database is not available. Please start it first.')
      return
    }
    
    setIsVectorizing(true)
    try {
      const result = await invoke<string>('vectorize_existing_conversations')
      toast.success(result)
    } catch (error) {
      console.error('Vectorization failed:', error)
      toast.error('Failed to vectorize conversations: ' + String(error))
    } finally {
      setIsVectorizing(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      
      <div className="space-y-4">
        {/* Qdrant Service Management */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Qdrant Vector Database</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Automatic service management for conversation vectorization and semantic search.
          </p>
          
          <div className="space-y-4">
            {/* Status Display */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <div className={`flex items-center gap-1 ${
                qdrantStatus === 'available' ? 'text-green-600' : 
                qdrantStatus === 'unavailable' ? 'text-red-600' : 'text-yellow-600'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  qdrantStatus === 'available' ? 'bg-green-600' : 
                  qdrantStatus === 'unavailable' ? 'bg-red-600' : 'bg-yellow-600'
                }`} />
                <span className="text-sm">
                  {qdrantStatus === 'available' ? 'Running' : 
                   qdrantStatus === 'unavailable' ? 'Stopped' : 'Checking...'}
                </span>
              </div>
              {qdrantDetails && (
                <span className="text-xs text-muted-foreground ml-2">
                  Port {qdrantDetails.port} • {qdrantDetails.method}
                </span>
              )}
            </div>

            {/* Service Controls */}
            <div className="flex gap-2">
              <button
                onClick={handleStartQdrant}
                disabled={isStarting || qdrantStatus === 'available'}
                className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                {isStarting ? 'Starting...' : 'Start Service'}
              </button>
              
              <button
                onClick={handleStopQdrant}
                disabled={qdrantStatus !== 'available'}
                className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                Stop Service
              </button>
            </div>

            {/* Configuration */}
            <div className="space-y-2 pt-2 border-t">
              <h3 className="text-sm font-medium">Configuration</h3>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoStart"
                  checked={autoStart}
                  onChange={(e) => setAutoStart(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="autoStart" className="text-sm">
                  Auto-start on app launch
                </label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useDocker"
                  checked={useDocker}
                  onChange={(e) => setUseDocker(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="useDocker" className="text-sm">
                  Use Docker (recommended)
                </label>
              </div>
              
              <button
                onClick={handleConfigureQdrant}
                className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Update Configuration
              </button>
            </div>

            {/* Info Message */}
            {qdrantStatus === 'unavailable' && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  {useDocker ? (
                    <>Click "Start Service" to automatically start Qdrant with Docker. <br />
                    Make sure Docker is installed and running.</>
                  ) : (
                    <>Click "Start Service" to start the local Qdrant binary. <br />
                    Make sure Qdrant is installed: <code className="bg-blue-100 px-1 rounded">cargo install qdrant</code></>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Conversation Vectorization */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Conversation Vectorization</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Process existing conversations for cross-chat context and semantic search.
          </p>
          
          <button
            onClick={handleVectorizeConversations}
            disabled={isVectorizing || qdrantStatus !== 'available'}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isVectorizing ? 'Vectorizing...' : 'Vectorize All Conversations'}
          </button>
          
          {qdrantStatus !== 'available' && (
            <p className="text-sm text-muted-foreground mt-2">
              Start Qdrant service first to enable vectorization.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
