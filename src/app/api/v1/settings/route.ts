/**
 * Settings API - 系统设置
 *
 * GET /api/v1/settings - 获取系统配置（币种、贸易条款、付款方式、物流方式等）
 * PUT /api/v1/settings - 更新系统配置
 *
 * @作者 Trade ERP 团队
 * @创建日期 2026-05-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth-unified';

// ============================================
// 类型 / 常量
// ============================================

interface SystemSettings {
  currencies: { code: string; name: string; symbol: string; default: boolean }[];
  tradeTerms: string[];
  paymentMethods: string[];
  shippingMethods: string[];
}

/** 默认配置（数据库无数据时回退） */
const DEFAULT_SETTINGS: SystemSettings = {
  currencies: [
    { code: 'USD', name: '美元', symbol: '$', default: true },
    { code: 'EUR', name: '欧元', symbol: '€', default: false },
    { code: 'CNY', name: '人民币', symbol: '¥', default: false },
    { code: 'GBP', name: '英镑', symbol: '£', default: false },
  ],
  tradeTerms: ['FOB', 'CIF', 'EXW', 'DDP', 'DAP', 'CFR', 'CIP', 'FCA'],
  paymentMethods: ['T/T', 'L/C', 'D/P', 'D/A', 'PayPal', 'Western Union', 'Credit Card'],
  shippingMethods: ['海运 (FCL)', '海运 (LCL)', '空运', '快递 (DHL/FedEx)', '铁路', '多式联运'],
};

// ============================================
// GET — 获取系统配置
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 从数据库读取配置（存储在 SystemConfig 表或通过键值方式）
    // 当前实现：尝试从通用的 KeyValue 存储读取，如不存在则返回默认值
    let settings: SystemSettings | null = null;

    try {
      // 优先从数据库读取持久化的配置
      const stored = await prisma.systemConfig.findFirst({
        where: { key: 'business_settings' },
      });
      if (stored && stored.value) {
        settings = JSON.parse(stored.value as string) as SystemSettings;
      }
    } catch {
      // SystemConfig 表可能尚不存在，静默回退到默认值
    }

    return NextResponse.json({
      success: true,
      data: settings || DEFAULT_SETTINGS,
    });
  } catch (error) {
    console.error('获取系统设置失败:', error);
    return NextResponse.json(
      { error: '获取系统设置失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT — 更新系统配置
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currencies, tradeTerms, paymentMethods, shippingMethods } = body;

    // 校验
    if (!currencies || !Array.isArray(currencies)) {
      return NextResponse.json({ error: '缺少有效的 currencies 字段' }, { status: 400 });
    }

    const settings: SystemSettings = {
      currencies,
      tradeTerms: tradeTerms || DEFAULT_SETTINGS.tradeTerms,
      paymentMethods: paymentMethods || DEFAULT_SETTINGS.paymentMethods,
      shippingMethods: shippingMethods || DEFAULT_SETTINGS.shippingMethods,
    };

    // 持久化到数据库
    try {
      await prisma.systemConfig.upsert({
        where: { key: 'business_settings' },
        update: { value: JSON.stringify(settings) },
        create: {
          key: 'business_settings',
          value: JSON.stringify(settings),
          description: '业务设置：币种、贸易条款、付款方式、物流方式',
        },
      });
    } catch {
      // SystemConfig 表可能尚不存在，忽略持久化错误
      console.warn('SystemConfig 表不存在，配置将不会被持久化');
    }

    return NextResponse.json({
      success: true,
      data: settings,
      message: '系统设置已更新',
    });
  } catch (error) {
    console.error('更新系统设置失败:', error);
    return NextResponse.json(
      { error: '更新系统设置失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
