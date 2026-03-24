#!/bin/bash

# Trade ERP v0.7.0 认证 API 测试脚本
# 执行时间：2026-03-23

BASE_URL="http://localhost:3001"
PASS=0
FAIL=0

echo "================================"
echo "Trade ERP v0.7.0 认证 API 测试"
echo "================================"
echo ""

# 测试 1: 登录 API - 成功场景
echo "📝 测试 1: 登录 API - 成功场景"
RESPONSE=$(curl -s -c /tmp/test-cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trade-erp.com","password":"Admin@123456"}')

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ 通过：登录成功"
  PASS=$((PASS+1))
else
  echo "❌ 失败：登录 API 返回错误"
  echo "响应：$RESPONSE"
  FAIL=$((FAIL+1))
fi
echo ""

# 测试 2: 登录 API - 密码错误
echo "📝 测试 2: 登录 API - 密码错误"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trade-erp.com","password":"wrong"}')

if echo "$RESPONSE" | grep -q '"error"'; then
  echo "✅ 通过：密码错误返回错误信息"
  PASS=$((PASS+1))
else
  echo "❌ 失败：密码错误应该返回错误"
  FAIL=$((FAIL+1))
fi
echo ""

# 测试 3: 登录 API - 用户不存在
echo "📝 测试 3: 登录 API - 用户不存在"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"notexist@example.com","password":"Admin@123456"}')

if echo "$RESPONSE" | grep -q '"error"'; then
  echo "✅ 通过：用户不存在返回错误"
  PASS=$((PASS+1))
else
  echo "❌ 失败：用户不存在应该返回错误"
  FAIL=$((FAIL+1))
fi
echo ""

# 测试 4: /api/auth/me - 已认证
echo "📝 测试 4: /api/auth/me - 已认证（使用登录后的 cookie）"
RESPONSE=$(curl -s -b /tmp/test-cookies.txt "$BASE_URL/api/auth/me")

if echo "$RESPONSE" | grep -q '"authenticated":true'; then
  echo "✅ 通过：已认证用户返回 authenticated: true"
  PASS=$((PASS+1))
else
  echo "❌ 失败：已认证用户应该返回 authenticated: true"
  echo "响应：$RESPONSE"
  FAIL=$((FAIL+1))
fi
echo ""

# 测试 5: /api/auth/me - 未认证
echo "📝 测试 5: /api/auth/me - 未认证（不使用 cookie）"
RESPONSE=$(curl -s "$BASE_URL/api/auth/me")

if echo "$RESPONSE" | grep -q '"authenticated":false'; then
  echo "✅ 通过：未认证用户返回 authenticated: false"
  PASS=$((PASS+1))
else
  echo "❌ 失败：未认证用户应该返回 authenticated: false"
  FAIL=$((FAIL+1))
fi
echo ""

# 测试 6: 登出 API
echo "📝 测试 6: 登出 API"
RESPONSE=$(curl -s -b /tmp/test-cookies.txt -X POST "$BASE_URL/api/auth/logout")

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ 通过：登出成功"
  PASS=$((PASS+1))
else
  echo "❌ 失败：登出 API 返回错误"
  echo "响应：$RESPONSE"
  FAIL=$((FAIL+1))
fi
echo ""

# 测试 7: 登出后验证 cookie 已清除
echo "📝 测试 7: 登出后验证 cookie 已清除"
RESPONSE=$(curl -s -b /tmp/test-cookies.txt "$BASE_URL/api/auth/me")

if echo "$RESPONSE" | grep -q '"authenticated":false'; then
  echo "✅ 通过：登出后 cookie 已清除"
  PASS=$((PASS+1))
else
  echo "❌ 失败：登出后应该返回 authenticated: false"
  echo "响应：$RESPONSE"
  FAIL=$((FAIL+1))
fi
echo ""

# 测试 8-12: 速率限制测试
echo "📝 测试 8-12: 速率限制测试（连续 6 次失败登录）"
for i in {1..6}; do
  echo "  第 $i 次尝试..."
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@trade-erp.com","password":"wrong"}')
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)
  
  if [ $i -le 5 ]; then
    if [ "$HTTP_CODE" = "401" ]; then
      echo "  ✅ 第 $i 次：返回 401（正常）"
      PASS=$((PASS+1))
    else
      echo "  ❌ 第 $i 次：应该返回 401，实际返回 $HTTP_CODE"
      FAIL=$((FAIL+1))
    fi
  else
    if [ "$HTTP_CODE" = "429" ]; then
      echo "  ✅ 第 $i 次：返回 429（速率限制生效）"
      PASS=$((PASS+1))
    else
      echo "  ❌ 第 $i 次：应该返回 429，实际返回 $HTTP_CODE"
      FAIL=$((FAIL+1))
    fi
  fi
done
echo ""

# 总结
echo "================================"
echo "测试总结"
echo "================================"
echo "通过：$PASS"
echo "失败：$FAIL"
echo "总计：$((PASS+FAIL))"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎉 所有测试通过！v0.7.0 认证系统测试完成！"
  exit 0
else
  echo "⚠️  有 $FAIL 个测试失败，请检查！"
  exit 1
fi
