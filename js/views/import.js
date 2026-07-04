// views/import.js — 题库导入向导视图
window.FK = window.FK || {};
FK.views = FK.views || {};

FK.views.import = {
  pendingQuestions: [],
  parsedResult: null,
  currentText: '',  // 保存当前文本，便于切换解析模式

  render(el) {
    el.innerHTML = `
      <div class="fade-in">
        <h1 class="page-title">📥 题库导入</h1>

        <!-- 导入方式 -->
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><span class="card-title">📋 选择导入来源</span></div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="FK.views.import.showTextImport()">📝 粘贴文本</button>
            <button class="btn btn-outline" onclick="document.getElementById('file-word-input').click()">📎 上传Word (.docx)</button>
            <button class="btn btn-outline" onclick="document.getElementById('file-pdf-input').click()">📄 上传PDF</button>
            <input type="file" id="file-pdf-input" accept=".pdf" style="display:none;"
              onchange="FK.views.import.handleFileUpload(this, 'pdf')">
            <input type="file" id="file-word-input" accept=".docx,.doc" style="display:none;"
              onchange="FK.views.import.handleFileUpload(this, 'word')">
          </div>
        </div>

        <!-- 格式说明 -->
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header">
            <span class="card-title">📖 三种导入格式</span>
          </div>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">勾选对应解析按钮即可。方式三最适合武大真题Word文档。</p>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <!-- 方式一：标记格式 -->
            <div style="background:var(--bg);padding:16px;border-radius:var(--radius-sm);">
              <h3 style="margin-bottom:8px;">方式一：标记格式（推荐，精确控制）</h3>
              <p style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">每道题用 <code>---</code> 分隔，元数据在上方。适合手动整理或少量题目。</p>
              <pre style="background:#1a1a2e;color:#ddd;padding:12px;border-radius:4px;font-size:12px;overflow-x:auto;line-height:1.5;">---
类型: 单选
科目: 刑法
知识点: 正当防卫
年份: 2022
难度: 3
---
甲深夜潜入乙家行窃，被乙发现后，
甲持刀威胁乙。乙用木棍将甲打伤。
关于乙的行为，下列哪一说法正确？
A. 乙构成故意伤害罪
B. 乙属于防卫过当
C. 乙属于正当防卫
D. 乙属于紧急避险
答案：C
解析：乙的行为属于制止正在进行的
不法侵害，构成正当防卫。</pre>
            </div>

            <!-- 方式二：真题原始格式 -->
            <div style="background:var(--bg);padding:16px;border-radius:var(--radius-sm);">
              <h3 style="margin-bottom:8px;">方式二：真题原始格式（快速导入）</h3>
              <p style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">直接粘贴Word/PDF中提取的真题文本，自动识别题号、选项和答案。</p>
              <pre style="background:#1a1a2e;color:#ddd;padding:12px;border-radius:4px;font-size:12px;overflow-x:auto;line-height:1.5;">1．关于依法治国，下列哪一认识是错误的？
A．依法治国要求构建科学完善的权力制约监督机制
B．依法治国要求坚持"法律中心主义"
C．实施依法治国基本方略，必须坚持法治国家、
   法治政府、法治社会一体建设
D．依法治国要求党必须坚持依法执政
答案：B
解析：依法治国并不要求"法律中心主义"，
而是强调法治与德治相结合。</pre>
            </div>

            <!-- 方式三：真题标记格式 -->
            <div style="background:var(--bg);padding:16px;border-radius:var(--radius-sm);">
              <h3 style="margin-bottom:8px;">方式三：真题标记格式（推荐！）</h3>
              <p style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">直接粘贴Word中的【思路分析】+【参考答案】格式真题，自动识别科目。</p>
              <pre style="background:#1a1a2e;color:#ddd;padding:12px;border-radius:4px;font-size:11px;overflow-x:auto;line-height:1.5;">1、政策性原则和公理性原则
【思路分析】
本题较为常规。法律原则的概念、特征、
分类以及与法律规则的适用区别均为重点
内容，考生务必牢固掌握。
【参考答案】
（1）依法律原则内容的性质不同，可以
分为政策性原则和公理性原则。
（2）政策性原则是国家必须达到的政治
目标或社会主义国家执政党的基本路线...
（3）公理性原则是从社会关系的本质中
产生出来的...</pre>
            </div>
          </div>
        </div>

        <!-- 文本导入区域 -->
        <div id="text-import-area" style="display:none;" class="card">
          <div class="card-header">
            <span class="card-title">📝 输入题目文本</span>
            <span style="font-size:12px;color:var(--text-muted);" id="text-char-count"></span>
          </div>
          <textarea id="import-textarea" class="form-textarea" rows="14"
            placeholder="在此粘贴题目文本（支持上述两种格式）..."
            oninput="FK.views.import._updateCharCount()"></textarea>
          <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="FK.views.import.parseText('markup')">
              🏷️ 标记格式
            </button>
            <button class="btn btn-success" onclick="FK.views.import.parseText('raw')">
              🔍 智能识别
            </button>
            <button class="btn btn-info" onclick="FK.views.import.parseText('exam')">
              📋 真题标记格式
            </button>
            <button class="btn btn-secondary" onclick="document.getElementById('text-import-area').style.display='none'">取消</button>
          </div>
        </div>

        <!-- 解析预览区 -->
        <div id="preview-area" style="display:none;"></div>
      </div>
    `;
  },

  _updateCharCount() {
    const ta = document.getElementById('import-textarea');
    const countEl = document.getElementById('text-char-count');
    if (ta && countEl) {
      const len = ta.value.length;
      countEl.textContent = len > 0 ? `${len} 字` : '';
    }
  },

  showTextImport() {
    document.getElementById('text-import-area').style.display = 'block';
    document.getElementById('text-import-area').scrollIntoView({ behavior: 'smooth' });
  },

  parseText(mode) {
    const textarea = document.getElementById('import-textarea');
    const text = textarea.value.trim();
    if (!text) {
      alert('请先粘贴题目文本');
      return;
    }

    this.currentText = text;
    let result;

    if (mode === 'raw') {
      result = FK.importer.parseRawExamText(text);
    } else if (mode === 'exam') {
      // 真题标记格式（【思路分析】+【参考答案】）
      const subject = prompt('请输入科目（如：法理学、刑法），或留空自动识别：') || '';
      result = FK.importer.parseExamFormat(text, subject);
    } else {
      result = FK.importer.parseMarkup(text);
    }

    this.parsedResult = result;
    this._showPreview(result, mode);
  },

  _showPreview(result, mode) {
    const preview = document.getElementById('preview-area');
    preview.style.display = 'block';

    const modeLabel = mode === 'raw' ? '智能识别真题' : '标记格式';

    let html = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">🔍 解析结果（${modeLabel}）</span>
          <span class="badge badge-success">${result.questions.length} 题识别成功</span>
          ${result.errors.length > 0 ? `<span class="badge badge-error">${result.errors.length} 个失败</span>` : ''}
        </div>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:12px;">
          共 ${result.totalBlocks || 0} 段文本，解析出 ${result.questions.length} 道题目
          ${mode === 'raw' ? ' · 智能识别可能需要手动补充科目、年份等信息' : ''}
        </p>
    `;

    // 显示题目预览
    for (const q of result.questions.slice(0, 25)) {
      const typeName = FK_SEED_DATA.questionTypes[q.type]?.name || q.type;
      const needsReview = q._needsReview;
      html += `
        <div style="background:${needsReview ? '#FFF8E1' : 'var(--bg)'};padding:12px;border-radius:var(--radius-sm);margin-bottom:8px;border-left:3px solid ${needsReview ? 'var(--warning)' : 'var(--success)'};">
          <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;align-items:center;">
            <span class="badge ${q.subject ? 'badge-primary' : 'badge-warning'}">${q.subject || '⚠ 待补充科目'}</span>
            <span class="badge badge-info">${typeName}</span>
            ${q.knowledgePoint ? `<span class="tag">${q.knowledgePoint}</span>` : ''}
            ${q.year ? `<span class="tag">${q.year}年</span>` : ''}
            <span class="tag">${FK.utils.difficultyLabel(q.difficulty)}</span>
            ${needsReview ? '<span style="font-size:11px;color:var(--warning);">⚠ 需审核补充</span>' : ''}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;margin-bottom:4px;">${FK.utils.escapeHtml(q.content.stem.substring(0, 120))}${q.content.stem.length > 120 ? '...' : ''}</div>
              <div style="font-size:12px;color:var(--text-muted);">
                选项：${(q.content.options || []).map(o => o.key + '.' + o.text.substring(0, 20)).join('  ')}
              </div>
              ${q.content.answer && q.content.answer[0] !== '?' ? `<div style="font-size:13px;color:var(--success);margin-top:4px;">答案：${q.content.answer.join('')}</div>` : '<div style="font-size:13px;color:var(--error);">答案：未识别</div>'}
              ${q.content.explanation ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">解析：${FK.utils.escapeHtml(q.content.explanation.substring(0, 60))}...</div>` : ''}
            </div>
            <button class="btn btn-sm btn-outline" style="flex-shrink:0;"
              onclick="event.stopPropagation();FK.app.showEditModal('${q.id}')"
              title="编辑题目">✏️</button>
          </div>
        </div>
      `;
    }

    if (result.questions.length > 25) {
      html += `<p style="text-align:center;color:var(--text-muted);">...还有 ${result.questions.length - 25} 道题未显示</p>`;
    }

    // 错误信息
    if (result.errors.length > 0) {
      html += `<div style="margin-top:16px;background:#FFEBEE;padding:12px;border-radius:var(--radius-sm);">
        <strong style="color:var(--error);">⚠ 未能解析的段落：</strong>`;
      for (const err of result.errors.slice(0, 10)) {
        html += `<div style="font-size:13px;color:var(--error);">· 第${err.index + 1}块：${err.message}</div>`;
      }
      if (result.errors.length > 10) html += `<div style="font-size:13px;color:var(--error);">...还有${result.errors.length - 10}个</div>`;
      html += `</div>`;
    }

    html += `
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
          <button class="btn btn-primary btn-lg" onclick="FK.views.import.confirmImport()"
            ${result.questions.length === 0 ? 'disabled' : ''}>
            ✅ 确认导入 (${result.questions.length}题)
          </button>
          <button class="btn btn-outline btn-lg" onclick="FK.views.import.parseText('markup')">
            🏷️ 换用标记格式重试
          </button>
          <button class="btn btn-outline btn-lg" onclick="FK.views.import.parseText('raw')">
            🔍 换用智能识别重试
          </button>
          <button class="btn btn-secondary btn-lg" onclick="document.getElementById('preview-area').style.display='none'">取消</button>
        </div>
      </div>
    `;

    preview.innerHTML = html;
    preview.scrollIntoView({ behavior: 'smooth' });
  },

  confirmImport() {
    if (!this.parsedResult || this.parsedResult.questions.length === 0) return;

    const valid = [];
    const invalid = [];
    for (const q of this.parsedResult.questions) {
      // 清理内部标记
      delete q._needsReview;
      const result = FK.importer.validateQuestion(q);
      if (result.valid) {
        valid.push(q);
      } else {
        invalid.push({ question: q, errors: result.errors, needsReview: result.needsReview });
      }
    }

    if (invalid.length > 0) {
      const msgs = invalid.map(i => {
        const stem = (i.question.content?.stem || '').substring(0, 30);
        return `· ${stem}... → ${i.errors.join(', ')}`;
      }).join('\n');
      alert(`以下 ${invalid.length} 题验证失败，将被跳过：\n\n${msgs}\n\n提示：智能识别的题目需要手动补充"科目"等信息后才可导入。`);
    }

    if (valid.length === 0) {
      alert('没有通过验证的题目。\n\n常见原因：\n1. 缺少科目信息 → 在文本上方添加"科目: XXX"\n2. 缺少答案 → 添加"答案：C"\n3. 选项格式不识别 → 确保每行以"A. B. C. D."开头');
      return;
    }

    FK.storage.addCustomQuestions(valid);
    FK.questionBank.init();

    alert(`✅ 成功导入 ${valid.length} 道题目！\n\n返回仪表盘即可开始练习。`);

    // 清空状态
    const ta = document.getElementById('import-textarea');
    if (ta) ta.value = '';
    document.getElementById('preview-area').style.display = 'none';
    document.getElementById('text-import-area').style.display = 'none';
    this.parsedResult = null;
    this.currentText = '';

    this.render(document.getElementById('app-content'));
  },

  async handleFileUpload(input, type) {
    const file = input.files[0];
    if (!file) return;

    try {
      let text;

      if (type === 'pdf') {
        this._showLoading(true, '正在解析PDF文件（大文件可能需要几十秒）...');
        text = await FK.importer.handlePDFFile(file);
      } else {
        this._showLoading(true, '正在解析Word文件...');
        text = await FK.importer.handleWordFile(file);
      }

      this._showLoading(false);

      if (text && text.trim().length > 0) {
        const textarea = document.getElementById('import-textarea');
        textarea.value = text;
        document.getElementById('text-import-area').style.display = 'block';
        this._updateCharCount();
        document.getElementById('text-import-area').scrollIntoView({ behavior: 'smooth' });

        // 自动检测格式类型
        const hasMarkup = text.includes('类型:') || text.includes('科目:');
        const suggestion = hasMarkup
          ? '✅ 检测到标记格式，建议使用"🏷️ 标记格式解析"'
          : '💡 检测到真题原始格式，建议使用"🔍 智能识别真题"';

        setTimeout(() => {
          alert(`文件解析完成！已提取 ${text.length} 字。\n\n${suggestion}\n\n文本已填入编辑区，你可以直接点击解析按钮，或手动调整后再解析。`);
        }, 300);
      } else {
        alert('文件解析完成，但未提取到文字内容。\n\n可能原因：\n1. PDF是扫描版（图片型），无法提取文字\n2. 文件已损坏\n\n建议使用Word版本文档重试。');
      }
    } catch (err) {
      this._showLoading(false);
      alert(`文件处理失败：${err.message}`);
      console.error('File import error:', err);
    }

    input.value = '';
  },

  _showLoading(show, message) {
    let overlay = document.getElementById('import-loading');
    if (!overlay && show) {
      overlay = document.createElement('div');
      overlay.id = 'import-loading';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="text-align:center;">
          <div style="font-size:40px;margin-bottom:16px;">⏳</div>
          <h3 id="import-loading-msg">${message || '处理中...'}</h3>
          <div class="progress-bar" style="margin-top:16px;"><div class="progress-fill primary" style="width:100%;animation:pulse 1.5s infinite;"></div></div>
        </div>
      `;
      document.body.appendChild(overlay);
    } else if (overlay && !show) {
      overlay.remove();
    }
    if (overlay && show) {
      const msgEl = document.getElementById('import-loading-msg');
      if (msgEl) msgEl.textContent = message;
    }
  }
};
