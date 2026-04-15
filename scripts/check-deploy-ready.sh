#!/bin/bash

# Trade ERP 部署准备检查脚本
# 日期：2026-04-12

echo "======================================"
echo "Trade ERP 部署准备检查"
echo "======================================"
echo ""

# 检查 Docker
echo "🔍 检查 Docker..."
if docker info > /dev/null 2>&1; then
    echo "✅ Docker 运行正常"
    docker --version
else
    echo "❌ Docker 未运行"
    echo "   请先启动 Docker Desktop 或 OrbStack"
fi
echo ""

# 检查数据库
echo "🔍 检查 PostgreSQL 数据库..."
if psql -h localhost -p 5432 -U trade_erp -d trade_erp -c "SELECT 1" > /dev/null 2>&1; then
    echo "✅ 数据库连接正常"
else
    echo "❌ 数据库连接失败"
    echo "   请确保 PostgreSQL 运行在 localhost:5432"
    echo "   或执行：brew services start postgresql@15"
fi
echo ""

# 检查端口
echo "🔍 检查端口 3000..."
if lsof -ti:3000 > /dev/null; then
    echo "⚠️  端口 3000 被占用 (PID: $(lsof -ti:3000))"
    echo "   这是开发服务器，部署前需要停止"
else
    echo "✅ 端口 3000 可用"
fi
echo ""

# 检查必要文件
echo "🔍 检查必要文件..."
files=("Dockerfile" "docker-compose.yml" ".env.docker" "package.json")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file 存在"
    else
        echo "❌ $file 不存在"
    fi
done
echo ""

# 检查磁盘空间
echo "🔍 检查磁盘空间..."
free_space=$(df -h / | tail -1 | awk '{print $4}')
echo "✅ 可用磁盘空间：$free_space"
echo ""

# 总结
echo "======================================"
echo "检查完成！"
echo "======================================"
echo ""
echo "📋 部署步骤："
echo "1. 启动 Docker（如未运行）"
echo "2. 停止开发服务器（如运行中）"
echo "3. 运行部署脚本："
echo "   ./scripts/deploy-production.sh"
echo ""
