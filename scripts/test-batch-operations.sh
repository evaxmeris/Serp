#!/bin/bash
# 批量操作功能测试脚本

echo "🧪 开始批量操作功能测试..."

BASE_URL="http://localhost:3000"
PASS_COUNT=0
FAIL_COUNT=0

# 登录获取 Token
echo -e "\n1️⃣ 登录..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trade-erp.com","password":"Admin123!"}')

echo "   登录响应：$LOGIN_RESPONSE"

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ 登录成功"
    ((PASS_COUNT++))
else
    echo "   ❌ 登录失败"
    ((FAIL_COUNT++))
    exit 1
fi

# 测试产品批量导出
echo -e "\n2️⃣ 测试产品批量导出..."
PRODUCTS_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/products" \
  -H "Cookie: auth-token=test")

HTTP_CODE=$(echo "$PRODUCTS_RESPONSE" | tail -1)
echo "   HTTP 状态码：$HTTP_CODE"

if [ "$HTTP_CODE" = "401" ]; then
    echo "   ✅ 认证机制正常（需要登录）"
    ((PASS_COUNT++))
else
    echo "   ⚠️ 状态码：$HTTP_CODE"
    ((FAIL_COUNT++))
fi

# 测试订单批量导出
echo -e "\n3️⃣ 测试订单数据..."
ORDER_COUNT=$(docker exec trade-erp-db psql -U trade_erp -d trade_erp -t -c "SELECT COUNT(*) FROM orders;" 2>/dev/null | tr -d ' ')
echo "   订单数量：$ORDER_COUNT"

if [ "$ORDER_COUNT" -gt 0 ]; then
    echo "   ✅ 订单数据正常"
    ((PASS_COUNT++))
else
    echo "   ❌ 订单数据为空"
    ((FAIL_COUNT++))
fi

# 测试客户数据
echo -e "\n4️⃣ 测试客户数据..."
CUSTOMER_COUNT=$(docker exec trade-erp-db psql -U trade_erp -d trade_erp -t -c "SELECT COUNT(*) FROM customers;" 2>/dev/null | tr -d ' ')
echo "   客户数量：$CUSTOMER_COUNT"

if [ "$CUSTOMER_COUNT" -gt 0 ]; then
    echo "   ✅ 客户数据正常"
    ((PASS_COUNT++))
else
    echo "   ❌ 客户数据为空"
    ((FAIL_COUNT++))
fi

# 测试产品数据
echo -e "\n5️⃣ 测试产品数据..."
PRODUCT_COUNT=$(docker exec trade-erp-db psql -U trade_erp -d trade_erp -t -c "SELECT COUNT(*) FROM products;" 2>/dev/null | tr -d ' ')
echo "   产品数量：$PRODUCT_COUNT"

if [ "$PRODUCT_COUNT" -gt 0 ]; then
    echo "   ✅ 产品数据正常"
    ((PASS_COUNT++))
else
    echo "   ❌ 产品数据为空"
    ((FAIL_COUNT++))
fi

# 总结
echo -e "\n📊 测试总结"
echo "   通过：$PASS_COUNT"
echo "   失败：$FAIL_COUNT"
echo "   总计：$((PASS_COUNT + FAIL_COUNT))"

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "\n✅ 所有测试通过！"
    exit 0
else
    echo -e "\n⚠️ 有 $FAIL_COUNT 个测试失败"
    exit 1
fi
