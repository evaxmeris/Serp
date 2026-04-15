#!/bin/bash

# Trade ERP 生产环境部署脚本
# 版本：v0.9.5
# 日期：2026-04-15

set -e

echo "======================================"
echo "Trade ERP 生产环境部署脚本"
echo "版本：v0.9.4"
echo "日期：2026-04-12"
echo "======================================"
echo ""

# 检查 Docker 是否运行
echo "🔍 检查 Docker 状态..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未运行！"
    echo ""
    echo "请先启动 Docker："
    echo "  - macOS: 打开 Docker Desktop 应用"
    echo "  - OrbStack: 打开 OrbStack 应用"
    echo ""
    exit 1
fi
echo "✅ Docker 运行正常"
echo ""

# 停止旧容器
echo "🛑 停止旧容器（如有）..."
docker stop trade-erp-v0.9.2 2>/dev/null || true
docker rm trade-erp-v0.9.2 2>/dev/null || true
echo "✅ 旧容器已清理"
echo ""

# 构建镜像
echo "🔨 构建 Docker 镜像..."
cd /Users/apple/clawd/trade-erp
docker build -t trade-erp:v0.9.4 .
echo "✅ 镜像构建完成"
echo ""

# 检查数据库连接
echo "🔍 检查数据库连接..."
if ! docker run --rm --network host postgres:15 psql -h localhost -p 5432 -U trade_erp -d trade_erp -c "SELECT 1" > /dev/null 2>&1; then
    echo "⚠️  数据库连接失败！"
    echo ""
    echo "请确保 PostgreSQL 服务运行在 localhost:5432"
    echo "或者修改 docker-compose.yml 中的 DATABASE_URL"
    echo ""
    read -p "是否继续部署？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo "✅ 数据库连接正常"
echo ""

# 启动容器
echo "🚀 启动生产容器..."
docker-compose up -d
echo "✅ 容器启动成功"
echo ""

# 等待服务就绪
echo "⏳ 等待服务就绪..."
sleep 10

# 健康检查
echo "🏥 执行健康检查..."
for i in {1..10}; do
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "✅ 服务健康检查通过"
        echo ""
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ 服务健康检查失败"
        echo ""
        echo "查看容器日志："
        echo "  docker logs trade-erp-v0.9.2"
        echo ""
        exit 1
    fi
    echo "  等待中... ($i/10)"
    sleep 3
done

# 显示部署信息
echo "======================================"
echo "✅ 部署成功！"
echo "======================================"
echo ""
echo "📊 服务信息："
echo "  - 访问地址：http://localhost:3000"
echo "  - 容器名称：trade-erp-v0.9.2"
echo "  - 镜像版本：trade-erp:v0.9.4"
echo "  - 端口映射：3000:3000"
echo ""
echo "📝 常用命令："
echo "  查看日志：docker logs -f trade-erp-v0.9.2"
echo "  重启服务：docker restart trade-erp-v0.9.2"
echo "  停止服务：docker stop trade-erp-v0.9.2"
echo "  查看状态：docker ps | grep trade-erp"
echo ""
echo "🎉 部署完成！"
echo ""
