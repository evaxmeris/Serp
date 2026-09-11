'use client';

/**
 * 亚马逊广告优化管理（M1）React Query hooks
 *
 * 范式对齐 src/hooks/use-orders.ts：
 *  - fetcher 解包 `data.data`（后端 successResponse/listResponse 包装）；后端未就绪/裸返回时兜底 `data`
 *  - queryKey = [前缀, 序列化参数]；staleTime 走 providers.tsx 全局 60s（配置类数据加长）
 *  - mutation onSuccess invalidate 对应前缀
 *
 * 契约来源：docs/advertising-domain-m1-be-design.md §17 + FE 设计 §5.1
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import type {
  AdAccountDTO,
  AdAccountInput,
  AdAnalyzeResponse,
  AdBulkTableResponse,
  AdKeywordListQuery,
  AdKeywordRow,
  AdMarketplaceDTO,
  AdMarketplaceInput,
  AdRawReportRow,
  AdRecommendationListItem,
  AdReportListItem,
  AdUploadResponse,
  AdsListResponse,
  AdsResultResponse,
  UpdateKeywordInput,
} from '@/types/ads';

/** 广告域 API 前缀（架构 §4.0：新域走 /api/v1/**） */
export const ADS_API = '/api/v1/ads';

/** M2：Ads API 接入状态查询（未配置 → mock 模式提示） */
export interface AdsApiStatus {
  configured: boolean;
  mode: 'mock' | 'real';
  dryRun: boolean;
  marketplace: string;
  profileId: string;
  message: string;
}

export function useAdsApiStatus(accountId: string | null) {
  return useQuery<AdsApiStatus>({
    queryKey: ['ads-api-status', accountId ?? 'none'],
    queryFn: async () => {
      const q = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
      const res = await fetcher<AdsApiStatus>(`${ADS_API}/api${q}`);
      return res ?? { configured: false, mode: 'mock', dryRun: true, marketplace: 'US', profileId: '', message: '' };
    },
    staleTime: 60_000,
  });
}

// ──────────────────────────────────────────────────────────────
// 错误对象：保留后端 code，供 E5/E6 分支处理（FE 设计 §8.3）
// ──────────────────────────────────────────────────────────────

export class AdsApiError extends Error {
  code?: string;
  status: number;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'AdsApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** 后端错误响应解析（兼容 {error}/{message}/{code} 多形态） */
async function toError(res: Response, fallback: string): Promise<AdsApiError> {
  const body = await res.json().catch(() => null as unknown);
  const obj = (body ?? {}) as Record<string, unknown>;
  const message =
    (typeof obj.message === 'string' && obj.message) ||
    (typeof obj.error === 'string' && obj.error) ||
    fallback;
  const code =
    (typeof obj.code === 'string' && obj.code) ||
    (typeof obj.errorCode === 'string' && obj.errorCode) ||
    undefined;
  const details = obj.details ?? obj.errors ?? obj.data ?? undefined;
  return new AdsApiError(message, res.status, code, details);
}

/** GET：解包 data.data，后端裸返回时兜底 data（运行时容错，后端未全就绪） */
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw await toError(res, '请求失败');
  const json = await res.json().catch(() => null);
  const payload = json && typeof json === 'object' && 'data' in json ? (json as { data: unknown }).data : json;
  return (payload ?? json) as T;
}

/** 列表兜底：{items,pagination} / 裸数组 都能消费 */
function normalizeList<T>(raw: unknown, page = 1, limit = 20): AdsListResponse<T> {
  if (Array.isArray(raw)) {
    return {
      items: raw as T[],
      pagination: { page, limit, total: raw.length, totalPages: 1 },
    };
  }
  const obj = (raw ?? {}) as Partial<AdsListResponse<T>>;
  const items = Array.isArray(obj.items) ? obj.items : [];
  const pagination = obj.pagination ?? {
    page,
    limit,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / Math.max(1, limit))),
  };
  return { items, pagination };
}

