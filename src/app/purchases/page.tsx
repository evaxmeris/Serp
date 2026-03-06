'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PurchasesPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">采购管理</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-4">🚧 开发中</p>
            <p>采购管理功能即将上线</p>
            <div className="mt-8">
              <a href="/">
                <Button variant="outline">返回首页</Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
