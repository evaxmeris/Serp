#!/bin/bash

# Trade ERP - OrbStack 一键部署脚本

set -e

echo "🚀 Trade ERP - 开始部署..."

# 检查 OrbStack/Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 OrbStack"
    exit 1
fi

echo "✅ Docker 已就绪"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠️  .env 文件不存在，从 .env.docker 复制..."
    cp .env.docker .env
    echo "✅ 已创建 .env 文件，请根据需要修改"
fi

# 构建并启动
echo "📦 构建镜像..."
docker-compose build

echo "🚀 启动服务..."
docker-compose up -d

echo ""
echo "✅ 部署完成！"
echo ""
echo "📊 查看日志：docker-compose logs -f"
echo "🛑 停止服务：docker-compose down"
echo "🌐 访问应用：http://localhost:3000"
echo "🗄️  数据库端口：localhost:5432"
echo ""

# 等待数据库就绪
echo "⏳ 等待数据库初始化..."
sleep 5

# 推送数据库 schema
echo "📋 推送数据库结构..."
docker-compose exec -T app npx prisma db push

echo ""
echo "🎉 所有服务已就绪！"
