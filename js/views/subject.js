// views/subject.js — 分科练习（卡片墙 + 学习地图风格）
window.FK = window.FK || {};
FK.views = FK.views || {};

FK.views.subject = {
  render(el) {
    const subjects = FK.questionBank.getAllSubjects();
    const masteries = FK.analytics.getAllSubjectMasteries();
    const papers = FK_SEED_DATA.papers || {};

    let html = `<div class="fade-in"><h1 class="page-title">📚 分科练习</h1>`;

    for (const [paperName, paperData] of Object.entries(papers)) {
      const paperSubjects = subjects.filter(s => paperData.subjects.includes(s.key));

      // 试卷统计
      let paperAnswered = 0, paperCorrect = 0;
      for (const s of paperSubjects) {
        const m = masteries[s.key] || {};
        paperAnswered += m.totalAnswered || 0;
        paperCorrect += m.totalCorrect || 0;
      }
      const paperAccuracy = paperAnswered > 0 ? Math.round((paperCorrect / paperAnswered) * 100) : 0;

      html += `
        <!-- 试卷标题栏 -->
        <div style="background:var(--card-bg);border-radius:var(--radius-md);padding:16px 20px;margin:20px 0 14px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--shadow-sm);">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:24px;">${paperName === '试卷一' ? '📕' : '📘'}</span>
            <div>
              <div style="font-weight:700;font-size:16px;">${paperName}</div>
              <div style="font-size:12px;color:var(--text-muted);">${paperData.subjects.length}个科目 · ${paperSubjects.reduce((s,subj)=>s+subj.questionCount, 0)}题可用</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:20px;font-weight:700;color:${FK.utils.accuracyColor(paperAccuracy)};">${paperAccuracy}%</div>
            <div style="font-size:11px;color:var(--text-muted);">正确率 · ${paperAnswered}题</div>
          </div>
        </div>

        <!-- 科目卡片网格 -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
      `;

      for (const s of paperSubjects) {
        const m = masteries[s.key] || { mastery: 0, totalAnswered: 0, totalCorrect: 0 };
        const pct = m.mastery;
        const qCount = s.questionCount;

        // 学习状态
        let statusIcon, statusText, borderColor;
        if (pct >= 80) { statusIcon = '⭐'; statusText = '已掌握'; borderColor = 'var(--success)'; }
        else if (pct >= 60) { statusIcon = '📖'; statusText = '学习中'; borderColor = 'var(--warning)'; }
        else if (m.totalAnswered > 0) { statusIcon = '🔴'; statusText = '需加强'; borderColor = 'var(--error)'; }
        else { statusIcon = '📋'; statusText = '未开始'; borderColor = 'var(--border)'; }

        html += `
          <div style="background:var(--card-bg);border-radius:var(--radius-md);padding:18px;box-shadow:var(--shadow-sm);border-top:3px solid ${borderColor};cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;"
            onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='var(--shadow-md)'"
            onmouseout="this.style.transform='';this.style.boxShadow='var(--shadow-sm)'"
            onclick="FK.views.subject.renderDetail('${s.key}')">

            <!-- 科目头部 -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <span style="font-size:28px;">${s.icon || '📖'}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:15px;">${s.shortName || s.key}</div>
                <div style="font-size:11px;color:var(--text-muted);">${s.knowledgePoints?.length || 0}个知识点 · ${qCount}题</div>
              </div>
              <span style="font-size:18px;" title="${statusText}">${statusIcon}</span>
            </div>

            <!-- 进度条 -->
            ${m.totalAnswered > 0 ? `
              <div style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:3px;">
                  <span>掌握度</span><span style="font-weight:600;color:${FK.utils.accuracyColor(pct)};">${pct}%</span>
                </div>
                <div class="progress-bar" style="height:5px;"><div class="progress-fill ${pct>=70?'success':pct>=50?'warning':'error'}" style="width:${Math.max(pct,3)}%;"></div></div>
              </div>
            ` : ''}

            <!-- 统计 + 按钮 -->
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:12px;color:var(--text-muted);">
                ${m.totalAnswered > 0 ? `已做${m.totalAnswered}题 · 对${m.totalCorrect}题` : '点击进入开始学习'}
              </span>
              <button class="btn btn-sm btn-outline" style="padding:3px 10px;font-size:11px;"
                onclick="event.stopPropagation();FK.views.subject.startPractice('${s.key}')">▶ 练习</button>
            </div>
          </div>
        `;
      }

      html += `</div>`;
    }

    html += `</div>`;
    el.innerHTML = html;
  },

  renderDetail(subjectKey) {
    const subjectDef = (FK_SEED_DATA.subjects || {})[subjectKey];
    if (!subjectDef) return;

    const masteries = FK.analytics.getAllSubjectMasteries();
    const m = masteries[subjectKey] || { mastery: 0 };
    const kps = FK.questionBank.getKnowledgePoints(subjectKey);
    const questions = FK.questionBank.query({ subject: subjectKey });

    const el = document.getElementById('app-content');
    const pct = m.mastery;
    const color = pct >= 70 ? 'success' : pct >= 50 ? 'warning' : 'error';

    el.innerHTML = `
      <div class="fade-in">
        <!-- 返回 + 标题 -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
          <button class="btn btn-sm btn-secondary" onclick="FK.views.subject.render(document.getElementById('app-content'))">← 返回</button>
          <h1 style="margin:0;font-size:20px;">${subjectDef.icon||''} ${subjectDef.shortName||subjectKey}</h1>
          <span class="badge badge-${color}">${m.label}</span>
        </div>

        <!-- 科目概览卡片 -->
        <div class="card" style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
            <div>
              <div style="font-size:32px;font-weight:700;color:${FK.utils.accuracyColor(pct)};">${pct}%</div>
              <div style="font-size:13px;color:var(--text-muted);">掌握度</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:32px;font-weight:700;">${questions.length}</div>
              <div style="font-size:13px;color:var(--text-muted);">可用题目</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:32px;font-weight:700;">${m.totalAnswered||0}</div>
              <div style="font-size:13px;color:var(--text-muted);">已做</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:32px;font-weight:700;">${kps.length}</div>
              <div style="font-size:13px;color:var(--text-muted);">知识点</div>
            </div>
            <button class="btn btn-primary btn-lg" onclick="FK.views.subject.startPractice('${subjectKey}')">
              ▶ 练习${subjectDef.shortName||subjectKey}（${Math.min(questions.length, 20)}题）
            </button>
          </div>
        </div>

        <!-- 知识点列表 -->
        <h2 style="margin:16px 0 12px;">📖 知识点清单</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;">
          ${kps.map(kp => {
            const progress = FK.storage.getProgress();
            const sp = progress.subjects[subjectKey];
            const kpData = sp?.knowledgePoints?.[kp.name];
            const done = kpData?.totalAnswered || 0;
            const correct = kpData?.totalCorrect || 0;
            const acc = done > 0 ? Math.round((correct / done) * 100) : 0;
            const stateColor = done === 0 ? 'var(--border)' : acc >= 70 ? 'var(--success)' : acc >= 50 ? 'var(--warning)' : 'var(--error)';
            const stateIcon = done === 0 ? '⬜' : acc >= 70 ? '✅' : acc >= 50 ? '⚠️' : '❌';

            return `
              <div style="background:var(--bg);border-left:3px solid ${stateColor};padding:12px;border-radius:var(--radius-sm);cursor:pointer;transition:transform 0.15s;"
                onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''"
                onclick="FK.views.subject.startKnowledgePractice('${subjectKey}', '${kp.name.replace(/'/g, "\\'")}')">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:14px;font-weight:500;">${stateIcon} ${kp.name}</span>
                  <span style="font-size:12px;color:var(--text-muted);">${kp.questionCount}题</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
                  ${done > 0
                    ? `<span style="font-size:12px;color:var(--text-muted);">做${done}对${correct} · 正确率${acc}%</span>`
                    : `<span style="font-size:11px;color:var(--text-muted);">尚未练习</span>`
                  }
                  <button class="btn btn-sm btn-outline" style="padding:2px 10px;font-size:11px;"
                    onclick="event.stopPropagation();FK.views.subject.startKnowledgePractice('${subjectKey}', '${kp.name.replace(/'/g, "\\'")}')">▶ 练习</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  startPractice(subjectKey) {
    const el = document.getElementById('app-content');
    FK.views.practice.render(el, subjectKey);
  },

  startKnowledgePractice(subjectKey, knowledgePoint) {
    const questionIds = FK.questionBank.query({ subject: subjectKey, knowledgePoint: knowledgePoint });
    if (questionIds.length === 0) {
      alert('该知识点暂无题目');
      return;
    }
    const practice = FK.views.practice;
    const el = document.getElementById('app-content');
    const selected = FK.utils.shuffle(questionIds).slice(0, 10);
    practice.session = null;
    practice._startSession.call(practice, el, selected, `${subjectKey} · ${knowledgePoint}`);
  }
};
