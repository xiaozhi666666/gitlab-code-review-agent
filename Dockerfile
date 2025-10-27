# 使用 Node.js 20 Alpine 基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 yarn.lock
COPY package.json yarn.lock ./

# 安装 yarn（如果未包含）
RUN corepack enable && corepack prepare yarn@1.22.22 --activate

# 安装依赖
# 使用 --frozen-lockfile 确保依赖版本一致
RUN yarn install --frozen-lockfile --network-timeout 100000

# 复制源代码
COPY . .

# 构建项目
RUN yarn build

# 暴露 Mastra API 端口
EXPOSE 4111

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4111/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动命令
CMD ["yarn", "start"]
