# Docker 部署指南 - GitLab Code Review Mastra API

本指南介绍如何使用 Docker 将 Mastra API 服务部署到 1Panel 或任何支持 Docker 的环境。

## 目录

- [前置要求](#前置要求)
- [快速开始](#快速开始)
- [1Panel 部署步骤](#1panel-部署步骤)
- [手动 Docker 部署](#手动-docker-部署)
- [环境变量配置](#环境变量配置)
- [验证部署](#验证部署)
- [故障排除](#故障排除)

---

## 前置要求

- Docker 19.03 或更高版本
- Docker Compose 1.27 或更高版本（使用 docker-compose 时）
- 1Panel（如果使用 1Panel 部署）
- OpenAI API Key

---

## 快速开始

### 1. 配置环境变量

创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置必需的环境变量：

```env
# 必需：OpenAI API Key
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx

# 可选：其他配置
NODE_ENV=production
LOG_LEVEL=info
```

### 2. 使用 Docker Compose 启动

```bash
# 构建并启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 3. 验证部署

访问以下地址验证服务是否正常运行：

- API 健康检查: http://localhost:4111/health
- Swagger UI: http://localhost:4111/swagger-ui
- Playground: http://localhost:4111

---

## 上传项目到服务器

在部署之前，需要先将项目文件上传到 1Panel 服务器。以下是几种推荐的方法：

### 方法 1：使用自动上传脚本（最简单）

项目提供了自动上传脚本，一键完成上传：

```bash
# 在本地 Mac 终端执行
cd /Users/xiaozhi/Desktop/gitlab-code-review/gitlab-code-review

# 使用 rsync 上传（推荐）
./upload-to-1panel.sh -h your-server-ip -u root -p 22

# 或使用 SCP 上传
./upload-to-1panel.sh -h your-server-ip -m scp

# 查看帮助
./upload-to-1panel.sh --help
```

**参数说明**：
- `-h, --host`: 服务器 IP 地址（必需）
- `-u, --user`: SSH 用户名（默认 root）
- `-p, --port`: SSH 端口（默认 22）
- `-d, --dest`: 目标目录（默认 /opt/gitlab-code-review）
- `-m, --method`: 上传方法 rsync|scp|git（默认 rsync）

### 方法 2：使用 Git 克隆（推荐）

如果项目在 Git 仓库中：

```bash
# 1. 在本地推送到 Git 仓库（如 GitHub/GitLab）
cd /Users/xiaozhi/Desktop/gitlab-code-review/gitlab-code-review
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/gitlab-code-review.git
git push -u origin main

# 2. 在服务器上克隆
ssh root@your-server-ip
cd /opt
git clone https://github.com/your-username/gitlab-code-review.git
```

### 方法 3：使用 SFTP 客户端

使用图形化工具（如 FileZilla、WinSCP）：

1. 下载并安装 FileZilla: https://filezilla-project.org/
2. 连接配置：
   - 主机: `sftp://your-server-ip`
   - 用户名: `root`
   - 密码: 你的 SSH 密码
   - 端口: `22`
3. 左侧导航到本地项目目录
4. 右侧导航到 `/opt/`
5. 拖拽上传整个 `gitlab-code-review` 目录

### 方法 4：使用命令行 rsync/scp

```bash
# 使用 rsync（推荐，支持断点续传）
rsync -avz --progress \
  --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
  /Users/xiaozhi/Desktop/gitlab-code-review/gitlab-code-review/ \
  root@your-server-ip:/opt/gitlab-code-review/

# 使用 scp
scp -r /Users/xiaozhi/Desktop/gitlab-code-review/gitlab-code-review \
  root@your-server-ip:/opt/
```

---

## 1Panel 部署步骤

### 方式 1：使用 1Panel 的 Docker Compose 功能（推荐）

#### 步骤 1：确认项目已上传

确保项目已经通过上述任一方法上传到服务器（如 `/opt/gitlab-code-review`）

#### 步骤 2：配置环境变量

在项目目录创建 `.env` 文件：

```bash
# 在 1Panel 文件管理中创建 .env 文件
OPENAI_API_KEY=sk-your-openai-api-key-here
NODE_ENV=production
LOG_LEVEL=info
```

#### 步骤 3：使用 1Panel 部署

1. 进入 **容器** > **编排**
2. 点击 **创建编排**
3. 配置如下：
   - **名称**: `gitlab-code-review-mastra`
   - **工作目录**: `/opt/gitlab-code-review`
   - **Compose 文件**: 选择 `docker-compose.yml`
4. 点击 **创建并启动**

#### 步骤 4：查看服务状态

1. 在 1Panel **容器** 列表中找到 `gitlab-code-review-mastra`
2. 查看状态是否为 **运行中**
3. 点击 **日志** 查看启动日志

---

### 方式 2：使用 1Panel 的 Docker 镜像管理

#### 步骤 1：构建 Docker 镜像

在服务器上执行：

```bash
cd /opt/gitlab-code-review

# 构建镜像
docker build -t gitlab-code-review-mastra:latest .
```

#### 步骤 2：在 1Panel 中创建容器

1. 进入 **容器** > **容器**
2. 点击 **创建容器**
3. 配置如下：
   - **镜像**: `gitlab-code-review-mastra:latest`
   - **容器名**: `gitlab-code-review-mastra`
   - **端口映射**: `4111:4111`
   - **环境变量**:
     - `OPENAI_API_KEY`: `sk-your-key`
     - `NODE_ENV`: `production`
   - **重启策略**: `unless-stopped`
4. 点击 **创建**

---

## 手动 Docker 部署

### 构建镜像

```bash
# 在项目根目录执行
docker build -t gitlab-code-review-mastra:latest .
```

### 运行容器

```bash
docker run -d \
  --name gitlab-code-review-mastra \
  -p 4111:4111 \
  -e OPENAI_API_KEY=sk-your-openai-api-key \
  -e NODE_ENV=production \
  --restart unless-stopped \
  gitlab-code-review-mastra:latest
```

### 使用 .env 文件运行

```bash
docker run -d \
  --name gitlab-code-review-mastra \
  -p 4111:4111 \
  --env-file .env \
  --restart unless-stopped \
  gitlab-code-review-mastra:latest
```

---

## 环境变量配置

### 必需变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | `sk-xxxxxxxxxxxxxxxxxxxx` |

### 可选变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | `production` | 运行环境 |
| `LOG_LEVEL` | `info` | 日志级别 (debug/info/warn/error) |
| `PORT` | `4111` | API 服务端口 |

### 环境变量文件示例

`.env` 文件内容：

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Environment
NODE_ENV=production

# Logging
LOG_LEVEL=info

# Server (optional, default is 4111)
# PORT=4111
```

---

## 验证部署

### 1. 检查容器状态

```bash
# 查看运行中的容器
docker ps | grep gitlab-code-review-mastra

# 查看容器日志
docker logs -f gitlab-code-review-mastra
```

### 2. 健康检查

```bash
# 检查 API 是否响应
curl http://localhost:4111/health

# 预期响应
# {"status":"ok"}
```

### 3. 访问 Swagger UI

在浏览器中打开：http://localhost:4111/swagger-ui

### 4. 测试 API 端点

```bash
# 获取可用的 workflows
curl http://localhost:4111/api/workflows

# 获取可用的 agents
curl http://localhost:4111/api/agents
```

---

## 1Panel 中的网络配置

### 配置反向代理（可选）

如果需要通过域名访问，在 1Panel 中配置 Nginx 反向代理：

1. 进入 **网站** > **网站**
2. 点击 **创建网站** > **反向代理**
3. 配置如下：
   - **域名**: `mastra-api.yourdomain.com`
   - **代理地址**: `http://127.0.0.1:4111`
   - **启用 HTTPS**: 是（推荐）
4. 申请或上传 SSL 证书

### 防火墙配置

确保端口 4111 已开放（如果需要外部访问）：

```bash
# 在 1Panel 安全 > 防火墙中添加规则
# 或使用命令行
firewall-cmd --permanent --add-port=4111/tcp
firewall-cmd --reload
```

---

## Docker Compose 命令参考

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f

# 查看实时日志（最近 100 行）
docker-compose logs -f --tail=100

# 重新构建并启动
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 进入容器 shell
docker-compose exec mastra-api sh
```

---

## 故障排除

### 1. 容器无法启动

**症状**: 容器创建后立即退出

**排查步骤**:

```bash
# 查看容器日志
docker logs gitlab-code-review-mastra

# 检查环境变量是否正确
docker inspect gitlab-code-review-mastra | grep -A 10 Env
```

**常见原因**:
- 环境变量 `OPENAI_API_KEY` 未设置或无效
- 端口 4111 已被占用
- 构建失败

**解决方案**:
```bash
# 检查端口占用
lsof -i :4111

# 重新设置环境变量
docker-compose down
# 编辑 .env 文件
docker-compose up -d
```

---

### 2. API 请求超时

**症状**: 访问 http://localhost:4111 超时

**排查步骤**:

```bash
# 检查容器是否运行
docker ps -a | grep gitlab-code-review-mastra

# 检查容器健康状态
docker inspect --format='{{.State.Health.Status}}' gitlab-code-review-mastra

# 检查容器内部是否监听端口
docker exec gitlab-code-review-mastra netstat -tuln | grep 4111
```

**解决方案**:
```bash
# 重启容器
docker-compose restart

# 或重新构建
docker-compose down
docker-compose up -d --build
```

---

### 3. OpenAI API 调用失败

**症状**: 日志中出现 `401 Unauthorized` 或 `429 Rate Limit`

**排查步骤**:

```bash
# 查看详细日志
docker-compose logs -f | grep -i openai

# 验证 API Key
docker exec gitlab-code-review-mastra sh -c 'echo $OPENAI_API_KEY'
```

**解决方案**:
```bash
# 更新 .env 文件中的 OPENAI_API_KEY
# 然后重启容器
docker-compose restart
```

---

### 4. 构建失败

**症状**: `docker build` 或 `docker-compose up` 时报错

**常见错误**:

**错误 1**: `yarn install` 失败
```bash
# 解决：清理缓存重新构建
docker-compose build --no-cache
```

**错误 2**: 依赖安装超时
```bash
# 解决：在 Dockerfile 中增加超时时间（已包含）
# RUN yarn install --frozen-lockfile --network-timeout 100000
```

**错误 3**: 权限问题
```bash
# 解决：检查文件权限
ls -la Dockerfile
chmod 644 Dockerfile
```

---

### 5. 内存不足

**症状**: 容器被 OOM Killer 杀掉

**解决方案**:

编辑 `docker-compose.yml`，调整资源限制：

```yaml
deploy:
  resources:
    limits:
      memory: 2G  # 增加到 2GB
    reservations:
      memory: 1G
```

然后重启：
```bash
docker-compose down
docker-compose up -d
```

---

### 6. 查看详细日志

```bash
# 查看所有日志
docker-compose logs

# 实时跟踪日志
docker-compose logs -f

# 只查看最近 100 行
docker-compose logs --tail=100

# 查看特定服务的日志
docker-compose logs mastra-api

# 带时间戳
docker-compose logs -f --timestamps
```

---

## 维护操作

### 更新镜像

```bash
# 拉取最新代码
cd /opt/gitlab-code-review
git pull

# 重新构建并启动
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 备份数据

```bash
# 备份环境变量
cp .env .env.backup

# 导出镜像
docker save gitlab-code-review-mastra:latest | gzip > mastra-api-backup.tar.gz
```

### 清理资源

```bash
# 删除停止的容器
docker-compose down

# 删除镜像
docker rmi gitlab-code-review-mastra:latest

# 清理未使用的资源
docker system prune -a
```

---

## 性能优化

### 1. 多阶段构建（已实施）

当前 Dockerfile 已经优化，使用单阶段构建适合生产环境。

### 2. 资源限制

根据实际负载调整 `docker-compose.yml` 中的资源配置：

```yaml
deploy:
  resources:
    limits:
      cpus: '2'      # 根据服务器 CPU 调整
      memory: 2G     # 根据实际需求调整
```

### 3. 日志轮转

已在 `docker-compose.yml` 中配置日志轮转：

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## 监控和告警

### 使用 1Panel 监控

1. 进入 **容器** > 选择容器
2. 查看：
   - CPU 使用率
   - 内存使用率
   - 网络流量
   - 日志输出

### 健康检查配置

Docker Compose 已配置健康检查：

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "require('http').get('http://localhost:4111/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

查看健康状态：
```bash
docker inspect --format='{{.State.Health}}' gitlab-code-review-mastra
```

---

## 安全建议

1. **不要将 .env 文件提交到 Git**
   - 已在 `.gitignore` 中排除
   - 在 1Panel 中安全存储

2. **定期更新依赖**
   ```bash
   cd /opt/gitlab-code-review
   yarn upgrade
   docker-compose build --no-cache
   docker-compose up -d
   ```

3. **使用反向代理和 HTTPS**
   - 在 1Panel 中配置 Nginx + SSL

4. **限制网络访问**
   - 仅开放必要的端口
   - 使用防火墙规则

---

## 下一步

部署完成后，你可以：

1. **配置 Webhook Server**
   - 参考 [gitlab-webhook-server](../gitlab-webhook-server/README.md)
   - 设置 `MASTRA_API_URL=http://your-server-ip:4111`

2. **测试完整流程**
   - 配置 GitLab Webhook
   - 推送代码触发审查
   - 查看钉钉通知

3. **自定义审查规则**
   - 编辑 `src/mastra/tools/code-review-tool.ts`
   - 重新构建并部署

---

## 相关文档

- [项目 README](README.md)
- [架构说明](../ARCHITECTURE.md)
- [Webhook Server 部署](../gitlab-webhook-server/README.md)

---

## 获取帮助

如遇问题，请：

1. 查看容器日志: `docker-compose logs -f`
2. 检查环境变量: `docker-compose config`
3. 提交 Issue: [GitHub Issues](https://github.com/your-repo/issues)

---

**祝部署顺利！**
