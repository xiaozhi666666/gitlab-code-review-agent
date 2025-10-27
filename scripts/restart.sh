#!/bin/bash

# ============================================
# 重启远程 Docker 容器
# ============================================

set -e

SERVER_IP="172.19.52.251"
SERVER_USER="root"

echo "🔄 重启 ${SERVER_IP} 上的 Docker 容器..."

ssh "${SERVER_USER}@${SERVER_IP}" << 'EOF'
    cd /opt/gitlab-code-review
    docker-compose restart

    echo "⏳ 等待容器重启..."
    sleep 3

    echo "📊 容器状态:"
    docker-compose ps
EOF

echo "✅ 容器已重启"