/** 写请求统一处理（JSON） */
async function mutateJson<T>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  fallbackMsg = '操作失败'
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res, fallbackMsg);
  const json = await res.json().catch(() => null);
  const payload = json && typeof json === 'object' && 'data' in json ? (json as { data: unknown }).data : json;
  return (payload ?? json) as T;
}

/** 查询串构造（跳过 undefined / 空串） */
function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, String(v));
  });
  return sp.toString();
}

// ──────────────────────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────────────────────

export interface AdsAccountsQuery {
  page?: number;
  limit?: number;
  search?: string;
  active?: boolean;
}

/** 广告账户列表（含 marketplace、脱敏凭据；BE §17-9） */
export function useAdsAccounts(query: AdsAccountsQuery = {}) {
  const { page = 1, limit = 100, ...filters } = query;
  const search = qs({ page, limit, ...filters });

  return useQuery<AdsListResponse<AdAccountDTO>>({
    queryKey: ['ads-accounts', search],
    queryFn: async () => normalizeList<AdAccountDTO>(await fetcher(`${ADS_API}/accounts?${search}`), page, limit),
  });
}

/** 站点列表（配置类数据，staleTime 5min） */
export function useAdsMarketplaces() {
  return useQuery<AdsListResponse<AdMarketplaceDTO>>({
    queryKey: ['ads-marketplaces'],
    queryFn: async () => normalizeList<AdMarketplaceDTO>(await fetcher(`${ADS_API}/marketplaces?limit=100`), 1, 100),
    staleTime: 300_000,
  });
}

export interface AdsReportsQuery {
  accountId?: string;
  reportType?: string;
  source?: string;
  page?: number;
  limit?: number;
}

/** 报告历史（上传后状态确认 + 历史列表） */
export function useAdsReports(query: AdsReportsQuery = {}, options?: { enabled?: boolean }) {
  const { page = 1, limit = 20, ...filters } = query;
  const search = qs({ page, limit, ...filters });

  return useQuery<AdsListResponse<AdReportListItem>>({
    queryKey: ['ads-reports', search],
    queryFn: async () => normalizeList<AdReportListItem>(await fetcher(`${ADS_API}/reports?${search}`), page, limit),
    enabled: options?.enabled ?? true,
  });
}

/**
 * 决策结果快照（5 区数据源，BE §17-4 顶层键透传）
 * 端点：GET /reports/:id/result（按报告 id）；无数据时按 3s 条件轮询（FE 设计 §5.3）
 */
export function useAdsReportResult(reportId: string | null, options?: { poll?: boolean }) {
  const poll = options?.poll ?? true;

  return useQuery<AdsResultResponse>({
    queryKey: ['ads-result', reportId],
    queryFn: () => fetcher<AdsResultResponse>(`${ADS_API}/reports/${reportId}/result`),
    enabled: !!reportId,
    staleTime: 30_000,
    retry: 1,
    // 分析异步落库窗口：尚无数据时每 3s 轮询一次
    refetchInterval: (query) => (poll && !query.state.data ? 3000 : false),
  });
}

/** 原始报告行（下钻单行，AC-10；GET /reports/:id/result?rawRow=N） */
export function useRawReportRow(reportId: string | null, rowIndex: number | null) {
  return useQuery<AdRawReportRow>({
    queryKey: ['ads-raw-row', reportId, rowIndex],
    queryFn: async () => {
      const raw = await fetcher<unknown>(`${ADS_API}/reports/${reportId}/result?rawRow=${rowIndex}`);
      // 兜底：后端可能返回 { rawRow: {...} } 或直接返回行对象
      const obj = (raw ?? {}) as Record<string, unknown>;
      const inner = obj.rawRow ?? obj.row ?? raw;
      return (inner ?? {}) as AdRawReportRow;
    },
    enabled: !!reportId && rowIndex !== null && rowIndex !== undefined,
    staleTime: 300_000,
    retry: 0,
  });
}

