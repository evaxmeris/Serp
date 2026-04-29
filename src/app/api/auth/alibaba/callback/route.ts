import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { encryptCredentials } from '@/lib/crypto-utils';

/**
 * 阿里国际站 OAuth 回调 + 自动换 Token
 * GET /api/auth/alibaba/callback?code=xxx
 * 
 * 1. 接收阿里返回的授权码 code
 * 2. 自动调用 /auth/token/create 换取 access_token
 * 3. 保存到数据库
 * 4. 跳回设置页面
 */

const APP_KEY = '504486';
const APP_SECRET = '1fb2a78f6e7dab63d9ec81d10462961f';
const TOKEN_BASE = 'https://open-api.alibaba.com/rest';

function generateSign(apiName: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let signStr = apiName;
  for (const key of sortedKeys) signStr += key + params[key];
  return crypto.createHmac('sha256', appSecret).update(signStr, 'utf-8').digest('hex').toUpperCase();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // 用户拒绝授权
  if (error) {
    return NextResponse.redirect(new URL(
      `/settings?tab=sync&oauth=error&msg=${encodeURIComponent(errorDescription || error)}`,
      request.url
    ));
  }

  if (!code) {
    return NextResponse.redirect(new URL(
      `/settings?tab=sync&oauth=error&msg=${encodeURIComponent('未收到授权码')}`,
      request.url
    ));
  }

  // 用 code 换 token
  try {
    const ts = String(Date.now());
    const params: Record<string, string> = {
      app_key: APP_KEY,
      code,
      sign_method: 'sha256',
      simplify: 'true',
      timestamp: ts,
    };

    const sign = generateSign('/auth/token/create', params, APP_SECRET);

    const qs = Object.entries({ ...params, sign })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    const res = await fetch(`${TOKEN_BASE}/auth/token/create?${qs}`);
    const data = await res.json();

    if (!data.access_token) {
      throw new Error(data.message || data.error_response?.msg || '换取 Token 失败');
    }

    // 保存到数据库
    await prisma.platformSyncConfig.upsert({
      where: { platformCode: 'alibaba' },
      update: {
        credentials: encryptCredentials({
          appKey: APP_KEY,
          appSecret: APP_SECRET,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || '',
        }),
      },
      create: {
        platformCode: 'alibaba',
        platformName: '阿里国际站',
        enabled: true,
        syncIntervalMin: 120,
        credentials: encryptCredentials({
          appKey: APP_KEY,
          appSecret: APP_SECRET,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || '',
        }),
      },
    });

    const expiresDays = Math.floor((data.expires_in || 2592000) / 86400);

    return NextResponse.redirect(new URL(
      `/settings?tab=sync&oauth=success&msg=${encodeURIComponent(`Token 获取成功！有效期 ${expiresDays} 天，已自动保存`)}`,
      request.url
    ));

  } catch (e: any) {
    console.error('Alibaba OAuth token exchange failed:', e);
    return NextResponse.redirect(new URL(
      `/settings?tab=sync&oauth=error&msg=${encodeURIComponent(e.message || '换取 Token 失败')}`,
      request.url
    ));
  }
}
