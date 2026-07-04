// views/practice.js — 答题界面
window.FK = window.FK || {};
FK.views = FK.views || {};

FK.views.practice = {
  session: null, // 当前练习会话
  timerInterval: null,
  startTime: null,

  // 渲染分科练习
  async render(el, subject) {
    this.session = null;
    const questions = FK.testGenerator.generateSubjectPractice(subject, { count: 10 });
    if (questions.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h2>该科目暂无题目</h2><p>请先导入或添加题目</p></div>`;
      return;
    }
    this._startSession(el, questions, `分科练习 · ${subject}`);
  },

  // 渲染每日测试
  renderDaily(el) {
    this.session = null;

    // 检查今天是否已完成
    const todayTest = FK.storage.getTodayTest();
    const progress = FK.storage.getProgress();
    const settings = progress.settings;
    const todayGoal = settings.dailyQuestionCount || 20;

    if (todayTest && todayTest.completed) {
      // 今日已完成 → 显示结果 + 可选择再来一套
      const score = todayTest.score || 0;
      const total = todayTest.totalQuestions || todayGoal;
      const pct = Math.round((score / total) * 100);
      const emoji = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪';
      const color = pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--error)';

      el.innerHTML = `
        <div class="fade-in" style="max-width:600px;margin:0 auto;text-align:center;">
          <div style="font-size:64px;margin-bottom:16px;">${emoji}</div>
          <h1>今日练习已完成 ✅</h1>
          <div style="font-size:48px;font-weight:700;color:${color};margin:16px 0;">${pct}%</div>
          <p style="color:var(--text-secondary);">${score} / ${total} 题正确</p>
          <div style="display:flex;gap:12px;justify-content:center;margin-top:24px;">
            <button class="btn btn-primary btn-lg" onclick="FK.views.practice._startDailyTest()">🔄 再来一套</button>
            <button class="btn btn-secondary btn-lg" onclick="FK.router.navigate('#review')">📝 去错题复习</button>
            <button class="btn btn-secondary btn-lg" onclick="FK.router.navigate('#dashboard')">📊 回仪表盘</button>
          </div>
        </div>
      `;
      return;
    }

    // 还没开始或未完成 → 显示准备页面
    const questions = FK.testGenerator.generate({});
    if (questions.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h2>题库还没有题目</h2>
          <p>请先在设置中选择科目，或在"题库导入"页面添加题目</p>
          <button class="btn btn-primary" onclick="FK.router.navigate('#import')">去导入题目 →</button>
        </div>
      `;
      return;
    }

    // 如果今天已经开始但未完成，检查进度
    if (todayTest && !todayTest.completed) {
      // 有未完成的测试，直接继续
      this._startSession(el, questions, '今日练习');
      return;
    }

    // 全新的每日测试 → 显示准备页
    const subjectBreakdown = {};
    for (const qid of questions) {
      const q = FK.questionBank.getById(qid);
      if (q?.subject) {
        const sn = (FK_SEED_DATA.subjects||{})[q.subject]?.shortName || q.subject;
        subjectBreakdown[sn] = (subjectBreakdown[sn] || 0) + 1;
      }
    }

    el.innerHTML = `
      <div class="fade-in" style="max-width:600px;margin:0 auto;text-align:center;">
        <div style="font-size:72px;margin-bottom:20px;">📋</div>
        <h1 style="margin-bottom:8px;">今日练习</h1>
        <p style="color:var(--text-secondary);font-size:16px;margin-bottom:4px;">📅 ${FK.utils.today()}</p>
        <p style="color:var(--text-muted);font-size:14px;">智能选题 · 即时批改 · 解析详解</p>

        <div class="card" style="margin:24px 0;text-align:left;">
          <div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:16px;">
            <div>
              <div style="font-size:28px;font-weight:700;color:var(--primary);">${questions.length}</div>
              <div style="font-size:13px;color:var(--text-secondary);">题目总数</div>
            </div>
            <div>
              <div style="font-size:28px;font-weight:700;color:var(--warning);">${todayGoal}</div>
              <div style="font-size:13px;color:var(--text-secondary);">每日目标</div>
            </div>
            <div>
              <div style="font-size:28px;font-weight:700;color:var(--info);">${Object.keys(subjectBreakdown).length}</div>
              <div style="font-size:13px;color:var(--text-secondary);">覆盖科目</div>
            </div>
          </div>
          ${Object.keys(subjectBreakdown).length > 0 ? `
            <div style="font-size:13px;color:var(--text-muted);text-align:center;">
              涉及：${Object.entries(subjectBreakdown).map(([s,c])=>`${s}(${c}题)`).join(' · ')}
            </div>
          ` : ''}
        </div>

        <button class="btn btn-primary btn-lg" style="font-size:18px;padding:16px 48px;"
          onclick="FK.views.practice._startDailyTest()">
          🚀 开始答题
        </button>
        <p style="margin-top:12px;font-size:13px;color:var(--text-muted);">
          答题过程中可随时查看解析，完成后自动记录成绩
        </p>
      </div>
    `;
  },

  _startDailyTest() {
    const questions = FK.testGenerator.generate({});
    if (questions.length === 0) {
      FK.router.navigate('#import');
      return;
    }
    const el = document.getElementById('app-content');
    this._startSession(el, questions, '今日练习');
  },

  _startSession(el, questionIds, title) {
    this.session = {
      questionIds,
      currentIndex: 0,
      answers: {},        // { questionId: { selected, correct, timeSpentSec } }
      title,
      startedAt: new Date().toISOString()
    };

    this._renderQuestion(el);
  },

  _renderQuestion(el) {
    const s = this.session;
    if (!s) return;

    if (s.currentIndex >= s.questionIds.length) {
      this._renderResult(el);
      return;
    }

    const qid = s.questionIds[s.currentIndex];
    const question = FK.questionBank.getById(qid);
    if (!question) {
      s.currentIndex++;
      this._renderQuestion(el);
      return;
    }

    const progress = FK.storage.getProgress();
    const qp = progress.questions[qid];

    this.startTime = Date.now();
    const total = s.questionIds.length;
    const current = s.currentIndex + 1;
    const isMulti = question.type === 'multiple_choice' || question.type === 'indefinite_choice';
    const isSubjective = question.type === 'essay' || question.type === 'case_analysis';

    el.innerHTML = `
      <div class="fade-in" style="max-width:800px;margin:0 auto;">
        <!-- 进度条 -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <span style="font-size:14px;color:var(--text-secondary);">${s.title}</span>
          <div class="progress-bar" style="flex:1;"><div class="progress-fill primary" style="width:${(current/total)*100}%"></div></div>
          <span style="font-size:14px;font-weight:600;">${current}/${total}</span>
        </div>

        <!-- 题目元信息 -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
          ${question.subject ? `<span class="badge badge-primary">${question.subject}</span>` : ''}
          ${question.type ? `<span class="badge badge-info">${FK_SEED_DATA.questionTypes[question.type]?.name || question.type}</span>` : ''}
          ${question.year ? `<span class="tag">${question.year}年</span>` : ''}
          ${FK.utils.difficultyStars(question._effectiveDifficulty || question.difficulty || 3)}
          ${qp && qp.attemptCount > 0 ? `<span class="badge badge-warning">做过${qp.attemptCount}次</span>` : ''}
        </div>

        <!-- 题干 -->
        <div class="card" style="margin-bottom:16px;">
          <div style="font-size:16px;line-height:1.8;white-space:pre-wrap;">${FK.utils.escapeHtml(question.content.stem)}</div>
        </div>

        <!-- 选项（客观题）或 文本框（主观题） -->
        <div id="options-area">
          ${isSubjective ? this._renderSubjectiveBox(question) : this._renderOptions(question, isMulti)}
        </div>

        <!-- 确认按钮（多选题） -->
        ${isMulti ? `
          <div class="multi-confirm-bar">
            <button class="btn btn-primary btn-lg" id="btn-confirm-multi" disabled
              onclick="FK.views.practice._submitAnswer('${qid}', '${question.type}')">
              确认提交
            </button>
          </div>
        ` : ''}

        <!-- 反馈区域 -->
        <div id="feedback-area"></div>

        <!-- 导航按钮 -->
        <div style="display:flex;justify-content:space-between;margin-top:20px;">
          <button class="btn btn-secondary" ${s.currentIndex === 0 ? 'disabled' : ''}
            onclick="FK.views.practice._prevQuestion()">← 上一题</button>
          <button class="btn" id="btn-next" style="background:var(--warning);color:#fff;"
            onclick="FK.views.practice._nextQuestion()">⏭️ 跳过</button>
        </div>
      </div>
    `;

    // 主观题：绑定提交按钮
    if (isSubjective) {
      document.getElementById('btn-submit-subjective').addEventListener('click', () => {
        FK.views.practice._submitSubjective(qid);
      });
      return;
    }

    // 单选题点击选项直接提交
    if (!isMulti) {
      document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.key;
          FK.views.practice._submitAnswer(qid, question.type, [key]);
        });
      });
    } else {
      // 多选题
      document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          btn.classList.toggle('selected');
          const selected = [...document.querySelectorAll('.option-btn.selected')].map(b => b.dataset.key);
          const confirmBtn = document.getElementById('btn-confirm-multi');
          if (confirmBtn) confirmBtn.disabled = selected.length === 0;
        });
      });
    }
  },

  // ===== 主观题文本框 =====
  _renderSubjectiveBox(question) {
    const qid = question.id;
    const submitted = this.session.answers[qid];

    if (submitted) {
      const userAnswer = submitted.selected[0] || '';
      const refAnswer = (question.content.answer || []).join('\n') || '暂无参考答案';

      // AI 自动评分
      const evaluation = this._evaluateAnswer(userAnswer, refAnswer, question);

      return `
        <div class="card" style="background:var(--bg);">
          <div style="font-size:14px;font-weight:600;margin-bottom:10px;">📝 你的答案：</div>
          <div style="background:#fff;padding:16px;border-radius:var(--radius-sm);white-space:pre-wrap;line-height:1.8;margin-bottom:16px;border:1px solid var(--border);">${FK.utils.escapeHtml(userAnswer) || '<span style="color:var(--text-muted);">（未填写）</span>'}</div>

          <!-- AI 评分卡 -->
          <div style="margin-bottom:16px;padding:16px;background:linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%);border-radius:var(--radius-md);color:#fff;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <span style="font-size:15px;font-weight:700;">🤖 AI 评分</span>
              <span style="font-size:28px;font-weight:700;color:${evaluation.color};">${evaluation.score}分</span>
            </div>
            <div style="font-size:13px;opacity:0.85;line-height:1.7;">${evaluation.comment}</div>
            ${evaluation.missed.length > 0 ? `
              <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.15);">
                <div style="font-size:12px;opacity:0.6;margin-bottom:6px;">⚠️ 未覆盖的关键点：</div>
                ${evaluation.missed.map(m => `<div style="font-size:12px;opacity:0.8;padding:2px 0;">· ${FK.utils.escapeHtml(m)}</div>`).join('')}
              </div>
            ` : ''}
            ${evaluation.matched.length > 0 ? `
              <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.15);">
                <div style="font-size:12px;opacity:0.6;margin-bottom:6px;">✅ 已覆盖的关键点：</div>
                ${evaluation.matched.map(m => `<div style="font-size:12px;opacity:0.8;padding:2px 0;">· ${FK.utils.escapeHtml(m)}</div>`).join('')}
              </div>
            ` : ''}
          </div>

          <div style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--success);">✅ 参考答案：</div>
          <div style="background:#f0fff0;padding:16px;border-radius:var(--radius-sm);white-space:pre-wrap;line-height:1.8;border:1px solid var(--success);max-height:500px;overflow-y:auto;">${FK.utils.escapeHtml(refAnswer)}</div>

        </div>
      `;
    }

    return `
      <div class="card">
        <div style="font-size:14px;font-weight:600;margin-bottom:10px;">📝 请输入你的答案：</div>
        <textarea id="subjective-answer" class="form-textarea" rows="10"
          placeholder="在此输入你的答案...&#10;&#10;提示：&#10;1. 先列出关键词和核心概念&#10;2. 展开论述，注意逻辑结构&#10;3. 引用相关法条或理论依据"
          style="font-size:15px;line-height:1.8;"></textarea>
        <div style="margin-top:12px;text-align:center;">
          <button class="btn btn-primary btn-lg" id="btn-submit-subjective">
            ✅ 提交答案，查看对比
          </button>
        </div>
      </div>
    `;
  },

  // AI 评分引擎：对比用户答案和参考答案
  _evaluateAnswer(userAnswer, refAnswer, question) {
    if (!userAnswer || userAnswer.trim().length < 5) {
      return {
        score: 0,
        color: 'var(--error)',
        comment: '未作答或答案过短，无法评分。请尽量写出你知道的内容，哪怕只是关键词。',
        matched: [],
        missed: ['（未作答）']
      };
    }

    // 从参考答案中提取关键点
    const keyPoints = this._extractKeyPoints(refAnswer);
    if (keyPoints.length === 0) {
      return {
        score: 50,
        color: 'var(--warning)',
        comment: '已提交答案，但参考答案暂无结构化采分点。请自行对照参考答案检查。',
        matched: [],
        missed: []
      };
    }

    // 匹配关键点
    const userClean = userAnswer.replace(/\s+/g, '');
    const matched = [];
    const missed = [];

    for (const kp of keyPoints) {
      const kpClean = kp.replace(/\s+/g, '');
      // 核心词匹配
      const coreWords = kpClean.substring(0, Math.min(8, kpClean.length));
      if (userClean.includes(coreWords) || this._fuzzyMatch(userClean, kpClean)) {
        matched.push(kp.substring(0, 80));
      } else {
        missed.push(kp.substring(0, 80));
      }
    }

    const total = keyPoints.length;
    const hit = matched.length;
    const pct = Math.round((hit / total) * 100);

    // 生成评语
    let score, color, comment;
    if (pct >= 85) {
      score = Math.round(pct * 0.85 + 10); color = 'var(--success)';
      comment = `优秀！你准确把握了 ${hit}/${total} 个关键点，论述全面、逻辑清晰。继续保持这个水平！`;
    } else if (pct >= 65) {
      score = Math.round(pct * 0.8 + 10); color = '#4CAF50';
      comment = `良好！覆盖了 ${hit}/${total} 个要点。未覆盖的部分请重点关注，完善后可以得更高分。`;
    } else if (pct >= 40) {
      score = Math.round(pct * 0.75 + 10); color = 'var(--warning)';
      comment = `一般。仅命中 ${hit}/${total} 个关键点。建议：仔细阅读参考答案，关注遗漏的知识点和法律依据。`;
    } else {
      score = Math.max(5, Math.round(pct * 0.7 + 5)); color = 'var(--error)';
      comment = `需加强。仅覆盖 ${hit}/${total} 个要点。建议：先记忆核心概念，再做此题，对比差距。`;
    }

    return { score: Math.min(100, score), color, comment, matched, missed };
  },

  // 提取采分关键点
  _extractKeyPoints(text) {
    if (!text) return [];
    const points = [];

    // 按序号分割
    const byNumber = text.split(/\n(?=[（(]?\d+[)）.．、])/);
    if (byNumber.length >= 3) {
      for (const p of byNumber) {
        const cleaned = p.replace(/^[（(]?\d+[)）.．、]\s*/, '').trim();
        if (cleaned.length > 6) points.push(cleaned.substring(0, 150));
      }
      return points.filter((p, i) => i < 12); // 最多12个点
    }

    // 按关键词分割（① ② 或第一 第二 或首先 其次）
    const byKeyword = text.split(/[①②③④⑤⑥⑦⑧⑨⑩]|第[一二三四五六七八九十]|[首其再另]|一是|二是|三是|四是|五是/);
    if (byKeyword.length >= 3) {
      for (const p of byKeyword) {
        const cleaned = p.replace(/^[，,、\s]+/, '').trim();
        if (cleaned.length > 6) points.push(cleaned.substring(0, 150));
      }
      return points.filter((p, i) => i < 12);
    }

    // 按句号分
    const byPeriod = text.split(/[。；;]/).filter(s => s.trim().length > 8);
    if (byPeriod.length >= 3) {
      return byPeriod.slice(0, 10).map(s => s.trim().substring(0, 150));
    }

    return [];
  },

  // 模糊匹配
  _fuzzyMatch(userText, keyPoint) {
    // 从关键点提取核心词，检查是否出现在用户答案中
    const coreTerms = keyPoint.replace(/[，,。.、；;：:（）()\s]/g, '').substring(0, 6);
    if (coreTerms.length >= 3 && userText.includes(coreTerms)) return true;

    // 提取关键点中的名词短语（2-4字）
    const phrases = keyPoint.match(/[一-鿿]{2,4}/g) || [];
    let matchCount = 0;
    for (const phrase of phrases) {
      if (userText.includes(phrase)) matchCount++;
    }
    return matchCount >= Math.max(1, phrases.length * 0.4);
  },

  _skipSubjective(qid) {
    if (this.session.answers[qid] !== undefined) return;
    this.session.answers[qid] = { selected: [''], correct: true, timeSpentSec: 0 };
    this._nextQuestion();
  },

  _updateScore(qid, total) {
    const checks = document.querySelectorAll('.score-check-' + qid);
    let count = 0;
    checks.forEach(c => { if (c.checked) count++; });
    const display = document.getElementById('self-score-display-' + qid);
    if (display) {
      const pct = Math.round((count / total) * 100);
      display.textContent = count + '/' + total;
      display.style.color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--error)';
    }
    // 保存自评分数
    if (this.session) {
      this.session.answers[qid].selfScore = count;
      this.session.answers[qid].totalScore = total;
    }
  },

  _selectAll(qid, select) {
    const checks = document.querySelectorAll('.score-check-' + qid);
    checks.forEach(c => { c.checked = select; });
    const question = FK.questionBank.getById(qid);
    const total = (question?.scoringPoints || []).length;
    this._updateScore(qid, total || checks.length);
  },

  _submitSubjective(qid) {
    if (this.session.answers[qid] !== undefined) return;

    const textarea = document.getElementById('subjective-answer');
    const userAnswer = textarea ? textarea.value.trim() : '';
    const timeSpentSec = Math.round((Date.now() - this.startTime) / 1000);

    this.session.answers[qid] = { selected: [userAnswer], correct: true, timeSpentSec };

    // 记录作答（主观题始终算"正确"——关键是看了参考答案）
    const question = FK.questionBank.getById(qid);
    FK.storage.recordAnswer({
      questionId: qid,
      subject: question?.subject,
      knowledgePoint: question?.knowledgePoint,
      questionType: question?.type,
      selectedAnswer: ['(主观题)'],
      correct: true,
      timeSpentSec
    });

    // 更新SR
    const quality = userAnswer.length > 20 ? 4 : 2;
    const progress = FK.storage.getProgress();
    FK.spacedRepetition.update(progress.questions[qid], quality);
    FK.storage.updateSR(qid, { easeFactor: 2.5, intervalDays: 1, nextReviewDate: FK.utils.addDays(FK.utils.today(), 1), reviewCount: 1 });

    // 重新渲染题目（显示对比），更新跳过为下一题
    const el = document.getElementById('app-content');
    this._renderQuestion(el);
    setTimeout(() => {
      const nb = document.getElementById('btn-next');
      if (nb) {
        nb.textContent = '下一题 →';
        nb.style.background = 'var(--primary)';
        nb.style.color = '#fff';
      }
    }, 50);
  },

  _renderOptions(question, isMulti) {
    return (question.content.options || []).map(opt => `
      <button class="option-btn" data-key="${opt.key}">
        <span class="option-key">${opt.key}</span>${FK.utils.escapeHtml(opt.text)}
      </button>
    `).join('');
  },

  _submitAnswer(qid, type, singleSelection) {
    // 防止重复提交
    if (this.session.answers[qid] !== undefined) return;

    const question = FK.questionBank.getById(qid);
    let selected;

    if (singleSelection) {
      selected = singleSelection;
    } else {
      selected = [...document.querySelectorAll('.option-btn.selected')].map(b => b.dataset.key);
    }

    if (selected.length === 0) return;

    // 禁用所有选项
    document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
    const confirmBtn = document.getElementById('btn-confirm-multi');
    if (confirmBtn) confirmBtn.style.display = 'none';

    const timeSpentSec = Math.round((Date.now() - this.startTime) / 1000);
    const correctAnswer = question.content.answer || [];
    const correct = this._arraysEqual(selected.sort(), correctAnswer.sort());

    // 保存
    this.session.answers[qid] = { selected, correct, timeSpentSec };

    // 记录到 storage
    FK.storage.recordAnswer({
      questionId: qid,
      subject: question.subject,
      knowledgePoint: question.knowledgePoint,
      questionType: question.type,
      selectedAnswer: selected,
      correct,
      timeSpentSec
    });

    // 更新 SR
    const quality = correct ? (timeSpentSec < 30 ? 5 : timeSpentSec < 90 ? 4 : 3) : 1;
    const progress = FK.storage.getProgress();
    const qp = progress.questions[qid];
    const srData = FK.spacedRepetition.update(qp, quality);
    FK.storage.updateSR(qid, srData);

    // 显示反馈
    this._showFeedback(question, selected, correct, correctAnswer);

    // 标记选项
    document.querySelectorAll('.option-btn').forEach(btn => {
      const key = btn.dataset.key;
      if (correctAnswer.includes(key)) {
        btn.classList.add('correct');
      }
      if (selected.includes(key) && !correctAnswer.includes(key)) {
        btn.classList.add('wrong');
      }
      if (selected.includes(key) && correctAnswer.includes(key)) {
        btn.classList.add('correct');
      }
    });

    // 跳过变下一题
    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) {
      nextBtn.textContent = '下一题 →';
      nextBtn.style.background = 'var(--primary)';
      nextBtn.style.color = '#fff';
      nextBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  _showFeedback(question, selected, correct, correctAnswer) {
    const feedback = document.getElementById('feedback-area');
    if (!feedback) return;

    const userAnswerStr = selected.join('');
    const correctAnswerStr = correctAnswer.join('');

    feedback.innerHTML = `
      <div class="feedback-panel ${correct ? 'correct' : 'wrong'}">
        <div class="feedback-title">${correct ? '✅ 回答正确！' : '❌ 回答错误'}</div>
        <p style="margin-bottom:8px;">你的答案：<strong>${userAnswerStr}</strong>　|　正确答案：<strong>${correctAnswerStr}</strong></p>
        ${question.content.explanation ? `
          <div style="margin-top:8px;">
            <strong>📖 解析：</strong>
            <div class="explanation" style="margin-top:4px;">${FK.utils.escapeHtml(question.content.explanation)}</div>
          </div>
        ` : ''}
      </div>
    `;
    // Scroll feedback into view
    feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  _nextQuestion() {
    clearTimeout(this._autoNextTimer);
    // 如果当前题未答，记录为跳过
    const qid = this.session.questionIds[this.session.currentIndex];
    if (qid && this.session.answers[qid] === undefined) {
      const question = FK.questionBank.getById(qid);
      this.session.answers[qid] = {
        selected: question?.type === 'essay' || question?.type === 'case_analysis' ? [''] : [],
        correct: false,
        timeSpentSec: 0,
        skipped: true
      };
    }
    this.session.currentIndex++;
    const el = document.querySelector('.content-area') || document.getElementById('app-content');
    if (el) this._renderQuestion(el);
  },

  _prevQuestion() {
    clearTimeout(this._autoNextTimer);
    if (this.session.currentIndex > 0) {
      // 清除当前题的答案记录，回看时重新作答
      const currentQid = this.session.questionIds[this.session.currentIndex];
      if (currentQid) delete this.session.answers[currentQid];
      this.session.currentIndex--;
      // 也清除上一题的答案，确保回看时题目是干净的
      const prevQid = this.session.questionIds[this.session.currentIndex];
      if (prevQid) delete this.session.answers[prevQid];
      const el = document.querySelector('.content-area') || document.getElementById('app-content');
      if (el) this._renderQuestion(el);
    }
  },

  _renderResult(el) {
    const s = this.session;
    const total = s.questionIds.length;
    const answered = Object.values(s.answers);
    const correct = answered.filter(a => a.correct).length;
    const accuracy = answered.length > 0 ? Math.round((correct / answered.length) * 100) : 0;
    const totalTime = answered.reduce((sum, a) => sum + a.timeSpentSec, 0);

    // 保存每日测试记录
    if (s.title === '今日练习') {
      FK.storage.saveDailyTest({
        date: FK.utils.today(),
        questionIds: s.questionIds,
        completed: answered.length === total,
        score: correct,
        totalQuestions: total,
        startedAt: s.startedAt,
        completedAt: new Date().toISOString()
      });
    }

    const color = accuracy >= 70 ? 'var(--success)' : accuracy >= 50 ? 'var(--warning)' : 'var(--error)';
    const emoji = accuracy >= 80 ? '🎉' : accuracy >= 60 ? '👍' : '💪';

    // 主观题自评分数统计
    const scored = answered.filter(a => a.selfScore !== undefined);
    const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, a) => s + (a.selfScore || 0), 0) / scored.reduce((s, a) => s + (a.totalScore || 1), 0) * 100) : null;

    el.innerHTML = `
      <div class="fade-in" style="max-width:600px;margin:0 auto;text-align:center;">
        <div style="font-size:64px;margin-bottom:16px;">${emoji}</div>
        <h1 style="margin-bottom:8px;">${s.title}完成！</h1>
        ${avgScore !== null
          ? `<div style="font-size:48px;font-weight:700;color:${FK.utils.accuracyColor(avgScore)};margin:16px 0;">${avgScore}%</div>
             <p style="color:var(--text-secondary);">自评得分 · 已答${scored.length}/${total}题</p>`
          : `<div style="font-size:48px;font-weight:700;color:${color};margin:16px 0;">${accuracy}%</div>`
        }
        <div style="display:flex;justify-content:center;gap:24px;margin-bottom:24px;color:var(--text-secondary);">
          <div><strong>${total}</strong> 总题数</div>
          <div><strong style="color:var(--success);">${correct}</strong> 正确</div>
          <div><strong style="color:var(--error);">${total - correct}</strong> 错误</div>
          <div><strong>${Math.round(totalTime/60)}</strong> 分钟</div>
        </div>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button class="btn btn-primary btn-lg" onclick="FK.views.practice.renderDaily(document.getElementById('app-content'))">再来一套 →</button>
          <button class="btn btn-secondary btn-lg" onclick="FK.router.navigate('#dashboard')">返回仪表盘</button>
        </div>
      </div>
    `;
  },

  _arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
};
