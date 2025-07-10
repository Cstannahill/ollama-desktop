import React from 'react'
import ToolPicker from '@/components/ToolPicker'
import { Button } from '@/components/ui'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

export function SettingsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" aria-label="Settings">
          Open Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Adjust your preferences below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ToolPicker />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
