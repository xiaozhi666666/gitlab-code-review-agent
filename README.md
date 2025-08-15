# GitLab Code Review with Mastra

这是一个基于 Mastra 框架的 GitLab 代码审查自动化系统，可以在代码提交后自动进行代码审查并通过钉钉推送审查结果。

## 功能特性

- 🔄 **自动触发**: 接收 GitLab webhook 事件，自动进行代码审查
- 🤖 **AI 驱动**: 使用 OpenAI GPT 模型进行智能代码分析
- 📊 **全面审查**: 从代码质量、安全性、性能、可维护性等多个维度进行评估
- 💬 **钉钉通知**: 自动将审查结果推送到钉钉群聊
- 🎯 **精准分析**: 支持多种编程语言和框架的代码分析

## 架构组成

### 工具 (Tools)
- **GitLab Webhook Tool**: 处理 GitLab 推送事件
- **GitLab API Tool**: 获取代码差异和文件内容
- **Code Review Tool**: AI 驱动的代码审查分析
- **DingTalk Tool**: 钉钉消息推送

### 工作流 (Workflow)
- **Code Review Workflow**: 串联整个代码审查流程
  1. 处理 webhook 事件
  2. 获取代码差异
  3. 执行 AI 代码审查
  4. 发送钉钉通知

### 代理 (Agent)
- **Code Review Agent**: 专业的代码审查助手

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
npm install

# 复制环境变量配置文件
cp .env.example .env
```

### 2. 配置环境变量

编辑 `.env` 文件，填入相应的配置：

```env
# GitLab 配置
GITLAB_URL=https://gitlab.com
GITLAB_ACCESS_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_PROJECT_ID=12345
GITLAB_WEBHOOK_SECRET=your_webhook_secret

# 钉钉配置
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx
DINGTALK_SECRET=your_dingtalk_secret

# OpenAI 配置
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. 启动服务

```bash
# 开发模式（推荐）
npm run server:simple:dev

# 测试模式（跳过GitLab API调用，用于调试）
npm run server:test:dev

# 生产模式
npm run build
npm start
```

服务启动后会在 `http://localhost:3000` 提供以下端点：

- `POST /webhook/gitlab` - GitLab webhook 接收端点
- `GET /health` - 健康检查
- `POST /test/dingtalk` - 测试钉钉消息
- `GET /info` - 系统信息

### 4. 本地开发调试 (使用 ngrok)

由于GitLab webhook无法直接访问本地服务器，需要使用ngrok进行内网穿透：

#### 4.1 安装 ngrok

```bash
# macOS (使用 Homebrew)
brew install ngrok

# 或从官网下载: https://ngrok.com/download
```

#### 4.2 配置 ngrok 账号

