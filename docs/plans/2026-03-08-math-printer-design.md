# 数学口算题打印服务设计文档

## 项目概述

将现有的 math.html 口算题生成器改造为 Web 服务，提供 API 供外部系统调用，通过局域网打印机（EPSON L4160）打印随机生成的口算练习题。

## 需求背景

- **现有功能**：静态 HTML 页面，可生成 100 以内加减法、表内乘除法、混合运算题目
- **目标**：提供 REST API，支持远程触发打印
- **部署环境**：Debian 13，Docker 容器化部署
- **打印机**：EPSON L4160，IP 192.168.31.206，支持 IPP 协议

## 架构设计

```
┌─────────────┐     HTTP API      ┌──────────────┐     IPP Protocol   ┌─────────────┐
│  调用方系统  │ ─────────────────> │  Node.js     │ ─────────────────> │  EPSON      │
│ (任意客户端) │  POST /api/print   │  Web 服务    │   发送 PDF 打印    │  L4160      │
│             │                    │  (Docker)    │                    │192.168.31.206│
└─────────────┘                    └──────────────┘                    └─────────────┘
                                         │
                                         │ Puppeteer
                                         ▼
                                   ┌──────────────┐
                                   │  PDF 生成    │
                                   │  (模板渲染)  │
                                   └──────────────┘
```

## 技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| Web 框架 | Express | 轻量、成熟、生态丰富 |
| PDF 生成 | Puppeteer | 复用现有 HTML 模板，样式一致 |
| 打印协议 | IPP | EPSON L4160 原生支持，无需 CUPS |
| 部署 | Docker Compose | 单容器部署，简单可移植 |

## API 设计

### 打印口算题

```http
POST /api/print
Content-Type: application/json
```

请求参数：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| count | number | 否 | 1 | 打印份数 |
| questions | number | 否 | 26 | 口算题数量 |
| mixedCount | number | 否 | 8 | 混合运算题数量 |
| title | string | 否 | "数学口算练习" | 试卷标题 |

请求示例：

```json
{
  "count": 2,
  "questions": 26,
  "mixedCount": 8,
  "title": "数学口算练习"
}
```

响应示例：

```json
{
  "success": true,
  "jobId": "print-550e8400-e29b-41d4-a716-446655440000",
  "message": "打印任务已提交"
}
```

### 健康检查

```http
GET /health
```

响应：

```json
{
  "status": "ok",
  "printer": "connected"
}
```

## 项目结构

```
math-printer/
├── Dockerfile                 # 容器构建配置
├── docker-compose.yml         # Docker Compose 配置
├── package.json               # Node.js 依赖
├── src/
│   ├── index.js              # Express 服务入口
│   ├── generator.js          # 题目生成逻辑
│   ├── pdf-renderer.js       # Puppeteer PDF 生成
│   └── printer.js            # IPP 打印服务
├── templates/
│   └── worksheet.html        # 打印模板
└── docs/
    └── plans/
        └── 2026-03-08-math-printer-design.md  # 本设计文档
```

## 部署配置

### Docker Compose

```yaml
version: '3.8'
services:
  math-printer:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PRINTER_IP=192.168.31.206
      - PRINTER_PORT=631
      - NODE_ENV=production
    restart: unless-stopped
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务监听端口 |
| PRINTER_IP | 192.168.31.206 | 打印机 IP 地址 |
| PRINTER_PORT | 631 | IPP 端口 |

## 题目类型

### 1. 加法（100 以内）
- 两个两位数相加，结果不超过 100

### 2. 减法（100 以内）
- 被减数大于减数，结果为正数

### 3. 乘法（表内）
- 1-9 的乘法表

### 4. 除法（表内）
- 整除，商为 1-9

### 5. 混合运算（含优先级）
- 乘法 + 加法: `a × b + c`
- 乘法 - 减法: `a × b - c`
- 除法 + 加法: `a ÷ b + c`
- 除法 - 减法: `a ÷ b - c`
- 复合运算: `a × b + c ÷ d`
- 复合运算: `a ÷ b + c × d`

## 安全考虑

1. **无认证设计**：局域网内部使用，暂不实现认证（如有需要可后续添加）
2. **输入验证**：限制打印份数（max 10）、题目数量（max 100）
3. **错误处理**：打印失败时返回明确错误信息

## 后续扩展

- 添加更多题目类型（分数、小数等）
- 支持 PDF 下载接口（不打印只生成）
- 添加打印历史记录
- Web 管理界面

---

**设计日期**: 2026-03-08
**状态**: 已确认，等待实施
