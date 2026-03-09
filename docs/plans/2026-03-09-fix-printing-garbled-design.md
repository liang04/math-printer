# 修复 EPSON L4160 打印乱码问题设计文档

## 问题背景

当前 `math-printer` 服务直接使用 Node.js `net.Socket` 将 PDF 原始数据发送到打印机 9100 端口，导致 EPSON L4160 输出乱码。

**根本原因**：EPSON L4160 使用 ESC/P-R 打印机语言，不支持直接接收 PDF 数据。需要通过 CUPS + ESC/P-R 驱动将 PDF 转换为打印机可识别的格式。

参考 `my-printer` 项目的成功经验（详见 `/home/lvliang/lvliang/my-printer/docs/fix-epson-l4160-printing.md`）。

## 目标

将打印方式从"直接 socket 发送 PDF"改为"CUPS + ESC/P-R 驱动打印"，解决乱码问题。

## 架构变更

### 当前架构（有问题）

```
Node.js -> net.Socket -> RAW PDF -> EPSON L4160 (乱码)
```

### 新架构（修复后）

```
Node.js -> lp command -> CUPS -> ESC/P-R 驱动 -> socket 9100 -> EPSON L4160
```

## 技术方案

### 1. 基础镜像变更

从 `node:20-slim` (Debian) 改为 `alpine:latest` + 手动安装 Node.js

**原因**：Alpine Linux 有现成的 `epson-inkjet-printer-escpr` 包

### 2. Dockerfile 修改

- 安装 CUPS 服务及相关工具
- 安装 ESC/P-R 驱动
- 配置启动脚本

### 3. printer.js 重构

- 移除直接 socket 写入逻辑
- 改为调用 `lp` 命令提交打印任务
- 在启动时通过 `lpadmin` 注册打印机

### 4. 网络配置

- Docker Compose 使用 `network_mode: host`
- 支持直接访问局域网打印机

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `Dockerfile` | 重写 | Alpine 基础，安装 CUPS + ESC/P-R |
| `src/printer.js` | 重写 | 使用 lp 命令替代 socket |
| `docker-compose.yml` | 修改 | 添加 host 网络模式 |
| `entrypoint.sh` | 新增 | 启动 CUPS 和打印机注册 |

## 配置参数

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PRINTER_IP` | `192.168.31.206` | 打印机 IP |
| `PRINTER_RAW_PORT` | `9100` | JetDirect 端口 |

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Alpine Node.js 版本差异 | 低 | 安装 Node.js 18 LTS |
| CUPS 启动延迟 | 低 | entrypoint.sh 添加等待逻辑 |
| PPD 文件路径变化 | 低 | 使用通配查找或检查路径 |

## 验证方式

1. 构建并启动服务
2. 调用 `/api/print` 接口
3. 检查打印机输出是否为正常口算题内容（非乱码）

## 参考文档

- [EPSON L4160 打印修复报告](/home/lvliang/lvliang/my-printer/docs/fix-epson-l4160-printing.md)

---

**设计日期**: 2026-03-09
**状态**: 已确认，等待实施