1. 访问 [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
2. 注册/登录账号
3. 复制你的 authtoken
4. 配置 authtoken：

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

#### 4.3 启动本地服务并暴露到公网

打开两个终端窗口：

**终端 1 - 启动本地服务:**
```bash
npm run server:simple:dev
```

**终端 2 - 启动 ngrok:**
```bash
ngrok http 3000
```

ngrok 会显示类似以下信息：
```
Session Status    online
Account           你的邮箱
Version           3.x.x
Region            us-east-1
Latency           45ms
Web Interface     http://127.0.0.1:4040
Forwarding        https://abc123def.ngrok-free.app -> http://localhost:3000
```

#### 4.4 配置 GitLab Webhook

在GitLab项目中配置webhook：
- **URL**: `https://abc123def.ngrok-free.app/webhook/gitlab` （使用ngrok提供的HTTPS地址）
- **Secret Token**: `gitlab-code-review-webhook-2025`
- **Trigger events**: 勾选 "Push events"

#### 4.5 测试完整流程

1. 向GitLab项目推送代码
2. 观察终端1的日志输出
3. 检查钉钉群是否收到审查报告

### 💡 开发调试技巧

- **ngrok web界面**: 访问 `http://127.0.0.1:4040` 查看请求详情
- **测试模式**: 使用 `npm run server:test:dev` 跳过GitLab API调用
- **日志调试**: 服务器会输出详细的处理日志
- **手动测试**: 使用 `npm run test:webhook` 发送模拟数据

### 5. 生产环境配置 GitLab Webhook

#### 开发环境（使用ngrok）
1. 确保 ngrok 正在运行：`ngrok http 3000`
2. 进入 GitLab 项目的 Settings > Webhooks
3. 添加新的 webhook：
   - **URL**: `https://your-ngrok-url.ngrok-free.app/webhook/gitlab` （使用ngrok提供的HTTPS地址）
   - **Secret Token**: `gitlab-code-review-webhook-2025`
   - **Trigger events**: 勾选 "Push events"
   - **SSL verification**: 启用
4. 点击 "Test" > "Push events" 测试webhook

#### 生产环境
1. 进入 GitLab 项目的 Settings > Webhooks  
2. 添加新的 webhook：
   - **URL**: `https://your-domain.com/webhook/gitlab`
   - **Secret Token**: 你在 `.env` 中设置的 `GITLAB_WEBHOOK_SECRET`
   - **Trigger events**: 勾选 "Push events"
   - **SSL verification**: 启用
3. 保存并测试 webhook

### 6. 配置钉钉机器人

1. 在钉钉群聊中添加自定义机器人
2. 复制 webhook URL 到环境变量 `DINGTALK_WEBHOOK_URL`
3. 如果启用了加签验证，将密钥复制到 `DINGTALK_SECRET`

### 7. 服务器部署

如果要部署到生产环境：

```bash
# 1. 将代码部署到服务器
git clone your-repo
cd gitlab-code-review

# 2. 安装依赖
npm install --legacy-peer-deps

# 3. 配置环境变量 (复制并编辑 .env 文件)
cp .env.example .env
# 编辑 .env 填入正确的配置

# 4. 启动服务
npm run server:simple

# 或者使用 PM2 管理进程
npm install -g pm2
pm2 start "npm run server:simple" --name gitlab-code-review
pm2 save
pm2 startup
```

## API 接口

### Webhook 接收

```http
POST /webhook/gitlab
Content-Type: application/json
X-Gitlab-Event: Push Hook
X-Gitlab-Token: your_secret_token

{
  "object_kind": "push",
  "project": {...},
  "commits": [...],
  ...
}
```

### 测试钉钉消息

```http
POST /test/dingtalk
Content-Type: application/json

{
  "message": "测试消息",
  "title": "测试标题"
}
```

## 代码审查标准

系统会从以下维度对代码进行评估：

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

## 示例输出

代码审查完成后，会通过钉钉发送如下格式的消息：

```markdown
# 🔍 代码审查报告

## 📋 基本信息
- 项目: My Project
- 分支: main  
- 提交者: 张三
- 提交ID: a1b2c3d4
- 提交信息: feat: 添加用户认证功能

## 📊 审查结果
✅ 总体评分: 8/10

摘要: 代码质量良好，新增的用户认证功能实现合理，有1个中等优先级问题需要注意。

## ⚠️ 发现的问题 (1个)
### ⚡ MEDIUM - security
- 文件: src/auth.js
- 问题: 代码中可能包含敏感信息
- 建议: 建议使用环境变量存储敏感配置

## 👍 积极方面
- ✅ 包含了完整的单元测试
- ✅ 代码注释清晰完整

## 💡 改进建议
- 🔧 建议定期进行安全审计
```

## 开发指南

### 项目结构

```
src/
├── mastra/
│   ├── agents/          # 代理定义
│   ├── tools/           # 工具定义  
│   ├── workflows/       # 工作流定义
│   └── index.ts         # Mastra 主配置
├── example-server.ts    # HTTP 服务器示例
└── ...
```

### 自定义代码审查规则

编辑 `src/mastra/tools/code-review-tool.ts` 来自定义审查逻辑：

```typescript
// 添加新的检查规则
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

### 扩展钉钉消息格式

编辑 `src/mastra/tools/dingtalk-tool.ts` 来自定义消息格式。

## 故障排除

### 常见问题

1. **Webhook 接收失败**
   - **检查ngrok状态**: 确保 `ngrok http 3000` 正在运行
   - **验证URL**: 使用ngrok提供的HTTPS地址，不是localhost
   - **检查token**: 确认GitLab webhook secret token配置正确
   - **防火墙**: 确保服务器端口3000可访问

2. **GitLab API认证失败 (401错误)**
   - **检查Access Token**: 确认token未过期且权限足够
   - **所需权限**: api, read_api, read_repository
   - **测试token**: `curl -H "Authorization: Bearer YOUR_TOKEN" "YOUR_GITLAB_URL/api/v4/user"`

3. **代码审查失败**
   - **OpenAI API**: 检查API key是否正确且有额度
   - **网络连接**: 确认服务器可以访问OpenAI API
   - **使用测试模式**: `npm run server:test:dev` 跳过GitLab API调用

4. **钉钉消息发送失败**
   - **验证webhook URL**: 检查钉钉机器人webhook地址格式
   - **检查加签**: 如果启用加签验证，确认密钥正确
   - **测试消息**: 使用 `POST /test/dingtalk` 端点测试

### ngrok 调试技巧

- **访问ngrok面板**: `http://127.0.0.1:4040` 查看所有HTTP请求
- **查看请求详情**: 在ngrok面板中可以看到GitLab发送的原始请求
- **重放请求**: 可以在ngrok面板中重放之前的请求进行调试
- **检查响应**: 查看服务器返回的状态码和响应内容

### 日志查看

服务器日志会输出详细的执行信息，有助于问题诊断。

## 许可证

MIT

## 贡献

欢迎提交 Issues 和 Pull Requests！