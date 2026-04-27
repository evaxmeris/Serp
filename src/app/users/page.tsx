'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UsersRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings/users'); }, []);
  return <div className="flex items-center justify-center min-h-screen text-gray-500">正在跳转...</div>;
}
