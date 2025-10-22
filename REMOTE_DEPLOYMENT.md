# 远程 Mastra API 部署指南

本文档说明如何将 Mastra 服务独立部署，然后通过 HTTP API 调用它。

## 架构方案

```
┌─────────────────┐         HTTP API        ┌──────────────────────┐
│  GitLab Webhook │  ────────────────────>  │  Mastra API 服务     │
│  接收服务器     │                          │  (远程/云端)          │
│  (port 3000)    │  <────────────────────  │  (port 4111)         │
└─────────────────┘         返回结果         └──────────────────────┘
        ↓                                             ↓
   接收 GitLab                                   执行 AI 代码审查
   Webhook 事件                                  + 钉钉通知
```

## 方案优势

1. **解耦部署**：Mastra API 可以独立扩展和维护
2. **多服务共享**：多个 webhook 服务器可以共享同一个 Mastra 实例
3. **云端部署**：可以将 Mastra 部署到性能更好的服务器或云平台
4. **资源优化**：AI 处理可以在独立服务器上运行，不影响 webhook 接收

## 部署步骤

### 方案 A：同一台机器运行两个服务（开发/测试）

适合本地开发和测试。

#### 步骤 1：启动 Mastra API 服务

打开**终端 1**：

```bash
cd /Users/xiaozhi/Desktop/gitlab-code-review/gitlab-code-review

# 启动 Mastra API 服务（开发模式）
npm run dev

# 服务将运行在 http://localhost:4111
# 可以访问 http://localhost:4111/swagger-ui 查看 API 文档
```

#### 步骤 2：启动 Webhook 接收服务器

打开**终端 2**：

```bash
cd /Users/xiaozhi/Desktop/gitlab-code-review/gitlab-code-review

# 启动 Webhook 服务器（开发模式）
npm run server:remote:dev

# 服务将运行在 http://localhost:3000
```

#### 步骤 3：测试连接

```bash
# 测试 Mastra API 连接
curl http://localhost:3000/test/mastra-api

# 测试健康检查
curl http://localhost:3000/health
```

---

### 方案 B：Mastra 部署到独立服务器（生产环境）

适合生产环境，Mastra 和 Webhook 服务器分别部署。

#### 服务器 1：部署 Mastra API 服务

```bash
# 1. 克隆项目
git clone your-repo
cd gitlab-code-review

# 2. 安装依赖
npm install --legacy-peer-deps

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，配置 OPENAI_API_KEY 等

# 4. 启动 Mastra API 服务（生产模式）
npm run dev  # 或使用 PM2 管理进程

# 使用 PM2 启动（推荐）
npm install -g pm2
pm2 start "npm run dev" --name mastra-api
pm2 save
pm2 startup
```

Mastra API 将运行在 `http://your-mastra-server:4111`

#### 服务器 2：部署 Webhook 接收服务器

```bash
# 1. 克隆项目（或只部署 webhook 服务器代码）
git clone your-repo
cd gitlab-code-review

# 2. 安装依赖
npm install --legacy-peer-deps

# 3. 配置环境变量
cp .env.example .env

# 编辑 .env，添加关键配置：
MASTRA_API_URL=http://your-mastra-server:4111  # 指向 Mastra API 服务器
GITLAB_WEBHOOK_SECRET=your_secret
GITLAB_ACCESS_TOKEN=your_token
GITLAB_PROJECT_ID=12345
GITLAB_URL=https://gitlab.com
DINGTALK_WEBHOOK_URL=your_dingtalk_webhook
DINGTALK_SECRET=your_dingtalk_secret

# 4. 启动 Webhook 服务器（生产模式）
npm run server:remote

# 使用 PM2 启动（推荐）
pm2 start "npm run server:remote" --name gitlab-webhook
pm2 save
```

Webhook 服务器将运行在 `http://localhost:3000`

#### 配置 GitLab Webhook

在 GitLab 项目设置中添加 webhook：
- **URL**: `http://your-webhook-server:3000/webhook/gitlab`
- **Secret Token**: 你的 `GITLAB_WEBHOOK_SECRET`
- **Trigger events**: 勾选 "Push events"

---

### 方案 C：Mastra 部署到 Cloudflare Workers（未来计划）

> **注意**：目前由于版本兼容性问题，Cloudflare Workers 部署暂不可用。
> 等待 Mastra 官方更新或使用方案 A/B。

```bash
# 未来支持时的部署方式：
npm run build
wrangler deploy --config .mastra/output/wrangler.json

# 然后设置环境变量
MASTRA_API_URL=https://your-worker.workers.dev
```

---

## 环境变量配置

