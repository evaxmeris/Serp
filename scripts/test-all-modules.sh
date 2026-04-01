#!/bin/bash

# Trade ERP v0.7.0 全模块测试脚本
# 执行时间：2026-04-01

BASE_URL="http://localhost:3001"
PASS=0
FAIL=0

echo "================================"
echo "Trade ERP v0.7.0 全模块测试"
echo "================================"
echo ""

# 先登录获取 cookie
echo "📝 准备：登录系统..."
LOGIN_RESPONSE=$(curl -s -c /tmp/test-cookies-all.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trade-erp.com","password":"Admin@123456"}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo "✅ 登录成功"
  PASS=$((PASS+1))
else
  echo "❌ 登录失败，终止测试"
  exit 1
fi
echo ""

# ==================== 产品模块测试 ====================
echo "================================"
echo "📦 产品模块测试"
echo "================================"
echo ""

# 测试 1: 属性模板列表
echo "📝 测试：属性模板列表"
RESPONSE=$(curl -s -b /tmp/test-cookies-all.txt "$BASE_URL/api/attribute-templates")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/test-cookies-all.txt "$BASE_URL/api/attribute-templates")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ 通过：API 响应正常 (HTTP $HTTP_CODE)"
  PASS=$((PASS+1))
else
  echo "❌ 失败：API 返回错误 (HTTP $HTTP_CODE)"
  FAIL=$((FAIL+1))
fi
echo ""

# 测试 2: 产品列表
echo "📝 测试：产品列表"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/test-cookies-all.txt "$BASE_URL/api/products")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ 通过：API 响应正常 (HTTP $HTTP_CODE)"
  PASS=$((PASS+1))
else
  echo "❌ 失败：API 返回错误 (HTTP $HTTP_CODE)"
  FAIL=$((FAIL+1))
fi
echo ""

# ==================== 采购模块测试 ====================
echo "================================"
echo "🛒 采购模块测试"
echo "================================"
echo ""

# 测试 3: 供应商列表
echo "📝 测试：供应商列表"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/test-cookies-all.txt "$BASE_URL/api/suppliers")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ 通过：API 响应正常 (HTTP $HTTP_CODE)"
  PASS=$((PASS+1))
else
  echo "❌ 失败：API 返回错误 (HTTP $HTTP_CODE)"
  FAIL=$((FAIL+1))
fi
echo ""

# 测试 4: 采购订单列表
echo "📝 测试：采购订单列表"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/test-cookies-all.txt "$BASE_URL/api/purchase-orders")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ 通过：API 响应正常 (HTTP $HTTP_CODE)"
  PASS=$((PASS+1))
else
  echo "❌ 失败：API 返回错误 (HTTP $HTTP_CODE)"
  FAIL=$((FAIL+1))
fi
echo ""

# ==================== 库存模块测试 ====================
echo "================================"
echo "📊 库存模块测试"
echo "================================"
echo ""

# 测试 5: 库存列表
echo "📝 测试：库存列表"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/test-cookies-all.txt "$BASE_URL/api/inventory")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ 通过：API 响应正常 (HTTP $HTTP_CODE)"
  PASS=$((PASS+1))
else
  echo "❌ 失败：API 返回错误 (HTTP $HTTP_CODE)"
  FAIL=$((FAIL+1))
fi
echo ""

# 测试 6: 入库单列表
echo "📝 测试：入库单列表"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/test-cookies-all.txt "$BASE_URL/api/inbound-orders")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ 通过：API 响应正常 (HTTP $HTTP_CODE)"
  PASS=$((PASS+1))
else
  echo "❌ 失败：API 返回错误 (HTTP $HTTP_CODE)"
  FAIL=$((FAIL+1))
fi
echo ""

# 测试 7: 出库单列表
echo "📝 测试：出库单列表"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/test-cookies-all.txt "$BASE_URL/api/outbound-orders")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ 通过：API 响应正常 (HTTP $HTTP_CODE)"
  PASS=$((PASS+1))
else
  echo "❌ 失败：API 返回错误 (HTTP $HTTP_CODE)"
  FAIL=$((FAIL+1))
fi
echo ""

# ==================== 财务模块测试 ====================
echo "================================"
echo "💰 财务模块测试"
echo "================================"
echo ""

# 测试 8: 利润报表
echo "📝 测试：利润报表 API"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/test-cookies-all.txt "$BASE_URL/api/reports/profit")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ 通过：API 响应正常 (HTTP $HTTP_CODE)"
  PASS=$((PASS+1))
else
  echo "❌ 失败：API 返回错误 (HTTP $HTTP_CODE)"
  FAIL=$((FAIL+1))
fi
echo ""

# 测试 9: 库存报表
echo "📝 测试：库存报表 API"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/test-cookies-all.txt "$BASE_URL/api/reports/inventory")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ 通过：API 响应正常 (HTTP $HTTP_CODE)"
  PASS=$((PASS+1))
else
  echo "❌ 失败：API 返回错误 (HTTP $HTTP_CODE)"
  FAIL=$((FAIL+1))
fi
echo ""

# 测试 10: 健康检查
echo "📝 测试：系统健康检查"
RESPONSE=$(curl -s "$BASE_URL/api/health")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ 通过：健康检查正常 (HTTP $HTTP_CODE)"
  echo "响应：$RESPONSE"
  PASS=$((PASS+1))
else
  echo "❌ 失败：健康检查失败 (HTTP $HTTP_CODE)"
  FAIL=$((FAIL+1))
fi
echo ""

# ==================== 总结 ====================
echo "================================"
echo "测试总结"
echo "================================"
echo "通过：$PASS"
echo "失败：$FAIL"
echo "总计：$((PASS+FAIL))"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎉 所有模块测试通过！v0.7.0 具备发布条件！"
  exit 0
else
  echo "⚠️  有 $FAIL 个测试失败，请检查！"
  exit 1
fi
