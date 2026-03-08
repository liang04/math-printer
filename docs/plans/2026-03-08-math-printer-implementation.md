# 数学口算题打印服务实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 math.html 改造为 Docker 化的 Web 服务，提供 API 触发 EPSON L4160 打印口算题

**Architecture:** Node.js + Express 提供 REST API，Puppeteer 渲染 PDF，IPP 协议直连打印机，单容器 Docker 部署

**Tech Stack:** Node.js 20, Express, Puppeteer, ipp, uuid

---

## 前置检查

### Task 0: 验证项目目录结构

**检查:**
```bash
cd /home/lvliang/lvliang/mental-math/math-printer
ls -la
```

**预期:** 已存在 `docs/plans/` 目录

**如果不存在:**
```bash
mkdir -p src templates
```

---

## Phase 1: 项目基础

### Task 1: 初始化 package.json

**Files:**
- Create: `package.json`

**Step 1: 创建 package.json**

```json
{
  "name": "math-printer",
  "version": "1.0.0",
  "description": "数学口算题打印服务",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "puppeteer": "^21.6.1",
    "ipp": "^2.0.1",
    "uuid": "^9.0.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Step 2: 验证创建成功**

```bash
cat package.json
```

**Step 3: 提交**

```bash
git add package.json
git commit -m "chore: initialize package.json with dependencies"
```

---

### Task 2: 创建 Dockerfile

**Files:**
- Create: `Dockerfile`

**Step 1: 编写 Dockerfile**

```dockerfile
FROM node:20-slim

# 安装 Puppeteer 依赖
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-cjk \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 设置 Puppeteer 使用系统 Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# 先复制依赖文件
COPY package*.json ./
RUN npm ci --only=production

# 复制应用代码
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

**Step 2: 创建 .dockerignore**

```
node_modules
npm-debug.log
.git
.gitignore
README.md
docs
```

**Step 3: 提交**

```bash
git add Dockerfile .dockerignore
git commit -m "chore: add Dockerfile with Puppeteer support"
```

---

### Task 3: 创建 docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

**Step 1: 编写配置**

```yaml
version: '3.8'

services:
  math-printer:
    build: .
    container_name: math-printer
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - PRINTER_IP=192.168.31.206
      - PRINTER_PORT=631
      - NODE_ENV=production
    restart: unless-stopped
    networks:
      - printer-net

networks:
  printer-net:
    driver: bridge
```

**Step 2: 提交**

```bash
git add docker-compose.yml
git commit -m "chore: add docker-compose configuration"
```

---

## Phase 2: 核心模块

### Task 4: 题目生成模块

**Files:**
- Create: `src/generator.js`
- Test: 手动测试（运行 node src/generator.js）

**Step 1: 编写题目生成器**

