#!/bin/bash

# Trade ERP - OrbStack 一键部署脚本 v2.0
# 使用方法：./deploy.sh

set -e

echo "🚀 Trade ERP - 开始部署..."
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 OrbStack"
    exit 1
fi

echo "✅ Docker 已就绪"
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠️  .env 文件不存在，从 .env.docker 复制..."
    cp .env.docker .env
    echo "✅ 已创建 .env 文件"
    echo "⚠️  请根据需要修改 .env 中的配置"
    echo ""
fi

# 停止旧容器
echo "🛑 停止旧容器..."
docker-compose down 2>/dev/null || true
echo ""

# 构建镜像
echo "📦 构建 Docker 镜像..."
docker-compose build

echo ""
echo "🚀 启动服务..."
docker-compose up -d

echo ""
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo ""
echo "📊 检查服务状态..."
docker ps -f name=trade-erp

echo ""
echo "🔍 健康检查..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ 服务运行正常"
    echo ""
    echo "=========================================="
    echo "✅ 部署完成！"
    echo "=========================================="
    echo ""
    echo "🌐 访问应用：http://localhost:3000"
    echo "📊 健康检查：http://localhost:3000/api/health"
    echo "🗄️  数据库：localhost:5432"
    echo ""
    echo "📋 常用命令:"
    echo "  查看日志：docker-compose logs -f"
    echo "  停止服务：docker-compose down"
    echo "  重启服务：docker-compose restart"
    echo "  进入容器：docker exec -it trade-erp-v0.4.0 sh"
    echo ""
else
    echo "⚠️  服务可能未完全启动，请稍后检查"
    echo "查看日志：docker-compose logs -f"
fi
