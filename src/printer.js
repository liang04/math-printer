/**
 * 打印机模块 - 使用 IPP 协议
 */

const ipp = require('ipp');

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
