# 将 Mastra 部署到 Cloudflare Workers

本文档说明如何将 Mastra API 服务部署到 Cloudflare Workers，实现全球 CDN 加速和无服务器架构。

## 为什么选择 Cloudflare Workers

- ✅ **全球 CDN**: 自动在全球 200+ 数据中心部署
- ✅ **无服务器**: 按请求计费，无需管理服务器
- ✅ **自动扩展**: 根据流量自动扩展
- ✅ **免费额度**: 每天 100,000 次请求免费
- ✅ **GitHub 集成**: 直接从 GitHub 自动部署

## 部署方式

### 方案 A：通过 Cloudflare Dashboard（推荐）

最简单的方式，无需安装任何工具。

#### 步骤 1：准备 GitHub 仓库

1. 将你的 Mastra 项目推送到 GitHub：

```bash
cd /Users/xiaozhi/Desktop/gitlab-code-review/gitlab-code-review

# 初始化 Git（如果还没有）
git init
git add .
git commit -m "Initial commit"

# 创建 GitHub 仓库并推送
git remote add origin https://github.com/YOUR_USERNAME/gitlab-code-review-mastra.git
git push -u origin main
```

#### 步骤 2：在 Cloudflare 创建 Worker

1. **登录 Cloudflare Dashboard**
   - 访问 https://dash.cloudflare.com/
   - 如果没有账号，先注册一个（免费）

2. **创建 Worker**
   - 点击左侧菜单 **Workers & Pages**
   - 点击 **Create Application**
   - 选择 **Workers** 标签
   - 点击 **Create Worker**

3. **配置 GitHub 集成**
   - 选择 **Connect to Git**
   - 授权 Cloudflare 访问你的 GitHub
   - 选择你的 Mastra 仓库
   - 分支选择：`main` 或 `master`

#### 步骤 3：配置构建设置

在 Cloudflare Dashboard 的构建设置中填写：

| 设置项 | 值 |
|--------|-----|
| **Framework preset** | None |
| **Build command** | `npm install --legacy-peer-deps && npm run dev` |
| **Build output directory** | `.mastra/output` |
| **Root directory** | `/` |

> **注意**：由于 Cloudflare Workers 有特殊的运行时环境，我们使用 `npm run dev` 来启动 Mastra。

#### 步骤 4：配置环境变量

在 **Settings > Environment variables** 中添加：

```
OPENAI_API_KEY = sk-xxxxxxxxxxxxxxxxxxxx
NODE_ENV = production
```

> **重要**：不要在环境变量中添加 GitLab 或钉钉相关配置，这些应该在 Webhook Server 中配置。

#### 步骤 5：部署

1. 点击 **Save and Deploy**
2. Cloudflare 会自动构建和部署
3. 部署完成后，你会得到一个 Worker URL：
   ```
   https://YOUR_WORKER_NAME.YOUR_SUBDOMAIN.workers.dev
   ```

#### 步骤 6：测试部署

```bash
# 测试健康检查
curl https://YOUR_WORKER_NAME.YOUR_SUBDOMAIN.workers.dev/health

# 访问 Swagger UI
open https://YOUR_WORKER_NAME.YOUR_SUBDOMAIN.workers.dev/swagger-ui

# 测试 API
curl https://YOUR_WORKER_NAME.YOUR_SUBDOMAIN.workers.dev/api/workflows
```

#### 步骤 7：配置 Webhook Server

更新你的 Webhook Server 的 `.env` 文件：

```env
MASTRA_API_URL=https://YOUR_WORKER_NAME.YOUR_SUBDOMAIN.workers.dev
```

---

### 方案 B：使用 Wrangler CLI（高级用户）

适合需要更多控制的用户。

#### 步骤 1：安装 Wrangler

```bash
npm install -g wrangler
```

#### 步骤 2：登录 Cloudflare

```bash
wrangler login
```

这会打开浏览器进行授权。

#### 步骤 3：创建 wrangler.toml

在 Mastra 项目根目录创建 `wrangler.toml`：

```toml
name = "gitlab-code-review-mastra"
main = ".mastra/output/index.mjs"
compatibility_date = "2024-01-01"

[env.production]
workers_dev = false
route = "https://your-domain.com/*"

[env.production.vars]
NODE_ENV = "production"
```

#### 步骤 4：构建和部署

```bash
# 构建 Mastra
npm run build

# 部署到 Cloudflare Workers
wrangler deploy

# 或者部署到特定环境
wrangler deploy --env production
```

#### 步骤 5：配置 Secrets

```bash
# 设置 OpenAI API Key（敏感信息）
wrangler secret put OPENAI_API_KEY
# 输入你的 API Key
```

---

## 自动化部署

### 配置 GitHub Actions

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install --legacy-peer-deps

      - name: Build
        run: npm run build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

配置 GitHub Secrets：

