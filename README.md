# GitLab Code Review - Mastra API Service

基于 Mastra 框架的 AI 代码审查引擎，提供 REST API 服务用于代码质量分析。

## 项目说明

这是一个**纯 Mastra API 服务**，专注于提供代码审查的 AI 引擎能力。

**注意**: 如果你需要接收 GitLab Webhook，请使用独立的 [gitlab-webhook-server](../gitlab-webhook-server) 项目。

## 架构

```
┌────────────────────┐       HTTP API       ┌─────────────────┐
│  Webhook Server    │ ──────────────────>  │  Mastra API     │
│  (独立项目)         │                      │  (本项目)        │
└────────────────────┘                      └─────────────────┘
                                                    ↓
                                            AI 代码审查引擎
                                            - Workflows
                                            - Agents
                                            - Tools
```

## 功能特性

- 🤖 **AI 驱动**: 使用 OpenAI GPT-4 进行智能代码分析
- 📊 **多维度评估**: 代码质量、安全性、性能、可维护性
- 🔧 **工具集成**: GitLab API、钉钉通知
- 🌐 **REST API**: 标准化的 HTTP API 接口
- 📝 **Workflow**: 完整的代码审查流程编排

## 核心组件

### Workflows
- **codeReviewWorkflow**: 完整的代码审查流程
  - Step 1: 处理 webhook 事件
  - Step 2: 获取代码差异
  - Step 3: AI 代码审查
  - Step 4: 发送钉钉通知

### Agents
- **codeReviewAgent**: 专业的代码审查助手
  - 使用 GPT-4o 模型
  - 多维度质量评估
  - 生成详细审查报告

### Tools
- **GitLab Webhook Tool**: 解析 GitLab push 事件
- **GitLab API Tool**: 获取代码差异和文件内容
- **Code Review Tool**: AI 驱动的代码审查引擎
- **DingTalk Tool**: 钉钉消息推送

## 快速开始

### 1. 安装依赖

```bash
npm install --legacy-peer-deps
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
# OpenAI API Key (必需)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
```

### 3. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

服务将运行在 `http://localhost:4111`

### 4. 访问 API

- **Playground**: http://localhost:4111
- **Swagger UI**: http://localhost:4111/swagger-ui
- **OpenAPI Spec**: http://localhost:4111/openapi.json
- **API Base**: http://localhost:4111/api

## API 端点

### 执行 Workflow

```bash
POST /api/workflows/codeReviewWorkflow/execute
Content-Type: application/json

{
  "triggerData": {
    "headers": { ... },
    "body": { ... },
    "secretToken": "your_secret",
    "gitlabUrl": "https://gitlab.com",
    "accessToken": "glpat-xxx",
    "projectId": 12345,
    "dingtalkWebhook": "https://oapi.dingtalk.com/...",
    "dingtalkSecret": "xxx"
  }
}
```

### 调用 Agent

```bash
POST /api/agents/codeReviewAgent/generate
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": "请审查这段代码..."
    }
  ]
}
```

### 获取 Workflows

```bash
GET /api/workflows
```

### 获取 Agents

```bash
GET /api/agents
```

## 部署指南

### 本地开发

```bash
npm run dev
```

服务运行在 `http://localhost:4111`

---

### 部署到 Cloudflare Workers（推荐）

Cloudflare Workers 提供全球 CDN 和无服务器部署。

#### 方式 1: Cloudflare Dashboard（最简单）

1. **推送代码到 GitHub**

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/gitlab-code-review-mastra.git
git push -u origin main
```

2. **在 Cloudflare Dashboard 创建 Worker**
   - 登录 https://dash.cloudflare.com/
   - 进入 **Workers & Pages**
   - 点击 **Create Application** > **Workers** > **Create Worker**
   - 选择 **Connect to Git**

3. **配置 GitHub 集成**
   - 授权 Cloudflare 访问 GitHub
   - 选择你的仓库
   - 分支: `main`

4. **配置构建设置**
   - Framework preset: `None`
   - Build command: `npm install --legacy-peer-deps && npm run build`
   - Build output directory: `.mastra/output`

5. **设置环境变量**
   ```
   OPENAI_API_KEY = sk-xxx
   NODE_ENV = production
   ```

6. **部署**
   - 点击 **Save and Deploy**
   - 获得 Worker URL: `https://your-worker.workers.dev`

#### 方式 2: Wrangler CLI（高级用户）

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录
wrangler login

# 构建
npm run build

# 部署
wrangler deploy --config .mastra/output/wrangler.json

# 设置 Secret
wrangler secret put OPENAI_API_KEY
```

详细步骤请参考 [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md)

---

### 部署到独立服务器

```bash
# 1. 克隆项目
git clone https://github.com/your-username/gitlab-code-review-mastra.git
cd gitlab-code-review-mastra

# 2. 安装依赖
npm install --legacy-peer-deps

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，设置 OPENAI_API_KEY