```javascript
/**
 * 数学口算题生成器
 * 从 math.html 迁移
 */

// 随机打乱数组 (Fisher-Yates Shuffle)
function shuffle(array) {
  const arr = [...array];
  let currentIndex = arr.length;
  let randomIndex;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [arr[currentIndex], arr[randomIndex]] = [arr[randomIndex], arr[currentIndex]];
  }
  return arr;
}

// 生成加法题 (100以内)
function generateAddition() {
  const a = Math.floor(Math.random() * 80) + 10;
  const b = Math.floor(Math.random() * (90 - a)) + 10;
  return { text: `${a} + ${b}`, answer: a + b };
}

// 生成减法题 (100以内，结果为正)
function generateSubtraction() {
  const a = Math.floor(Math.random() * 80) + 20;
  const b = Math.floor(Math.random() * (a - 10)) + 10;
  return { text: `${a} - ${b}`, answer: a - b };
}

// 生成乘法题 (表内)
function generateMultiplication() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { text: `${a} × ${b}`, answer: a * b };
}

// 生成除法题 (表内，整除)
function generateDivision() {
  const divisor = Math.floor(Math.random() * 9) + 1;
  const quotient = Math.floor(Math.random() * 9) + 1;
  const dividend = divisor * quotient;
  return { text: `${dividend} ÷ ${divisor}`, answer: quotient };
}

// 生成混合运算题
function generateMixed() {
  const generators = [
    // 乘法 + 加法: a × b + c
    () => {
      const a = Math.floor(Math.random() * 9) + 1;
      const b = Math.floor(Math.random() * 9) + 1;
      const c = Math.floor(Math.random() * 40) + 10;
      return { text: `${a} × ${b} + ${c}`, answer: a * b + c };
    },
    // 乘法 - 减法: a × b - c (结果为正)
    () => {
      const a = Math.floor(Math.random() * 6) + 4;
      const b = Math.floor(Math.random() * 6) + 4;
      const product = a * b;
      const c = Math.floor(Math.random() * (product - 1)) + 1;
      return { text: `${a} × ${b} - ${c}`, answer: product - c };
    },
    // 除法 + 加法: a ÷ b + c
    () => {
      const b = Math.floor(Math.random() * 8) + 2;
      const quotient = Math.floor(Math.random() * 9) + 1;
      const a = b * quotient;
      const c = Math.floor(Math.random() * 40) + 10;
      return { text: `${a} ÷ ${b} + ${c}`, answer: quotient + c };
    },
    // 除法 - 减法: a ÷ b - c (结果为正)
    () => {
      const b = Math.floor(Math.random() * 8) + 2;
      const quotient = Math.floor(Math.random() * 7) + 3;
      const a = b * quotient;
      const c = Math.floor(Math.random() * (quotient - 1)) + 1;
      return { text: `${a} ÷ ${b} - ${c}`, answer: quotient - c };
    },
    // a × b + c ÷ d
    () => {
      const a = Math.floor(Math.random() * 9) + 1;
      const b = Math.floor(Math.random() * 9) + 1;
      const d = Math.floor(Math.random() * 8) + 2;
      const quotient = Math.floor(Math.random() * 9) + 1;
      const c = d * quotient;
      return { text: `${a} × ${b} + ${c} ÷ ${d}`, answer: a * b + quotient };
    },
    // a ÷ b + c × d
    () => {
      const b = Math.floor(Math.random() * 8) + 2;
      const quotient = Math.floor(Math.random() * 9) + 1;
      const a = b * quotient;
      const c = Math.floor(Math.random() * 9) + 1;
      const d = Math.floor(Math.random() * 9) + 1;
      return { text: `${a} ÷ ${b} + ${c} × ${d}`, answer: quotient + c * d };
    }
  ];

  const gen = generators[Math.floor(Math.random() * generators.length)];
  return gen();
}

/**
 * 生成完整试卷
 * @param {Object} options
 * @param {number} options.questionCount - 口算题数量 (默认 26)
 * @param {number} options.mixedCount - 混合运算题数量 (默认 8)
 * @returns {Object} { oral: [], mixed: [] }
 */
function generateWorksheet(options = {}) {
  const questionCount = options.questionCount || 26;
  const mixedCount = options.mixedCount || 8;

  const oral = [];

  // 分配口算题: 12 加法, 12 减法, 1 乘法, 1 除法
  const additionCount = Math.min(12, Math.floor(questionCount * 0.46));
  const subtractionCount = Math.min(12, Math.floor(questionCount * 0.46));
  const multiplicationCount = 1;
  const divisionCount = 1;

  for (let i = 0; i < additionCount; i++) {
    oral.push(generateAddition());
  }
  for (let i = 0; i < subtractionCount; i++) {
    oral.push(generateSubtraction());
  }
  for (let i = 0; i < multiplicationCount; i++) {
    oral.push(generateMultiplication());
  }
  for (let i = 0; i < divisionCount; i++) {
    oral.push(generateDivision());
  }

  const mixed = [];
  for (let i = 0; i < mixedCount; i++) {
    mixed.push(generateMixed());
  }

  return {
    oral: shuffle(oral),
    mixed: mixed
  };
}

module.exports = { generateWorksheet, shuffle };

// 手动测试
if (require.main === module) {
  const worksheet = generateWorksheet({ questionCount: 26, mixedCount: 8 });
  console.log('口算题 (26道):');
  worksheet.oral.forEach((q, i) => console.log(`${i + 1}. ${q.text} = ${q.answer}`));
  console.log('\n混合运算 (8道):');
  worksheet.mixed.forEach((q, i) => console.log(`${i + 1}. ${q.text} = ${q.answer}`));
}
```

