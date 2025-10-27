# Git 部署指南 - GitLab Code Review

使用 Git 部署是最简单、最高效的方式，特别适合堡垒机环境。

## 📋 准备工作

### 1. 确认已安装 Docker 和 Docker Compose

在 1Panel 终端中检查：

```bash
docker --version
docker-compose --version
```

### 2. 准备 Git 仓库

你需要一个 Git 远程仓库（GitHub、GitLab 或 Gitee）。

---

## 🚀 首次部署

### 步骤 1：初始化 Git 仓库（本地 Mac）

```bash
cd /Users/xiaozhi/Desktop/gitlab-code-review/gitlab-code-review

# 初始化 Git（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial Docker deployment for 1Panel"

# 添加远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/你的用户名/gitlab-code-review.git
# 或使用 GitLab
# git remote add origin https://gitlab.com/你的用户名/gitlab-code-review.git
# 或使用 Gitee（国内）
# git remote add origin https://gitee.com/你的用户名/gitlab-code-review.git

# 推送到远程
git push -u origin main
```

**注意**：
- 如果主分支是 `master` 而不是 `main`，使用 `git push -u origin master`
- 如果仓库不存在，需要先在 GitHub/GitLab/Gitee 创建仓库

---

### 步骤 2：在服务器上克隆项目

通过堡垒机登录 1Panel 服务器，然后在 **1Panel 终端** 中执行：

```bash
# 进入部署目录
cd /opt

# 克隆项目
git clone https://github.com/你的用户名/gitlab-code-review.git

# 进入项目目录
cd gitlab-code-review
```

**如果是私有仓库**，需要认证：

#### 方式 A：使用 Personal Access Token（推荐）

```bash
# GitHub Personal Access Token
git clone https://TOKEN@github.com/你的用户名/gitlab-code-review.git

# GitLab Personal Access Token
git clone https://TOKEN@gitlab.com/你的用户名/gitlab-code-review.git

# Gitee 私人令牌
git clone https://TOKEN@gitee.com/你的用户名/gitlab-code-review.git
```

#### 方式 B：使用用户名密码

```bash
git clone https://用户名:密码@github.com/你的用户名/gitlab-code-review.git
```

---

### 步骤 3：配置环境变量

在服务器上创建 `.env` 文件：

```bash
cd /opt/gitlab-code-review

# 使用 vi 编辑器
vi .env
```

按 `i` 进入编辑模式，添加以下内容：

```env
# OpenAI API Key (必需)
OPENAI_API_KEY=sk-your-openai-api-key-here

# 运行环境
NODE_ENV=production

# 日志级别
LOG_LEVEL=info
```

保存并退出：
1. 按 `Esc` 键
2. 输入 `:wq`
3. 按 `Enter`

---

### 步骤 4：启动 Docker 容器

```bash
cd /opt/gitlab-code-review

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

看到类似以下输出表示成功：

```
gitlab-code-review-mastra  | Mastra API running on http://localhost:4111
gitlab-code-review-mastra  | Playground available at http://localhost:4111
```

按 `Ctrl+C` 退出日志查看。

---

### 步骤 5：验证部署

```bash
# 检查容器状态
docker-compose ps

# 测试 API
curl http://localhost:4111/health

# 或访问 Swagger UI
curl http://172.19.52.251:4111/swagger-ui
```

预期返回：
```json
{"status":"ok"}
```

---

## 🔄 后续更新代码

### 在本地 Mac 更新代码

```bash
cd /Users/xiaozhi/Desktop/gitlab-code-review/gitlab-code-review

# 修改代码后...

# 添加更改
git add .

# 提交
git commit -m "描述你的更改"

# 推送到远程
git push
```

### 在服务器上更新（1Panel 终端）

```bash
cd /opt/gitlab-code-review

# 拉取最新代码
git pull

# 重启容器应用更改
docker-compose restart

