/**
 * 打印机模块 - 使用 RAW (JetDirect) 协议
 * EPSON L4160 使用 9100 端口
 */

const net = require('net');

const PRINTER_IP = process.env.PRINTER_IP || '192.168.31.206';
const PRINTER_PORT = process.env.PRINTER_RAW_PORT || 9100;

const PRINTER_URL = `tcp://${PRINTER_IP}:${PRINTER_PORT}`;

/**
 * 打印 PDF 文件 (RAW 方式)
 * @param {Buffer} pdfBuffer - PDF 数据
 * @param {string} jobName - 打印任务名称
 * @returns {Promise<{jobId: number, status: string}>}
 */
async function printPDF(pdfBuffer, jobName = 'math-worksheet') {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let timeout;

    // 设置超时
    timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('打印超时'));
    }, 30000);

    socket.on('connect', () => {
      console.log(`已连接到打印机: ${PRINTER_IP}:${PRINTER_PORT}`);
      // 发送 PDF 数据
      socket.write(pdfBuffer, (err) => {
        if (err) {
          clearTimeout(timeout);
          socket.destroy();
          reject(new Error(`发送数据失败: ${err.message}`));
          return;
        }
        // 结束连接
        socket.end();
      });
    });

    socket.on('close', (hadError) => {
      clearTimeout(timeout);
      if (!hadError) {
        resolve({
          jobId: Date.now(),
          status: 'sent',
          printerUrl: PRINTER_URL
        });
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`打印失败: ${err.message}`));
    });

    // 连接打印机
    socket.connect(PRINTER_PORT, PRINTER_IP);
  });
}

/**
 * 检查打印机状态
 * @returns {Promise<{connected: boolean, state?: string}>}
 */
async function checkPrinterStatus() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let timeout;

    timeout = setTimeout(() => {
      socket.destroy();
      resolve({ connected: false, error: '连接超时' });
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({
        connected: true,
        state: 'idle'
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        connected: false,
        error: err.message
      });
    });

    socket.connect(PRINTER_PORT, PRINTER_IP);
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
