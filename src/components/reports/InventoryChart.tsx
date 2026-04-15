/**
 * 库存报表图表组件
 * 包含库存分布图、库龄分析图等
 */

'use client';

import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const STATUS_COLORS = {
  normal: '#22c55e',
  low: '#eab308',
  out: '#ef4444',
  over: '#3b82f6',
};

interface InventoryChartProps {
  data: any[];
  type: 'distribution' | 'status' | 'age';
  title?: string;
}

interface ChartSubComponentProps {
  data: any[];
  title?: string;
}

/**
 * 库存品类分布图（饼图）
 */
export function InventoryDistributionChart({ data, title }: ChartSubComponentProps) {
  return (
    <div className="w-full h-[300px]">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] || `hsl(${index * 60}, 70%, 50%)`} 
              />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${Number(value).toLocaleString()}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 库存状态统计图（柱状图）
 */
export function InventoryStatusChart({ data, title }: ChartSubComponentProps) {
  const statusLabels: any = {
    normal: '正常',
    low: '低库存',
    out: '缺货',
    over: '超储',
  };
  
  const chartData = data.map(item => ({
    name: statusLabels[item.status] || item.status,
    value: item.count,
    status: item.status,
  }));
  
  return (
    <div className="w-full h-[300px]">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip formatter={(value) => `${Number(value)} 个产品`} />
          <Legend />
          <Bar dataKey="value" name="产品数量">
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS]} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 库龄分析图（柱状图）
 */
export function InventoryAgeChart({ data, title }: ChartSubComponentProps) {
  return (
    <div className="w-full h-[300px]">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="ageRange" />
          <YAxis />
          <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
          <Legend />
          <Bar dataKey="value" name="库存金额" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 通用库存图表组件
 */
export default function InventoryChart({ data, type, title }: InventoryChartProps) {
  switch (type) {
    case 'distribution':
      return <InventoryDistributionChart data={data} title={title} />;
    case 'status':
      return <InventoryStatusChart data={data} title={title} />;
    case 'age':
      return <InventoryAgeChart data={data} title={title} />;
    default:
      return <InventoryDistributionChart data={data} title={title} />;
  }
}
