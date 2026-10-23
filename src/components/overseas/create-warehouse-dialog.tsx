'use client';

/**
 * 新建海外仓弹窗
 * POST /api/v1/overseas/warehouses（code 大写、地址必填）
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast, ToastContainer } from '@/components/ui/toast';
import type { OverseasWarehouse } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (warehouse: OverseasWarehouse) => void;
}

interface FormState {
  code: string;
  name: string;
  type: string;
  country: string;
  region: string;
  city: string;
  address: string;
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  type: 'SELF_OWNED',
  country: '',
  region: '',
  city: '',
  address: '',
};

export default function CreateWarehouseDialog({ open, onOpenChange, onCreated }: Props) {
  const { toasts, removeToast, toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setError('');
    }
  }, [open]);

  const patch = (key: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setError('');
    if (!form.code.trim() || !form.name.trim()) {
      setError('仓库编码与名称必填');
      return;
    }
    if (!form.country.trim()) {
      setError('国家必填');
      return;
    }
    if (!form.address.trim()) {
      setError('地址必填');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/overseas/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          type: form.type,
          country: form.country.trim(),
          region: form.region.trim() || undefined,
          city: form.city.trim() || undefined,
          address: form.address.trim(),
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || '海外仓创建成功');
        onCreated(data.data as OverseasWarehouse);
        onOpenChange(false);
      } else {
        const detail = Array.isArray(data.errors) && data.errors.length
          ? data.errors.map((e: { message: string }) => e.message).join('；')
          : data.message;
        setError(detail || '创建失败');
      }
    } catch (e) {
      console.error('创建海外仓失败:', e);
      setError('创建失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建海外仓</DialogTitle>
            <DialogDescription>
              编码会用于台账/调拨单引用，创建后不建议修改；建议使用「地区-序号」形式（如 US-LAX01）。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="ow-code">仓库编码 *</Label>
              <Input
                id="ow-code"
                value={form.code}
                onChange={e => patch('code', e.target.value.toUpperCase())}
                placeholder="US-LAX01"
                maxLength={50}
              />
            </div>
            <div>
              <Label htmlFor="ow-name">仓库名称 *</Label>
              <Input
                id="ow-name"
                value={form.name}
                onChange={e => patch('name', e.target.value)}
                placeholder="洛杉矶自营仓"
                maxLength={120}
              />
            </div>
            <div>
              <Label>仓库类型 *</Label>
              <Select value={form.type} onValueChange={v => patch('type', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELF_OWNED">自营仓</SelectItem>
                  <SelectItem value="THIRD_PARTY">第三方仓</SelectItem>
                  <SelectItem value="FBA">FBA 仓</SelectItem>
                  <SelectItem value="FBN">FBN 仓</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ow-country">国家 *</Label>
              <Input
                id="ow-country"
                value={form.country}
                onChange={e => patch('country', e.target.value)}
                placeholder="美国"
                maxLength={60}
              />
            </div>
            <div>
              <Label htmlFor="ow-region">州/省</Label>
              <Input
                id="ow-region"
                value={form.region}
                onChange={e => patch('region', e.target.value)}
                placeholder="CA"
              />
            </div>
            <div>
              <Label htmlFor="ow-city">城市</Label>
              <Input
                id="ow-city"
                value={form.city}
                onChange={e => patch('city', e.target.value)}
                placeholder="Los Angeles"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ow-address">地址 *</Label>
              <Input
                id="ow-address"
                value={form.address}
                onChange={e => patch('address', e.target.value)}
                placeholder="1234 E Olympic Blvd, Los Angeles, CA 90021"
                maxLength={300}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '创建中...' : '确认创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}
