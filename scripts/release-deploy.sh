#!/bin/bash

# Trade ERP - 发布部署强制流程脚本
# 用法：./scripts/release-deploy.sh <版本号>
# 示例：./scripts/release-deploy.sh v0.4.0

set -e

echo "🚀 Trade ERP - 发布部署强制流程"
echo "================================="
echo ""

# 参数检查
if [ -z "$1" ]; then
    echo "❌ 错误：必须指定版本号"
    echo "用法：$0 <版本号>"
    echo "示例：$0 v0.4.0"
    exit 1
fi

VERSION="$1"

# 强制检查清单
echo "📋 执行强制检查清单..."
echo ""

# 1. 检查是否在 trade-erp 目录
if [ ! -f "package.json" ] || [ ! -f "Dockerfile" ]; then
    echo "❌ 错误：请在 trade-erp 项目根目录执行此脚本"
    exit 1
fi
echo "✅ 1. 项目目录正确"

# 2. 检查 Git 状态
echo ""
echo "📊 检查 Git 状态..."
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ 错误：工作区有未提交的修改"
    echo ""
    git status --short
    echo ""
    echo "请先提交所有修改："
    echo "  git add ."
    echo "  git commit -m '...'"
    exit 1
fi
echo "✅ 2. Git 工作区干净"

# 3. 检查是否在 main 分支
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ 错误：必须在 main 分支执行发布"
    echo "当前分支：$CURRENT_BRANCH"
    echo ""
    echo "请切换到 main 分支："
    echo "  git checkout main"
    exit 1
fi
echo "✅ 3. 在 main 分支"

# 4. 检查是否已推送最新代码
echo ""
echo "📡 检查远程同步状态..."
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "⚠️  警告：本地分支落后于远程"
    echo ""
    echo "请先推送代码："
    echo "  git push"
    exit 1
fi
echo "✅ 4. 代码已同步到远程"

# 5. 运行测试
echo ""
echo "🧪 运行测试..."
if ! npm test -- --silent 2>&1 | tail -20; then
    echo "❌ 错误：测试失败"
    echo ""
    echo "请先修复所有测试失败"
    exit 1
fi
echo "✅ 5. 测试通过"

# 6. TypeScript 编译检查
echo ""
echo "📝 TypeScript 编译检查..."
if ! npx tsc --noEmit 2>&1; then
    echo "❌ 错误：TypeScript 编译失败"
    echo ""
    echo "请先修复类型错误"
    exit 1
fi
echo "✅ 6. TypeScript 编译通过"

# 7. 生产构建检查
echo ""
echo "📦 生产构建检查..."
if ! npm run build 2>&1 | tail -30; then
    echo "❌ 错误：生产构建失败"
    echo ""
    echo "请先修复构建错误"
    exit 1
fi
echo "✅ 7. 生产构建成功"

# 8. 检查 OrbStack/Docker
echo ""
echo "🐳 检查 Docker 状态..."
if ! command -v docker &> /dev/null; then
    echo "❌ 错误：Docker 未安装，请先安装 OrbStack"
    exit 1
fi

if ! docker ps &> /dev/null; then
    echo "❌ 错误：Docker 服务未运行"
    echo "请启动 OrbStack"
    exit 1
fi
echo "✅ 8. Docker 已就绪"

# 9. 检查数据库连接
echo ""
echo "🗄️  检查数据库连接..."
if ! docker-compose ps | grep -q "Up"; then
    echo "⚠️  警告：生产容器未运行（首次部署时正常）"
else
    echo "✅ 9. 生产容器运行正常"
fi

# 所有检查通过
echo ""
echo "======================================"
echo "✅ 所有强制检查通过！"
echo "======================================"
echo ""

# 确认发布
echo "📋 发布确认"
echo "-----------"
echo "版本号：$VERSION"
echo "分支：$CURRENT_BRANCH"
echo "时间：$(date '+%Y-%m-%d %H:%M:%S')"
echo ""
read -p "确认发布并部署？(y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 发布已取消"
    exit 0
fi

# 执行发布
echo ""
echo "🚀 执行发布流程..."

# 10. 创建 Git 标签
echo "📌 创建 Git 标签：$VERSION"
if git tag | grep -q "^$VERSION$"; then
    echo "⚠️  警告：标签 $VERSION 已存在"
    read -p "是否覆盖？(y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d "$VERSION"
        git tag "$VERSION"
    else
        echo "❌ 发布已取消"
        exit 0
    fi
else
    git tag "$VERSION"
fi

# 11. 推送标签
echo "📡 推送标签到 GitHub..."
git push origin "$VERSION"

# 12. 部署到生产容器
echo ""
echo "🐳 部署到生产容器..."
./deploy.sh

# 13. 验证部署
echo ""
echo "🔍 验证部署..."
sleep 10

if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ 健康检查通过"
else
    echo "⚠️  健康检查失败，请检查容器日志"
    echo "docker-compose logs -f trade-erp"
fi

# 完成
echo ""
echo "======================================"
echo "🎉 发布部署完成！"
echo "======================================"
echo ""
echo "版本：$VERSION"
echo "生产地址：http://localhost:3000"
echo "GitHub Release: https://github.com/evaxmeris/Serp/releases/new"
echo ""
echo "下一步："
echo "1. 创建 GitHub Release（手动）"
echo "2. 填写发布说明"
echo "3. 通知团队"
echo ""
