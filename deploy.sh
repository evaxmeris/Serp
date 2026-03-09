#!/bin/bash

# Trade ERP - OrbStack 一键部署脚本
# 版本：v0.4.0

set -e

echo "🚀 Trade ERP v0.4.0 - 开始部署..."
echo ""

# 检查 OrbStack/Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 OrbStack"
    echo "   下载地址：https://orbstack.dev/"
    exit 1
fi

echo "✅ Docker 已就绪 ($(docker --version))"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠️  .env 文件不存在，从 .env.example 复制..."
    cp .env.example .env
    echo "✅ 已创建 .env 文件"
    echo ""
    echo "⚠️  请编辑 .env 文件配置数据库连接"
    echo ""
fi

# 停止旧容器
echo "🛑 停止旧容器..."
docker-compose down --remove-orphans 2>/dev/null || true

# 构建镜像
echo "📦 构建镜像..."
docker-compose build --progress=plain

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d

echo ""
echo "⏳ 等待服务启动..."
sleep 10

# 检查容器状态
if ! docker-compose ps | grep -q "Up"; then
    echo "❌ 容器启动失败，请查看日志："
    docker-compose logs
    exit 1
fi

echo "✅ 容器运行正常"

# 推送数据库 schema
echo ""
echo "📋 推送数据库结构..."
if docker-compose exec -T trade-erp npx prisma db push; then
    echo "✅ 数据库结构已更新"
else
    echo "⚠️  数据库推送失败，请检查数据库连接"
    echo "   数据库地址：host.docker.internal:5432"
fi

echo ""
echo "======================================"
echo "✅ 部署完成！"
echo "======================================"
echo ""
echo "🌐 访问应用：http://localhost:3000"
echo "🗄️  数据库：localhost:5432"
echo ""
echo "📊 查看日志：docker-compose logs -f"
echo "🛑 停止服务：docker-compose down"
echo "🔄 重启服务：docker-compose restart"
echo ""
echo "🎉 所有服务已就绪！"
