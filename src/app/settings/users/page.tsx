'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, UserCheck, Shield } from 'lucide-react';
import UserListTab from './user-list';
import UserApprovalsTab from './user-approvals';
import RolesManagementTab from './roles-management';

export default function UsersAndPermissionsPage() {
  const [activeTab, setActiveTab] = useState('users');
  const router = useRouter();

  return (
    <div className="p-6 w-full space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push('/settings')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />返回
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-600" />用户及权限管理
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />用户列表
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />用户审批
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />角色管理
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UserListTab />
        </TabsContent>
        <TabsContent value="approvals" className="mt-4">
          <UserApprovalsTab />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
