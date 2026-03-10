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
      level = 5,
      title = '数学口算练习'
    } = req.body;

    // 参数验证
    if (count < 1 || count > 10) {
      return res.status(400).json({
        success: false,
        error: '打印份数必须在 1-10 之间'
      });
    }
    if (level < 1 || level > 18) {
      return res.status(400).json({
        success: false,
        error: '难度等级必须在 1-18 之间'
      });
    }

    const jobId = uuidv4();
    const results = [];

    // 生成并打印
    for (let i = 0; i < count; i++) {
      const worksheet = generateWorksheet({ level });
      worksheet.title = count > 1 ? `${title} (${i + 1}/${count})` : title;

      const pdf = await generatePDF(worksheet);
      const printResult = await printPDF(pdf, `worksheet-${jobId}-${i + 1}`);
      results.push(printResult);
    }

    // 计算题目数量用于返回信息
    const mixedCount = (level - 1) * 2;
    const oralCount = 34 - mixedCount;

    res.json({
      success: true,
      jobId,
      message: `打印任务已提交，共 ${count} 份`,
      copies: count,
      level,
      oralCount,
      mixedCount,
      totalCount: 34,
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
      level = 5,
      title = '数学口算练习'
    } = req.body;

    if (level < 1 || level > 18) {
      return res.status(400).json({
        success: false,
        error: '难度等级必须在 1-18 之间'
      });
    }

    const worksheet = generateWorksheet({ level });
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
