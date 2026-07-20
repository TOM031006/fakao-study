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

    // 随机背诵
    FK.router.register('recite', (el) => this._renderRecite(el));

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

  // ===== 背诵卡片页面（Studley风格：掌握度追踪+评级） =====
  _getCardMastery() { try { return JSON.parse(localStorage.getItem('fk_card_mastery')||'{}'); } catch(e) { return {}; } },
  _saveCardMastery(d) { localStorage.setItem('fk_card_mastery', JSON.stringify(d)); },

  _renderCards(el) {
    const xf2=window.FK_SEED_DATA?.xianfaCards2||[];
    this._cardChapters=[{name:'宪法背诵',cards:xf2}].filter(c=>c.cards.length>0);
    if(!this._cardChapters.length){el.innerHTML='<div class=\"empty-state\"><div class=\"empty-icon\">🃏</div><h2>暂无背诵卡片</h2></div>';return;}
    this._currentCardChapter=0; this._cardFilter='all'; this._renderCardPage(el);
  },

  _renderCardPage(el) {
    const mastery=this._getCardMastery();
    const ch=this._cardChapters[this._currentCardChapter];
    let filtered=ch.cards;
    if(this._cardFilter==='learning') filtered=ch.cards.filter(c=>mastery[c.id]===1); // 只显示主动点了"不熟"的
    if(this._cardFilter==='mastered') filtered=ch.cards.filter(c=>mastery[c.id]>=2);
    const mastered=ch.cards.filter(c=>mastery[c.id]>=2).length;
    const learning=ch.cards.filter(c=>mastery[c.id]===1).length;
    const pct=Math.round(mastered/Math.max(ch.cards.length,1)*100);

    const sections={}; filtered.forEach(c=>{const s=c.section||'其他';if(!sections[s])sections[s]=[];sections[s].push(c);});

    el.innerHTML=`
      <div class="fade-in">
        <div class="card" style="margin-bottom:14px;padding:16px 20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-size:17px;font-weight:700;">${ch.name}</div>
              <div style="font-size:12px;color:var(--text-muted);">${filtered.length}张 · ${mastered}熟练 · ${learning}不熟</div>
            </div>
            <div style="text-align:right;"><div style="font-size:26px;font-weight:700;color:${pct>=70?'var(--success)':pct>=30?'var(--warning)':'var(--text-muted)'};">${pct}%</div><div style="font-size:10px;color:var(--text-muted);">掌握度</div></div>
          </div>
          <div class="progress-bar" style="margin-top:10px;height:6px;"><div class="progress-fill ${pct>=70?'success':pct>=30?'warning':'error'}" style="width:${Math.max(pct,3)}%;"></div></div>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
          ${this._cardChapters.map((c,i)=>`<button class="btn btn-sm ${i===this._currentCardChapter?'btn-primary':'btn-outline'}" onclick="FK.app._switchChapter(${i})">${c.name.split(' ')[0]}</button>`).join('')}
          <span style="color:var(--border);">|</span>
          <button class="btn btn-sm ${this._cardFilter==='all'?'btn-primary':'btn-outline'}" onclick="FK.app._setCardFilter('all')">全部</button>
          <button class="btn btn-sm ${this._cardFilter==='learning'?'btn-primary':'btn-outline'}" onclick="FK.app._setCardFilter('learning')">📖 不熟</button>
          <button class="btn btn-sm ${this._cardFilter==='mastered'?'btn-primary':'btn-outline'}" onclick="FK.app._setCardFilter('mastered')">⭐ 熟练</button>
        </div>
        <div id="cards-container"></div>
      </div>`;
    this._renderCardList(sections);
  },
  _switchChapter(i){this._currentCardChapter=i;this._renderCardPage(document.getElementById('app-content'));},
  _setCardFilter(f){this._cardFilter=f;this._renderCardPage(document.getElementById('app-content'));},

  _renderCardList(sections) {
    const container=document.getElementById('cards-container');if(!container)return;
    const mastery=this._getCardMastery();let html='';
    for(const[sec,cards]of Object.entries(sections)){
      html+=`<h3 style="margin:18px 0 8px;font-size:14px;color:var(--text-secondary);border-bottom:1px solid var(--border);padding-bottom:6px;">${sec}</h3><div style="display:flex;flex-direction:column;gap:12px;">`;
      cards.forEach(c=>{
        const concept=c.concept||'',cloze=c.content?.cloze||'',uid='crd_'+c.id,m=mastery[c.id]||0;
        const mColor=m>=2?'var(--success)':m===1?'var(--warning)':'var(--text-muted)';
        const mEmoji=m>=2?'⭐':m===1?'📖':'🆕';
        html+=`
          <div class="flashcard" style="background:var(--card-bg);border-radius:var(--radius-md);box-shadow:var(--shadow-sm);border:1px solid ${m>=2?'var(--success)':m===1?'var(--warning)':'var(--border)'};overflow:hidden;">
            <div id="${uid}-front" onclick="FK.app._flipCard('${uid}')" style="padding:20px;cursor:pointer;text-align:center;display:flex;align-items:center;justify-content:center;">
              <div>
                <div style="display:flex;justify-content:center;align-items:center;gap:6px;margin-bottom:8px;">
                  <span style="font-size:12px;color:${mColor};">${mEmoji}</span><span style="font-size:11px;color:var(--text-muted);">${c.section||''}</span>
                </div>
                <div style="font-size:16px;font-weight:700;color:var(--text);line-height:1.5;">${FK.utils.escapeHtml(concept)}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:10px;">点击翻转 →</div>
              </div>
            </div>
            <div id="${uid}-back" style="display:none;padding:18px;background:#fafafa;">
              <div style="font-size:15px;line-height:2;white-space:pre-wrap;padding:12px;background:#f0fff0;border-radius:6px;border:1px solid var(--success);">${FK.utils.escapeHtml((c.content?.answer||[])[0]||'暂无答案')}</div>
              ${cloze?`<div style="font-size:11px;color:var(--warning);font-weight:600;margin:10px 0 6px;">✍️ 填空自测（点击出答案）</div><div id="${uid}-cloze" data-cloze="${FK.utils.escapeHtml(cloze)}" style="font-size:14px;line-height:2.2;padding:10px;background:#fff;border-radius:6px;border:1px dashed var(--warning);white-space:pre-wrap;">${FK.app._renderClozeText(cloze,false)}</div>`:''}
              <div id="${uid}-hint" style="text-align:center;margin:8px 0;font-size:12px;color:var(--primary);cursor:pointer;" onclick="FK.app._flipCard('${uid}')">👆 点击填空显示答案</div>
              <div style="display:flex;gap:6px;margin-top:10px;">
                <button class="btn btn-sm" style="flex:1;background:${m===2?'var(--success)':'var(--bg)'};color:${m===2?'#fff':'var(--text)'};" onclick="event.stopPropagation();FK.app._rateCard('${c.id}',2)">⭐ 熟练</button>
                <button class="btn btn-sm" style="flex:1;background:${m===1?'var(--warning)':'var(--bg)'};color:${m===1?'#fff':'var(--text)'};" onclick="event.stopPropagation();FK.app._rateCard('${c.id}',1)">📖 不熟</button>
              </div>
            </div>
          </div>`;
      });
      html+='</div>';
    }
    container.innerHTML=html;
    if(!document.getElementById('flashcard-styles')){const s=document.createElement('style');s.id='flashcard-styles';s.textContent='.flashcard:hover{box-shadow:var(--shadow-md);transform:translateY(-2px);}';document.head.appendChild(s);}
  },

  _rateCard(cardId,level){const m=this._getCardMastery();m[cardId]=level;this._saveCardMastery(m);this._renderCardPage(document.getElementById('app-content'));FK.app._toast(level>=2?'⭐ 已标记熟练':level===1?'📖 已标记不熟，下次复习':'','success');},

  _flipCard(uid){const f=document.getElementById(uid+'-front'),b=document.getElementById(uid+'-back'),c=document.getElementById(uid+'-cloze'),h=document.getElementById(uid+'-hint');if(!f||!b)return;if(b.style.display==='none'){f.style.display='none';b.style.display='block';if(h)h.style.display='block';}else if(c&&c.dataset.revealed!=='true'){c.innerHTML=FK.app._renderClozeText(c.dataset.cloze||'',true);c.dataset.revealed='true';if(h)h.style.display='none';}else{b.style.display='none';f.style.display='flex';if(c){c.dataset.revealed='false';c.innerHTML=FK.app._renderClozeText(c.dataset.cloze||'',false);}if(h)h.style.display='block';}},

  _renderClozeText(t,r){if(!t)return'（暂无填空）';const e=FK.utils.escapeHtml(t);return r?e.replace(/【(.+?)】/g,'<span style="color:#C41E3A;font-weight:700;background:#FFEBEE;padding:1px 5px;border-radius:3px;">$1</span>'):e.replace(/【(.+?)】/g,'<span style="border-bottom:3px solid var(--warning);padding:0 14px;margin:0 3px;color:var(--text-muted);font-size:12px;">?</span>');},

  // ===== 随机背诵页面 =====
  _getCustomCloze() { try { return JSON.parse(localStorage.getItem('fk_custom_cloze')||'{}'); } catch(e) { return {}; } },
  _saveCustomCloze(d) { localStorage.setItem('fk_custom_cloze', JSON.stringify(d)); },

  _renderRecite(el) {
    const allCards = [...(window.FK_SEED_DATA?.civilCh1Cards||[]), ...(window.FK_SEED_DATA?.civilCh2Cards||[])];
    if (!allCards.length) { el.innerHTML='<div class="empty-state"><div class="empty-icon">🎯</div><h2>暂无背诵卡片</h2></div>'; return; }

    // 随机打乱
    const shuffled = FK.utils.shuffle([...allCards]);
    this._reciteCards = shuffled;
    this._reciteIdx = 0;
    this._reciteRevealed = false;
    this._blankHistory = [];
    this._renderReciteCard(el);
  },

  _renderReciteCard(el) {
    const cards = this._reciteCards;
    const idx = this._reciteIdx;
    if (idx >= cards.length) {
      el.innerHTML = `<div class="fade-in" style="text-align:center;padding:60px 20px;">
        <div style="font-size:64px;">🎉</div><h2>本轮背诵完成！</h2>
        <button class="btn btn-primary btn-lg" onclick="FK.app._renderRecite(document.getElementById('app-content'))">🔄 重新开始</button>
        <button class="btn btn-secondary btn-lg" onclick="FK.router.navigate('#cards')">🃏 回卡片列表</button>
      </div>`;
      return;
    }

    const card = cards[idx];
    const concept = card.concept || '';
    let answer = (card.content?.answer||[])[0] || '';
    const customCloze = this._getCustomCloze();
    const saved = customCloze[card.id] || [];

    // Apply saved blanks to answer text
    let hasBlanks = false;
    for (const b of saved) {
      if (answer.includes(b.text)) {
        answer = answer.replace(b.text, `<span data-original="${FK.utils.escapeHtml(b.text)}" style="border-bottom:2px solid var(--warning);padding:0 10px;margin:0 2px;color:var(--text-muted);font-size:13px;">（${'_'.repeat(Math.max(2, b.text.length/2))}）</span>`);
        hasBlanks = true;
      }
    }
    // Only escape if no saved blanks (otherwise trust the HTML we built)
    const displayAnswer = hasBlanks ? answer : FK.utils.escapeHtml(answer);

    // Reset history for new card
    this._blankHistory = [];
    this._reciteClozeModified = false;

    el.innerHTML = `
      <div class="fade-in" style="max-width:800px;margin:0 auto;">
        <!-- 进度 -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
          <span style="font-size:13px;color:var(--text-secondary);">🎯 随机背诵</span>
          <div class="progress-bar" style="flex:1;"><div class="progress-fill primary" style="width:${((idx+1)/cards.length)*100}%;"></div></div>
          <span style="font-size:13px;font-weight:600;">${idx+1}/${cards.length}</span>
        </div>

        <!-- 题目标题 -->
        <div class="card" style="margin-bottom:12px;text-align:center;padding:24px;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">${card.section||''}</div>
          <div style="font-size:20px;font-weight:700;color:var(--primary);line-height:1.5;">${FK.utils.escapeHtml(concept)}</div>
          ${!this._reciteRevealed ? `<div style="font-size:13px;color:var(--text-muted);margin-top:12px;">👇 点击下方查看答案</div>` : ''}
        </div>

        <!-- 答案区（可点击挖空） -->
        <div class="card" style="padding:20px;min-height:100px;cursor:${this._reciteRevealed?'default':'pointer'};"
          onclick="${this._reciteRevealed ? '' : "FK.app._revealRecite()"}">
          ${!this._reciteRevealed ? `
            <div style="text-align:center;padding:30px;color:var(--text-muted);">
              <div style="font-size:36px;margin-bottom:8px;">🔍</div>
              <div>点击此处查看完整答案</div>
            </div>
          ` : `
            <div id="recite-answer-text" style="font-size:15px;line-height:2.4;white-space:pre-wrap;padding:12px;background:#fff;border-radius:6px;border:1px solid var(--border);">${displayAnswer}</div>
            <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <button class="btn btn-sm btn-outline" onclick="FK.app._blankSelected()">✂️ 挖空选中文字</button>
              <button class="btn btn-sm btn-outline" onclick="FK.app._undoLastBlank()">↩️ 撤销</button>
              <span style="font-size:12px;color:var(--text-muted);">选中文字→点按钮挖空</span>
            </div>
          `}
        </div>

        <!-- 操作按钮 -->
        <div style="display:flex;gap:10px;margin-top:14px;justify-content:center;flex-wrap:wrap;">
          ${this._reciteRevealed ? `
            <button class="btn btn-primary" onclick="FK.app._saveReciteCloze('${card.id}')">💾 保存挖空</button>
            <button class="btn btn-outline" onclick="FK.app._resetReciteCloze()">🔄 重置</button>
          ` : ''}
          <button class="btn btn-secondary" onclick="FK.app._prevReciteCard()" ${idx===0?'disabled':''}>← 上一张</button>
          <button class="btn btn-primary" onclick="FK.app._nextReciteCard()">下一张 →</button>
        </div>
      </div>
    `;
  },

  _splitIntoWords(text) {
    const parts = text.split(/([，。、；：！？\n（）""''【】《》\s])/);
    const words = [];
    for (const p of parts) {
      if (!p) continue;
      if (/^[，。、；：！？\n（）""''【】《》\s]+$/.test(p)) { words.push(p); }
      else {
        // 固定按2字一组分割，保证一致性
        for (let i = 0; i < p.length; i += 2) {
          words.push(p.substring(i, Math.min(i+2, p.length)));
        }
      }
    }
    return words;
  },

  _revealRecite() { this._reciteRevealed = true; this._renderReciteCard(document.getElementById('app-content')); },

  _blankHistory: [], // 撤销历史

  _blankSelected() {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) { alert('请先选中要挖空的文字'); return; }
    const range = sel.getRangeAt(0);
    const text = range.toString().trim();
    if (!text) return;

    // Save to history for undo
    this._blankHistory.push({ range, text, cardId: this._reciteCards[this._reciteIdx].id });

    // Replace selected text with blank brackets
    const span = document.createElement('span');
    span.style.borderBottom = '2px solid var(--warning)';
    span.style.padding = '0 12px';
    span.style.margin = '0 2px';
    span.style.color = 'var(--text-muted)';
    span.style.fontSize = '13px';
    span.textContent = '（' + '_'.repeat(Math.max(2, text.length/2)) + '）';
    span.title = text; // Store original text in title
    span.dataset.original = text;

    range.deleteContents();
    range.insertNode(span);
    sel.removeAllRanges();

    // Update cloze words tracking
    this._reciteClozeModified = true;
  },

  _undoLastBlank() {
    if (!this._blankHistory.length) { alert('没有可撤销的操作'); return; }
    const last = this._blankHistory.pop();
    const spans = document.querySelectorAll('#recite-answer-text span[data-original]');
    // Find the last span and restore
    for (let i = spans.length - 1; i >= 0; i--) {
      if (spans[i].dataset.original === last.text) {
        spans[i].replaceWith(document.createTextNode(last.text));
        break;
      }
    }
  },

  _saveReciteCloze(cardId) {
    const custom = this._getCustomCloze();
    const spans = document.querySelectorAll('#recite-answer-text span[data-original]');
    const blanked = [];
    spans.forEach(s => { blanked.push({ text: s.dataset.original, idx: blanked.length }); });
    custom[cardId] = blanked;
    this._saveCustomCloze(custom);
    FK.app._toast(`💾 已保存 ${blanked.length} 个挖空`, 'success');
  },

  _resetReciteCloze() {
    this._blankHistory = [];
    this._renderReciteCard(document.getElementById('app-content'));
  },

  _nextReciteCard() {
    this._reciteRevealed = false;
    this._reciteClozeWords = {};
    this._reciteIdx++;
    this._renderReciteCard(document.getElementById('app-content'));
  },

  _prevReciteCard() {
    if (this._reciteIdx > 0) {
      this._reciteRevealed = false;
      this._reciteClozeWords = {};
      this._reciteIdx--;
      this._renderReciteCard(document.getElementById('app-content'));
    }
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
