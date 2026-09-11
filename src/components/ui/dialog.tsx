"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  draggable = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /** 允许鼠标按住弹窗非交互区域拖动（适用于长表单弹窗被屏幕边缘/任务栏遮挡的场景） */
  draggable?: boolean
}) {
  const [offset, setOffset] = React.useState({ dx: 0, dy: 0 });
  const draggingRef = React.useRef(false);
  const startPosRef = React.useRef({ x: 0, y: 0 });
  const baseOffsetRef = React.useRef({ dx: 0, dy: 0 });
  const movedRef = React.useRef(false); // 是否已超过阈值真正拖动

  // 拖动期间挂 window 级监听，鼠标移出弹窗也能继续拖。
  // 用 pointermove + buttons 检测：mouseup 丢失（指针移出窗口/滚动条捕获/焦点切换）时自动复位，
  // 杜绝弹窗"卡死"在跟随鼠标的状态（症状：不按键移动鼠标弹窗也跟着动）
  React.useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      // 兜底：左键未按住 → 强制复位（处理 mouseup 未派发的情况）
      if ((e.buttons & 1) === 0) {
        draggingRef.current = false;
        movedRef.current = false;
        return;
      }
      if (!draggingRef.current) return;
      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      // 3px 阈值：点击/轻微移动不视为拖动
      if (!movedRef.current && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      movedRef.current = true;
      setOffset({
        dx: baseOffsetRef.current.dx + dx,
        dy: baseOffsetRef.current.dy + dy,
      });
    };
    const onPointerUp = () => {
      draggingRef.current = false;
      movedRef.current = false;
    };
    const onBlur = () => {
      // 窗口失焦也复位，防止切换窗口后弹窗"粘"在鼠标上
      draggingRef.current = false;
      movedRef.current = false;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggable || e.button !== 0) return;
    const target = e.target as Element;
    // 仅允许从弹窗标题区(dialog-header)启动拖动：
    // - 表单/内容区按下 → 不拖（点击、滚动、文本选择优先，避免"想滚动结果弹窗被拖走"）
    // - 滚动条区域按下 → 不拖，原生滚动条正常工作
    if (!target.closest('[data-slot="dialog-header"]')) {
      return;
    }
    // 标题区内的交互元素（关闭按钮等）不启动拖动
    if (target.closest('button, a, [role="button"], [data-slot="dialog-close"]')) {
      return;
    }
    draggingRef.current = true;
    movedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    baseOffsetRef.current = offset;
    // 注意：不做 preventDefault —— 避免阻止原生滚动条拖拽和文本选择
  };

  const renderCloseButton = (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
    >
      <XIcon />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  );

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          draggable && "select-none",
          className
        )}
        style={{
          // draggable 时用 left/top 承载拖动偏移（保留 translate -50% 负责居中与开合动画）
          ...(draggable
            ? {
                left: `calc(50% + ${offset.dx}px)`,
                top: `calc(50% + ${offset.dy}px)`,
                cursor: 'default',
              }
            : {}),
        }}
        onMouseDown={handleMouseDown}
        {...props}
      >
        {children}
        {showCloseButton && renderCloseButton}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
