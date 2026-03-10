# 数学口算题打印服务

通过 REST API 触发局域网打印机（EPSON L4160）打印随机生成的数学口算练习题。

## 功能

- 生成 100 以内加减法、表内乘除法题目
- 生成含运算优先级的混合运算题
- 支持难度等级（level 1-18），总题数固定 34 道
- 使用 CUPS + ESC/P-R 驱动打印到 EPSON 打印机

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
    "level": 5,
    "title": "数学口算练习"
  }'
```

**参数说明**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `level` | number | 5 | 难度等级 (1-18)，每级增加 2 道混合运算 |
| `title` | string | "数学口算练习" | 试卷标题 |

**难度等级**

| Level | 简单算式 | 混合运算 | 总计 |
|-------|----------|----------|------|
| 1 | 34 | 0 | 34 |
| 2 | 32 | 2 | 34 |
| 3 | 30 | 4 | 34 |
| ... | ... | ... | 34 |
| 18 | 0 | 34 | 34 |

### 预览 PDF（不打印）

```bash
curl -X POST http://localhost:3000/api/preview \
  -H "Content-Type: application/json" \
  -d '{"level": 5}' \
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

已在 EPSON L4160 上测试。使用 CUPS + ESC/P-R 驱动通过 RAW (JetDirect) 协议打印（端口 9100）。

### 已解决问题

- **打印乱码**: 使用 CUPS + ESC/P-R 驱动替代直接 socket 发送
- **中文显示**: 安装 Noto CJK 中文字体

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