/** 决策行列表（执行清单四表唯一勾选数据源，架构 P0-7） */
export function useAdsKeywords(query: AdKeywordListQuery, options?: { enabled?: boolean }) {
  const { recommendationId, page = 1, limit = 20, ...filters } = query;
  const search = qs({ recommendationId, page, limit, ...filters });

  return useQuery<AdsListResponse<AdKeywordRow>>({
    queryKey: ['ads-keywords', search],
    queryFn: async () => normalizeList<AdKeywordRow>(await fetcher(`${ADS_API}/keywords?${search}`), page, limit),
    enabled: (options?.enabled ?? true) && !!recommendationId,
  });
}

/**
 * 已勾选分类计数（REQ-004-4：计数与批量表行数一致）
 * 实现：limit=1 只读 pagination.total（响应极小，FE 设计 §4.9 / §13 O-2）
 */
export function useAdsSelectedCount(recommendationId: string | null, source: string) {
  const search = qs({ recommendationId, source, isSelected: true, page: 1, limit: 1 });

  return useQuery<number>({
    queryKey: ['ads-keywords', search],
    queryFn: async () => {
      const list = normalizeList<AdKeywordRow>(await fetcher(`${ADS_API}/keywords?${search}`), 1, 1);
      return list.pagination.total ?? 0;
    },
    enabled: !!recommendationId,
  });
}

/** 决策历史（P1） */
export function useAdsRecommendations(query: { accountId?: string; page?: number; limit?: number } = {}) {
  const { page = 1, limit = 20, ...filters } = query;
  const search = qs({ page, limit, ...filters });

  return useQuery<AdsListResponse<AdRecommendationListItem>>({
    queryKey: ['ads-recommendations', search],
    queryFn: async () =>
      normalizeList<AdRecommendationListItem>(await fetcher(`${ADS_API}/recommendations?${search}`), page, limit),
  });
}

// ──────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────

