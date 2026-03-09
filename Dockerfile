# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 运行阶段
FROM alpine:latest

# 安装 Node.js、CUPS 和 ESC/P-R 驱动
RUN apk add --no-cache \
    nodejs \
    npm \
    cups \
    cups-client \
    cups-filters \
    epson-inkjet-printer-escpr \
    ca-certificates \
    tzdata \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# 配置 CUPS 允许远程管理（本地使用）
RUN echo "Listen *:631" >> /etc/cups/cupsd.conf && \
    echo "<Location />" >> /etc/cups/cupsd.conf && \
    echo "  Order allow,deny" >> /etc/cups/cupsd.conf && \
    echo "  Allow @LOCAL" >> /etc/cups/cupsd.conf && \
    echo "</Location>" >> /etc/cups/cupsd.conf && \
    echo "<Location /admin>" >> /etc/cups/cupsd.conf && \
    echo "  Order allow,deny" >> /etc/cups/cupsd.conf && \
    echo "  Allow @LOCAL" >> /etc/cups/cupsd.conf && \
    echo "</Location>" >> /etc/cups/cupsd.conf

# 设置 Puppeteer 使用系统 Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# 从构建阶段复制依赖
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/entrypoint.sh /entrypoint.sh

# 创建临时目录
RUN mkdir -p /tmp/cups-pdfs

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
