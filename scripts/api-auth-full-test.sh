#!/bin/bash
# API 认证完整测试脚本
# Trade ERP v0.8.0
# 测试范围：登录流程、API认证、权限控制、性能测试

# Disable errexit for better error handling in tests
set -uo pipefail

# 配置
BASE_URL="http://localhost:3001"
RESULTS_FILE="logs/api-auth-test-results-$(date +%Y%m%d-%H%M%S).log"
mkdir -p logs

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔐 Trade ERP API 认证完整测试"
echo "=================================="
echo "测试开始时间: $(date)"
echo "目标服务: $BASE_URL"
echo "结果文件: $RESULTS_FILE"
echo "" >> $RESULTS_FILE

# 统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试结果记录
function record() {
    echo "[$(date '+%H:%M:%S')] $1" >> $RESULTS_FILE
}

# 断言（简单版本：比较 actual 和 expected 是否相等）
function assert() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ "$actual" = "$expected" ]; then
        echo -e "${GREEN}✅ PASS${NC} - $test_name"
        echo "PASS - $test_name - Expected: $expected, Actual: $actual" >> $RESULTS_FILE
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} - $test_name"
        echo "FAIL - $test_name - Expected: $expected, Actual: $actual" >> $RESULTS_FILE
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 检查 grep 是否匹配的断言
function assert_grep() {
    local test_name="$1"
    local text="$2"
    local pattern="$3"
    echo "$text" | grep -q "$pattern"
    local exit_code=$?
    assert "$test_name" "0" "$exit_code"
}

# 检查服务是否运行
echo "🧪 检查服务是否运行..."
if ! curl -s --connect-timeout 5 "$BASE_URL/api/health" > /dev/null; then
    echo -e "${RED}❌ 服务未运行！请先启动服务：npm run dev${NC}"
    echo "ERROR: Service not running at $BASE_URL" >> $RESULTS_FILE
    exit 1
fi
echo -e "${GREEN}✅ 服务运行正常${NC}"
echo ""

# ========== 1. 登录流程测试 ==========
echo "📋 1. 登录流程测试"
echo "-------------------"

# 1.1 正常登录测试 (LOGIN-001)
echo "🧪 LOGIN-001: 正常登录测试（admin）"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trade-erp.com","password":"Admin123!"}')

echo "Login response: $LOGIN_RESPONSE" >> $RESULTS_FILE
assert_grep "LOGIN-001: 正常登录返回 success=true" "$LOGIN_RESPONSE" '"success":true'
assert_grep "LOGIN-001: 返回用户角色正确" "$LOGIN_RESPONSE" '"role":"ADMIN"'

# 提取信息
ADMIN_USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
JWT_SECRET=$(printenv NEXTAUTH_SECRET || echo "TradeERP_Dev_Secret_Key_2026")
ADMIN_TOKEN=$(node -e "
const { SignJWT } = require('jose');
const SECRET = new TextEncoder().encode('$JWT_SECRET');
new SignJWT({
  id: '$ADMIN_USER_ID',
  email: 'admin@trade-erp.com',
  name: '系统管理员',
  role: 'ADMIN'
})
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('7d')
  .sign(SECRET)
  .then(token => console.log(token));
" 2>/dev/null)
record "LOGIN-001: Admin user ID: $ADMIN_USER_ID"

# 1.2 错误密码测试 (LOGIN-002)
echo ""
echo "🧪 LOGIN-002: 错误密码测试"
LOGIN_FAIL1=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trade-erp.com","password":"wrong-password"}')
HTTP_CODE=$(echo "$LOGIN_FAIL1" | tail -c 4)
assert_grep "LOGIN-002: 返回密码错误消息" "$LOGIN_FAIL1" "error.*账号或密码错误"
assert "LOGIN-002: HTTP 状态码 401" "401" "$HTTP_CODE"

# 1.3 不存在用户测试 (LOGIN-003)
echo ""
echo "🧪 LOGIN-003: 不存在用户测试"
LOGIN_FAIL2=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-exists@example.com","password":"any-password"}')
HTTP_CODE2=$(echo "$LOGIN_FAIL2" | tail -c 4)
assert_grep "LOGIN-003: 返回账号错误消息" "$LOGIN_FAIL2" "error.*账号或密码错误"
assert "LOGIN-003: HTTP 状态码 401" "401" "$HTTP_CODE2"

# 1.4 缺少必填字段 (LOGIN-004, LOGIN-005)
echo ""
echo "🧪 LOGIN-004: 缺少邮箱测试"
LOGIN_FAIL3=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"Admin123!"}')
HTTP_CODE3=$(echo "$LOGIN_FAIL3" | tail -c 4)
assert "LOGIN-004: HTTP 状态码 400" "400" "$HTTP_CODE3"

