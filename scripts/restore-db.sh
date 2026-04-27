#!/bin/bash
# Trade ERP 数据库恢复脚本
# 用法：bash scripts/restore-db.sh <备份文件路径>
# 示例：bash scripts/restore-db.sh backups/trade_erp_backup_20260427_151724.dump

set -e

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
    echo "用法: bash scripts/restore-db.sh <备份文件路径>"
    echo ""
    echo "可用的备份文件:"
    ls -lh backups/*.dump 2>/dev/null || echo "  (没有找到备份文件)"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "错误: 备份文件不存在: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  警告: 即将恢复数据库，当前数据将被覆盖！"
echo "备份文件: $BACKUP_FILE"
echo ""
read -p "确定要继续吗？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "已取消"
    exit 0
fi

# 复制备份文件到容器
CONTAINER_BACKUP="/tmp/restore_$(basename $BACKUP_FILE)"
echo "📦 复制备份文件到容器..."
docker cp "$BACKUP_FILE" trade-erp-db:$CONTAINER_BACKUP

# 执行恢复
echo "🔄 开始恢复数据库..."
docker exec trade-erp-db pg_restore -U trade_erp -d trade_erp --clean --if-exists $CONTAINER_BACKUP

# 清理临时文件
docker exec trade-erp-db rm -f $CONTAINER_BACKUP

echo "✅ 数据库恢复完成！"
echo "💡 建议重启应用容器以确保数据一致性:"
echo "   docker restart trade-erp-v0.10.0"
