#!/bin/bash

# ============================================
# 查看远程容器状态
# ============================================

SERVER_IP="172.19.52.251"
SERVER_USER="root"

echo "📊 查看 ${SERVER_IP} 上的容器状态..."
echo ""

ssh "${SERVER_USER}@${SERVER_IP}" << 'EOF'
    cd /opt/gitlab-code-review

    echo "==================================="
    echo "  Docker 容器状态"
    echo "==================================="
    docker-compose ps

    echo ""
    echo "==================================="
    echo "  资源使用情况"
    echo "==================================="
    docker stats --no-stream $(docker-compose ps -q)
EOF