# 查看日志确认
docker-compose logs -f
```

**就这么简单！** 🎉

---

## 📝 常用命令

### 本地（Mac）管理

```bash
# 查看可用的远程管理命令
yarn logs:remote      # 查看远程日志
yarn restart:remote   # 重启远程容器
yarn status:remote    # 查看远程容器状态
```

**注意**：这些命令在堡垒机环境下可能无法使用，建议直接在 1Panel 终端操作。

### 服务器（1Panel 终端）管理

```bash
# 进入项目目录
cd /opt/gitlab-code-review

# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f                    # 实时日志
docker-compose logs --tail=100           # 最近 100 行
docker-compose logs -f --tail=50         # 实时显示最近 50 行

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 启动服务
docker-compose up -d

# 重新构建并启动（代码有大改动时）
docker-compose down
docker-compose up -d --build

# 查看资源使用
docker stats $(docker-compose ps -q)

# 更新代码
git pull
docker-compose restart
```

---

## 🔧 故障排除

### 1. 容器无法启动

**检查日志**：
```bash
docker-compose logs
```

**常见问题**：
- 环境变量未设置：检查 `.env` 文件
- 端口被占用：`lsof -i :4111`
- 内存不足：`docker stats`

**解决**：
```bash
# 完全重启
docker-compose down
docker-compose up -d

# 查看详细日志
docker-compose logs -f
```

### 2. Git pull 失败

**错误**：`Authentication failed`

**解决**：
```bash
# 重新配置远程仓库（使用 Token）
git remote set-url origin https://TOKEN@github.com/你的用户名/gitlab-code-review.git

# 再次拉取
git pull
```

### 3. 无法访问 API

**检查容器是否运行**：
```bash
docker-compose ps
```

**检查端口**：
```bash
curl http://localhost:4111/health
```

**检查防火墙**：
```bash
# 如需外部访问，确保端口开放
firewall-cmd --list-ports
```

### 4. 更新后没有生效

**完全重建容器**：
```bash
docker-compose down
docker-compose up -d --build
```

---

## 🌟 最佳实践

### 1. 使用分支管理

```bash
# 创建开发分支
git checkout -b dev

# 开发完成后合并到主分支
git checkout main
git merge dev
git push
```

### 2. 配置 Git 忽略

`.gitignore` 已配置，确保不会提交敏感信息：
- `.env` - 环境变量
- `node_modules/` - 依赖包
- `dist/` - 构建产物

### 3. 定期查看日志

```bash
# 每天检查一次
cd /opt/gitlab-code-review
docker-compose logs --since 24h
```

### 4. 备份环境变量

```bash
# 备份 .env 文件
cp .env .env.backup.$(date +%Y%m%d)
```

---

## 📊 部署检查清单

### 首次部署

- [ ] 本地代码推送到 Git 仓库
- [ ] 服务器上克隆项目到 `/opt/gitlab-code-review`
- [ ] 创建并配置 `.env` 文件
- [ ] 启动 Docker 容器
- [ ] 验证 API 可访问（`curl http://localhost:4111/health`）
- [ ] 查看日志确认无错误

### 日常更新

- [ ] 本地提交并推送代码
- [ ] 服务器执行 `git pull`
- [ ] 重启容器 `docker-compose restart`
- [ ] 查看日志确认无问题

---

## 🎯 快速参考

| 操作 | 本地命令 | 服务器命令 |
|------|---------|-----------|
| 提交代码 | `git add . && git commit -m "msg" && git push` | - |
| 更新代码 | - | `git pull` |
| 重启服务 | - | `docker-compose restart` |
| 查看日志 | - | `docker-compose logs -f` |
| 查看状态 | - | `docker-compose ps` |

---

## 📞 获取帮助

如遇到问题：

1. 查看日志：`docker-compose logs -f`
2. 检查容器状态：`docker-compose ps`
3. 查看文档：本文件和 `DOCKER_DEPLOYMENT.md`
4. 检查 Git 状态：`git status`

---

## 🎉 完成！

现在你已经设置好了基于 Git 的部署流程：

1. ✅ 本地开发 → Git 推送
2. ✅ 服务器 Git 拉取 → 重启容器
3. ✅ 简单高效，无需复杂上传

每次更新只需几秒钟！
