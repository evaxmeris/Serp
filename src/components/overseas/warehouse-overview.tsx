'use client';

/**
 * 海外仓 - 仓库概况（卡片列表）
 * 每个卡片：编码/名称/国家地区 + SKU数/在库/可用 + 快捷进入台账/流水
 */

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Globe, MapPin, Search, Boxes, Warehouse as WarehouseIcon } from 'lucide-react';
import { OVERSEAS_TYPES, type OverseasWarehouse } from './types';

interface Props {
  warehouses: OverseasWarehouse[];
  loading: boolean;
  onViewLedger: (code: string) => void;
  onViewMovements: (code: string) => void;
  onCreate: () => void;
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={
          'text-xl font-semibold tabular-nums ' + (highlight ? 'text-blue-600 dark:text-blue-400' : '')
        }
      >
        {value.toLocaleString('zh-CN')}
      </span>
    </div>
  );
}

export default function WarehouseOverview({
  warehouses,
  loading,
  onViewLedger,
  onViewMovements,
  onCreate,
}: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return warehouses;
    return warehouses.filter(
      w =>
        w.code.toLowerCase().includes(kw) ||
        w.name.toLowerCase().includes(kw) ||
        (w.country || '').toLowerCase().includes(kw) ||
        (w.city || '').toLowerCase().includes(kw)
    );
  }, [warehouses, search]);

  return (
    <div className="space-y-4">
      {/* 筛选：右对齐 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="搜索仓编码 / 名称 / 国家"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <Globe className="h-8 w-8 text-blue-500" />
            </div>
          }
          title={warehouses.length === 0 ? '还没有海外仓' : '没有匹配的海外仓'}
          description={
            warehouses.length === 0
              ? '创建第一个海外仓后，即可维护台账、做国内→海外调拨'
              : '换个关键字试试，或清空搜索条件'
          }
          action={
            warehouses.length === 0 ? (
              <Button onClick={onCreate}>新建海外仓</Button>
            ) : (
              <Button variant="outline" onClick={() => setSearch('')}>
                清空搜索
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(w => (
            <Card
              key={w.id}
              className={
                'transition-shadow hover:shadow-md ' + (w.isActive ? '' : 'opacity-60 bg-muted/30')
              }
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <WarehouseIcon className="h-4 w-4 text-blue-500 shrink-0" />
                      <h3 className="font-semibold truncate" title={w.name}>
                        {w.name}
                      </h3>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-mono">
                        {w.code}
                      </Badge>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {[w.country, w.region, w.city].filter(Boolean).join(' / ') || '-'}
                      </span>
                      {w.type && <span>· {OVERSEAS_TYPES[w.type] || w.type}</span>}
                    </div>
                  </div>
                  <Badge
                    className={
                      w.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }
                  >
                    {w.isActive ? '启用' : '停用'}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <Stat label="SKU 数" value={w.skuCount} />
                  <Stat label="在库" value={w.totalQuantity} />
                  <Stat label="可用" value={w.availableQuantity} highlight />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => onViewLedger(w.code)}
                  >
                    <Boxes className="h-3.5 w-3.5 mr-1" />
                    库存台账
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => onViewMovements(w.code)}
                  >
                    查看流水
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
