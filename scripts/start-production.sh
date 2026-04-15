#!/bin/bash

# Trade ERP 生产服务器启动脚本
# 日期：2026-04-12

echo "======================================"
echo "Trade ERP 生产服务器启动"
echo "======================================"
echo ""

# 1. 启动 Docker
echo "🚀 启动 OrbStack..."
open -a OrbStack
echo "   等待 OrbStack 完全启动（约 30 秒）..."
sleep 30

# 验证 Docker 运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 启动失败，请手动打开 OrbStack 应用"
    exit 1
fi
echo "✅ Docker 运行正常"
echo ""

# 2. 设置 Docker 上下文
docker context use orbstack 2>/dev/null || true

# 3. 检查现有容器
echo "🔍 检查现有容器..."
CONTAINER=$(docker ps -a --filter "name=trade-erp" --format "{{.Names}}")

if [ -z "$CONTAINER" ]; then
    echo "❌ 未找到 trade-erp 容器"
    echo "   需要先部署容器，请运行："
    echo "   ./scripts/deploy-production.sh"
    exit 1
fi

echo "✅ 找到容器：$CONTAINER"
echo ""

# 4. 启动容器
echo "🚀 启动容器..."
docker start $CONTAINER

if [ $? -eq 0 ]; then
    echo "✅ 容器启动成功"
else
    echo "❌ 容器启动失败"
    exit 1
fi
echo ""

# 5. 等待服务就绪
echo "⏳ 等待服务就绪..."
sleep 10

# 6. 健康检查
echo "🏥 执行健康检查..."
for i in {1..10}; do
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "✅ 服务健康检查通过"
        echo ""
        break
    fi
    if [ $i -eq 10 ]; then
        echo "⚠️  服务健康检查未通过，但不影响使用"
        echo "   查看日志：docker logs -f $CONTAINER"
        echo ""
        break
    fi
    echo "  等待中... ($i/10)"
    sleep 3
done

# 7. 显示状态
echo "======================================"
echo "✅ 生产服务器启动成功！"
echo "======================================"
echo ""
echo "📊 服务信息："
echo "  - 访问地址：http://localhost:3000"
echo "  - 容器名称：$CONTAINER"
echo "  - 端口映射：3000:3000"
echo ""
echo "📝 常用命令："
echo "  查看状态：docker ps | grep trade-erp"
echo "  查看日志：docker logs -f $CONTAINER"
echo "  重启服务：docker restart $CONTAINER"
echo "  停止服务：docker stop $CONTAINER"
echo ""
echo "🌐 立即访问："
echo "  open http://localhost:3000"
echo ""
