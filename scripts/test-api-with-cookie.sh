#!/bin/bash
# 使用真实 cookie 测试 API

echo "🔐 使用真实 cookie 测试 API 认证..."

# 1. 登录并保存 cookie
echo -e "\n1️⃣ 登录并保存 cookie..."
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trade-erp.com","password":"Admin123!"}' \
  -c /tmp/erp-cookies.txt \
  > /tmp/login-response.json

echo "登录响应："
cat /tmp/login-response.json

# 2. 使用 cookie 测试 customers API
echo -e "\n2️⃣ 测试 /api/customers（使用 cookie）..."
CUSTOMERS_RESPONSE=$(curl -s http://localhost:3001/api/customers \
  -b /tmp/erp-cookies.txt)

echo "响应：${CUSTOMERS_RESPONSE:0:300}..."

if echo "$CUSTOMERS_RESPONSE" | grep -q '"success":true'; then
    echo -e "\n✅ **认证成功！API 修复成功！**"
    COUNT=$(echo "$CUSTOMERS_RESPONSE" | grep -o '"id"' | wc -l)
    echo "客户数量：$COUNT"
elif echo "$CUSTOMERS_RESPONSE" | grep -q 'UNAUTHORIZED'; then
    echo -e "\n❌ 认证仍然失败，需要检查修复"
else
    echo -e "\n⚠️ 响应：$CUSTOMERS_RESPONSE"
fi

# 3. 测试 suppliers API
echo -e "\n3️⃣ 测试 /api/suppliers（使用 cookie）..."
SUPPLIERS_RESPONSE=$(curl -s http://localhost:3001/api/suppliers \
  -b /tmp/erp-cookies.txt)

echo "响应：${SUPPLIERS_RESPONSE:0:300}..."

if echo "$SUPPLIERS_RESPONSE" | grep -q '"success":true'; then
    echo "✅ suppliers API 正常"
fi

# 4. 测试 orders API
echo -e "\n4️⃣ 测试 /api/orders（使用 cookie）..."
ORDERS_RESPONSE=$(curl -s http://localhost:3001/api/orders \
  -b /tmp/erp-cookies.txt)

echo "响应：${ORDERS_RESPONSE:0:300}..."

if echo "$ORDERS_RESPONSE" | grep -q '"success":true'; then
    echo "✅ orders API 正常"
fi

# 清理
rm -f /tmp/erp-cookies.txt /tmp/login-response.json
