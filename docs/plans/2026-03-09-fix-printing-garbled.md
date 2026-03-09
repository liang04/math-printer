# 修复 EPSON L4160 打印乱码问题实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将打印方式从直接 socket 发送 PDF 改为 CUPS + ESC/P-R 驱动，解决 EPSON L4160 乱码问题

**Architecture:** 使用 Alpine Linux 作为基础镜像，安装 CUPS 打印系统和 EPSON ESC/P-R 驱动，通过 `lp` 命令提交打印任务，由 CUPS 自动转换 PDF 为打印机可识别的 ESC/P-R 格式

**Tech Stack:** Node.js 18, Alpine Linux, CUPS, epson-inkjet-printer-escpr 驱动

---

## 前置条件

- Docker 和 Docker Compose 已安装
- EPSON L4160 打印机 IP 为 192.168.31.206
- 打印机 9100 端口可访问

---

### Task 1: 创建 entrypoint.sh 启动脚本

**Files:**
- Create: `entrypoint.sh`

**Step 1: 编写 entrypoint.sh**

```bash
#!/bin/sh

# 启动 CUPS 服务
/usr/sbin/cupsd

# 等待 CUPS 启动
sleep 2

# 配置打印机
PRINTER_IP=${PRINTER_IP:-192.168.31.206}
PRINTER_PORT=${PRINTER_RAW_PORT:-9100}
PRINTER_URI="socket://${PRINTER_IP}:${PRINTER_PORT}"
PRINTER_NAME="epson_l4160"

# PPD 文件路径
PPD_PATH="/usr/share/ppd/epson-inkjet-printer-escpr/Epson-L4160_Series-epson-escpr-en.ppd"

# 如果 PPD 文件不存在，尝试查找其他 PPD
if [ ! -f "$PPD_PATH" ]; then
    PPD_PATH=$(find /usr/share/ppd -name "*L4160*.ppd" 2>/dev/null | head -n1)
fi

if [ ! -f "$PPD_PATH" ]; then
    echo "警告: 未找到 L4160 PPD 文件，使用通用 ESC/P-R PPD"
    PPD_PATH=$(find /usr/share/ppd -name "*escpr*.ppd" 2>/dev/null | head -n1)
fi

echo "打印机 URI: $PRINTER_URI"
echo "PPD 文件: $PPD_PATH"

# 删除已存在的打印机
lpadmin -x "$PRINTER_NAME" 2>/dev/null

# 添加打印机
if [ -f "$PPD_PATH" ]; then
    lpadmin -p "$PRINTER_NAME" -v "$PRINTER_URI" -E -P "$PPD_PATH" 2>&1
else
    # 没有 PPD 时使用 raw 模式（不推荐，但作为 fallback）
    lpadmin -p "$PRINTER_NAME" -v "$PRINTER_URI" -E -o printer-is-shared=false 2>&1
fi

# 检查打印机状态
echo "打印机状态:"
lpstat -p "$PRINTER_NAME" 2>&1 || echo "打印机配置可能有问题"

# 启动 Node.js 应用
echo "启动应用..."
exec node src/index.js
```

**Step 2: 添加执行权限**

Run: `chmod +x entrypoint.sh`

**Step 3: Commit**

```bash
git add entrypoint.sh
git commit -m "feat: add entrypoint script for CUPS and printer setup"
```

---

### Task 2: 重写 Dockerfile 使用 Alpine + CUPS

**Files:**
- Modify: `Dockerfile`

**Step 1: 重写 Dockerfile**

```dockerfile
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
    ca-certificates \
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
```

**Step 2: Commit**

```bash
git add Dockerfile
git commit -m "feat: rewrite Dockerfile with Alpine, CUPS and ESC/P-R driver"
```

---

### Task 3: 修改 docker-compose.yml 添加 host 网络模式

**Files:**
- Modify: `docker-compose.yml`

**Step 1: 修改 docker-compose.yml**

```yaml
version: '3.8'

services:
  math-printer:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - PRINTER_IP=192.168.31.206
      - PRINTER_RAW_PORT=9100
      - NODE_ENV=production
    # host 网络模式支持直接访问局域网打印机
    network_mode: host
    restart: unless-stopped
    volumes:
      - /dev/bus/usb:/dev/bus/usb
      - /var/run/dbus:/var/run/dbus
```

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: use host network mode for LAN printer access"
```

---

### Task 4: 重写 printer.js 使用 lp 命令

**Files:**
- Modify: `src/printer.js`

**Step 1: 重写 printer.js**

```javascript
/**
 * 打印机模块 - 使用 CUPS lp 命令
 * EPSON L4160 使用 ESC/P-R 驱动
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const PRINTER_NAME = 'epson_l4160';

/**
 * 将 Buffer 写入临时文件
 * @param {Buffer} buffer - 数据
 * @param {string} fileName - 文件名
 * @returns {Promise<string>} 临时文件路径
 */
