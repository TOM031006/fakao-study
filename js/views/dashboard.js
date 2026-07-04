// views/dashboard.js — 个性化仪表盘
window.FK = window.FK || {};
FK.views = FK.views || {};

FK.views.dashboard = {
  render(el) {
    const progress = FK.storage.getProgress();
    const summary = FK.models.getSummary(progress);
    const settings = progress.settings;
    const readiness = FK.analytics.getReadiness();
    const weakAreas = FK.analytics.getWeakAreas();
    const recs = FK.analytics.getRecommendations();
    const stats = FK.questionBank.getStats();
    const trend = FK.analytics.getTrend();
    const today = FK.utils.today();
    const todayRecord = progress.dailyRecords.find(r => r.date === today);
    const userName = settings.userName || '法考生';
    const todayAnswered = todayRecord?.totalAnswered || 0;
    const todayGoal = settings.dailyQuestionCount || 20;
    const todayProgress = Math.min(Math.round((todayAnswered / todayGoal) * 100), 100);

    // 根据时间生成问候语
    const hour = new Date().getHours();
    const greeting = hour < 6 ? '夜深了' : hour < 9 ? '早上好' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

    // 备考天数估算
    const firstRecord = progress.dailyRecords[0];
    const studyDays = firstRecord ? Math.max(FK.utils.daysBetween(firstRecord.date, today) + 1, 1) : 0;
    const totalStudyMin = Math.round((progress.dailyRecords.reduce((s, r) => s + (r.totalTimeSec || 0), 0)) / 60);

    // 估计总分（客观题300分满分）
    const estimatedScore = readiness.overall > 0 ? Math.round(readiness.overall * 3) : '--';

    el.innerHTML = `
      <div class="fade-in">

        <!-- ===== 横幅：个人信息 + 问候 ===== -->
        <div style="background:linear-gradient(135deg, #1a1a2e 0%, #2a1a3e 50%, #1a1a2e 100%);color:#fff;border-radius:var(--radius-lg);padding:28px 28px 24px;margin-bottom:20px;position:relative;overflow:hidden;">
          <!-- 背景装饰 -->
          <div style="position:absolute;right:-20px;top:-20px;font-size:140px;opacity:0.05;">⚖️</div>
          <div style="position:absolute;left:60%;bottom:-30px;width:200px;height:200px;background:radial-gradient(circle, var(--primary) 0%, transparent 70%);opacity:0.15;border-radius:50%;"></div>

          <div style="position:relative;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
              <!-- 左侧：头像 + 信息 -->
              <div style="display:flex;align-items:center;gap:16px;">
                <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg, var(--primary) 0%, #e8475f 100%);display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 4px 16px rgba(196,30,58,0.4);">
                  👤
                </div>
                <div>
                  <div style="font-size:24px;font-weight:700;margin-bottom:2px;">
                    ${greeting}，<span style="color:var(--gold-light);">${FK.utils.escapeHtml(userName)}</span>
                  </div>
                  <div style="font-size:14px;opacity:0.7;">
                    ${summary.totalAnswered > 0
                      ? `已坚持学习 <strong style="color:#fff;">${studyDays}</strong> 天 · 累计刷题 <strong style="color:#fff;">${summary.totalAnswered}</strong> 道`
                      : '新的一天，新的开始'}
                    ${progress.streak.current >= 3 ? ` · 🔥 连续 <strong style="color:#fff;">${progress.streak.current}</strong> 天打卡` : ''}
                  </div>
                </div>
              </div>
              <!-- 右侧：修改姓名 -->
              <button style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#ccc;padding:6px 14px;border-radius:20px;cursor:pointer;font-size:13px;font-family:inherit;transition:all 0.2s;"
                onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'"
                onclick="FK.app._showNameEditor()">✏️ 修改</button>
            </div>

            <!-- 副统计行 -->
            ${summary.totalAnswered > 0 ? `
              <div style="display:flex;gap:32px;margin-top:20px;flex-wrap:wrap;">
                <div style="text-align:center;">
                  <div style="font-size:26px;font-weight:700;">${summary.accuracy}<span style="font-size:16px;">%</span></div>
                  <div style="font-size:12px;opacity:0.6;">总体正确率</div>
                </div>
                <div style="text-align:center;">
                  <div style="font-size:26px;font-weight:700;">${studyDays}</div>
                  <div style="font-size:12px;opacity:0.6;">备考天数</div>
                </div>
                <div style="text-align:center;">
                  <div style="font-size:26px;font-weight:700;">${totalStudyMin}</div>
                  <div style="font-size:12px;opacity:0.6;">学习分钟</div>
                </div>
                <div style="text-align:center;">
                  <div style="font-size:26px;font-weight:700;">${progress.streak.current}</div>
                  <div style="font-size:12px;opacity:0.6;">连续打卡</div>
                </div>
                <div style="text-align:center;">
                  <div style="font-size:26px;font-weight:700;color:var(--gold-light);">${estimatedScore}</div>
                  <div style="font-size:12px;opacity:0.6;">估分 /300</div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- ===== 今日任务卡 + 快速入口 ===== -->
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:20px;">

          <!-- 今日任务 -->
          <div class="card" style="padding:24px;cursor:pointer;" onclick="FK.router.navigate('#practice/daily')">
            <div style="display:flex;align-items:center;gap:16px;">
              <div style="position:relative;width:80px;height:80px;flex-shrink:0;">
                <svg viewBox="0 0 36 36" style="width:80px;height:80px;transform:rotate(-90deg);">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#eee" stroke-width="3"/>
                  <circle cx="18" cy="18" r="15.5" fill="none"
                    stroke="${todayProgress >= 100 ? '#2D8B4E' : '#C41E3A'}"
                    stroke-width="3" stroke-linecap="round"
                    stroke-dasharray="${todayProgress * 0.9739} 97.39"/>
                </svg>
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;">
                  <span style="font-size:20px;font-weight:700;">${todayProgress}%</span>
                </div>
              </div>
              <div style="flex:1;">
                <div style="font-size:18px;font-weight:700;margin-bottom:4px;">
                  ${todayProgress >= 100 ? '🎉 今日目标达成！' : todayAnswered > 0 ? '📝 今日进行中' : '📋 今日任务'}
                </div>
                <div style="font-size:14px;color:var(--text-secondary);margin-bottom:4px;">
                  ${todayAnswered > 0
                    ? `已完成 <strong>${todayAnswered}</strong> / ${todayGoal} 题 · 正确 <strong>${todayRecord?.totalCorrect||0}</strong> 题`
                    : `点击开始今天的 ${todayGoal} 道练习题`}
                </div>
                ${todayAnswered > 0 ? `
                  <div class="progress-bar" style="height:6px;"><div class="progress-fill ${todayProgress>=100?'success':'primary'}" style="width:${todayProgress}%;"></div></div>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- 快速入口 -->
          <div class="card" style="padding:16px;">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;">⚡ 快捷操作</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              <button class="btn btn-sm" style="justify-content:flex-start;background:var(--error-light);color:var(--error);"
                onclick="FK.router.navigate('#review')">🔄 错题复习</button>
              <button class="btn btn-sm" style="justify-content:flex-start;background:var(--info-light);color:var(--info);"
                onclick="FK.router.navigate('#analytics')">📈 学习分析</button>
              <button class="btn btn-sm" style="justify-content:flex-start;background:var(--warning-light);color:#b57a00;"
                onclick="FK.router.navigate('#subjects')">📚 分科练习</button>
              <button class="btn btn-sm" style="justify-content:flex-start;background:var(--bg);color:var(--text-secondary);"
                onclick="FK.router.navigate('#questions')">📋 题库管理</button>
            </div>
          </div>
        </div>

        <!-- ===== 两栏：弱点 + 建议 ===== -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">

          <!-- 薄弱环节 -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">⚠️ 需要加强</span>
              <span class="badge ${weakAreas.length>0?'badge-error':'badge-success'}">${weakAreas.length}项</span>
            </div>
            <div style="max-height:280px;overflow-y:auto;">
              ${weakAreas.length === 0
                ? `<div style="text-align:center;padding:30px 0;color:var(--text-muted);">
                    <div style="font-size:40px;margin-bottom:8px;">🌟</div>
                    ${summary.totalAnswered > 0 ? '暂无薄弱项，继续保持！' : '开始做题后自动检测薄弱环节'}
                  </div>`
                : weakAreas.slice(0, 6).map(w => `
                  <div style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;"
                    onclick="FK.views.subject.renderDetail('${w.subject}')">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <div>
                        <span style="font-size:14px;font-weight:500;">${w.subjectShortName}</span>
                        <span style="font-size:13px;color:var(--text-muted);"> · ${w.knowledgePoint}</span>
                      </div>
                      <span style="font-weight:600;color:var(--error);">${w.mastery}%</span>
                    </div>
                    <div style="font-size:12px;color:var(--text-muted);">${w.totalAnswered}做/${w.totalCorrect}对</div>
                  </div>
                `).join('')
              }
            </div>
          </div>

          <!-- 建议 + 趋势 -->
          <div class="card">
            <div class="card-header"><span class="card-title">💡 学习建议</span></div>
            <div style="max-height:280px;overflow-y:auto;">
              ${recs.length === 0
                ? `<div style="text-align:center;padding:30px 0;color:var(--text-muted);">
                    <div style="font-size:40px;margin-bottom:8px;">🚀</div>
                    完成首次练习后获取个性化建议
                  </div>`
                : recs.map(r => `
                  <div style="padding:10px 0;border-bottom:1px solid var(--border);">
                    <div style="font-size:14px;font-weight:500;">${r.title}</div>
                    <div style="font-size:13px;color:var(--text-muted);">${r.detail}</div>
                    ${r.route ? `<a href="${r.route}" style="font-size:13px;color:var(--primary);">${r.action||'去看看'} →</a>` : ''}
                  </div>
                `).join('')
              }

              ${summary.totalAnswered > 0 ? `
                <div style="margin-top:12px;padding-top:12px;border-top:2px solid var(--border);">
                  <div style="font-size:13px;font-weight:600;margin-bottom:6px;">📈 近期趋势</div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:20px;">${trend.direction==='improving'?'📈':trend.direction==='declining'?'📉':'➡️'}</span>
                    <span style="font-size:14px;color:${trend.direction==='improving'?'var(--success)':trend.direction==='declining'?'var(--error)':'var(--text-secondary)'};">
                      ${trend.direction==='improving'?`正确率上升 ${trend.delta}%`:trend.direction==='declining'?`正确率下降 ${Math.abs(trend.delta)}%`:'保持平稳'}
                    </span>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- ===== 科目环 ===== -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">📖 各科目情况</span>
            <span style="font-size:12px;color:var(--text-muted);">仅显示已练习科目</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">
            ${(() => {
              const masteries = FK.analytics.getAllSubjectMasteries();
              const entries = Object.entries(masteries)
                .filter(([, m]) => m.totalAnswered > 0)
                .sort(([, a], [, b]) => a.mastery - b.mastery);
              if (entries.length === 0) {
                return '<p style="text-align:center;color:var(--text-muted);padding:20px;grid-column:1/-1;">完成练习后，各科目掌握度将在此展示</p>';
              }
              return entries.map(([key, m]) => {
                const subj = (FK_SEED_DATA.subjects||{})[key]||{};
                const pct = m.mastery;
                const color = pct>=80?'success':pct>=60?'warning':'error';
                return `
                  <div style="padding:12px;background:var(--bg);border-radius:var(--radius-sm);cursor:pointer;border-left:3px solid ${pct>=80?'var(--success)':pct>=60?'var(--warning)':'var(--error)'};"
                    onclick="FK.views.subject.renderDetail('${key}')">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                      <span style="font-size:14px;font-weight:500;">${subj.icon||'📖'} ${subj.shortName||key}</span>
                      <span class="badge badge-${color}">${m.label}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div class="progress-bar" style="flex:1;"><div class="progress-fill ${color}" style="width:${Math.max(pct,3)}%;"></div></div>
                      <span style="font-size:13px;font-weight:600;color:${FK.utils.accuracyColor(pct)};min-width:35px;">${pct}%</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${m.totalAnswered}题 · ${m.totalCorrect}对</div>
                  </div>
                `;
              });
            })()}
          </div>
        </div>
      </div>
    `;
  }
};
