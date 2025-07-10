import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui'
import { Button } from '@/components/ui'
import ToolPicker from './ToolPicker'
import { Cog } from 'lucide-react'

export default function SettingsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <Cog className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="border-b pb-2">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="pt-2">
          <ToolPicker />
        </div>
      </DialogContent>
    </Dialog>
  )
}
