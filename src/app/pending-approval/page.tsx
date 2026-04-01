'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-black px-4">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
      
      <Card className="w-full max-w-lg shadow-xl border-0 ring-1 ring-zinc-200 dark:ring-zinc-800 rounded-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
            <Clock className="h-10 w-10 text-white" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-bold text-zinc-900 dark:text-white">
              注册申请已提交
            </CardTitle>
            <CardDescription className="text-base">
              您的账户正在等待管理员审批
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="pt-4 space-y-6">
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">审批流程说明</h3>
            <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-1">•</span>
                <span>管理员通常会在 1-2 个工作日内完成审批</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-1">•</span>
                <span>审批通过后，您会收到邮件通知</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-1">•</span>
                <span>审批通过后即可登录系统使用全部功能</span>
              </li>
            </ul>
          </div>

          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">需要帮助？</h3>
            <p className="text-sm text-green-700 dark:text-green-400">
              如果您有任何问题，请联系系统管理员获取支持。
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button asChild className="w-full h-11 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all">
              <Link href="/login">
                <CheckCircle className="h-5 w-5 mr-2" />
                返回登录页面
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
