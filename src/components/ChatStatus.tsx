import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui'
import { ChatStatusType } from '@/stores/chatStore'

interface ChatStatusProps {
    status: ChatStatusType
}

export function ChatStatus({ status }: ChatStatusProps) {
    if (!status) return null

    const getStatusConfig = () => {
        switch (status.type) {
            case 'loading':
                return {
                    icon: <Loader2 className="h-3 w-3 animate-spin" />,
                    variant: 'secondary' as const,
                    text: status.message
                }
            case 'tool-executing':
                return {
                    icon: <Loader2 className="h-3 w-3 animate-spin" />,
                    variant: 'default' as const,
                    text: status.message
                }
            case 'error':
                return {
                    icon: <AlertCircle className="h-3 w-3" />,
                    variant: 'destructive' as const,
                    text: status.message
                }
            case 'success':
                return {
                    icon: <CheckCircle className="h-3 w-3" />,
                    variant: 'default' as const,
                    text: status.message
                }
            default:
                return {
                    icon: <Loader2 className="h-3 w-3" />,
                    variant: 'secondary' as const,
                    text: 'Processing...'
                }
        }
    }

    const config = getStatusConfig()

    return (
        <div className="flex justify-center py-2">
            <Badge variant={config.variant} className="gap-2 px-3 py-1">
                {config.icon}
                <span className="text-xs font-medium">
                    {config.text}
                </span>
            </Badge>
        </div>
    )
}
