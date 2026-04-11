# Trade ERP v0.4.0 Production Dockerfile
FROM node:20-alpine@sha256:b88333c42c23fbd91596ebd7fd10de239cedab9617de04142dde7315e3bc0afa

# 安装必要的依赖
RUN apk add --no-cache libc6-compat

# 设置工作目录
WORKDIR /app

# 复制 package.json
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 生成 Prisma 客户端
RUN npx prisma generate

# 构建生产版本（typescript.ignoreBuildErrors 会跳过类型检查）
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN npx next build

# standalone 模式需要手动复制 public 文件夹和 .next/static
RUN cp -r public .next/standalone/
RUN cp -r .next/static .next/standalone/.next/

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 启动生产服务器（output: standalone 模式需要直接运行 node）
CMD ["node", ".next/standalone/server.js"]
