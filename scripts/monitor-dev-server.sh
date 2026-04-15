#!/bin/bash
# Trade ERP 开发服务器监控脚本
# 自动检测崩溃并重启

PORT=3001
LOG_FILE="/Users/apple/clawd/trade-erp/logs/dev-server-monitor.log"
PID_FILE="/Users/apple/clawd/trade-erp/.next/dev/server.pid"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_server() {
    # 检查端口是否被占用
    if lsof -i :$PORT > /dev/null 2>&1; then
        return 0  # 服务器运行中
    else
        return 1  # 服务器已停止
    fi
}

start_server() {
    log "🚀 启动开发服务器..."
    cd /Users/apple/clawd/trade-erp
    PORT=$PORT npm run dev > /dev/null 2>&1 &
    echo $! > "$PID_FILE"
    sleep 5
    
    if check_server; then
        log "✅ 服务器启动成功"
        return 0
    else
        log "❌ 服务器启动失败"
        return 1
    fi
}

restart_server() {
    log "⚠️ 检测到服务器崩溃，正在重启..."
    
    # 杀死旧进程
    if [ -f "$PID_FILE" ]; then
        kill $(cat "$PID_FILE") 2>/dev/null
        rm -f "$PID_FILE"
    fi
    
    # 等待端口释放
    sleep 3
    
    # 启动新服务器
    start_server
}

# 主循环
log "🔍 开始监控开发服务器 (端口 $PORT)"

while true; do
    if ! check_server; then
        log "❌ 服务器无响应"
        restart_server
    else
        log "✅ 服务器运行正常"
    fi
    
    # 每 30 秒检查一次
    sleep 30
done
