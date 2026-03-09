# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 运行阶段
FROM alpine:3.19

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
    font-noto-cjk \
    && rm -rf /var/cache/apk/*

# 配置中文字体
RUN echo '<?xml version="1.0"?>' > /etc/fonts/local.conf && \
    echo '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">' >> /etc/fonts/local.conf && \
    echo '<fontconfig>' >> /etc/fonts/local.conf && \
    echo '    <alias>' >> /etc/fonts/local.conf && \
    echo '        <family>sans-serif</family>' >> /etc/fonts/local.conf && \
    echo '        <prefer>' >> /etc/fonts/local.conf && \
    echo '            <family>Noto Sans CJK SC</family>' >> /etc/fonts/local.conf && \
    echo '        </prefer>' >> /etc/fonts/local.conf && \
    echo '    </alias>' >> /etc/fonts/local.conf && \
    echo '    <alias>' >> /etc/fonts/local.conf && \
    echo '        <family>serif</family>' >> /etc/fonts/local.conf && \
    echo '        <prefer>' >> /etc/fonts/local.conf && \
    echo '            <family>Noto Serif CJK SC</family>' >> /etc/fonts/local.conf && \
    echo '        </prefer>' >> /etc/fonts/local.conf && \
    echo '    </alias>' >> /etc/fonts/local.conf && \
    echo '</fontconfig>' >> /etc/fonts/local.conf && \
    fc-cache -fv

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
RUN mkdir -p /tmp/cups-pdfs && chmod 1777 /tmp/cups-pdfs

# 确保 entrypoint 可执行
RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
