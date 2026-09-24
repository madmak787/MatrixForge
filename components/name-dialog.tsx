'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export interface NameRequest {
  title: string
  description?: string
  initial: string
  confirmLabel: string
  onConfirm: (name: string) => void
}

/** Replaces window.prompt for naming projects */
export function NameDialog({ request, onClose }: { request: NameRequest | null; onClose: () => void }) {
  const [value, setValue] = useState('')
  useEffect(() => {
    if (request) setValue(request.initial)
  }, [request])

  const submit = () => {
    const name = value.trim()
    if (!name || !request) return
    request.onConfirm(name)
    onClose()
  }

  return (
    <Dialog open={!!request} onOpenChange={o => !o && onClose()}>
      <DialogContent className="bg-card sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          {request?.description && <DialogDescription>{request.description}</DialogDescription>}
        </DialogHeader>
        <form
          onSubmit={e => {
            e.preventDefault()
            submit()
          }}
        >
          <Input
            autoFocus
            value={value}
            maxLength={80}
            onChange={e => setValue(e.target.value)}
            onFocus={e => e.target.select()}
            className="bg-background/60"
            aria-label="Name"
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!value.trim()}>{request?.confirmLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