echo ""
echo "🧪 LOGIN-005: 缺少密码测试"
LOGIN_FAIL4=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trade-erp.com"}')
HTTP_CODE4=$(echo "$LOGIN_FAIL4" | tail -c 4)
assert "LOGIN-005: HTTP 状态码 400" "400" "$HTTP_CODE4"

# 1.7 获取当前用户 (LOGIN-008)
echo ""
echo "🧪 LOGIN-008: 获取当前用户信息（已登录）"
ME_RESPONSE=$(curl -s "$BASE_URL/api/auth/me" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "ME response: $ME_RESPONSE" >> $RESULTS_FILE
assert_grep "LOGIN-008: 返回正确邮箱" "$ME_RESPONSE" "admin@trade-erp.com"
assert_grep "LOGIN-008: 返回正确角色" "$ME_RESPONSE" "ADMIN"

# 1.9 获取当前用户（未登录）(LOGIN-009)
echo ""
echo "🧪 LOGIN-009: 获取当前用户信息（未登录）"
ME_RESPONSE_UNAUTH=$(curl -s -w "%{http_code}" "$BASE_URL/api/auth/me")
HTTP_CODE_ME=$(echo "$ME_RESPONSE_UNAUTH" | tail -c 4)
assert "LOGIN-009: HTTP 状态码 401" "401" "$HTTP_CODE_ME"

echo ""
echo "🎉 登录流程测试完成"
echo ""

# ========== 2. API 认证测试 ==========
echo "🔒 2. API 认证测试"
echo "-------------------"

# 列出所有需要测试的受保护 API
PROTECTED_APIS=(
  "/api/customers"
  "/api/orders"
  "/api/products"
  "/api/suppliers"
  "/api/dashboard/overview"
  "/api/dashboard/customers"
  "/api/dashboard/orders"
  "/api/dashboard/products"
  "/api/quotations"
  "/api/purchases"
  "/api/inquiries"
  "/api/v1/inventory"
  "/api/v1/reports/dashboard"
  "/api/roles"
)

# 2.1 未认证访问测试 (AUTH-001)
echo "🧪 AUTH-001: 未认证访问所有受保护 API"
echo "      测试 ${#PROTECTED_APIS[@]} 个端点..."
FAILED_UNAUTH=0
for API in "${PROTECTED_APIS[@]}"; do
  RESPONSE=$(curl -s "$BASE_URL$API")
  if ! echo "$RESPONSE" | grep -q "UNAUTHORIZED"; then
    echo -e "  ${YELLOW}⚠️  $API 未返回 UNAUTHORIZED${NC}"
    FAILED_UNAUTH=$((FAILED_UNAUTH + 1))
    record "AUTH-001: $API - FAIL - No UNAUTHORIZED"
  else
    record "AUTH-001: $API - PASS"
  fi
done
assert "AUTH-001: 所有 API 正确返回 UNAUTHORIZED" "0" "$FAILED_UNAUTH"

# 2.2 无效 token 测试 (AUTH-002)
echo ""
echo "🧪 AUTH-002: 无效 token 测试"
RESPONSE_INVALID=$(curl -s "$BASE_URL/api/customers" -H "Authorization: Bearer invalid-token-string")
assert_grep "AUTH-002: 无效 token 返回 UNAUTHORIZED" "$RESPONSE_INVALID" "UNAUTHORIZED"

# 2.4 正确 token - Bearer 方式 (AUTH-004)
echo ""
echo "🧪 AUTH-004: 正确 token (Bearer) 测试"
echo "      测试 ${#PROTECTED_APIS[@]} 个端点..."
FAILED_AUTH=0
for API in "${PROTECTED_APIS[@]}"; do
  START=$(date +%s%N)
  RESPONSE=$(curl -s "$BASE_URL$API" -H "Authorization: Bearer $ADMIN_TOKEN")
  END=$(date +%s%N)
  DURATION_MS=$(((END - START)/1000000))

  # 检查是否成功（不检查具体内容，只检查不是 401）
  if echo "$RESPONSE" | grep -q "UNAUTHORIZED"; then
    echo -e "  ${RED}❌ $API 返回 UNAUTHORIZED (${DURATION_MS}ms)${NC}"
    FAILED_AUTH=$((FAILED_AUTH + 1))
    record "AUTH-004: $API - FAIL - still UNAUTHORIZED in ${DURATION_MS}ms"
  else
    record "AUTH-004: $API - PASS - ${DURATION_MS}ms"
  fi
done
assert "AUTH-004: 所有 API 认证通过" "0" "$FAILED_AUTH"

echo ""
echo "🎉 API 认证测试完成"
echo ""

# ========== 3. 权限测试 ==========
echo "👤 3. 权限测试（不同角色）"
echo "---------------------------"

# 创建其他角色 token
# MANAGER
echo "🧪 准备测试账号 Token..."
MANAGER_TOKEN=$(node -e "
const { SignJWT } = require('jose');
const SECRET = new TextEncoder().encode('$JWT_SECRET');
new SignJWT({
  id: 'test-manager-id',
  email: 'manager@trade-erp.com',
  name: '经理',
  role: 'MANAGER'
})
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('7d')
  .sign(SECRET)
  .then(token => console.log(token));
" 2>/dev/null)

# USER
USER_TOKEN=$(node -e "
const { SignJWT } = require('jose');
const SECRET = new TextEncoder().encode('$JWT_SECRET');
new SignJWT({
  id: 'test-user-id',
  email: 'user@trade-erp.com',
  name: '普通用户',
  role: 'USER'
})
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('7d')
  .sign(SECRET)
  .then(token => console.log(token));
" 2>/dev/null)

# VIEWER
VIEWER_TOKEN=$(node -e "
const { SignJWT } = require('jose');
const SECRET = new TextEncoder().encode('$JWT_SECRET');
new SignJWT({
  id: 'test-viewer-id',
  email: 'viewer@trade-erp.com',
  name: '只读用户',
  role: 'VIEWER'
})
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('7d')
  .sign(SECRET)
  .then(token => console.log(token));
" 2>/dev/null)

# 3.1 ADMIN 权限测试
echo ""
echo "🧪 PERM-001: ADMIN 访问客户列表"
ADMIN_CUST=$(curl -s "$BASE_URL/api/customers?limit=1" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "ADMIN customers: $ADMIN_CUST" >> $RESULTS_FILE
assert_grep "PERM-001: ADMIN 可以访问客户列表" "$ADMIN_CUST" "data"

# 检查是否返回数据（ADMIN 应该看到所有客户）
CUST_COUNT=$(echo "$ADMIN_CUST" | grep -o '"total":[0-9]*' | cut -d':' -f2)
record "PERM-001: Total customers visible to ADMIN: $CUST_COUNT"
echo "   可见客户总数: $CUST_COUNT"

# 3.2 MANAGER 权限测试
echo ""
echo "🧪 PERM-011: MANAGER 访问客户列表"
MANAGER_CUST=$(curl -s "$BASE_URL/api/customers?limit=1" -H "Authorization: Bearer $MANAGER_TOKEN")
assert_grep "PERM-011: MANAGER 可以访问客户列表" "$MANAGER_CUST" "data"

# 3.3 USER 权限测试
echo ""
echo "🧪 PERM-021: USER 访问客户列表"
USER_CUST=$(curl -s "$BASE_URL/api/customers?limit=5" -H "Authorization: Bearer $USER_TOKEN")
assert_grep "PERM-021: USER 可以访问客户列表" "$USER_CUST" "data"

# 检查行级隔离 - USER 只能看到 ownerId = 自己的数据
USER_CUST_COUNT=$(echo "$USER_CUST" | grep -o '"total":[0-9]*' | cut -d':' -f2)
record "PERM-021: Total customers visible to USER: $USER_CUST_COUNT"
echo "   可见客户总数: $USER_CUST_COUNT (应为 0 或少量，如果这是测试账号)"

# 3.4 角色权限 - 用户列表仅 ADMIN 可访问
echo ""
echo "🧪 PERM-002: ADMIN 访问 /api/users"
USERS_ADMIN=$(curl -s "$BASE_URL/api/users" -H "Authorization: Bearer $ADMIN_TOKEN")
if ! echo "$USERS_ADMIN" | grep -q "error"; then
  echo "   ✅ ADMIN 可以访问用户列表"
  PASSED_TESTS=$((PASSED_TESTS + 1))
else
  echo "   ❌ ADMIN 访问失败"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo "🧪 PERM-024: USER 访问 /api/users (应该权限不足)"
USERS_USER=$(curl -s -w "%{http_code}" "$BASE_URL/api/users" -H "Authorization: Bearer $USER_TOKEN")
USER_USERS_CODE=$(echo "$USERS_USER" | tail -c 4)
assert "PERM-024: USER 访问返回 403" "403" "$USER_USERS_CODE"

echo ""
echo "🎉 权限测试完成"
echo ""

# ========== 4. 性能测试 ==========
echo "⚡ 4. 性能测试"
echo "--------------"

# 性能测试函数
function test_api_performance() {
  local api="$1"
  local name="$2"
  local max_acceptable="$3"
  local iterations=10
  local total=0

  echo "  📊 $name - $api (${iterations}次迭代)"

  for i in $(seq 1 $iterations); do
    start=$(date +%s%N)
    curl -s "$BASE_URL$api" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
    end=$(date +%s%N)
    dur=$(((end - start)/1000000))
    total=$((total + dur))
  done

  avg=$((total / iterations))
  echo "    平均响应: ${avg}ms (接受标准: < ${max_acceptable}ms)"

  if [ $avg -lt $max_acceptable ]; then
    echo -e "    ${GREEN}✅ 通过${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "    ${YELLOW}⚠️  超过接受标准${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  record "PERFORMANCE: $name - average ${avg}ms (max < $max_acceptable)"
}

# 对关键 API 进行性能测试
test_api_performance "/api/customers" "客户列表" "50"
test_api_performance "/api/orders" "订单列表" "50"
test_api_performance "/api/products" "产品列表" "50"
test_api_performance "/api/dashboard/overview" "仪表盘概览" "100"
test_api_performance "/api/v1/inventory" "库存查询" "50"

# 认证中间件 overhead 测试
echo ""
echo "  📊 认证中间件测试 (100 次请求)"
iterations=100
start_total=$(date +%s%N)
for i in $(seq 1 $iterations); do
  curl -s "$BASE_URL/api/customers" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
done
end_total=$(date +%s%N)
total_ns=$(((end_total - start_total)))
total_ms=$((total_ns / 1000000))
avg_ms=$((total_ms / iterations))
echo "    总时间: ${total_ms}ms for ${iterations} 请求"
echo "    平均每次: ${avg_ms}ms"
record "PERFORMANCE: Auth overhead - average ${avg_ms}ms per request"

# 检查性能
if [ $avg_ms -lt 50 ]; then
  assert "PERF-002: 平均认证检查 < 50ms" "less than 50ms" "less than 50ms"
else
  assert "PERF-002: 平均认证检查 < 50ms" "less than 50ms" "${avg_ms}ms (>= 50ms)"
fi

echo ""
echo "🎉 性能测试完成"
echo ""

# ========== 总结 ==========
echo "📊 测试总结"
echo "============"
echo "总计测试用例: $TOTAL_TESTS"
echo "通过: $PASSED_TESTS"
echo "失败: $FAILED_TESTS"

PASS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
echo "通过率: ${PASS_RATE}%"

echo "" >> $RESULTS_FILE
echo "=== SUMMARY ===" >> $RESULTS_FILE
echo "Total: $TOTAL_TESTS" >> $RESULTS_FILE
echo "Passed: $PASSED_TESTS" >> $RESULTS_FILE
echo "Failed: $FAILED_TESTS" >> $RESULTS_FILE
echo "Pass rate: ${PASS_RATE}%" >> $RESULTS_FILE
echo "Completed at: $(date)" >> $RESULTS_FILE

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✅ 所有测试通过！${NC}"
  echo "测试结果保存在: $RESULTS_FILE"
  exit 0
else
  echo -e "${RED}⚠️  有 $FAILED_TESTS 个测试失败，请检查日志: $RESULTS_FILE${NC}"
  exit 1
fi
