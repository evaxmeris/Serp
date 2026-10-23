import type { Metadata } from 'next';
import WorkbenchHome from '@/components/workbench/WorkbenchHome';

export const metadata: Metadata = {
  title: '工作台 · Trade ERP',
  description: '按角色聚合待办与告警的角色工作台',
};

/**
 * 首页 / 工作台
 *
 * 数据全部来自 GET /api/v1/workbench（按登录角色返回待办聚合），
 * 原「经营看板 + 图表 + mock 兜底数据」已下线，常用功能 / 快捷操作保留在工作台下方。
 */
export default function DashboardPage() {
  return <WorkbenchHome />;
}
