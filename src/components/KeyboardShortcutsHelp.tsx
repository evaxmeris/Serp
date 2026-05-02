'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const shortcuts = [
    // 全局导航
    { section: '🌐 全局导航', items: [
      { key: 'Ctrl+K / ⌘K', description: '打开全局搜索' },
      { key: 'Ctrl+N / ⌘N', description: '新建（跳转到当前页面的新建页）' },
      { key: 'Ctrl+B / ⌘B', description: '切换侧边栏折叠' },
      { key: 'Ctrl+D / ⌘D', description: '跳转至仪表盘' },
      { key: '? / Shift+/', description: '显示快捷键帮助' },
      { key: 'Esc', description: '关闭弹窗 / 取消操作' },
    ]},
    // 页面间跳转（按键序列）
    { section: '🔄 页面跳转', items: [
      { key: 'g → d', description: '跳转至仪表盘 (Dashboard)' },
      { key: 'g → o', description: '跳转至订单 (Orders)' },
      { key: 'g → c', description: '跳转至客户 (Customers)' },
      { key: 'g → p', description: '跳转至产品 (Products)' },
      { key: 'g → s', description: '跳转至供应商 (Suppliers)' },
      { key: 'g → h', description: '返回首页 (Home)' },
    ]},
    // 列表页导航
    { section: '📋 列表页导航', items: [
      { key: 'j', description: '选中下一行' },
      { key: 'k', description: '选中上一行' },
      { key: 'Enter', description: '进入选中行的详情页' },
    ]},
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>⌨️ 键盘快捷键</DialogTitle>
          <DialogDescription>
            Trade ERP 支持以下键盘快捷键提高操作效率
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {shortcuts.map((group) => (
            <div key={group.section} className="mb-5 last:mb-0">
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                {group.section}
              </h4>
              <div className="space-y-2">
                {group.items.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <Kbd className="ml-4 shrink-0">{shortcut.key}</Kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