### Mastra API 服务器需要的环境变量

```env
# OpenAI 配置（用于 AI 代码审查）
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 可选：日志级别
LOG_LEVEL=info
```

### Webhook 服务器需要的环境变量

```env
# Mastra API 地址
MASTRA_API_URL=http://localhost:4111  # 本地测试
# MASTRA_API_URL=http://your-mastra-server:4111  # 生产环境

# GitLab 配置
GITLAB_URL=https://gitlab.com
GITLAB_ACCESS_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_PROJECT_ID=12345
GITLAB_WEBHOOK_SECRET=your_webhook_secret

# 钉钉配置
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx
DINGTALK_SECRET=your_dingtalk_secret

# 服务器端口（可选）
PORT=3000
```

---

## API 端点

### Webhook 服务器端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/webhook/gitlab` | POST | 接收 GitLab webhook 事件 |
| `/health` | GET | 健康检查（包含 Mastra API 状态） |
| `/test/mastra-api` | GET | 测试 Mastra API 连接 |
| `/info` | GET | 系统信息 |

### Mastra API 服务器端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | Playground 界面 |
| `/swagger-ui` | GET | Swagger API 文档 |
| `/openapi.json` | GET | OpenAPI 规范 |
| `/api/workflows/codeReviewWorkflow/execute` | POST | 执行代码审查工作流 |
| `/api/agents/codeReviewAgent/generate` | POST | 调用代码审查 Agent |

---

## 测试和验证

### 1. 测试 Mastra API 连接

```bash
# 检查 Mastra API 是否正常
curl http://localhost:4111/swagger-ui

# 从 Webhook 服务器测试连接
curl http://localhost:3000/test/mastra-api
```

应该返回：
```json
{
  "success": true,
  "mastraApiUrl": "http://localhost:4111",
  "swagger": "http://localhost:4111/swagger-ui",
  "workflows": { ... },
  "agents": { ... }
}
```

### 2. 测试完整流程

```bash
# 发送测试 webhook 事件
npm run test:webhook
```

### 3. 检查日志

**终端 1 (Mastra API)**：
- 应该看到 workflow 执行日志
- AI 代码审查过程
- 钉钉通知发送

**终端 2 (Webhook Server)**：
- 应该看到 webhook 接收日志
- API 调用日志
- 返回结果

---

## 故障排除

### 1. Mastra API 连接失败

**错误**: `无法连接到 Mastra API: ECONNREFUSED`

**解决**:
```bash
# 检查 Mastra API 是否运行
curl http://localhost:4111/health

# 检查环境变量
echo $MASTRA_API_URL

# 确保 Mastra API 正在运行
npm run dev
```

### 2. Workflow 执行失败

**错误**: `Mastra API 调用失败: 500`

**解决**:
- 查看 Mastra API 服务器日志
- 检查 OpenAI API Key 是否有效
- 检查 GitLab Access Token 权限
- 确保所有环境变量已配置

### 3. 跨服务器通信问题

**问题**: 服务器 2 无法访问服务器 1 的 Mastra API

**解决**:
```bash
# 确保防火墙开放 4111 端口
sudo ufw allow 4111

# 检查 Mastra 监听地址（确保不是只监听 127.0.0.1）
# 如需外部访问，可能需要配置 Mastra 监听 0.0.0.0
```

---

## 性能优化建议

### 1. 使用 PM2 进程管理

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start "npm run dev" --name mastra-api
pm2 start "npm run server:remote" --name webhook-server

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 设置开机自启
pm2 startup
pm2 save
```

### 2. 配置反向代理（Nginx）

```nginx
# Mastra API
server {
    listen 80;
    server_name mastra.example.com;

    location / {
        proxy_pass http://localhost:4111;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Webhook Server
server {
    listen 80;
    server_name webhook.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. 启用 HTTPS

```bash
# 使用 Let's Encrypt
sudo certbot --nginx -d mastra.example.com
sudo certbot --nginx -d webhook.example.com
```

---

## 监控和日志

### 查看实时日志

```bash
# PM2 日志
pm2 logs mastra-api --lines 100
pm2 logs webhook-server --lines 100

# 或直接运行查看
npm run dev  # Mastra API
npm run server:remote:dev  # Webhook Server
```

### 健康检查

```bash
# 定期检查服务状态
curl http://localhost:3000/health
curl http://localhost:4111/health
```

---

## 下一步

1. ✅ 完成基础架构搭建
2. ✅ 测试本地双服务部署
3. 🔄 部署到生产服务器
4. 📊 配置监控和告警
5. 🚀 优化性能和扩展性

有问题请参考 [README.md](README.md) 或提交 Issue。
