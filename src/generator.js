/**
 * 数学口算题生成器
 * 从 math.html 迁移
 */

// 随机打乱数组 (Fisher-Yates Shuffle)
function shuffle(array) {
  const arr = [...array];
  let currentIndex = arr.length;
  let randomIndex;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [arr[currentIndex], arr[randomIndex]] = [arr[randomIndex], arr[currentIndex]];
  }
  return arr;
}

// 生成加法题 (100以内)
function generateAddition() {
  const a = Math.floor(Math.random() * 80) + 10;
  const b = Math.floor(Math.random() * (90 - a)) + 10;
  return { text: `${a} + ${b}`, answer: a + b };
}

// 生成减法题 (100以内，结果为正)
function generateSubtraction() {
  const a = Math.floor(Math.random() * 80) + 20;
  const b = Math.floor(Math.random() * (a - 10)) + 10;
  return { text: `${a} - ${b}`, answer: a - b };
}

// 生成乘法题 (表内)
function generateMultiplication() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { text: `${a} × ${b}`, answer: a * b };
}

// 生成除法题 (表内，整除)
function generateDivision() {
  const divisor = Math.floor(Math.random() * 9) + 1;
  const quotient = Math.floor(Math.random() * 9) + 1;
  const dividend = divisor * quotient;
  return { text: `${dividend} ÷ ${divisor}`, answer: quotient };
}

// 生成混合运算题
function generateMixed() {
  const generators = [
    // 乘法 + 加法: a × b + c
    () => {
      const a = Math.floor(Math.random() * 9) + 1;
      const b = Math.floor(Math.random() * 9) + 1;
      const c = Math.floor(Math.random() * 40) + 10;
      return { text: `${a} × ${b} + ${c}`, answer: a * b + c };
    },
    // 乘法 - 减法: a × b - c (结果为正)
    () => {
      const a = Math.floor(Math.random() * 6) + 4;
      const b = Math.floor(Math.random() * 6) + 4;
      const product = a * b;
      const c = Math.floor(Math.random() * (product - 1)) + 1;
      return { text: `${a} × ${b} - ${c}`, answer: product - c };
    },
    // 除法 + 加法: a ÷ b + c
    () => {
      const b = Math.floor(Math.random() * 8) + 2;
      const quotient = Math.floor(Math.random() * 9) + 1;
      const a = b * quotient;
      const c = Math.floor(Math.random() * 40) + 10;
      return { text: `${a} ÷ ${b} + ${c}`, answer: quotient + c };
    },
    // 除法 - 减法: a ÷ b - c (结果为正)
    () => {
      const b = Math.floor(Math.random() * 8) + 2;
      const quotient = Math.floor(Math.random() * 7) + 3;
      const a = b * quotient;
      const c = Math.floor(Math.random() * (quotient - 1)) + 1;
      return { text: `${a} ÷ ${b} - ${c}`, answer: quotient - c };
    },
    // a × b + c ÷ d
    () => {
      const a = Math.floor(Math.random() * 9) + 1;
      const b = Math.floor(Math.random() * 9) + 1;
      const d = Math.floor(Math.random() * 8) + 2;
      const quotient = Math.floor(Math.random() * 9) + 1;
      const c = d * quotient;
      return { text: `${a} × ${b} + ${c} ÷ ${d}`, answer: a * b + quotient };
    },
    // a ÷ b + c × d
    () => {
      const b = Math.floor(Math.random() * 8) + 2;
      const quotient = Math.floor(Math.random() * 9) + 1;
      const a = b * quotient;
      const c = Math.floor(Math.random() * 9) + 1;
      const d = Math.floor(Math.random() * 9) + 1;
      return { text: `${a} ÷ ${b} + ${c} × ${d}`, answer: quotient + c * d };
    }
  ];

  const gen = generators[Math.floor(Math.random() * generators.length)];
  return gen();
}

/**
 * 生成完整试卷
 * @param {Object} options
 * @param {number} options.questionCount - 口算题数量 (默认 26)
 * @param {number} options.mixedCount - 混合运算题数量 (默认 8)
 * @returns {Object} { oral: [], mixed: [] }
 */
function generateWorksheet(options = {}) {
  const questionCount = options.questionCount || 26;
  const mixedCount = options.mixedCount || 8;

  const oral = [];

  // 分配口算题: 12 加法, 12 减法, 1 乘法, 1 除法
  const additionCount = Math.min(12, Math.floor(questionCount * 0.46));
  const subtractionCount = Math.min(12, Math.floor(questionCount * 0.46));
  const multiplicationCount = 1;
  const divisionCount = 1;

  for (let i = 0; i < additionCount; i++) {
    oral.push(generateAddition());
  }
  for (let i = 0; i < subtractionCount; i++) {
    oral.push(generateSubtraction());
  }
  for (let i = 0; i < multiplicationCount; i++) {
    oral.push(generateMultiplication());
  }
  for (let i = 0; i < divisionCount; i++) {
    oral.push(generateDivision());
  }

  const mixed = [];
  for (let i = 0; i < mixedCount; i++) {
    mixed.push(generateMixed());
  }

  return {
    oral: shuffle(oral),
    mixed: shuffle(mixed)
  };
}

module.exports = { generateWorksheet, shuffle };

// 手动测试
if (require.main === module) {
  const worksheet = generateWorksheet({ questionCount: 26, mixedCount: 8 });
  console.log('口算题 (26道):');
  worksheet.oral.forEach((q, i) => console.log(`${i + 1}. ${q.text} = ${q.answer}`));
  console.log('\n混合运算 (8道):');
  worksheet.mixed.forEach((q, i) => console.log(`${i + 1}. ${q.text} = ${q.answer}`));
}
