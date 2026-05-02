'use client';

/**
 * 全局搜索组件
 *
 * - 搜索输入框（带放大镜图标）
 * - 按 Enter 触发搜索
 * - 下拉面板展示按模块分组的结果
 * - 点击结果跳转到对应的详情页
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Package, Users, Building2, ShoppingCart, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  url: string;
  type: 'order' | 'customer' | 'product' | 'supplier';
}

interface SearchResults {
  orders: SearchResult[];
  customers: SearchResult[];
  products: SearchResult[];
  suppliers: SearchResult[];
}

/** 模块中文标签 */
const MODULE_LABELS: Record<string, string> = {
  orders: '订单',
  customers: '客户',
  products: '产品',
  suppliers: '供应商',
};

/** 模块图标 */
const MODULE_ICONS: Record<string, React.ElementType> = {
  orders: ShoppingCart,
  customers: Users,
  products: Package,
  suppliers: Building2,
};

/** 模块空结果提示 */
const MODULE_EMPTY: Record<string, string> = {
  orders: '未找到匹配订单',
  customers: '未找到匹配客户',
  products: '未找到匹配产品',
  suppliers: '未找到匹配供应商',
};

interface GlobalSearchProps {
  collapsed?: boolean;
}

export default function GlobalSearch({ collapsed = false }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 扁平化所有结果用于键盘导航 */
  const flatResults = results
    ? ([
        ...results.orders.map((r) => ({ ...r, _section: 'orders' as const })),
        ...results.customers.map((r) => ({ ...r, _section: 'customers' as const })),
        ...results.products.map((r) => ({ ...r, _section: 'products' as const })),
        ...results.suppliers.map((r) => ({ ...r, _section: 'suppliers' as const })),
      ] as (SearchResult & { _section: string })[])
    : ([] as (SearchResult & { _section: string })[]);

  /** 调用搜索 API */
  const doSearch = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setResults(null);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(keyword)}`);
      const json = await res.json();
      if (json.success) {
        setResults(json.data);
        setOpen(true);
        setSelectedIndex(-1);
      }
    } catch (err) {
      console.error('全局搜索请求失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 防抖输入 */
  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  /** 选择结果跳转 */
  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    setResults(null);
    router.push(result.url);
  };

  /** 键盘导航 */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || flatResults.length === 0) {
      // 折叠态下，按 Enter 直接展开搜索
      if (e.key === 'Enter' && collapsed) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
          handleSelect(flatResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  /** 点击外部关闭面板 */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /** 清理防抖 */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /** 快捷键 Ctrl+K / Cmd+K 聚焦搜索 */
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  /** 折叠模式：只显示搜索图标按钮，点击弹出输入框 */
  if (collapsed) {
    return (
      <div className="relative px-2 py-3">
        <button
          onClick={() => inputRef.current?.focus()}
          className="flex items-center justify-center w-full p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="全局搜索 (Ctrl+K)"
          title="全局搜索 (Ctrl+K)"
        >
          <Search className="h-5 w-5" />
        </button>
        {/* 折叠模式下，搜索框用 overlay 形式弹出 */}
        {open && (
          <div
            ref={panelRef}
            className="absolute left-14 top-0 z-50 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl"
          >
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              ) : (
                <Search className="h-4 w-4 text-zinc-400" />
              )}
          <input
            ref={inputRef}
            id="global-search-input"
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索订单/客户/产品/供应商..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
            autoFocus
          />
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded">
                ESC
              </kbd>
            </div>
            <SearchResultsPanel
              results={results}
              loading={loading}
              flatResults={flatResults}
              selectedIndex={selectedIndex}
              query={query}
              onSelect={handleSelect}
            />
          </div>
        )}
      </div>
    );
  }

  /** 展开模式：搜索框内嵌在 Sidebar 顶部 */
  return (
    <div className="relative px-3 py-3">
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
          open
            ? 'border-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/30'
            : 'border-zinc-200 dark:border-zinc-700',
          'bg-zinc-50 dark:bg-zinc-800/50'
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400 flex-shrink-0" />
        ) : (
          <Search className="h-4 w-4 text-zinc-400 flex-shrink-0" />
        )}
        <input
          ref={inputRef}
          id="global-search-input"
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results) setOpen(true); }}
          placeholder="搜索 (Ctrl+K)"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400 min-w-0"
        />
      </div>

      {open && (
        <div
          ref={panelRef}
          className="absolute left-3 right-3 top-full mt-1 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl max-h-96 overflow-y-auto"
        >
          <SearchResultsPanel
            results={results}
            loading={loading}
            flatResults={flatResults}
            selectedIndex={selectedIndex}
            query={query}
            onSelect={handleSelect}
          />
        </div>
      )}
    </div>
  );
}

/** 搜索结果面板（内部组件） */
function SearchResultsPanel({
  results,
  loading,
  flatResults,
  selectedIndex,
  query,
  onSelect,
}: {
  results: SearchResults | null;
  loading: boolean;
  flatResults: (SearchResult & { _section: string })[];
  selectedIndex: number;
  query: string;
  onSelect: (result: SearchResult) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        搜索中...
      </div>
    );
  }

  if (!results || flatResults.length === 0) {
    if (query.trim()) {
      return (
        <div className="px-4 py-8 text-center text-sm text-zinc-400">
          未找到与 &ldquo;{query}&rdquo; 相关的结果
        </div>
      );
    }
    return null;
  }

  let globalIdx = -1;

  const renderSection = (key: 'orders' | 'customers' | 'products' | 'suppliers') => {
    const items = results[key];
    if (!items || items.length === 0) return null;
    const Icon = MODULE_ICONS[key];

    return (
      <div key={key}>
        <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3 w-3" />
            {MODULE_LABELS[key]}
          </div>
        </div>
        {items.map((item) => {
          globalIdx++;
          const idx = globalIdx;
          return (
            <button
              key={`${key}-${item.id}`}
              onClick={() => onSelect(item)}
              className={cn(
                'flex items-center w-full px-3 py-2.5 text-left transition-colors',
                idx === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {item.title}
                </div>
                <div className="text-xs text-zinc-400 truncate mt-0.5">
                  {item.description}
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-300 flex-shrink-0 ml-2" />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="max-h-80 overflow-y-auto">
        {renderSection('orders')}
        {renderSection('customers')}
        {renderSection('products')}
        {renderSection('suppliers')}
      </div>
      <div className="px-3 py-1.5 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-between">
        <span>
          {flatResults.length} 条结果
        </span>
        <span>
          ↑↓ 导航 &nbsp; Enter 打开 &nbsp; Esc 关闭
        </span>
      </div>
    </>
  );
}
