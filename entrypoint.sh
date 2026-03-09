#!/bin/sh

# 清理之前的 CUPS 状态
rm -f /run/cups/cupsd.pid /var/run/cups/cupsd.pid 2>/dev/null

# 创建 CUPS 需要的目录
mkdir -p /run/cups /var/run/cups /var/spool/cups/tmp /var/cache/cups

# 配置 CUPS（在启动前配置）
# 注意：CUPS 不允许使用 root 用户运行，使用默认的 lp 用户
cat > /etc/cups/cups-files.conf << 'EOF'
SystemGroup root lpadmin
User lp
Group lp
EOF

# 确保 lp 用户存在
adduser -S -D -H lp 2>/dev/null || true
addgroup lp lpadmin 2>/dev/null || true

# 备份原配置并创建新配置
if [ -f /etc/cups/cupsd.conf ]; then
    cp /etc/cups/cupsd.conf /etc/cups/cupsd.conf.bak 2>/dev/null || true
fi

cat > /etc/cups/cupsd.conf << 'EOF'
LogLevel warn
Listen *:631
<Location />
  Order allow,deny
  Allow all
</Location>
<Location /admin>
  Order allow,deny
  Allow all
</Location>
EOF

# 启动 CUPS 服务（后台模式）
/usr/sbin/cupsd

# 等待 CUPS 完全启动
for i in 1 2 3 4 5 6 7 8 9 10; do
    if lpstat -r 2>/dev/null | grep -q "scheduler is running"; then
        echo "CUPS 已启动"
        break
    fi
    echo "等待 CUPS 启动... ($i)"
    sleep 2
done

# 配置打印机
PRINTER_IP=${PRINTER_IP:-192.168.31.206}
PRINTER_RAW_PORT=${PRINTER_RAW_PORT:-9100}
PRINTER_URI="socket://${PRINTER_IP}:${PRINTER_RAW_PORT}"
PRINTER_NAME=${PRINTER_NAME:-epson_l4160}

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

# 等待 CUPS 完全就绪
sleep 2

# 删除已存在的打印机
lpadmin -x "$PRINTER_NAME" 2>/dev/null || true

# 添加打印机
if [ -f "$PPD_PATH" ]; then
    echo "正在添加打印机使用 PPD: $PPD_PATH"
    lpadmin -p "$PRINTER_NAME" -v "$PRINTER_URI" -E -P "$PPD_PATH" 2>&1 || {
        echo "警告: 使用 PPD 添加打印机失败，尝试不使用 PPD..."
        lpadmin -p "$PRINTER_NAME" -v "$PRINTER_URI" -E 2>&1
    }
else
    echo "未找到 PPD 文件，使用 raw 模式添加打印机"
    lpadmin -p "$PRINTER_NAME" -v "$PRINTER_URI" -E 2>&1
fi

# 启用打印机
cupsenable "$PRINTER_NAME" 2>/dev/null || true
cupsaccept "$PRINTER_NAME" 2>/dev/null || true

# 检查打印机状态
echo "打印机状态:"
lpstat -p "$PRINTER_NAME" 2>&1 || echo "打印机配置可能有问题"

# 启动 Node.js 应用
echo "启动应用..."
exec node src/index.js
