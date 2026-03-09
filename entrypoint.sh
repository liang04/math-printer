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
