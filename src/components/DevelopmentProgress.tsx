'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface Sprint {
  id: number;
  name: string;
  modules: string[];
  status: 'completed' | 'in-progress' | 'pending';
  completion: number;
  startDate?: string;
  endDate?: string;
}

const sprints: Sprint[] = [
  {
    id: 1,
    name: 'Sprint 1',
    modules: ['供应商管理', '采购订单'],
    status: 'completed',
    completion: 100,
  },
  {
    id: 2,
    name: 'Sprint 2',
    modules: ['报价管理', '销售订单'],
    status: 'completed',
    completion: 100,
  },
  {
    id: 3,
    name: 'Sprint 3',
    modules: ['产品管理', '客户管理', '询盘管理'],
    status: 'completed',
    completion: 100,
  },
  {
    id: 4,
    name: 'Sprint 4',
    modules: ['入库管理', '库存管理'],
    status: 'in-progress',
    completion: 95,
  },
  {
    id: 5,
    name: 'Sprint 5',
    modules: ['出库管理'],
    status: 'pending',
    completion: 0,
  },
  {
    id: 6,
    name: 'Sprint 6',
    modules: ['财务报表'],
    status: 'pending',
    completion: 0,
  },
];

export function DevelopmentProgress() {
  const getStatusBadge = (status: Sprint['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">已完成</Badge>;
      case 'in-progress':
        return <Badge className="bg-yellow-100 text-yellow-800">进行中</Badge>;
      case 'pending':
        return <Badge variant="secondary">待开发</Badge>;
      default:
        return <Badge>未知</Badge>;
    }
  };

  const getProgressColor = (status: Sprint['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'in-progress':
        return 'bg-yellow-500';
      case 'pending':
        return 'bg-gray-300';
      default:
        return 'bg-gray-300';
    }
  };

  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader>
        <CardTitle>开发进度</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sprints.map((sprint) => (
            <div key={sprint.id} className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{sprint.name}</span>
                  {getStatusBadge(sprint.status)}
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  {sprint.modules.join('、')}
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={sprint.completion} 
                    className={`h-2 ${getProgressColor(sprint.status)}`}
                  />
                  <span className="text-xs text-muted-foreground w-12">
                    {sprint.completion}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}