1. 在 GitHub 仓库中进入 **Settings > Secrets and variables > Actions**
2. 添加 `CLOUDFLARE_API_TOKEN`
3. 从 Cloudflare Dashboard 获取 API Token：
   - 进入 **My Profile > API Tokens**
   - 创建新 Token，选择 **Edit Cloudflare Workers** 模板

---

## 监控和调试

### 查看日志

在 Cloudflare Dashboard 中：

1. 进入 **Workers & Pages**
2. 选择你的 Worker
3. 点击 **Logs** 标签
4. 选择 **Begin log stream**

### 实时日志（使用 Wrangler）

```bash
wrangler tail
```

### 查看指标

在 Worker 详情页面可以看到：
- 请求数
- 错误率
- CPU 时间
- 请求延迟

---

## 成本估算

Cloudflare Workers 免费额度：

| 项目 | 免费额度 | 超出费用 |
|------|----------|----------|
| 请求数 | 100,000/天 | $0.50 / 百万请求 |
| CPU 时间 | 10ms/请求 | 包含在请求费用中 |
| 持久化存储 | 1GB | $0.50 / GB / 月 |

对于大多数项目，免费额度足够使用。

---

## 故障排除

### 1. 构建失败

**错误**: `Module not found` 或依赖问题

**解决**:
- 确保使用 `npm install --legacy-peer-deps`
- 检查 Node.js 版本 >= 18

### 2. 运行时错误

**错误**: `addEventListener is not defined`

**解决**:
这是 Mastra 的已知问题。当前建议：
- 使用方案 A（Dashboard 部署），Cloudflare 会自动处理
- 或等待 Mastra 官方更新

### 3. API 调用失败

**错误**: CORS 错误

**解决**:
在 Mastra 配置中添加 CORS 支持（如果需要从浏览器调用）。

---

## 自定义域名

### 步骤 1：添加域名到 Cloudflare

1. 在 Cloudflare Dashboard 添加你的域名
2. 更新域名的 DNS 到 Cloudflare

### 步骤 2：配置 Worker 路由

1. 进入 Worker 设置
2. 点击 **Triggers** 标签
3. 添加自定义域名：
   ```
   https://api.your-domain.com/*
   ```

### 步骤 3：更新 Webhook Server 配置

```env
MASTRA_API_URL=https://api.your-domain.com
```

---

## 限制和注意事项

### Cloudflare Workers 的限制

- **CPU 时间**: 每次请求最多 50ms（付费版 500ms）
- **内存**: 128MB
- **请求大小**: 最大 100MB
- **响应大小**: 最大 100MB

### 适用场景

✅ **适合**:
- API 服务
- Webhook 处理
- 轻量级 AI 调用
- 无状态服务

❌ **不适合**:
- 长时间运行的任务（> 50ms）
- 需要文件系统的应用
- 需要 WebSocket 的场景

### 对于 Mastra

Mastra 的代码审查任务可能需要较长时间（调用 OpenAI API）。如果超过 CPU 限制，考虑：

1. **使用 Cloudflare Durable Objects**（付费功能）
2. **部署到独立服务器**
3. **优化 AI 调用**（批量处理、缓存等）

---

## 最佳实践

### 1. 环境变量管理

- 敏感信息使用 Secrets（`wrangler secret put`）
- 非敏感配置使用环境变量
- 本地开发使用 `.env` 文件

### 2. 版本管理

```bash
# 创建不同环境
wrangler deploy --env staging
wrangler deploy --env production
```

### 3. 监控

- 启用 Cloudflare Analytics
- 配置告警（错误率、延迟等）
- 定期查看日志

### 4. 安全

- 使用自定义域名配置 HTTPS
- 限制 API 访问（IP 白名单、API Key）
- 定期轮换 Secrets

---

## 替代方案

如果 Cloudflare Workers 不适合你的场景：

### Cloudflare Pages

适合静态站点 + Functions：

```bash
# 构建
npm run build

# 部署
wrangler pages deploy .mastra/output
```

### Railway

一键部署到 Railway：

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### Vercel

部署到 Vercel Edge Functions：

```bash
vercel deploy
```

---

## 总结

推荐部署方式：

| 场景 | 推荐方案 |
|------|----------|
| **简单快速** | Cloudflare Dashboard + GitHub 集成 |
| **需要控制** | Wrangler CLI |
| **CI/CD** | GitHub Actions + Wrangler |
| **长时间任务** | 独立 VPS/云服务器 |

部署完成后，更新 Webhook Server 的 `MASTRA_API_URL` 即可使用！

---

## 相关资源

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [Mastra 官方文档](https://mastra.ai/docs)
- [Cloudflare Workers 定价](https://developers.cloudflare.com/workers/platform/pricing/)

有问题？查看 [故障排除](#故障排除) 或提交 Issue。
