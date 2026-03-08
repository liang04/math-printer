# 数学口算题打印服务

通过 REST API 触发局域网打印机（EPSON L4160）打印随机生成的数学口算练习题。

## 功能

- 生成 100 以内加减法、表内乘除法题目
- 生成含运算优先级的混合运算题
- 支持指定题目数量、打印份数
- 使用 RAW (JetDirect) 协议直连网络打印机

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

环境变量（可通过 .env 文件设置）:

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务端口 |
| PRINTER_IP | 192.168.31.206 | 打印机 IP |
| PRINTER_RAW_PORT | 9100 | RAW (JetDirect) 端口 |

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

已在 EPSON L4160 上测试。该打印机使用 RAW (JetDirect) 协议（端口 9100）。其他支持 RAW 协议的网络打印机理论兼容。

## 开发

### 安装依赖

```bash
npm install
```

### 本地测试

```bash
npm start
curl http://localhost:3000/health
```

### Docker 构建

```bash
docker-compose build
docker-compose up -d
```
