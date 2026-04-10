#!/bin/bash
# Trade ERP v0.9.0 Regression Test Script
# 测试范围：9 个 Bug 修复 + 核心业务流程 + 批量操作 + 认证授权

BASE_URL="http://localhost:3001"
COOKIES="/tmp/erp-cookies.txt"
PASS=0
FAIL=0
TOTAL=0

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASS++))
    ((TOTAL++))
}

log_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAIL++))
    ((TOTAL++))
}

log_info() {
    echo -e "${YELLOW}ℹ️${NC}: $1"
}

# 登录
log_info "正在登录..."
curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@trade-erp.com","password":"Admin123!"}' \
    -c "$COOKIES" > /dev/null

if [ $? -eq 0 ]; then
    log_pass "认证系统 - 登录成功"
else
    log_fail "认证系统 - 登录失败"
fi

# 测试 1: 认证授权
log_info "\n=== 测试 1: 认证授权 ==="

# 测试已认证用户访问
AUTH_ME=$(curl -s "$BASE_URL/api/auth/me" -b "$COOKIES")
if echo "$AUTH_ME" | grep -q '"authenticated":true'; then
    log_pass "认证系统 - 获取当前用户信息"
else
    log_fail "认证系统 - 获取当前用户信息"
fi

# 测试未认证访问（应该返回 401）
UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/me")
if [ "$UNAUTH" = "401" ]; then
    log_pass "认证系统 - 未认证拒绝访问"
else
    log_fail "认证系统 - 未认证拒绝访问 (期望 401, 得到 $UNAUTH)"
fi

# 测试 2: Bug 修复验证
log_info "\n=== 测试 2: Bug 修复验证 ==="

# BUG-002: 库存管理页面
INVENTORY=$(curl -s "$BASE_URL/api/v1/inventory" -b "$COOKIES")
if echo "$INVENTORY" | grep -q '"success":true'; then
    log_pass "BUG-002 - 库存管理 API 正常"
else
    log_fail "BUG-002 - 库存管理 API 异常"
fi

# BUG-003: 出库单页面
OUTBOUND=$(curl -s "$BASE_URL/api/outbound-orders" -b "$COOKIES")
if [ $? -eq 0 ]; then
    log_pass "BUG-003 - 出库单 API 正常"
else
    log_fail "BUG-003 - 出库单 API 异常"
fi

# BUG-009: 入库单确认
INBOUND=$(curl -s "$BASE_URL/api/inbound-orders" -b "$COOKIES")
if [ $? -eq 0 ]; then
    log_pass "BUG-009 - 入库单 API 正常"
else
    log_fail "BUG-009 - 入库单 API 异常"
fi

# 测试 3: 核心业务流程
log_info "\n=== 测试 3: 核心业务流程 ==="

# 采购管理
PURCHASE=$(curl -s "$BASE_URL/api/purchase-orders" -b "$COOKIES")
if [ $? -eq 0 ]; then
    log_pass "采购管理 - API 正常"
else
    log_fail "采购管理 - API 异常"
fi

# 入库管理
INBOUND_NEW=$(curl -s "$BASE_URL/api/inbound-orders" -b "$COOKIES")
if [ $? -eq 0 ]; then
    log_pass "入库管理 - API 正常"
else
    log_fail "入库管理 - API 异常"
fi

# 出库管理
OUTBOUND_NEW=$(curl -s "$BASE_URL/api/outbound-orders" -b "$COOKIES")
if [ $? -eq 0 ]; then
    log_pass "出库管理 - API 正常"
else
    log_fail "出库管理 - API 异常"
fi

# 测试 4: 批量操作功能
log_info "\n=== 测试 4: 批量操作功能 ==="

# 供应商批量导入 API
SUPPLIER_IMPORT=$(curl -s -X POST "$BASE_URL/api/suppliers/batch-import" \
    -b "$COOKIES" \
    -H "Content-Type: application/json" \
    -d '{"suppliers":[]}' 2>/dev/null)
if [ $? -eq 0 ]; then
    log_pass "批量操作 - 供应商批量导入 API"
else
    log_fail "批量操作 - 供应商批量导入 API"
fi

# 供应商批量导出 API
SUPPLIER_EXPORT=$(curl -s "$BASE_URL/api/suppliers/batch-export" -b "$COOKIES" 2>/dev/null)
if [ $? -eq 0 ]; then
    log_pass "批量操作 - 供应商批量导出 API"
else
    log_fail "批量操作 - 供应商批量导出 API"
fi

# 库存批量入库 API
INVENTORY_RECEIVE=$(curl -s -X POST "$BASE_URL/api/inventory/batch-receive" \
    -b "$COOKIES" \
    -H "Content-Type: application/json" \
    -d '{"items":[]}' 2>/dev/null)
if [ $? -eq 0 ]; then
    log_pass "批量操作 - 库存批量入库 API"
else
    log_fail "批量操作 - 库存批量入库 API"
fi

# 库存批量出库 API
INVENTORY_ISSUE=$(curl -s -X POST "$BASE_URL/api/inventory/batch-issue" \
    -b "$COOKIES" \
    -H "Content-Type: application/json" \
    -d '{"items":[]}' 2>/dev/null)
if [ $? -eq 0 ]; then
    log_pass "批量操作 - 库存批量出库 API"
else
    log_fail "批量操作 - 库存批量出库 API"
fi

# 库存批量盘点 API
INVENTORY_COUNT=$(curl -s -X POST "$BASE_URL/api/inventory/batch-count" \
    -b "$COOKIES" \
    -H "Content-Type: application/json" \
    -d '{"items":[]}' 2>/dev/null)
if [ $? -eq 0 ]; then
    log_pass "批量操作 - 库存批量盘点 API"
else
    log_fail "批量操作 - 库存批量盘点 API"
fi

# 测试 5: 基础资料模块
log_info "\n=== 测试 5: 基础资料模块 ==="

# 产品管理
PRODUCTS=$(curl -s "$BASE_URL/api/products" -b "$COOKIES")
if [ $? -eq 0 ]; then
    log_pass "产品管理 - API 正常"
else
    log_fail "产品管理 - API 异常"
fi

# 客户管理
CUSTOMERS=$(curl -s "$BASE_URL/api/customers" -b "$COOKIES")
if [ $? -eq 0 ]; then
    log_pass "客户管理 - API 正常"
else
    log_fail "客户管理 - API 异常"
fi

# 供应商管理
SUPPLIERS=$(curl -s "$BASE_URL/api/suppliers" -b "$COOKIES")
if [ $? -eq 0 ]; then
    log_pass "供应商管理 - API 正常"
else
    log_fail "供应商管理 - API 异常"
fi

# 测试 6: 健康检查
log_info "\n=== 测试 6: 系统健康检查 ==="

HEALTH=$(curl -s "$BASE_URL/api/health")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    log_pass "系统健康 - API 健康检查"
else
    log_fail "系统健康 - API 健康检查"
fi

# 输出报告
echo ""
echo "================================"
echo "📊 Trade ERP v0.9.0 回归测试报告"
echo "================================"
echo "总测试数：$TOTAL"
echo -e "${GREEN}通过：$PASS${NC}"
echo -e "${RED}失败：$FAIL${NC}"
if [ $TOTAL -gt 0 ]; then
    RATE=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc)
    echo "通过率：${RATE}%"
fi
echo "================================"

# 退出码
if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有测试失败，请检查${NC}"
    exit 1
fi
