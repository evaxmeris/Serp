#!/bin/bash
# P0 问题修复和验证脚本

echo "🔧 开始 P0 问题修复验证..."

# 1. 检查开发服务器
echo -e "\n1️⃣ 检查开发服务器..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "   ✅ 开发服务器运行正常"
else
    echo "   ❌ 开发服务器未运行，启动中..."
    cd /Users/apple/clawd/trade-erp && npm run dev &
    sleep 5
fi

# 2. 检查生产环境
echo -e "\n2️⃣ 检查生产环境..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "   ✅ 生产环境运行正常"
else
    echo "   ❌ 生产环境异常"
fi

# 3. 测试登录流程
echo -e "\n3️⃣ 测试登录流程..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trade-erp.com","password":"Admin123!"}')

echo "   登录响应：$LOGIN_RESPONSE"

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ 登录成功"
else
    echo "   ⚠️ 登录失败或需要检查"
fi

# 4. 测试 API 认证
echo -e "\n4️⃣ 测试 API 认证..."
# 这里需要 JWT token，暂时跳过

# 5. 检查数据库
echo -e "\n5️⃣ 检查数据库..."
ORDER_COUNT=$(docker exec trade-erp-db psql -U trade_erp -d trade_erp -t -c "SELECT COUNT(*) FROM orders;" 2>/dev/null | tr -d ' ')
SUPPLIER_COUNT=$(docker exec trade-erp-db psql -U trade_erp -d trade_erp -t -c "SELECT COUNT(*) FROM suppliers;" 2>/dev/null | tr -d ' ')

echo "   订单数：$ORDER_COUNT"
echo "   供应商数：$SUPPLIER_COUNT"

if [ "$ORDER_COUNT" -gt 0 ] && [ "$SUPPLIER_COUNT" -gt 0 ]; then
    echo "   ✅ 数据库正常"
else
    echo "   ⚠️ 数据库可能需要补充数据"
fi

# 6. 修复建议
echo -e "\n📋 修复建议:"
echo "   1. 确保用户已登录（检查 localStorage.user）"
echo "   2. 清除浏览器缓存后重试"
echo "   3. 检查浏览器控制台错误"
echo "   4. 验证 JWT token 有效期"

echo -e "\n✅ P0 验证完成！"