async function writeTempFile(buffer, fileName) {
    const tempDir = '/tmp/cups-pdfs';
    const tempPath = path.join(tempDir, `${fileName}-${Date.now()}.pdf`);
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(tempPath, buffer);
    return tempPath;
}

/**
 * 执行 shell 命令（Promise 包装）
 * @param {string} cmd - 命令
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function execPromise(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`命令失败: ${error.message}, stderr: ${stderr}`));
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

/**
 * 打印 PDF 文件
 * @param {Buffer} pdfBuffer - PDF 数据
 * @param {string} jobName - 打印任务名称
 * @returns {Promise<{jobId: number, status: string}>}
 */
async function printPDF(pdfBuffer, jobName = 'math-worksheet') {
    const tempPath = await writeTempFile(pdfBuffer, jobName);

    try {
        // 使用 lp 命令提交打印任务
        // CUPS + ESC/P-R 驱动会自动将 PDF 转换为打印机语言
        const cmd = `lp -d ${PRINTER_NAME} -t "${jobName}" "${tempPath}"`;

        console.log(`提交打印任务: ${cmd}`);
        const { stdout } = await execPromise(cmd);

        // 解析 job ID
        const match = stdout.match(/request id is (\S+)/);
        const jobId = match ? match[1] : `job-${Date.now()}`;

        console.log(`打印任务已提交: ${jobId}`);

        // 异步删除临时文件（给 CUPS 一点时间处理）
        setTimeout(() => {
            fs.unlink(tempPath).catch(() => {});
        }, 60000);

        return {
            jobId,
            status: 'pending',
            printer: PRINTER_NAME
        };
    } catch (err) {
        // 清理临时文件
        fs.unlink(tempPath).catch(() => {});
        throw err;
    }
}

/**
 * 检查打印机状态
 * @returns {Promise<{connected: boolean, state?: string}>}
 */
async function checkPrinterStatus() {
    try {
        const { stdout } = await execPromise(`lpstat -p ${PRINTER_NAME}`);

        if (stdout.includes('is idle')) {
            return { connected: true, state: 'idle' };
        } else if (stdout.includes('is printing')) {
            return { connected: true, state: 'printing' };
        } else if (stdout.includes('is disabled')) {
            return { connected: false, state: 'disabled' };
        } else {
            return { connected: true, state: 'unknown' };
        }
    } catch (err) {
        return {
            connected: false,
            error: err.message
        };
    }
}

module.exports = { printPDF, checkPrinterStatus, PRINTER_NAME };

// 测试
if (require.main === module) {
    console.log('打印机名称:', PRINTER_NAME);

    checkPrinterStatus().then(status => {
        console.log('打印机状态:', status);
    }).catch(err => {
        console.error('检查状态失败:', err.message);
    });
}
```

**Step 2: Commit**

```bash
git add src/printer.js
git commit -m "feat: rewrite printer module to use CUPS lp command"
```

---

### Task 5: 构建并测试

**Files:**
- None (build test)

**Step 1: 构建 Docker 镜像**

Run: `docker-compose build`

Expected: 构建成功，无错误

**Step 2: 启动服务**

Run: `docker-compose up -d`

Expected: 容器启动成功

**Step 3: 检查打印机状态**

Run: `docker exec <container> lpstat -p epson_l4160`

Expected: `printer epson_l4160 is idle. enabled since ...`

**Step 4: 测试打印**

```bash
curl -X POST http://localhost:3000/api/print \
  -H "Content-Type: application/json" \
  -d '{"count":1,"questions":10}'
```

Expected: 返回成功响应，打印机实际输出正常口算题（非乱码）

**Step 5: Commit 完成标记**

```bash
git add -A
git commit -m "fix: resolve EPSON L4160 printing garbled text issue

- Switch from raw socket to CUPS + ESC/P-R driver
- Use Alpine Linux with epson-inkjet-printer-escpr package
- Update Dockerfile with multi-stage build
- Add entrypoint.sh for printer setup
- Use host network mode for LAN printer access"
```

---

## 验证清单

- [ ] Dockerfile 构建成功
- [ ] 容器启动无错误
- [ ] lpstat 显示打印机已启用
- [ ] 打印 API 返回成功
- [ ] 打印机实际输出正常内容（非乱码）

## 故障排查

**问题: 构建时 Alpine 包找不到**
解决方案: 检查 Alpine 版本，可能需要更新包索引

**问题: CUPS 无法启动**
解决方案: 检查 entrypoint.sh 日志，查看 cupsd 错误

**问题: 打印机显示 disabled**
解决方案: 运行 `docker exec <container> cupsenable epson_l4160`

**问题: PPD 文件找不到**
解决方案: 检查 epson-inkjet-printer-escpr 包是否正确安装

---

**计划创建日期**: 2026-03-09
**预计实施时间**: 30-45 分钟
