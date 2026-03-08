/**
 * PDF 渲染模块 - 使用 Puppeteer
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 简单模板替换 (Mustache 风格)
function renderTemplate(template, data) {
  let result = template;

  // 替换 {{#key}}...{{/key}} 数组循环
  for (const key in data) {
    if (Array.isArray(data[key])) {
      const regex = new RegExp(`{{#${key}}}(\\s*[\\s\\S]*?\\s*){{/${key}}}`, 'g');
      result = result.replace(regex, (match, content) => {
        return data[key].map(item => {
          let itemResult = content;
          for (const itemKey in item) {
            itemResult = itemResult.replace(
              new RegExp(`{{${itemKey}}}`, 'g'),
              item[itemKey]
            );
          }
          return itemResult;
        }).join('');
      });
    }
  }

  // 替换简单变量
  for (const key in data) {
    if (!Array.isArray(data[key])) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), data[key]);
    }
  }

  return result;
}

/**
 * 生成 PDF
 * @param {Object} data - 试卷数据 { title, oral: [], mixed: [] }
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generatePDF(data) {
  const templatePath = path.join(__dirname, '../templates/worksheet.html');
  const template = fs.readFileSync(templatePath, 'utf-8');
  const html = renderTemplate(template, data);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });

    return pdf;
  } finally {
    await browser.close();
  }
}

module.exports = { generatePDF, renderTemplate };

// 测试
if (require.main === module) {
  const { generateWorksheet } = require('./generator');

  (async () => {
    const data = generateWorksheet({ questionCount: 26, mixedCount: 8 });
    data.title = '数学口算练习';

    try {
      const pdf = await generatePDF(data);
      fs.writeFileSync('/tmp/test-worksheet.pdf', pdf);
      console.log('PDF 生成成功: /tmp/test-worksheet.pdf');
      console.log('文件大小:', (pdf.length / 1024).toFixed(2), 'KB');
    } catch (err) {
      console.error('PDF 生成失败:', err);
    }
  })();
}
