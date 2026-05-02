"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
  onConfirm: () => void
  onCancel?: () => void
  loading?: boolean
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  variant = "default",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmationDialogProps) {
  const handleConfirm = () => {
    onConfirm()
  }

  const handleCancel = () => {
    onOpenChange(false)
    onCancel?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "处理中..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Hook: useConfirm
 * Returns a confirm function that returns a Promise<boolean>,
 * and a ConfirmDialog component to render.
 *
 * Usage:
 *   const { confirm, ConfirmDialog } = useConfirm()
 *   // ConfirmDialog must be rendered in the component tree
 *   if (await confirm({ title: '确认删除？', description: '此操作不可恢复' })) {
 *     // do delete
 *   }
 *
 * Or use the imperative shorthand:
 *   if (await confirm('确定要删除吗？')) { ... }
 */
export function useConfirm() {
  const [state, setState] = React.useState<{
    open: boolean
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    variant?: "default" | "destructive"
    resolve: (value: boolean) => void
  } | null>(null)

  const confirm = React.useCallback(
    (options: string | { title?: string; description: string; confirmText?: string; cancelText?: string; variant?: "default" | "destructive" }): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        const title = typeof options === "string" ? "确认操作" : options.title || "确认操作"
        const description = typeof options === "string" ? options : options.description
        setState({
          open: true,
          title,
          description,
          confirmText: typeof options !== "string" ? options.confirmText : undefined,
          cancelText: typeof options !== "string" ? options.cancelText : undefined,
          variant: typeof options !== "string" ? options.variant : undefined,
          resolve,
        })
      })
    },
    []
  )

  const ConfirmDialog = React.useCallback(() => {
    if (!state) return null
    return (
      <ConfirmationDialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) {
            state.resolve(false)
            setState(null)
          }
        }}
        title={state.title}
        description={state.description}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        variant={state.variant}
        onConfirm={() => {
          state.resolve(true)
          setState(null)
        }}
        onCancel={() => {
          state.resolve(false)
          setState(null)
        }}
      />
    )
  }, [state])

  return { confirm, ConfirmDialog }
}
