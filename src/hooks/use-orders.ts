'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Order,
  OrderListItem,
  OrderListQuery,
  OrderListResponse,
  OrderCreateInput,
  OrderUpdateInput,
} from '@/types/order';

// API 请求辅助函数
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: '请求失败' }));
    throw new Error(error.message || '请求失败');
  }
  const data = await res.json();
  return data.data as T;
}

// 获取订单列表
export function useOrders(query: OrderListQuery = {}) {
  const { page = 1, limit = 20, ...filters } = query;

  const searchParams = new URLSearchParams();
  searchParams.set('page', page.toString());
  searchParams.set('limit', limit.toString());

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, value.toString());
    }
  });

  return useQuery<OrderListResponse>({
    queryKey: ['orders', searchParams.toString()],
    queryFn: () => fetcher(`/api/orders?${searchParams.toString()}`),
  });
}

// 获取订单详情
export function useOrder(id: string | null) {
  return useQuery<Order>({
    queryKey: ['order', id],
    queryFn: () => fetcher(`/api/orders/${id}`),
    enabled: !!id,
  });
}

// 创建订单
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: OrderCreateInput) => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: '创建失败' }));
        throw new Error(error.message || '创建失败');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// 更新订单
export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: OrderUpdateInput }) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: '更新失败' }));
        throw new Error(error.message || '更新失败');
      }
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
  });
}

// 确认订单
export function useConfirmOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await fetch(`/api/orders/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: '确认失败' }));
        throw new Error(error.message || '确认失败');
      }
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
  });
}

// 取消订单
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cancelReason, notes }: { id: string; cancelReason: string; notes?: string }) => {
      const res = await fetch(`/api/orders/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReason, notes }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: '取消失败' }));
        throw new Error(error.message || '取消失败');
      }
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
  });
}

// 删除订单
export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: '删除失败' }));
        throw new Error(error.message || '删除失败');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// 获取客户列表（用于订单表单）
export function useCustomers() {
  return useQuery<Array<{ id: string; companyName: string; contactName: string | null }>>({
    queryKey: ['customers'],
    queryFn: async () => {
      const result = await fetcher<any>('/api/customers');
      // listResponse 返回 { items: [...], pagination: {...} }，需提取 items
      return result.items || result;
    },
  });
}

// 获取产品列表（用于订单表单）
export function useProducts() {
  return useQuery<Array<{
    id: string;
    sku: string;
    name: string;
    specification: string | null;
    salePrice: number;
    currency: string;
  }>>({
    queryKey: ['products'],
    queryFn: async () => {
      const result = await fetcher<any>('/api/products');
      // 兼容两种返回格式：直接数组 或 { items: [...] }
      if (Array.isArray(result)) return result;
      return result.items || result;
    },
  });
}
