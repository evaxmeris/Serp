'use client';

/** 补货计划（占位）— M4：销量预测 → 补货建议 → 转采购单 */

export default function AdsReplenishmentPage() {
  return (
    <div className="fade-in">
      <h1 className="text-2xl font-semibold">补货计划</h1>
      <p className="mt-1 text-sm text-muted-foreground">销量预测 → 补货建议 → 转采购单（M4 规划）</p>
      <div className="mt-10 rounded-lg border border-dashed py-20 text-center text-muted-foreground">
        该模块规划中：广告推量 → 销量预测 → 库存预警 → 补货建议 → 采购（M4）
      </div>
    </div>
  );
}