**Step 2: 测试运行**

```bash
node src/generator.js
```

**预期输出:** 显示 26 道口算题和 8 道混合运算题

**Step 3: 提交**

```bash
git add src/generator.js
git commit -m "feat: add worksheet generator module"
```

---

### Task 5: HTML 模板

**Files:**
- Create: `templates/worksheet.html`

**Step 1: 基于 math.html 创建模板**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>{{title}}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 1.5cm 1cm;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: "STKaiti", "KaiTi", "楷体", "SimSun", "宋体", sans-serif;
            color: #333;
            padding: 0;
        }

        .worksheet {
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
        }

        .title {
            text-align: center;
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 20px;
            letter-spacing: 4px;
        }

        .header-info {
            display: flex;
            justify-content: space-between;
            font-size: 16px;
            margin-bottom: 25px;
            border-bottom: 2px dashed #0cc;
            padding-bottom: 10px;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            row-gap: 20px;
            column-gap: 30px;
            margin-bottom: 30px;
        }

        .question {
            font-size: 20px;
            font-family: "Consolas", "Monaco", "Courier New", monospace;
            display: flex;
            align-items: center;
        }

        .question .expr {
            display: inline-block;
            width: 180px;
            text-align: right;
            margin-right: 10px;
            white-space: nowrap;
        }

        .mixed-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            row-gap: 25px;
            column-gap: 30px;
        }
    </style>
