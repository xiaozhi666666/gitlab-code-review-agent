# 使用 Node.js 20 Alpine 基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 yarn.lock
COPY package.json yarn.lock ./

# 安装 yarn（如果未包含）
RUN corepack enable && corepack prepare yarn@1.22.22 --activate

# 安装所有依赖（包括 devDependencies，mastra 需要）
RUN yarn install --frozen-lockfile --network-timeout 100000

# 复制源代码和配置文件
COPY . .

# 构建项目
RUN yarn build

# 安装生产依赖到 .mastra/output（确保运行时依赖完整）
RUN cd .mastra/output && \
    if [ -f package.json ]; then \
      yarn install --production --frozen-lockfile --network-timeout 100000 || \
      npm install --production --legacy-peer-deps; \
    fi

# 暴露 Mastra API 端口
EXPOSE 4111

# 切换到构建输出目录
WORKDIR /app/.mastra/output

# 启动命令（使用 mastra 生成的启动脚本）
CMD ["node", "--import=./instrumentation.mjs", "--import=@opentelemetry/instrumentation/hook.mjs", "./index.mjs"]
