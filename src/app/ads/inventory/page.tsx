'use client';

/** 库存对接（占位）— M3：FBA 库存同步 + 低库存预警 + 广告-库存联动 */

export default function AdsInventoryPage() {
  return (
    <div className="fade-in">
      <h1 className="text-2xl font-semibold">库存对接</h1>
      <p className="mt-1 text-sm text-muted-foreground">FBA 库存同步 + 低库存预警 + 广告-库存联动（M3 规划）</p>
      <div className="mt-10 rounded-lg border border-dashed py-20 text-center text-muted-foreground">
        该模块规划中：FBA 库存同步 → 低库存预警 → 自动暂停广告（M3）
      </div>
    </div>
  );
}
