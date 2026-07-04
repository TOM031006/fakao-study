// import.js — 题库导入引擎（支持文本标记 + 真题原始格式识别 + PDF/Word）
window.FK = window.FK || {};

FK.importer = {

  // ===== 文本预处理 =====

  // 清洗 Word/PDF 提取后的脏文本
  cleanText(text) {
    if (!text) return '';
    let cleaned = text
      // 去除 HTML/XML 标签（如 mammoth 的书签 <a id="bookmark..."></a>）
      .replace(/<[^>]*>/g, '')
      // 去除 Word 的 OLE 对象标记
      .replace(/\[对象\]|\[object\]/gi, '')
      // 统一中文标点
      .replace(/：/g, '：')
      .replace(/,/g, '，')
      .replace(/;/g, '；')
      .replace(/\(/g, '（')
      .replace(/\)/g, '）')
      // 压缩连续空白（但保留换行）
      .replace(/[^\S\n]+/g, ' ')
      // 压缩多余空行
      .replace(/\n{3,}/g, '\n\n')
      // 去除行首行尾空白
      .split('\n').map(l => l.trim()).join('\n')
      .trim();

    return cleaned;
  },

  // ===== 方式一：标记格式导入 =====

  parseMarkup(text) {
    const cleaned = this.cleanText(text);
    const blocks = cleaned.split(/^---\s*$/m).filter(b => b.trim());
    const questions = [];
    const errors = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);

      if (lines.length < 3) {
        errors.push({ index: i, message: '内容过短，无法解析' });
        continue;
      }

      try {
        const question = this._parseMarkupBlock(lines);
        if (question) {
          questions.push(question);
        } else {
          errors.push({ index: i, message: '无法识别的题目格式' });
        }
      } catch (e) {
        errors.push({ index: i, message: `解析错误: ${e.message}` });
      }
    }

    return { questions, errors, totalBlocks: blocks.length };
  },

  _parseMarkupBlock(lines) {
    const meta = {};
    let contentStart = 0;

    // 提取元数据（格式："键：值" 或 "键: 值"）
    const metaKeys = ['类型', '科目', '知识点', '年份', '难度', '试卷', '来源', '分科目', '子科目'];
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const match = line.match(/^(.+?)[：:]\s*(.+)/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (metaKeys.includes(key) && value) {
          meta[key] = value;
          contentStart = j + 1;
          continue;
        }
      }
      // 遇到非元数据行，元数据区结束
      if (Object.keys(meta).length > 0 && !match) break;
    }

    return this._buildQuestion(meta, lines, contentStart);
  },

  // ===== 方式二：真题原始格式智能识别 =====

  // 识别真题中常见的格式（不需要手动加标记）
  parseRawExamText(text) {
    const cleaned = this.cleanText(text);
    const questions = [];
    const errors = [];

    // 策略：按题号分割（匹配 "1．"、"1."、"1、" 等真题题号格式）
    // 真题格式示例：
    //   1．关于依法治国，下列哪一认识是错误的？
    //   ① 选项A内容
    //   ② 选项B内容
    //   ③ 选项C内容
    //   ④ 选项D内容

    // 先尝试识别题目边界
    const questionBlocks = this._splitByQuestionNumber(cleaned);

    for (let i = 0; i < questionBlocks.length; i++) {
      try {
        const q = this._parseRawBlock(questionBlocks[i]);
        if (q) {
          questions.push(q);
        } else {
          errors.push({ index: i, message: '未能识别此题格式' });
        }
      } catch (e) {
        errors.push({ index: i, message: `识别错误: ${e.message}` });
      }
    }

    return { questions, errors, totalBlocks: questionBlocks.length };
  },

  // 按题号分割文本（识别 "1."、"1．"、"1、" 等开头）
  _splitByQuestionNumber(text) {
    // 匹配各种题号格式：数字 + "." / "．" / "、" / ")"
    const lines = text.split('\n');
    const blocks = [];
    let currentBlock = [];

    for (const line of lines) {
      // 检测题号开头：1-200 后跟分隔符
      const isQuestionStart = /^(\d{1,3})[.．、\)]\s*[^\d]/.test(line) &&
                              !/^[A-Ea-e][.．、\)]/.test(line) &&  // 不是选项
                              !line.match(/^(\d{1,3})[.．、\)]\s*[①②③④⑤⑥]/);  // 不是选项编号

      if (isQuestionStart && currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'));
    }

    // 过滤太短的块（可能不是题目）
    return blocks.filter(b => b.trim().length > 10);
  },

  _parseRawBlock(blockText) {
    const lines = blockText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return null;

    // 第一行 → 题干（去掉题号前缀）
    let stem = lines[0].replace(/^\d{1,3}[.．、\)]\s*/, '').trim();

    let options = [];
    let answer = [];
    let explanation = '';
    let inExplanation = false;
    let extraStem = [];

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j];

      // 检测选项（支持多种编号格式）
      // A. A．A、A) ① ② ③ ④
      const optMatch = line.match(/^([A-Ea-e])[.．、\)]\s*(.+)/);
      const circleOptMatch = line.match(/^([①②③④⑤⑥⑦⑧])[\s.．、]*(.+)/);

      if (optMatch) {
        options.push({ key: optMatch[1].toUpperCase(), text: optMatch[2].trim() });
        continue;
      } else if (circleOptMatch) {
        const circleMap = { '①':'A', '②':'B', '③':'C', '④':'D', '⑤':'E', '⑥':'F', '⑦':'G', '⑧':'H' };
        const key = circleMap[circleOptMatch[1]];
        if (key) {
          options.push({ key, text: circleOptMatch[2].trim() });
        }
        continue;
      }

      // 检测同一行多个选项: "A．xxx  B．xxx  C．xxx"
      const multiOptLine = line.match(/^([A-E])[.．、]\s*(.+?)\s{2,}([A-E])[.．、]\s*(.+)/);
      if (multiOptLine) {
        options.push({ key: multiOptLine[1], text: multiOptLine[2].trim() });
        options.push({ key: multiOptLine[3], text: multiOptLine[4].trim() });
        continue;
      }

      // 检测答案行
      if (/^【?答案】?[：:]\s*(.+)/.test(line)) {
        const ansStr = line.match(/^【?答案】?[：:]\s*(.+)/)[1];
        answer = FK.utils.parseAnswerString(ansStr);
        continue;
      }

      // 检测解析行
      if (/^【?解析】?[：:]/.test(line) || /^【?考点】?[：:]/.test(line) || /^【?详解】?[：:]/.test(line)) {
        inExplanation = true;
        const expMatch = line.match(/^【?(?:解析|考点|详解)】?[：:]\s*(.*)/);
        if (expMatch && expMatch[1]) {
          explanation = expMatch[1];
        }
        continue;
      }

      // 积累题干或解析
      if (inExplanation) {
        explanation += (explanation ? '\n' : '') + line;
      } else if (options.length === 0 && !answer.length) {
        // 还没到选项部分，追加到题干
        extraStem.push(line);
      }
    }

    if (extraStem.length > 0) {
      stem = stem + '\n' + extraStem.join('\n');
    }

    // 验证最低要求
    if (!stem || stem.length < 5) return null;
    if (options.length > 0 && answer.length === 0) {
      // 有选项没答案，标记为待补充
      answer = ['?'];
    }

    return {
      id: FK.utils.generateId('obj'),
      type: 'single_choice',
      examType: 'objective',
      paper: null,
      subject: '',
      knowledgePoint: '',
      year: null,
      source: '真题',
      difficulty: 3,
      content: {
        stem: stem.trim(),
        options: options,
        answer: answer,
        explanation: explanation.trim()
      },
      tags: [],
      _needsReview: true  // 标记需要人工审核补充信息
    };
  },

  // ===== 通用：构建题目对象 =====

  _buildQuestion(meta, lines, contentStart) {
    const typeMap = {
      '单选': 'single_choice', '单选题': 'single_choice',
      '多选': 'multiple_choice', '多选题': 'multiple_choice',
      '不定项': 'indefinite_choice', '不定项选择': 'indefinite_choice',
      '案例分析': 'case_analysis', '案例': 'case_analysis',
      '论述': 'essay', '论述题': 'essay'
    };

    const typeKey = typeMap[meta['类型']] || 'single_choice';
    const subject = meta['科目'] || meta['分科目'] || '';
    const knowledgePoint = meta['知识点'] || '';
    const year = parseInt(meta['年份']) || null;
    const difficulty = parseInt(meta['难度']) || 3;

    let stem = '';
    let options = [];
    let answer = [];
    let explanation = '';
    let currentSection = 'stem';

    for (let j = contentStart; j < lines.length; j++) {
      const line = lines[j];

      // 检测选项 A. B. C. D. 或 A．B．C．D．
      const optMatch = line.match(/^([A-E])[.．、\)]\s*(.+)/);
      if (optMatch && ['single_choice', 'multiple_choice', 'indefinite_choice'].includes(typeKey)) {
        currentSection = 'options';
        options.push({ key: optMatch[1].toUpperCase(), text: optMatch[2].trim() });
        continue;
      }

      // 检测答案行
      if (/^【?答案】?[：:]\s*(.+)/.test(line)) {
        currentSection = 'answer';
        answer = FK.utils.parseAnswerString(line.match(/^【?答案】?[：:]\s*(.+)/)[1]);
        continue;
      }

      // 检测解析行
      if (/^【?(?:解析|考点|详解)】?[：:]/.test(line)) {
        currentSection = 'explanation';
        const expMatch = line.match(/^【?(?:解析|考点|详解)】?[：:]\s*(.*)/);
        if (expMatch && expMatch[1]) explanation = expMatch[1];
        continue;
      }

      // 累积内容
      if (currentSection === 'stem') {
        stem += (stem ? '\n' : '') + line;
      } else if (currentSection === 'explanation') {
        explanation += (explanation ? '\n' : '') + line;
      } else if (currentSection === 'answer') {
        const extraAns = FK.utils.parseAnswerString(line);
        if (extraAns.length > 0) answer = [...new Set([...answer, ...extraAns])];
      }
    }

    // 验证
    if (!stem) throw new Error('缺少题干内容');
    if (['single_choice', 'multiple_choice', 'indefinite_choice'].includes(typeKey)) {
      if (options.length < 2) throw new Error('选择题至少需要2个选项，请检查选项是否以"A."、"B."开头');
      if (answer.length === 0) throw new Error('缺少答案，请在答案行写"答案：C"');
    }

    // 确定试卷
    let paper = meta['试卷'] || null;
    if (!paper && subject) {
      const subjects = window.FK_SEED_DATA?.subjects || {};
      if (subjects[subject]) paper = subjects[subject].paper;
    }

    const id = FK.utils.generateId(
      typeKey === 'case_analysis' || typeKey === 'essay' ? 'sub' : 'obj'
    );

    return {
      id,
      type: typeKey,
      examType: (typeKey === 'case_analysis' || typeKey === 'essay') ? 'subjective' : 'objective',
      paper,
      subject,
      knowledgePoint,
      year,
      source: meta['来源'] || '自定义',
      difficulty: Math.max(1, Math.min(5, difficulty)),
      content: { stem: stem.trim(), options, answer, explanation: explanation.trim() },
      tags: knowledgePoint ? [knowledgePoint] : []
    };
  },

  // ===== 文件导入 =====

  async handlePDFFile(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF解析库未加载。请确认网络连接正常（需要CDN加载pdf.js），然后刷新页面重试。');
    }

    const arrayBuffer = await this._readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // 按 y 坐标排序，模拟阅读顺序
      const items = content.items;
      items.sort((a, b) => {
        // 先按 y 降序（同一行），再按 x 升序
        const yDiff = Math.round(b.transform[5]) - Math.round(a.transform[5]);
        if (Math.abs(yDiff) > 5) return yDiff;
        return a.transform[4] - b.transform[4];
      });
      const pageText = items.map(item => item.str).join(' ');
      fullText += `\n--- 第${i}页 ---\n` + pageText;
    }

    // 如果提取到的文本几乎为空白（图像型PDF），给出提示
    const textOnly = fullText.replace(/--- 第\d+页 ---/g, '').trim();
    if (textOnly.length < 100) {
      throw new Error(
        '此PDF可能是扫描版（图像型），没有可提取的文字。\n\n' +
        '建议：\n' +
        '1. 使用同目录下的Word版本文档导入\n' +
        '2. 或用Adobe Acrobat的OCR功能转换为文字型PDF\n' +
        '3. 或手动将题目粘贴为文本'
      );
    }

    return this.cleanText(fullText);
  },

  async handleWordFile(file) {
    if (typeof mammoth === 'undefined') {
      throw new Error('Word解析库未加载。请确认网络连接正常（需要CDN加载mammoth.js），然后刷新页面重试。');
    }

    const arrayBuffer = await this._readFileAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer });
    return this.cleanText(result.value);
  },

  _readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  // ===== 方式三：真题标记格式（【思路分析】+【参考答案】） =====
  parseExamFormat(text, subject) {
    const cleaned = this.cleanText(text);
    const questions = [];
    const errors = [];

    // 匹配模式：数字+、题目名 + 【思路分析】内容 + 【参考答案】内容
    const regex = /(\d+)[、.]\s*(.+?)\n\s*【思路分析】\s*([\s\S]*?)【参考答案】\s*([\s\S]*?)(?=\n\d+[、.]\s*.+?\n\s*【思路分析】|$)/g;

    let match;
    let idx = 0;
    while ((match = regex.exec(cleaned)) !== null) {
      idx++;
      const title = match[2].replace(/\s+/g, '').trim();
      let analysis = match[3].trim();
      let answer = match[4].trim();

      // 清理OCR artifact
      analysis = analysis.replace(/🎧/g, '本');
      answer = answer.replace(/\s+/g, '');

      if (title.length < 2) continue;
      if (analysis.length < 5 && answer.length < 5) {
        errors.push({ index: idx, message: `"${title}" 缺少思路分析或参考答案` });
        continue;
      }

      const qSubject = subject || this.guessSubject(title);

      questions.push({
        id: FK.utils.generateId('exam'),
        type: 'essay',
        examType: 'subjective',
        paper: null,
        subject: qSubject,
        knowledgePoint: title,
        year: null,
        source: '真题',
        difficulty: 4,
        content: {
          stem: title,
          options: [],
          answer: answer ? [answer] : ['?'],
          explanation: '【思路分析】\n' + analysis + '\n\n【参考答案】\n' + answer
        },
        tags: [qSubject, '真题']
      });
    }

    // 如果正则匹配不到，尝试简单分割
    if (questions.length === 0) {
      // 按 【参考答案】 分割
      const blocks = cleaned.split(/【参考答案】\s*/);
      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const analysisMatch = block.match(/【思路分析】\s*([\s\S]*)/);
        const answerText = block.replace(/【思路分析】[\s\S]*/, '').trim();
        const analysisText = analysisMatch ? analysisMatch[1].trim() : '';

        if (answerText.length > 5) {
          idx++;
          questions.push({
            id: FK.utils.generateId('exam'),
            type: 'essay',
            examType: 'subjective',
            paper: null,
            subject: subject || '',
            knowledgePoint: '',
            year: null,
            source: '真题',
            difficulty: 4,
            content: {
              stem: '(请补充题目)',
              options: [],
              answer: [answerText],
              explanation: analysisText ? '【思路分析】\n' + analysisText + '\n\n【参考答案】\n' + answerText : '【参考答案】\n' + answerText
            },
            tags: [subject || '', '真题']
          });
        }
      }
    }

    return { questions, errors, totalBlocks: idx };
  },

  // 自动猜科目
  guessSubject(text) {
    const kw = {
      '法理学': ['法理','法治','法律原则','法律规则','法律责任','法律体系','法治文化'],
      '宪法': ['宪法','全国人大','国务院','选举','基本权利','监察','民族区域'],
      '行政法与行政诉讼法': ['行政','许可','处罚','强制','复议','国家赔偿'],
      '刑法': ['刑法','犯罪','刑罚','故意','过失','正当防卫','紧急避险','盗窃','抢劫','贪污','受贿','不作为'],
      '民法': ['民法','物权','债权','合同','侵权','婚姻','继承','形成权','代理'],
      '诉讼法学': ['诉讼','判决','管辖','证据','证明','速裁','取保候审'],
      '国际法': ['国际法','条约','外交','领事','引渡','海洋','领土'],
    };
    for (const [s, words] of Object.entries(kw)) {
      if (words.some(w => text.includes(w))) return s;
    }
    return '';
  },

  // ===== 验证 =====

  validateQuestion(q) {
    const errors = [];
    const subjects = window.FK_SEED_DATA?.subjects || {};

    if (!q.id) errors.push('缺少ID');
    if (!q.type) errors.push('缺少题型');
    if (!q.subject) errors.push('⚠ 缺少科目（可导入后编辑）');  // 降级为警告
    else if (!subjects[q.subject]) errors.push(`科目"${q.subject}"不在已知科目列表中`);
    if (!q.content?.stem) errors.push('缺少题干');
    if (['single_choice', 'multiple_choice', 'indefinite_choice'].includes(q.type)) {
      if (!q.content?.options || q.content.options.length < 2) errors.push('选择题至少需要2个选项');
      if (!q.content?.answer || q.content.answer.length === 0) errors.push('缺少正确答案');
    }
    if (q.difficulty && (q.difficulty < 1 || q.difficulty > 5)) errors.push('难度应在1-5之间');

    // 允许缺少科目的题目通过（_needsReview 标记的）
    if (q._needsReview && errors.length <= 1) {
      return { valid: true, errors, needsReview: true };
    }

    return { valid: errors.length === 0, errors };
  }
};