/** 上传报告（multipart；分次提交沿用同一 uploadBatchId，架构 AD-9） */
export function useUploadReports() {
  const queryClient = useQueryClient();

  return useMutation<AdUploadResponse, AdsApiError, FormData>({
    mutationFn: async (fd: FormData) => {
      const res = await fetch(`${ADS_API}/reports/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw await toError(res, '上传失败');
      const json = await res.json().catch(() => null);
      const payload = json && typeof json === 'object' && 'data' in json ? (json as { data: unknown }).data : json;
      return (payload ?? {}) as AdUploadResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-reports'] });
    },
  });
}

/** 触发引擎分析（E2 重试复用同一 mutation） */
export function useAnalyzeReport() {
  const queryClient = useQueryClient();

  return useMutation<AdAnalyzeResponse, AdsApiError, string>({
    mutationFn: (reportId: string) =>
      mutateJson<AdAnalyzeResponse>(`${ADS_API}/reports/${reportId}/analyze`, 'POST', {}, '分析失败'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-reports'] });
      queryClient.invalidateQueries({ queryKey: ['ads-keywords'] });
      queryClient.invalidateQueries({ queryKey: ['ads-result'] });
    },
  });
}

/** 乐观更新本地补丁：勾选 / 覆写（与后端一致：传 action/actionBid ⇒ override*） */
function applyLocalPatch(row: AdKeywordRow, patch: UpdateKeywordInput): AdKeywordRow {
  const next: AdKeywordRow = { ...row };
  if (patch.isSelected !== undefined) next.isSelected = patch.isSelected;
  if (patch.action !== undefined) {
    next.overrideAction = patch.action;
    next.isManualOverride = true;
    next.overriddenAt = next.overriddenAt ?? new Date().toISOString();
  }
  if (patch.actionBid !== undefined) {
    next.overrideBid = patch.actionBid;
    next.isManualOverride = true;
    next.overriddenAt = next.overriddenAt ?? new Date().toISOString();
  }
  if (patch.actionReason !== undefined) {
    next.actionReason = patch.actionReason;
    next.reasonPending = patch.actionReason === '待补充';
  }
  return next;
}

/** 勾选 / 覆写（乐观更新，REQ-004-1/2/3：勾选即持久化，刷新不丢） */
export function useUpdateKeyword() {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    AdsApiError,
    { id: string; data: UpdateKeywordInput },
    { snapshots: Array<[QueryKey, unknown]> }
  >({
    mutationFn: ({ id, data }) =>
      mutateJson(`${ADS_API}/keywords/${id}`, 'PUT', data, '保存失败'),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['ads-keywords'] });
      const snapshots = queryClient.getQueriesData({ queryKey: ['ads-keywords'] });

      snapshots.forEach(([key, value]) => {
        const list = value as AdsListResponse<AdKeywordRow> | undefined;
        if (!list || !Array.isArray(list.items)) return;
        queryClient.setQueryData(key, {
          ...list,
          items: list.items.map((row) => (row.id === id ? applyLocalPatch(row, data) : row)),
        });
      });

      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      // 回滚全部受影响缓存
      ctx?.snapshots.forEach(([key, value]) => queryClient.setQueryData(key, value));
    },
    onSettled: () => {
      // 保底一致性（前缀匹配，覆盖分页与计数查询）
      queryClient.invalidateQueries({ queryKey: ['ads-keywords'] });
    },
  });
}

/** 生成批量表（E5/E6 由组件按 error.code 分支处理） */
export function useGenerateBulkTable() {
  return useMutation<AdBulkTableResponse, AdsApiError, { recommendationId: string; confirmEmpty?: boolean }>({
    mutationFn: ({ recommendationId, confirmEmpty = false }) =>
      mutateJson<AdBulkTableResponse>(`${ADS_API}/bulk-table`, 'POST', { recommendationId, confirmEmpty }, '生成批量表失败'),
  });
}

// ── 账户 CRUD ────────────────────────────────────────────────

export function useCreateAdAccount() {
  const queryClient = useQueryClient();
  return useMutation<AdAccountDTO, AdsApiError, AdAccountInput>({
    mutationFn: (data) => mutateJson<AdAccountDTO>(`${ADS_API}/accounts`, 'POST', data, '创建账户失败'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ads-accounts'] }),
  });
}

export function useUpdateAdAccount() {
  const queryClient = useQueryClient();
  return useMutation<AdAccountDTO, AdsApiError, { id: string; data: Partial<AdAccountInput> }>({
    mutationFn: ({ id, data }) => mutateJson<AdAccountDTO>(`${ADS_API}/accounts/${id}`, 'PUT', data, '更新账户失败'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ads-accounts'] }),
  });
}

export function useDeleteAdAccount() {
  const queryClient = useQueryClient();
  return useMutation<unknown, AdsApiError, string>({
    mutationFn: (id) => mutateJson(`${ADS_API}/accounts/${id}`, 'DELETE', undefined, '删除账户失败'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ads-accounts'] }),
  });
}

// ── 站点 CRUD ────────────────────────────────────────────────

export function useCreateMarketplace() {
  const queryClient = useQueryClient();
  return useMutation<AdMarketplaceDTO, AdsApiError, AdMarketplaceInput>({
    mutationFn: (data) => mutateJson<AdMarketplaceDTO>(`${ADS_API}/marketplaces`, 'POST', data, '创建站点失败'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-marketplaces'] });
      queryClient.invalidateQueries({ queryKey: ['ads-accounts'] });
    },
  });
}

export function useUpdateMarketplace() {
  const queryClient = useQueryClient();
  return useMutation<AdMarketplaceDTO, AdsApiError, { id: string; data: Partial<AdMarketplaceInput> }>({
    mutationFn: ({ id, data }) =>
      mutateJson<AdMarketplaceDTO>(`${ADS_API}/marketplaces/${id}`, 'PUT', data, '更新站点失败'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-marketplaces'] });
      queryClient.invalidateQueries({ queryKey: ['ads-accounts'] });
    },
  });
}

export function useDeleteMarketplace() {
  const queryClient = useQueryClient();
  return useMutation<unknown, AdsApiError, string>({
    mutationFn: (id) => mutateJson(`${ADS_API}/marketplaces/${id}`, 'DELETE', undefined, '删除站点失败'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-marketplaces'] });
      queryClient.invalidateQueries({ queryKey: ['ads-accounts'] });
    },
  });
}
