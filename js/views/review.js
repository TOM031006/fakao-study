// views/review.js — 错题复习视图
window.FK = window.FK || {};
FK.views = FK.views || {};

FK.views.review = {
  session: null,
  startTime: null,
  _autoNextTimer: null,

  render(el, subjectFilter) {
    const wrongQs = FK.testGenerator.getWrongQuestions(subjectFilter);
    const subjects = FK_SEED_DATA.subjects || {};
    const progress = FK.storage.getProgress();

    // 也获取需要 SR 复习的题目
    const dueSR = FK.spacedRepetition.getDueQuestions(progress);
    const dueIds = new Set(dueSR.map(d => d.id));
    const srQuestionIds = dueSR.filter(d => FK.questionBank.getById(d.id)).map(d => d.id);

    // 合并：错题 + SR到期题（去重）
    const allIds = new Set([...wrongQs.map(w => w.id), ...srQuestionIds]);

    if (allIds.size === 0) {
      el.innerHTML = `
        <div class="fade-in">
          <h1 class="page-title">🔄 错题复习</h1>
          <div class="empty-state">
            <div class="empty-icon">🎉</div>
            <h2>暂无需要复习的题目</h2>
            <p>继续做题，答错的题目会自动出现在这里</p>
            <button class="btn btn-primary" onclick="FK.router.navigate('#practice/daily')">去每日练习 →</button>
          </div>
        </div>
      `;
      return;
    }

    // 显示概览
    let html = `
      <div class="fade-in">
        <h1 class="page-title">🔄 错题复习</h1>
        <div class="stat-cards">
          <div class="stat-card"><div class="stat-icon" style="background:#FFEBEE;">📝</div><div class="stat-info"><div class="stat-value">${allIds.size}</div><div class="stat-label">待复习题目</div></div></div>
          <div class="stat-card"><div class="stat-icon" style="background:#FFF8E1;">⏰</div><div class="stat-info"><div class="stat-value">${srQuestionIds.length}</div><div class="stat-label">SR到期题目</div></div></div>
          <div class="stat-card"><div class="stat-icon" style="background:#E3F2FD;">❌</div><div class="stat-info"><div class="stat-value">${wrongQs.length}</div><div class="stat-label">低正确率题目</div></div></div>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><span class="card-title">复习列表</span></div>
          <div style="max-height:400px;overflow-y:auto;">
    `;

    // 列出待复习题目
    const questionIds = [...allIds];
    for (const qid of questionIds.slice(0, 30)) {
      const question = FK.questionBank.getById(qid);
      if (!question) continue;

      const qp = progress.questions[qid];
      const accuracy = qp ? Math.round((qp.correctCount / Math.max(qp.attemptCount, 1)) * 100) : 0;
      const subjectDef = question.subject ? subjects[question.subject] : null;

      html += `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:500;margin-bottom:2px;">
              ${subjectDef ? subjectDef.icon : ''} ${question.subject || ''} · ${FK.utils.escapeHtml(question.content.stem.substring(0, 40))}...
            </div>
            <div style="font-size:12px;color:var(--text-muted);">
              ${qp ? `做过${qp.attemptCount}次 · 正确率${accuracy}%` : '未做过'}
              ${qp?.nextReviewDate ? ` · 下次复习: ${qp.nextReviewDate}` : ''}
            </div>
          </div>
          <span class="badge badge-${accuracy < 50 ? 'error' : accuracy < 70 ? 'warning' : 'success'}">${accuracy}%</span>
        </div>
      `;
    }

    if (allIds.size > 30) {
      html += `<p style="text-align:center;color:var(--text-muted);padding:10px;">...还有 ${allIds.size - 30} 道题</p>`;
    }

    html += `
          </div>
        </div>
        <div style="text-align:center;">
          <button class="btn btn-primary btn-lg" onclick="FK.views.review.startReview()">
            ▶ 开始复习（${Math.min(allIds.size, 20)}题）
          </button>
        </div>
      </div>
    `;

    el.innerHTML = html;
  },

  startReview() {
    const progress = FK.storage.getProgress();
    const wrongQs = FK.testGenerator.getWrongQuestions();
    const dueSR = FK.spacedRepetition.getDueQuestions(progress);
    const allIds = [...new Set([...wrongQs.map(w => w.id), ...dueSR.map(d => d.id)])];

    const selected = FK.utils.shuffle(allIds).slice(0, 20);
    if (selected.length === 0) return;

    this.session = {
      questionIds: selected,
      currentIndex: 0,
      answers: {},
      title: '错题复习',
      startedAt: new Date().toISOString()
    };

    const el = document.getElementById('app-content');
    this._renderQuestion(el);
  },

  _renderQuestion(el) {
    // 复用 practice 的渲染逻辑
    const s = this.session;
    if (!s || s.currentIndex >= s.questionIds.length) {
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

    this.startTime = Date.now();
    const total = s.questionIds.length;
    const current = s.currentIndex + 1;
    const isMulti = question.type === 'multiple_choice' || question.type === 'indefinite_choice';
    const isSubjective = question.type === 'essay' || question.type === 'case_analysis';

    el.innerHTML = `
      <div class="fade-in" style="max-width:800px;margin:0 auto;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <span style="font-size:14px;color:var(--text-secondary);">错题复习</span>
          <div class="progress-bar" style="flex:1;"><div class="progress-fill primary" style="width:${(current/total)*100}%"></div></div>
          <span style="font-size:14px;font-weight:600;">${current}/${total}</span>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:16px;">
          ${question.subject ? `<span class="badge badge-primary">${question.subject}</span>` : ''}
          <span class="badge badge-info">${FK_SEED_DATA.questionTypes[question.type]?.name || question.type}</span>
          ${question.year ? `<span class="tag">${question.year}年</span>` : ''}
          ${question.difficulty ? `<span class="tag">${FK.utils.difficultyLabel(question.difficulty)}</span>` : ''}
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div style="font-size:16px;line-height:1.8;white-space:pre-wrap;">${FK.utils.escapeHtml(question.content.stem)}</div>
        </div>

        <div id="options-area">
          ${isSubjective ? FK.views.practice._renderSubjectiveBox(question) : (question.content.options || []).map(opt => `
            <button class="option-btn" data-key="${opt.key}">
              <span class="option-key">${opt.key}</span>${FK.utils.escapeHtml(opt.text)}
            </button>
          `).join('')}
        </div>

        ${isMulti ? `
          <div class="multi-confirm-bar">
            <button class="btn btn-primary btn-lg" id="btn-confirm-multi" disabled
              onclick="FK.views.review._submitAnswer('${qid}', '${question.type}')">确认提交</button>
          </div>
        ` : ''}

        <div id="feedback-area"></div>

        <div style="display:flex;justify-content:space-between;margin-top:20px;">
          <button class="btn btn-secondary" ${current === 1 ? 'disabled' : ''}
            onclick="FK.views.review._prevQuestion()">← 上一题</button>
          <button class="btn" id="btn-next" style="background:var(--warning);color:#fff;"
            onclick="FK.views.review._nextQuestion()">⏭️ 跳过</button>
        </div>
      </div>
    `;

    // 主观题：绑定提交按钮（复用practice的方法）
    if (isSubjective) {
      const submitBtn = document.getElementById('btn-submit-subjective');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => {
          // 使用review自己的提交逻辑
          const textarea = document.getElementById('subjective-answer');
          const userAnswer = textarea ? textarea.value.trim() : '';
          const timeSpentSec = Math.round((Date.now() - this.startTime) / 1000);
          const question = FK.questionBank.getById(qid);
          this.session.answers[qid] = { selected: [userAnswer], correct: true, timeSpentSec };
          FK.storage.recordAnswer({
            questionId: qid, subject: question?.subject, knowledgePoint: question?.knowledgePoint,
            questionType: question?.type, selectedAnswer: ['(主观题)'], correct: true, timeSpentSec
          });
          this._renderQuestion(document.getElementById('app-content'));
          setTimeout(() => {
            const nb = document.getElementById('btn-next');
            if (nb) { nb.textContent = '下一题 →'; nb.style.background = 'var(--primary)'; nb.style.color = '#fff'; }
          }, 50);
        });
      }
      return;
    }

    if (!isMulti) {
      document.querySelectorAll('.option-btn').forEach(btn => {
        btn.onclick = () => {
          const key = btn.dataset.key;
          this._submitAnswer(qid, question.type, [key]);
        };
      });
    } else {
      document.querySelectorAll('.option-btn').forEach(btn => {
        btn.onclick = () => {
          btn.classList.toggle('selected');
          const sel = [...document.querySelectorAll('.option-btn.selected')].map(b => b.dataset.key);
          const cb = document.getElementById('btn-confirm-multi');
          if (cb) cb.disabled = sel.length === 0;
        };
      });
    }
  },

  _submitAnswer(qid, type, singleSelection) {
    if (this.session.answers[qid] !== undefined) return;

    const question = FK.questionBank.getById(qid);
    let selected = singleSelection || [...document.querySelectorAll('.option-btn.selected')].map(b => b.dataset.key);
    if (selected.length === 0) return;

    document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
    const cb = document.getElementById('btn-confirm-multi');
    if (cb) cb.style.display = 'none';

    const timeSpentSec = Math.round((Date.now() - this.startTime) / 1000);
    const correctAnswer = question.content.answer || [];
    const correct = this._arraysEqual(selected.sort(), correctAnswer.sort());

    this.session.answers[qid] = { selected, correct, timeSpentSec };

    FK.storage.recordAnswer({
      questionId: qid, subject: question.subject, knowledgePoint: question.knowledgePoint,
      questionType: question.type, selectedAnswer: selected, correct, timeSpentSec
    });

    const quality = correct ? (timeSpentSec < 30 ? 5 : 4) : 1;
    const progress = FK.storage.getProgress();
    const srData = FK.spacedRepetition.update(progress.questions[qid], quality);
    FK.storage.updateSR(qid, srData);

    // 显示反馈
    const feedback = document.getElementById('feedback-area');
    if (feedback) {
      feedback.innerHTML = `
        <div class="feedback-panel ${correct ? 'correct' : 'wrong'}">
          <div class="feedback-title">${correct ? '✅ 回答正确！' : '❌ 回答错误'}</div>
          <p>你的答案：<strong>${selected.join('')}</strong>　|　正确答案：<strong>${correctAnswer.join('')}</strong></p>
          ${question.content.explanation ? `<div style="margin-top:8px;"><strong>📖 解析：</strong><div class="explanation">${FK.utils.escapeHtml(question.content.explanation)}</div></div>` : ''}
        </div>
      `;
      feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    document.querySelectorAll('.option-btn').forEach(btn => {
      const key = btn.dataset.key;
      if (correctAnswer.includes(key)) btn.classList.add('correct');
      if (selected.includes(key) && !correctAnswer.includes(key)) btn.classList.add('wrong');
      if (selected.includes(key) && correctAnswer.includes(key)) btn.classList.add('correct');
    });

    // 跳过变下一题
    const nb = document.getElementById('btn-next');
    if (nb) {
      nb.textContent = '下一题 →';
      nb.style.background = 'var(--primary)';
      nb.style.color = '#fff';
    }
  },

  _nextQuestion() {
    const qid = this.session.questionIds[this.session.currentIndex];
    if (qid && this.session.answers[qid] === undefined) {
      this.session.answers[qid] = { selected: [], correct: false, timeSpentSec: 0, skipped: true };
    }
    this.session.currentIndex++;
    this._renderQuestion(document.getElementById('app-content'));
  },

  _prevQuestion() {
    if (this.session.currentIndex > 0) {
      const currentQid = this.session.questionIds[this.session.currentIndex];
      if (currentQid) delete this.session.answers[currentQid];
      this.session.currentIndex--;
      const prevQid = this.session.questionIds[this.session.currentIndex];
      if (prevQid) delete this.session.answers[prevQid];
      this._renderQuestion(document.getElementById('app-content'));
    }
  },

  _renderResult(el) {
    const s = this.session;
    const total = s.questionIds.length;
    const answered = Object.values(s.answers);
    const correct = answered.filter(a => a.correct).length;
    const accuracy = answered.length > 0 ? Math.round((correct / answered.length) * 100) : 0;
    const emoji = accuracy >= 80 ? '🎉' : accuracy >= 60 ? '👍' : '💪';
    const color = accuracy >= 70 ? 'var(--success)' : accuracy >= 50 ? 'var(--warning)' : 'var(--error)';

    el.innerHTML = `
      <div class="fade-in" style="max-width:600px;margin:0 auto;text-align:center;">
        <div style="font-size:64px;margin-bottom:16px;">${emoji}</div>
        <h1>复习完成！</h1>
        <div style="font-size:48px;font-weight:700;color:${color};margin:16px 0;">${accuracy}%</div>
        <div style="display:flex;justify-content:center;gap:24px;margin-bottom:24px;">
          <div><strong>${total}</strong> 题</div>
          <div style="color:var(--success);"><strong>${correct}</strong> 正确</div>
          <div style="color:var(--error);"><strong>${total - correct}</strong> 错误</div>
        </div>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button class="btn btn-primary btn-lg" onclick="FK.views.review.render(document.getElementById('app-content'))">返回复习列表</button>
          <button class="btn btn-secondary btn-lg" onclick="FK.router.navigate('#dashboard')">返回仪表盘</button>
        </div>
      </div>
    `;
  },

  _arraysEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
};
