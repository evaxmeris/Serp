/**
 * 销售报表图表组件
 * 包含销售趋势图、品类分布图等
 */

'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

interface SalesChartProps {
  data: any[];
  type: 'trend' | 'category' | 'comparison';
  title?: string;
}

interface ChartSubComponentProps {
  data: any[];
  title?: string;
}

/**
 * 销售趋势图（折线图）
 */
export function SalesTrendChart({ data, title }: ChartSubComponentProps) {
  return (
    <div className="w-full h-[300px]">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip 
            formatter={(value) => `¥${Number(value).toLocaleString()}`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="revenue" 
            name="销售额" 
            stroke="#8884d8" 
            strokeWidth={2}
          />
          <Line 
            type="monotone" 
            dataKey="profit" 
            name="利润" 
            stroke="#82ca9d" 
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 销售品类分布图（饼图）
 */
export function CategoryPieChart({ data, title }: ChartSubComponentProps) {
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
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 销售对比图（柱状图）
 */
export function ComparisonBarChart({ data, title }: ChartSubComponentProps) {
  return (
    <div className="w-full h-[300px]">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip formatter={(value) => `¥${Number(value).toLocaleString()}`} />
          <Legend />
          <Bar dataKey="current" name="本期" fill="#8884d8" />
          <Bar dataKey="previous" name="上期" fill="#82ca9d" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 通用图表组件
 */
export default function SalesChart({ data, type, title }: SalesChartProps) {
  switch (type) {
    case 'trend':
      return <SalesTrendChart data={data} title={title} />;
    case 'category':
      return <CategoryPieChart data={data} title={title} />;
    case 'comparison':
      return <ComparisonBarChart data={data} title={title} />;
    default:
      return <SalesTrendChart data={data} title={title} />;
  }
}