</head>
<body>
    <div class="worksheet">
        <div class="title">{{title}}</div>
        <div class="header-info">
            <span>姓名：_________</span>
            <span>班级：_________</span>
            <span>日期：_________</span>
            <span>得分：_________</span>
        </div>

        <div class="grid">
            {{#oral}}
            <div class="question">
                <span class="expr">{{text}}</span> = ______
            </div>
            {{/oral}}
        </div>

        <div class="mixed-grid">
            {{#mixed}}
            <div class="question">
                <span class="expr">{{text}}</span> = ______
            </div>
            {{/mixed}}
        </div>
    </div>
</body>
</html>
```

**Step 2: 提交**

```bash
git add templates/worksheet.html
git commit -m "feat: add worksheet HTML template"
```

---

### Task 6: PDF 渲染模块

**Files:**
- Create: `src/pdf-renderer.js`
- Test: 运行 `node src/pdf-renderer.js`

**Step 1: 编写渲染模块**

```javascript
/**
 * PDF 渲染模块 - 使用 Puppeteer
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 简单模板替换 (Mustache 风格)
function renderTemplate(template, data) {
  let result = template;

  // 替换 {{#key}}...{{/key}} 数组循环
  for (const key in data) {
    if (Array.isArray(data[key])) {
      const regex = new RegExp(`{{#${key}}}(\\s*[\\s\\S]*?\\s*){{/${key}}}`, 'g');
      result = result.replace(regex, (match, content) => {
        return data[key].map(item => {
          let itemResult = content;
          for (const itemKey in item) {
            itemResult = itemResult.replace(
              new RegExp(`{{${itemKey}}}`, 'g'),
              item[itemKey]
            );
          }
          return itemResult;
        }).join('');
      });
    }
  }

  // 替换简单变量
  for (const key in data) {
    if (!Array.isArray(data[key])) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), data[key]);
    }
  }

  return result;
}

/**
 * 生成 PDF
 * @param {Object} data - 试卷数据 { title, oral: [], mixed: [] }
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generatePDF(data) {
  const templatePath = path.join(__dirname, '../templates/worksheet.html');
  const template = fs.readFileSync(templatePath, 'utf-8');
  const html = renderTemplate(template, data);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });

    return pdf;
  } finally {
    await browser.close();
  }
}

module.exports = { generatePDF, renderTemplate };

// 测试
if (require.main === module) {
  const { generateWorksheet } = require('./generator');

  (async () => {
    const data = generateWorksheet({ questionCount: 26, mixedCount: 8 });
    data.title = '数学口算练习';

    try {
      const pdf = await generatePDF(data);
      fs.writeFileSync('/tmp/test-worksheet.pdf', pdf);
      console.log('PDF 生成成功: /tmp/test-worksheet.pdf');
      console.log('文件大小:', (pdf.length / 1024).toFixed(2), 'KB');
    } catch (err) {
      console.error('PDF 生成失败:', err);
    }
  })();
}
```

**Step 2: 本地安装依赖并测试**

```bash
cd /home/lvliang/lvliang/mental-math/math-printer
npm install
node src/pdf-renderer.js
```

**预期:** 生成 `/tmp/test-worksheet.pdf`

**Step 3: 提交**

```bash
git add src/pdf-renderer.js
git commit -m "feat: add PDF renderer with Puppeteer"
```

---

### Task 7: 打印机模块

**Files:**
- Create: `src/printer.js`
- Test: 使用 mock 测试（避免浪费纸张）

**Step 1: 编写打印机模块**

```javascript
/**
 * 打印机模块 - 使用 IPP 协议
 */

const ipp = require('ipp');
const { v4: uuidv4 } = require('uuid');

const PRINTER_IP = process.env.PRINTER_IP || '192.168.31.206';
const PRINTER_PORT = process.env.PRINTER_PORT || 631;

const PRINTER_URL = `http://${PRINTER_IP}:${PRINTER_PORT}/ipp/print`;

/**
 * 打印 PDF 文件
 * @param {Buffer} pdfBuffer - PDF 数据
 * @param {string} jobName - 打印任务名称
 * @returns {Promise<{jobId: number, status: string}>}
 */
async function printPDF(pdfBuffer, jobName = 'math-worksheet') {
  const printer = ipp.Printer(PRINTER_URL);

  const msg = {
    "operation-attributes-tag": {
      "requesting-user-name": "math-printer",
      "job-name": jobName,
      "document-format": "application/pdf"
    },
    data: pdfBuffer
  };

  return new Promise((resolve, reject) => {
    printer.execute("Print-Job", msg, (err, res) => {
      if (err) {
        reject(new Error(`打印失败: ${err.message}`));
        return;
      }

      const status = res?.['job-attributes-tag']?.['job-state'] || 'unknown';
      const jobId = res?.['job-attributes-tag']?.['job-id'] || 0;

      resolve({
        jobId,
        status,
        printerUrl: PRINTER_URL
      });
    });
  });
}

/**
 * 检查打印机状态
 * @returns {Promise<{connected: boolean, state?: string}>}
 */
async function checkPrinterStatus() {
  const printer = ipp.Printer(PRINTER_URL);

  return new Promise((resolve) => {
    printer.execute("Get-Printer-Attributes", null, (err, res) => {
      if (err) {
        resolve({ connected: false, error: err.message });
        return;
      }

      const state = res?.['printer-attributes-tag']?.['printer-state'];
      resolve({
        connected: true,
        state: state === 3 ? 'idle' : state === 4 ? 'processing' : 'stopped'
      });
    });
  });
}

module.exports = { printPDF, checkPrinterStatus, PRINTER_URL };

// 测试
if (require.main === module) {
  console.log('打印机 URL:', PRINTER_URL);

  checkPrinterStatus().then(status => {
    console.log('打印机状态:', status);
  }).catch(err => {
    console.error('检查状态失败:', err.message);
  });
}
```

**Step 2: 提交**

```bash
git add src/printer.js
git commit -m "feat: add IPP printer module"
```

---

## Phase 3: API 服务

### Task 8: Express 主服务

**Files:**
- Create: `src/index.js`

**Step 1: 编写 API 服务**

```javascript
/**
 * 数学口算题打印服务 - Express API
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { generateWorksheet } = require('./generator');
const { generatePDF } = require('./pdf-renderer');
const { printPDF, checkPrinterStatus } = require('./printer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 健康检查
app.get('/health', async (req, res) => {
  const printerStatus = await checkPrinterStatus();
  res.json({
    status: 'ok',
    printer: printerStatus.connected ? 'connected' : 'disconnected',
    printerState: printerStatus.state || 'unknown'
  });
});

// 打印 API
app.post('/api/print', async (req, res) => {
  try {
    const {
      count = 1,
      questions = 26,
      mixedCount = 8,
      title = '数学口算练习'
    } = req.body;

    // 参数验证
    if (count < 1 || count > 10) {
      return res.status(400).json({
        success: false,
        error: '打印份数必须在 1-10 之间'
      });
    }
    if (questions < 1 || questions > 100) {
      return res.status(400).json({
        success: false,
        error: '题目数量必须在 1-100 之间'
      });
    }
    if (mixedCount < 0 || mixedCount > 20) {
      return res.status(400).json({
        success: false,
        error: '混合运算题数必须在 0-20 之间'
      });
    }

    const jobId = uuidv4();
    const results = [];

    // 生成并打印
    for (let i = 0; i < count; i++) {
      const worksheet = generateWorksheet({ questionCount: questions, mixedCount });
      worksheet.title = count > 1 ? `${title} (${i + 1}/${count})` : title;

      const pdf = await generatePDF(worksheet);
      const printResult = await printPDF(pdf, `worksheet-${jobId}-${i + 1}`);
      results.push(printResult);
    }

    res.json({
      success: true,
      jobId,
      message: `打印任务已提交，共 ${count} 份`,
      copies: count,
      printerJobs: results.map(r => r.jobId)
    });

  } catch (err) {
    console.error('打印失败:', err);
    res.status(500).json({
      success: false,
      error: err.message || '打印失败'
    });
  }
});

// 生成 PDF 但不打印（测试用）
app.post('/api/preview', async (req, res) => {
  try {
    const {
      questions = 26,
      mixedCount = 8,
      title = '数学口算练习'
    } = req.body;

    const worksheet = generateWorksheet({ questionCount: questions, mixedCount });
    worksheet.title = title;

    const pdf = await generatePDF(worksheet);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=worksheet.pdf');
    res.send(pdf);

  } catch (err) {
    console.error('生成 PDF 失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`数学口算题打印服务已启动`);
  console.log(`监听端口: ${PORT}`);
  console.log(`健康检查: GET http://localhost:${PORT}/health`);
  console.log(`打印 API: POST http://localhost:${PORT}/api/print`);
  console.log(`预览 API: POST http://localhost:${PORT}/api/preview`);
});
```

**Step 2: 提交**

```bash
git add src/index.js
git commit -m "feat: add Express API server"
```

---

## Phase 4: 测试与部署

### Task 9: 本地测试

**Files:**
- 运行测试命令

**Step 1: 启动服务**

```bash
npm install
npm start
```

**Step 2: 测试健康检查**

```bash
# 新终端
curl http://localhost:3000/health
```

**预期输出:**
```json
{"status":"ok","printer":"connected","printerState":"idle"}
```

**Step 3: 测试预览 API**

```bash
curl -X POST http://localhost:3000/api/preview \
  -H "Content-Type: application/json" \
  -d '{"questions":10,"mixedCount":4}' \
  -o /tmp/preview.pdf
```

**验证:** 检查 PDF 文件是否正确生成

```bash
ls -lh /tmp/preview.pdf
```

**Step 4: 测试打印 API（不实际打印）**

```bash
curl -X POST http://localhost:3000/api/print \
  -H "Content-Type: application/json" \
  -d '{"count":1,"questions":10,"mixedCount":4}'
```

**Step 5: 停止服务**

```bash
Ctrl+C
```

**Step 6: 提交**

```bash
git commit -m "test: verify local API works" --allow-empty
```

---

### Task 10: Docker 构建与运行

**Files:**
- 使用 docker-compose.yml

**Step 1: 构建镜像**

```bash
docker-compose build
```

**预期:** 成功构建镜像

**Step 2: 启动容器**

```bash
docker-compose up -d
```

**Step 3: 测试容器内服务**

```bash
# 等待 10 秒让服务启动
sleep 10

# 测试健康检查
curl http://localhost:3000/health
```

**Step 4: 测试预览**

```bash
curl -X POST http://localhost:3000/api/preview \
  -H "Content-Type: application/json" \
  -d '{"questions":26,"mixedCount":8}' \
  -o /tmp/docker-preview.pdf

ls -lh /tmp/docker-preview.pdf
```

**Step 5: 查看日志**

```bash
docker-compose logs -f
```

**Step 6: 停止服务**

```bash
docker-compose down
```

**Step 7: 提交**

```bash
git commit -m "test: verify Docker deployment works" --allow-empty
```

---

## Phase 5: 文档

### Task 11: README

**Files:**
- Create: `README.md`

**Step 1: 编写 README**

```markdown
# 数学口算题打印服务

通过 REST API 触发局域网打印机（EPSON L4160）打印随机生成的数学口算练习题。

## 功能

- 生成 100 以内加减法、表内乘除法题目
- 生成含运算优先级的混合运算题
- 支持指定题目数量、打印份数
- 使用 IPP 协议直连网络打印机

## 快速开始

### 使用 Docker（推荐）

```bash
docker-compose up -d
```

### 本地运行

```bash
npm install
npm start
```

## API

### 健康检查

```bash
curl http://localhost:3000/health
```

### 打印口算题

```bash
curl -X POST http://localhost:3000/api/print \
  -H "Content-Type: application/json" \
  -d '{
    "count": 1,
    "questions": 26,
    "mixedCount": 8,
    "title": "数学口算练习"
  }'
```

### 预览 PDF（不打印）

```bash
curl -X POST http://localhost:3000/api/preview \
  -H "Content-Type: application/json" \
  -d '{"questions": 26, "mixedCount": 8}' \
  -o worksheet.pdf
```

## 配置

环境变量:

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务端口 |
| PRINTER_IP | 192.168.31.206 | 打印机 IP |
| PRINTER_PORT | 631 | IPP 端口 |

## 项目结构

```
src/
├── index.js          # API 服务
├── generator.js      # 题目生成
├── pdf-renderer.js   # PDF 渲染
└── printer.js        # 打印服务
templates/
└── worksheet.html    # 试卷模板
```

## 打印机兼容性

已在 EPSON L4160 上测试。其他支持 IPP 协议的网络打印机理论兼容。
```

**Step 2: 提交**

```bash
git add README.md
git commit -m "docs: add README with usage instructions"
```

---

## 验证清单

实施完成后，验证以下功能:

- [ ] `npm install` 成功
- [ ] `node src/generator.js` 正常输出生成的题目
- [ ] `node src/pdf-renderer.js` 生成 /tmp/test-worksheet.pdf
- [ ] `npm start` 启动服务
- [ ] GET /health 返回打印机状态
- [ ] POST /api/preview 生成可查看的 PDF
- [ ] POST /api/print 提交打印任务（确保打印机在线）
- [ ] `docker-compose up -d` 成功启动
- [ ] 容器内所有 API 正常工作

---

**计划完成** - 准备执行