# 4. 使用 PM2 启动
npm install -g pm2
pm2 start "npm run dev" --name mastra-api
pm2 save
pm2 startup
```

---

## 与 Webhook Server 集成

本项目提供 API 服务，需要配合 [gitlab-webhook-server](../gitlab-webhook-server) 使用。

**Webhook Server 配置**:

```env
# 在 gitlab-webhook-server/.env 中配置
MASTRA_API_URL=http://localhost:4111           # 本地开发
# MASTRA_API_URL=https://your-worker.workers.dev  # Cloudflare Workers
# MASTRA_API_URL=https://your-server.com:4111     # 独立服务器
```

**完整流程**:

```
GitLab → Webhook Server → Mastra API → AI 审查 → 钉钉通知
```

## 项目结构

```
gitlab-code-review/
├── src/
│   └── mastra/
│       ├── agents/          # AI Agents 定义
│       │   └── code-review-agent.ts
│       ├── tools/           # 工具集
│       │   ├── gitlab-webhook-tool.ts
│       │   ├── code-review-tool.ts
│       │   └── dingtalk-tool.ts
│       ├── workflows/       # 工作流定义
│       │   └── code-review-workflow.ts
│       └── index.ts         # Mastra 配置
├── .env                     # 环境变量
├── package.json
├── tsconfig.json
├── README.md
└── CLOUDFLARE_DEPLOYMENT.md # Cloudflare 部署详细指南
```

## 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `OPENAI_API_KEY` | ✅ | OpenAI API Key，用于 GPT-4 代码审查 |
| `NODE_ENV` | ❌ | 运行环境（development/production） |

## 开发

### 查看 API 文档

启动服务后访问：

- Swagger UI: http://localhost:4111/swagger-ui
- OpenAPI JSON: http://localhost:4111/openapi.json

### 调试

```bash
# 实时查看日志
npm run dev

# 使用 Playground 测试
open http://localhost:4111
```

### 自定义代码审查规则

编辑 `src/mastra/tools/code-review-tool.ts` 添加新的检查规则：

```typescript
// 示例：检查 eval() 使用
if (diff.includes('eval(')) {
  issues.push({
    severity: 'high',
    type: 'security',
    file: file.filePath,
    message: '使用 eval() 函数存在安全风险',
    suggestion: '避免使用 eval()，考虑使用更安全的替代方案',
  });
}
```

## 故障排除

### 1. 构建失败

**错误**: `Module not found` 或依赖冲突

**解决**:
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### 2. OpenAI API 调用失败

**错误**: `401 Unauthorized` 或 `Rate limit exceeded`

**解决**:
- 检查 `OPENAI_API_KEY` 是否正确
- 检查 API 额度是否用完
- 验证 API Key: `curl https://api.openai.com/v1/models -H "Authorization: Bearer YOUR_KEY"`

### 3. Cloudflare Workers 部署失败

**错误**: `addEventListener is not defined`

**解决**:
- 这是 Mastra 的已知兼容性问题
- 使用 Cloudflare Dashboard 的 GitHub 集成部署（推荐）
- 等待 Mastra 官方更新

## 代码审查标准

系统从以下维度评估代码：

### 代码质量 (40%)
- 语法正确性和逻辑合理性
- 错误处理和边界条件
- 代码复杂度和可读性
- 变量命名和代码结构

### 安全性 (25%)
- 潜在的安全漏洞
- 敏感信息泄露检查
- 输入验证和授权检查
- 依赖安全性

### 性能 (20%)
- 算法效率
- 资源使用优化
- 数据库查询优化
- 缓存策略

### 可维护性 (15%)
- 代码组织和模块化
- 注释和文档完整性
- 测试覆盖率
- 向后兼容性

## 性能和限制

### 本地部署
- ✅ 无请求限制
- ✅ 无 CPU 时间限制
- ❌ 需要管理服务器

### Cloudflare Workers
- ✅ 全球 CDN 加速
- ✅ 免费额度：100,000 请求/天
- ⚠️ CPU 时间限制：50ms/请求（免费版）
- ⚠️ 内存限制：128MB

对于代码审查这种可能较耗时的任务，建议：
1. 优化 AI 调用（批量处理）
2. 升级 Cloudflare Workers 付费版（500ms CPU 时间）
3. 或部署到独立服务器

## 监控

### 查看日志

**本地**:
```bash
npm run dev  # 实时查看控制台日志
```

**Cloudflare Workers**:
- Dashboard: Workers > 你的 Worker > Logs
- CLI: `wrangler tail`

### 指标监控

Cloudflare Dashboard 可查看：
- 请求数和错误率
- CPU 使用时间
- 响应延迟
- 错误日志

## 相关项目

- [gitlab-webhook-server](../gitlab-webhook-server) - GitLab Webhook 接收服务器
- [完整架构说明](../ARCHITECTURE.md)

## API 参考

完整的 API 文档请访问：
- Swagger UI: `http://localhost:4111/swagger-ui`
- 或部署后的 Worker URL

## 许可证

MIT

## 贡献

欢迎提交 Issues 和 Pull Requests！

## 技术栈

- **Framework**: Mastra (TypeScript AI Framework)
- **AI Model**: OpenAI GPT-4o
- **Runtime**: Node.js >= 20.9.0
- **部署**: Cloudflare Workers / 独立服务器
