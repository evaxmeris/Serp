'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PurchasesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/purchase-orders'); }, []);
  return <div className="flex items-center justify-center min-h-screen text-gray-500">正在跳转...</div>;
}
