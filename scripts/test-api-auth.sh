#!/bin/bash
# API 认证测试脚本

echo "🔐 测试 API 认证修复..."

# 1. 登录获取用户信息
echo -e "\n1️⃣ 登录..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trade-erp.com","password":"Admin123!"}')

echo "登录响应：$LOGIN_RESPONSE"

# 提取 token（从响应中解析，实际需要 cookie）
USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "用户 ID: $USER_ID"

# 2. 手动生成 JWT token 测试
echo -e "\n2️⃣ 生成测试 token..."
TOKEN=$(node -e "
const { SignJWT } = require('jose');
const SECRET = new TextEncoder().encode('TradeERP_Dev_Secret_Key_2026');
new SignJWT({
  id: '$USER_ID',
  email: 'admin@trade-erp.com',
  name: '系统管理员',
  role: 'ADMIN'
})
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('7d')
  .sign(SECRET)
  .then(token => console.log(token));
" 2>/dev/null)

echo "Token: ${TOKEN:0:50}..."

# 3. 测试 API（带 Authorization header）
echo -e "\n3️⃣ 测试 /api/customers（带认证）..."
CUSTOMERS_RESPONSE=$(curl -s http://localhost:3001/api/customers \
  -H "Authorization: Bearer $TOKEN")

echo "响应：${CUSTOMERS_RESPONSE:0:200}..."

if echo "$CUSTOMERS_RESPONSE" | grep -q '"success":true'; then
    echo "✅ **认证成功！API 修复有效！**"
elif echo "$CUSTOMERS_RESPONSE" | grep -q 'UNAUTHORIZED'; then
    echo "❌ 认证失败，需要进一步修复"
else
    echo "⚠️ 响应：$CUSTOMERS_RESPONSE"
fi

# 4. 测试不带认证的 API
echo -e "\n4️⃣ 测试 /api/customers（无认证）..."
UNAUTH_RESPONSE=$(curl -s http://localhost:3001/api/customers)
echo "响应：$UNAUTH_RESPONSE"

if echo "$UNAUTH_RESPONSE" | grep -q 'UNAUTHORIZED'; then
    echo "✅ **安全机制正常（未登录拒绝访问）**"
else
    echo "⚠️ 安全问题：未认证也能访问"
fi
