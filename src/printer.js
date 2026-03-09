/**
 * 打印机模块 - 使用 CUPS lp 命令
 * EPSON L4160 使用 ESC/P-R 驱动
 */

const { execFile } = require('child_process');
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
 * 执行命令（Promise 包装，使用 execFile 避免命令注入）
 * @param {string} file - 可执行文件
 * @param {string[]} args - 参数数组
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function execFilePromise(file, args) {
    return new Promise((resolve, reject) => {
        execFile(file, args, { timeout: 30000 }, (error, stdout, stderr) => {
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
        // 使用 lp 命令提交打印任务（使用 execFile 避免命令注入）
        // CUPS + ESC/P-R 驱动会自动将 PDF 转换为打印机语言
        const args = ['-d', PRINTER_NAME, '-t', jobName, tempPath];

        console.log(`提交打印任务: lp ${args.join(' ')}`);
        const { stdout } = await execFilePromise('lp', args);

        // 解析 job ID
        const match = stdout.match(/request id is (\S+)/);
        const jobId = match ? match[1] : `job-${Date.now()}`;

        console.log(`打印任务已提交: ${jobId}`);

        // 异步删除临时文件（给 CUPS 一点时间处理）
        setTimeout(() => {
            fs.unlink(tempPath).catch((err) => {
                console.warn(`清理临时文件失败: ${tempPath}`, err.message);
            });
        }, 60000);

        return {
            jobId,
            status: 'pending',
            printer: PRINTER_NAME
        };
    } catch (err) {
        // 清理临时文件
        fs.unlink(tempPath).catch((err) => {
            console.warn(`清理临时文件失败: ${tempPath}`, err.message);
        });
        throw err;
    }
}

/**
 * 检查打印机状态
 * @returns {Promise<{connected: boolean, state?: string}>}
 */
async function checkPrinterStatus() {
    try {
        const { stdout } = await execFilePromise('lpstat', ['-p', PRINTER_NAME]);

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
