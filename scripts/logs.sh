#!/bin/bash

# ============================================
# 查看远程日志
# ============================================

SERVER_IP="172.19.52.251"
SERVER_USER="root"

echo "📋 连接到 ${SERVER_IP} 查看日志..."
echo "提示: 按 Ctrl+C 退出"
echo ""

ssh -t "${SERVER_USER}@${SERVER_IP}" "cd /opt/gitlab-code-review && docker-compose logs -f"
