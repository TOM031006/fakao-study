// app.js — 应用入口，命名空间初始化，启动流程
window.FK = window.FK || {};

FK.app = {
  version: '1.0.0',
  initialized: false,

  // 启动应用
  init() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. 初始化题库
    FK.questionBank.init();
    const stats = FK.questionBank.getStats();
    console.log(`法考学习追踪器 v${this.version} 启动`);
    console.log(`题库: ${stats.total}题`);

    // 2. 确保进度数据存在
    const progress = FK.storage.getProgress();
    if (!progress || Object.keys(progress.questions || {}).length === 0) {
      console.log('新用户，初始化进度数据');
    }

    // 3. 确保设置中的科目列表与科目定义同步
    this._syncSettings(progress);

    // 4. 注册所有路由
    this._registerRoutes();

    // 5. 绑定全局事件
    this._bindEvents();

    // 6. 显示欢迎提示（新用户）
    if (Object.keys(progress.questions || {}).length === 0 && FK.questionBank.questions.length > 0) {
      setTimeout(() => this._showWelcomeToast(), 500);
    }

    // 7. 数据迁移检查
    this._checkMigration(progress);

    // 8. 启动路由
    FK.router.init('app-content');

    console.log('✅ 应用初始化完成');
  },

  _syncSettings(progress) {
    const subjects = window.FK_SEED_DATA?.subjects || {};
    const allSubjectKeys = Object.keys(subjects);

    if (!progress.settings.subjects || progress.settings.subjects.length === 0) {
      // 默认启用所有科目
      progress.settings.subjects = allSubjectKeys;
      FK.storage.saveProgress(progress);
    }
  },

  _registerRoutes() {
    // 仪表盘
    FK.router.register('dashboard', (el) => FK.views.dashboard.render(el));

    // 每日练习
    FK.router.register('practice/daily', (el) => {
      FK.views.practice.renderDaily(el);
    });

    // 分科练习
    FK.router.register('practice/:subject', (el, subject) => {
      FK.views.practice.render(el, decodeURIComponent(subject || ''));
    });

    // 科目浏览
    FK.router.register('subjects', (el) => FK.views.subject.render(el));

    // 错题复习
    FK.router.register('review', (el) => FK.views.review.render(el));

    // 学习分析
    FK.router.register('analytics', (el) => FK.views.analytics.render(el));

    // 题库导入
    FK.router.register('import', (el) => FK.views.import.render(el));

    // 题库管理
    FK.router.register('questions', (el) => this._renderQuestionManager(el));

    // 背诵卡片
    FK.router.register('cards', (el) => this._renderCards(el));

    // 设置
    FK.router.register('settings', (el) => this._renderSettings(el));
  },

  _bindEvents() {
    // 更新顶栏信息
    FK.utils.on('answer-recorded', () => this._updateTopbar());

    // 数据导入后刷新所有视图
    FK.utils.on('data-imported', () => {
      FK.questionBank.init();
      this._updateTopbar();
    });

    // 题库更新后刷新
    FK.utils.on('questions-imported', () => {
      FK.questionBank.init();
    });

    // 初始化顶栏
    this._updateTopbar();
  },

  _updateTopbar() {
    const progress = FK.storage.getProgress();
    const streakEl = document.getElementById('topbar-streak');
    if (streakEl) {
      streakEl.innerHTML = `🔥 ${progress.streak?.current || 0} 天`;
    }

    const todayEl = document.getElementById('topbar-today-count');
    if (todayEl) {
      const today = FK.utils.today();
      const record = progress.dailyRecords.find(r => r.date === today);
      todayEl.textContent = record ? `${record.totalAnswered}题` : '0题';
    }

    // 更新侧栏的迷你统计
    const streakMiniEl = document.getElementById('sidebar-streak');
    if (streakMiniEl) {
      streakMiniEl.textContent = `🔥 连续${progress.streak?.current || 0}天 · 最长${progress.streak?.longest || 0}天`;
    }
  },

  _checkMigration(progress) {
    // 未来版本升级迁移逻辑
  },

  _showWelcomeToast() {
    this._toast('👋 欢迎使用法考学习追踪器！在"题库导入"页面添加更多真题。', 'info');
  },

  _toast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  // ===== 设置页面 =====
  _renderSettings(el) {
    const progress = FK.storage.getProgress();
    const settings = progress.settings;
    const subjects = FK.questionBank.getAllSubjects();

    el.innerHTML = `
      <div class="fade-in">
        <h1 class="page-title">⚙️ 设置</h1>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><span class="card-title">每日练习设置</span></div>
          <div class="form-group">
            <label class="form-label">每日题目数量</label>
            <select class="form-select" id="setting-count" onchange="FK.app._saveSetting('dailyQuestionCount', parseInt(this.value))">
              <option value="10" ${settings.dailyQuestionCount === 10 ? 'selected' : ''}>10题</option>
              <option value="20" ${settings.dailyQuestionCount === 20 ? 'selected' : ''}>20题（推荐）</option>
              <option value="30" ${settings.dailyQuestionCount === 30 ? 'selected' : ''}>30题</option>
              <option value="50" ${settings.dailyQuestionCount === 50 ? 'selected' : ''}>50题</option>
            </select>
          </div>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><span class="card-title">练习科目选择</span></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:8px;">
            ${subjects.map(s => `
              <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;">
                <input type="checkbox" ${settings.subjects.includes(s.key) ? 'checked' : ''}
                  onchange="FK.app._toggleSubject('${s.key}', this.checked)" style="accent-color:var(--primary);">
                <span>${s.icon || ''} ${s.shortName || s.key}</span>
                <span style="font-size:11px;color:var(--text-muted);">(${s.questionCount}题)</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><span class="card-title">数据管理</span></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="FK.app._exportData()">📤 导出全部数据</button>
            <button class="btn btn-outline" onclick="FK.app._importData()">📥 导入备份数据</button>
            <button class="btn btn-danger" onclick="FK.app._resetProgress()">⚠️ 重置进度</button>
            <button class="btn btn-danger" onclick="FK.app._resetAll()">🗑️ 清除所有数据</button>
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:10px;">
            建议每周导出一次数据作为备份。数据仅保存在浏览器中，清除浏览器数据会丢失进度。
          </p>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">关于</span></div>
          <p style="font-size:14px;">法考学习追踪器 v${this.version}</p>
          <p style="font-size:13px;color:var(--text-secondary);">
            📚 基于间隔重复(SM-2)算法的智能题库练习系统<br>
            🎯 每日出卷 · 薄弱分析 · 进度追踪<br>
            💻 纯本地应用，数据安全私密
          </p>
        </div>
      </div>
    `;
  },

  _showNameEditor() {
    const progress = FK.storage.getProgress();
    const currentName = progress.settings.userName || '';
    const name = prompt('请输入你的姓名（将显示在仪表盘上）：', currentName);
    if (name !== null) {
      FK.storage.saveSettings({ userName: name.trim() });
      FK.app._toast('✅ 姓名已更新', 'success');
      FK.router.navigate('#dashboard');
    }
  },

  _saveSetting(key, value) {
    FK.storage.saveSettings({ [key]: value });
    this._toast('设置已保存 ✅', 'success');
  },

  _toggleSubject(subjectKey, enabled) {
    const progress = FK.storage.getProgress();
    const subjects = progress.settings.subjects || [];
    if (enabled && !subjects.includes(subjectKey)) {
      subjects.push(subjectKey);
    } else if (!enabled) {
      const idx = subjects.indexOf(subjectKey);
      if (idx >= 0) subjects.splice(idx, 1);
    }
    FK.storage.saveSettings({ subjects });
    this._toast(`科目已${enabled ? '启用' : '禁用'} ✅`, 'success');
  },

  _exportData() {
    const data = FK.storage.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `法考学习数据_${FK.utils.today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this._toast('数据已导出 📤', 'success');
  },

  _importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      try {
        const file = input.files[0];
        if (!file) return;
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsText(file);
        });
        const data = JSON.parse(text);
        FK.storage.importAllData(data);
        FK.questionBank.init();
        this._updateTopbar();
        this._toast('数据已导入 ✅ 正在刷新...', 'success');
        setTimeout(() => FK.router.navigate('#dashboard'), 500);
      } catch (e) {
        alert('导入失败：' + e.message + '\n请确认选择了正确的备份文件。');
      }
    };
    input.click();
  },

  _resetProgress() {
    if (FK.storage.resetProgress()) {
      this._toast('进度已重置 ⚠️', 'warning');
      setTimeout(() => FK.router.navigate('#dashboard'), 300);
    }
  },

  // ===== 背诵卡片页面 =====
  _renderCards(el) {
    const cards = window.FK_SEED_DATA?.civilCh1Cards || [];
    if (cards.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🃏</div><h2>暂无背诵卡片</h2><p>请导入背诵资料后使用</p></div>';
      return;
    }

    const sections = {};
    cards.forEach(c => {
      const s = c.section || '其他';
      if (!sections[s]) sections[s] = [];
      sections[s].push(c);
    });

    el.innerHTML = `
      <div class="fade-in">
        <h1 class="page-title">🃏 背诵卡片 · 民法第一章</h1>
        <p style="color:var(--text-muted);margin-bottom:16px;">${cards.length} 张卡片 · 点击卡片翻转查看答案</p>
        <div id="cards-container"></div>
      </div>
    `;

    const container = document.getElementById('cards-container');
    let html = '';

    for (const [section, sectionCards] of Object.entries(sections)) {
      html += `<h2 style="margin:20px 0 10px;font-size:16px;color:var(--text-secondary);">${section}</h2>`;
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;">';

      sectionCards.forEach(c => {
        const q = (c.content?.stem || '').replace(/📖[^\n]+\n\n❓\s*/, '');
        const a = (c.content?.answer || [])[0] || '';
        // Remove the question part from answer (they overlap)
        const pureAnswer = a.substring(Math.min(a.length, q.length + 10));

        html += `
          <div class="flashcard" style="background:var(--card-bg);border-radius:var(--radius-md);box-shadow:var(--shadow-sm);cursor:pointer;min-height:150px;perspective:1000px;"
            onclick="this.querySelector('.card-inner').classList.toggle('flipped')">
            <div class="card-inner" style="position:relative;width:100%;min-height:150px;transition:transform 0.5s;">
              <div class="card-front" style="padding:16px;">
                <div style="font-size:14px;color:var(--primary);font-weight:600;margin-bottom:4px;">📖 ${c.knowledgePoint}</div>
                <div style="font-size:14px;line-height:1.6;">${FK.utils.escapeHtml(q.substring(0,200))}</div>
              </div>
              <div class="card-back" style="display:none;padding:16px;">
                <div style="font-size:13px;color:var(--success);font-weight:600;margin-bottom:6px;">✅ 答案</div>
                <div style="font-size:13px;line-height:1.7;max-height:300px;overflow-y:auto;">${FK.utils.escapeHtml(pureAnswer.substring(0,500))}</div>
              </div>
            </div>
          </div>
          <style>
            .flashcard:hover { box-shadow: var(--shadow-md); }
            .card-inner.flipped .card-front { display: none; }
            .card-inner.flipped .card-back { display: block; }
          </style>
        `;
      });

      html += '</div>';
    }

    container.innerHTML = html;
  },

  _resetAll() {
    if (FK.storage.resetAll()) {
      this._toast('所有数据已清除 🗑️', 'warning');
      setTimeout(() => location.reload(), 500);
    }
  },

  // ===== 题目编辑弹窗 =====
  // 可在任何视图中调用：FK.app.showEditModal(questionOrId, onSaved)
  showEditModal(questionOrId, onSaved) {
    let question;
    if (typeof questionOrId === 'string') {
      question = FK.questionBank.getById(questionOrId);
    } else {
      question = questionOrId;
    }
    if (!question) { alert('未找到该题目'); return; }

    const subjects = window.FK_SEED_DATA?.subjects || {};
    const subjectKeys = Object.keys(subjects);
    const typeNames = FK_SEED_DATA.questionTypes || {};

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'edit-question-modal';

    const isSubject = question.type === 'essay' || question.type === 'case_analysis';
    const ansStr = (question.content.answer || []).join('');

    overlay.innerHTML = `
      <div class="modal" style="max-width:700px;max-height:90vh;" onclick="event.stopPropagation()">
        <h2 class="modal-title">✏️ 编辑题目</h2>
        <div style="max-height:60vh;overflow-y:auto;padding-right:8px;">

          <div class="form-group">
            <label class="form-label">题型</label>
            <select class="form-select" id="edit-type">
              ${Object.entries(typeNames).map(([k,v]) =>
                `<option value="${k}" ${question.type===k?'selected':''}>${v.icon} ${v.name}</option>`
              ).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">科目</label>
            <select class="form-select" id="edit-subject">
              <option value="">(未分类)</option>
              ${subjectKeys.map(k => {
                const s = subjects[k];
                return `<option value="${k}" ${question.subject===k?'selected':''}>${s.icon||''} ${s.shortName||k}</option>`;
              }).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">知识点</label>
            <input class="form-input" id="edit-kp" value="${FK.utils.escapeHtml(question.knowledgePoint||'')}" placeholder="如：正当防卫">
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label class="form-label">年份</label>
              <input class="form-input" id="edit-year" type="number" value="${question.year||''}" placeholder="2023" min="2002" max="2025">
            </div>
            <div class="form-group">
              <label class="form-label">难度 (1-5)</label>
              <select class="form-select" id="edit-difficulty">
                ${[1,2,3,4,5].map(n =>
                  `<option value="${n}" ${question.difficulty===n?'selected':''}>${FK.utils.difficultyLabel(n)}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">${isSubject ? '✍️ 参考答案/答案要点' : '✅ 正确答案 (如：C 或 ABD)'}</label>
            ${isSubject
              ? `<textarea class="form-textarea" id="edit-answer" rows="8" style="font-size:14px;line-height:1.7;">${FK.utils.escapeHtml(ansStr)}</textarea>`
              : `<input class="form-input" id="edit-answer" value="${FK.utils.escapeHtml(ansStr)}" placeholder="C" style="font-weight:700;font-size:18px;color:var(--success);">`
            }
          </div>

          <div class="form-group">
            <label class="form-label">题干</label>
            <textarea class="form-textarea" id="edit-stem" rows="3">${FK.utils.escapeHtml(question.content?.stem||'')}</textarea>
          </div>

          ${question.content?.options ? `
            <div class="form-group">
              <label class="form-label">选项</label>
              ${(question.content.options||[]).map((o,i) => `
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
                  <span style="font-weight:700;min-width:20px;">${o.key}.</span>
                  <input class="form-input" id="edit-opt-${o.key}" value="${FK.utils.escapeHtml(o.text)}">
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="form-group">
            <label class="form-label">解析</label>
            <textarea class="form-textarea" id="edit-explanation" rows="4">${FK.utils.escapeHtml(question.content?.explanation||'')}</textarea>
          </div>

          <div style="font-size:12px;color:var(--text-muted);">ID: ${question.id}</div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-danger btn-sm" style="margin-right:auto;" onclick="FK.app._deleteQuestion('${question.id}')">🗑️ 删除</button>
          <button class="btn btn-secondary" onclick="document.getElementById('edit-question-modal').remove()">取消</button>
          <button class="btn btn-primary" id="btn-save-edit">💾 保存</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // 点击背景关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // 保存按钮
    document.getElementById('btn-save-edit').addEventListener('click', () => {
      const updates = {
        type: document.getElementById('edit-type').value,
        subject: document.getElementById('edit-subject').value,
        knowledgePoint: document.getElementById('edit-kp').value.trim(),
        year: parseInt(document.getElementById('edit-year').value) || null,
        difficulty: parseInt(document.getElementById('edit-difficulty').value) || 3,
        content: {
          stem: document.getElementById('edit-stem').value.trim(),
          answer: isSubject
            ? [document.getElementById('edit-answer').value.trim()]
            : FK.utils.parseAnswerString(document.getElementById('edit-answer').value),
          explanation: document.getElementById('edit-explanation').value.trim()
        }
      };

      // 更新选项
      if (question.content?.options) {
        updates.content.options = question.content.options.map(o => {
          const el = document.getElementById('edit-opt-' + o.key);
          return { key: o.key, text: el ? el.value.trim() : o.text };
        });
      }

      // 确定试卷
      const subjects = window.FK_SEED_DATA?.subjects || {};
      if (subjects[updates.subject]) {
        updates.paper = subjects[updates.subject].paper;
      }

      const updated = FK.storage.updateQuestion(question.id, updates);
      if (updated) {
        overlay.remove();
        FK.app._toast('✅ 题目已保存', 'success');
        if (onSaved) onSaved(updated);
      } else {
        alert('保存失败');
      }
    });
  },

  _deleteQuestion(id) {
    if (!confirm('确定删除这道题吗？\n\n注意：只能删除自定义/编辑过的题目，种子题库中原有的题目会在刷新后恢复。')) return;
    if (FK.storage.deleteQuestion(id)) {
      document.getElementById('edit-question-modal')?.remove();
      FK.app._toast('🗑️ 题目已删除', 'warning');
      // 刷新当前视图
      FK.router.navigate(location.hash || '#dashboard');
    }
  },

  // ===== 题库管理页面（搜索+编辑） =====
  _renderQuestionManager(el) {
    const questions = FK.questionBank.questions;
    el.innerHTML = `
      <div class="fade-in">
        <h1 class="page-title">📋 题库搜索与编辑 (${questions.length}题)</h1>
        <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
          <input class="form-input" id="qm-search" placeholder="🔍 搜索题干/答案/知识点关键词..." style="flex:1;min-width:250px;"
            onkeyup="FK.app._filterQM()" autofocus>
          <select class="form-select" id="qm-subject" style="max-width:180px;" onchange="FK.app._filterQM()">
            <option value="">全部科目</option>
            ${Object.entries(FK_SEED_DATA.subjects||{}).map(([k,s]) =>
              `<option value="${k}">${s.icon||''} ${s.shortName||k}</option>`
            ).join('')}
          </select>
          <select class="form-select" id="qm-type" style="max-width:140px;" onchange="FK.app._filterQM()">
            <option value="">全部题型</option>
            ${Object.entries(FK_SEED_DATA.questionTypes||{}).map(([k,v]) =>
              `<option value="${k}">${v.name}</option>`
            ).join('')}
          </select>
        </div>
        <div style="margin-bottom:16px;font-size:13px;color:var(--text-muted);" id="qm-count"></div>
        <div id="qm-list" style="max-height:65vh;overflow-y:auto;"></div>
      </div>
    `;
    this._filterQM();
  },

  _renderQMList(filtered) {
    if (!filtered) {
      const all = FK.questionBank.questions;
      const search = (document.getElementById('qm-search')?.value || '').toLowerCase();
      const subject = document.getElementById('qm-subject')?.value || '';
      const type = document.getElementById('qm-type')?.value || '';

      filtered = all;
      if (search) {
        filtered = filtered.filter(q => {
          const ans = (q.content?.answer||[]).join('');
          const exp = q.content?.explanation||'';
          const stem = q.content?.stem||'';
          const kp = q.knowledgePoint||'';
          return stem.toLowerCase().includes(search) ||
            ans.toLowerCase().includes(search) ||
            exp.toLowerCase().includes(search) ||
            kp.toLowerCase().includes(search) ||
            (q.subject||'').toLowerCase().includes(search);
        });
      }
      if (subject) filtered = filtered.filter(q => q.subject === subject);
      if (type) filtered = filtered.filter(q => q.type === type);
    }

    // 更新计数
    const cEl = document.getElementById('qm-count');
    if (cEl) {
      const wAns = filtered.filter(q => { const a = (q.content?.answer||[]).join(''); return a && a !== '?'; }).length;
      cEl.textContent = `找到 ${filtered.length} 题 · 有答案: ${wAns}`;
    }

    if (filtered.length === 0) {
      return '<p style="text-align:center;color:var(--text-muted);padding:40px;">没有匹配的题目，换个关键词试试</p>';
    }

    const displayed = filtered.slice(0, 60);

    return displayed.map((q, idx) => {
      const ansStr = (q.content.answer||[]).join('') || '?';
      const hasAns = ansStr && ansStr !== '?' && ansStr.length > 1;
      const ansPreview = hasAns ? ansStr.substring(0, 80) : '<span style="color:var(--error);">(无答案)</span>';
      const isSubj = q.type === 'essay' || q.type === 'case_analysis';
      const subjDef = (FK_SEED_DATA.subjects||{})[q.subject];
      return `
        <div class="card" style="padding:14px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
                ${q.subject ? `<span class="badge badge-primary">${subjDef?.icon||''} ${subjDef?.shortName||q.subject}</span>` : '<span class="badge badge-error">未分类</span>'}
                <span class="badge badge-info">${FK_SEED_DATA.questionTypes[q.type]?.name||q.type}</span>
                ${q.year ? `<span class="tag">${q.year}年</span>` : ''}
                ${FK.utils.difficultyStars(q._effectiveDifficulty || q.difficulty || 3)}
              </div>
              <div style="font-size:14px;font-weight:500;margin-bottom:4px;line-height:1.5;">
                ${FK.utils.escapeHtml((q.content?.stem||'').replace(/【[^】]+】/g, '').substring(0, 120))}
              </div>
              <div style="font-size:13px;color:var(--text-muted);line-height:1.5;">
                ${isSubj
                  ? `📝 ${ansPreview}${ansStr.length > 80 ? '...' : ''}`
                  : `答案: <strong style="color:${hasAns?'var(--success)':'var(--error)'}">${ansStr}</strong>`
                }
              </div>
              ${q.knowledgePoint ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">知识点: ${q.knowledgePoint}</div>` : ''}
            </div>
            <button class="btn btn-sm btn-outline" style="flex-shrink:0;"
              onclick="FK.app.showEditModal('${q.id}', ()=>{FK.app._renderQuestionManager(document.getElementById('app-content'))})">
              ✏️ 编辑
            </button>
          </div>
        </div>
      `;
    }).join('') + (filtered.length > 60 ? `<p style="text-align:center;color:var(--text-muted);padding:10px;">...还有 ${filtered.length-60} 题，输入更精确关键词缩小范围</p>` : '');
  },

  _filterQM() {
    const list = document.getElementById('qm-list');
    if (list) list.innerHTML = FK.app._renderQMList();
  }
};

// DOM 加载完后自动启动
document.addEventListener('DOMContentLoaded', () => {
  FK.app.init();
});

// 兜底：如果 DOMContentLoaded 已触发
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  FK.app.init();
}
