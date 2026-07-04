// views/analytics.js — 学习分析视图
window.FK = window.FK || {};
FK.views = FK.views || {};

FK.views.analytics = {
  currentTab: 'subjects',

  render(el) {
    const readiness = FK.analytics.getReadiness();
    const masteries = FK.analytics.getAllSubjectMasteries();
    const trend = FK.analytics.getTrend();
    const dailyStats = FK.analytics.getDailyStats(30);
    const weakAreas = FK.analytics.getWeakAreas();
    const summary = FK.models.getSummary(FK.storage.getProgress());

    el.innerHTML = `
      <div class="fade-in">
        <h1 class="page-title">📈 学习分析</h1>

        <!-- Tab 切换 -->
        <div class="tabs">
          <div class="tab active" data-tab="subjects" onclick="FK.views.analytics.switchTab('subjects')">按科目</div>
          <div class="tab" data-tab="trends" onclick="FK.views.analytics.switchTab('trends')">学习趋势</div>
          <div class="tab" data-tab="types" onclick="FK.views.analytics.switchTab('types')">按题型</div>
          <div class="tab" data-tab="readiness" onclick="FK.views.analytics.switchTab('readiness')">考试准备</div>
        </div>

        <!-- Tab 内容 -->
        <div id="tab-subjects" class="tab-content" style="display:block;">${this._tabSubjects(el, masteries)}</div>
        <div id="tab-trends" class="tab-content" style="display:none;">${this._tabTrends(dailyStats, trend)}</div>
        <div id="tab-types" class="tab-content" style="display:none;">${this._tabTypes(summary)}</div>
        <div id="tab-readiness" class="tab-content" style="display:none;">${this._tabReadiness(readiness, weakAreas)}</div>
      </div>
    `;

    // 渲染图表
    this._renderSubjectChart(masteries);
    this._renderTrendChart(dailyStats);
  },

  switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    const tabEl = document.getElementById(`tab-${tabName}`);
    if (tabEl) tabEl.style.display = 'block';
    this.currentTab = tabName;

    // 重新渲染图表
    if (tabName === 'subjects') {
      const masteries = FK.analytics.getAllSubjectMasteries();
      this._renderSubjectChart(masteries);
    } else if (tabName === 'trends') {
      const dailyStats = FK.analytics.getDailyStats(30);
      this._renderTrendChart(dailyStats);
    }
  },

  _tabSubjects(el, masteries) {
    return `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><span class="card-title">各科目正确率（仅显示已练习的）</span></div>
        <div style="height:300px;"><canvas id="chart-subjects-bar"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">科目掌握度详情</span></div>
        ${Object.entries(masteries).map(([key, m]) => {
          const subjectDef = (FK_SEED_DATA.subjects || {})[key];
          const pct = m.mastery;
          const colorClass = pct >= 70 ? 'success' : pct >= 50 ? 'warning' : 'error';
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
              <div style="flex:1;">
                <span style="font-weight:500;">${subjectDef?.icon || ''} ${subjectDef?.shortName || key}</span>
                <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">${m.totalAnswered}题</span>
              </div>
              <div style="width:200px;">
                <div class="progress-bar"><div class="progress-fill ${colorClass}" style="width:${Math.max(pct, 3)}%"></div></div>
              </div>
              <span style="width:60px;text-align:right;font-weight:600;color:${FK.utils.accuracyColor(pct)};">${pct}%</span>
              <span style="width:60px;text-align:right;font-size:12px;">${m.label}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  _tabTrends(dailyStats, trend) {
    const recent7 = dailyStats.slice(-7);
    const totalRecent = recent7.reduce((s, d) => s + d.totalAnswered, 0);
    const totalCorrect = recent7.reduce((s, d) => s + d.totalCorrect, 0);
    const avgAccuracy = totalRecent > 0 ? Math.round((totalCorrect / totalRecent) * 100) : 0;

    const directionMap = {
      improving: { icon: '📈', text: '上升', color: 'var(--success)' },
      declining: { icon: '📉', text: '下降', color: 'var(--error)' },
      stable: { icon: '➡️', text: '平稳', color: 'var(--text-secondary)' }
    };
    const dir = directionMap[trend.direction] || directionMap.stable;

    return `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><span class="card-title">📈 30天答题趋势</span></div>
        <div style="height:280px;"><canvas id="chart-trend"></canvas></div>
      </div>
      <div class="stat-cards">
        <div class="stat-card">
          <div class="stat-icon" style="background:#E3F2FD;">📊</div>
          <div class="stat-info">
            <div class="stat-value">${totalRecent}</div>
            <div class="stat-label">近7天答题数</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#E8F5E9;">✅</div>
          <div class="stat-info">
            <div class="stat-value">${avgAccuracy}%</div>
            <div class="stat-label">近7天正确率</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#FFF8E1;">${dir.icon}</div>
          <div class="stat-info">
            <div class="stat-value" style="color:${dir.color};">${trend.delta > 0 ? '+' : ''}${trend.delta}%</div>
            <div class="stat-label">与前7天对比</div>
          </div>
        </div>
      </div>
    `;
  },

  _tabTypes(summary) {
    const typeNames = FK_SEED_DATA.questionTypes || {};
    return `
      <div class="card">
        <div class="card-header"><span class="card-title">各题型表现</span></div>
        ${Object.entries(typeNames).map(([key, info]) => {
          const data = summary.byType[key];
          if (!data || data.totalAnswered === 0) return '';
          const pct = data.accuracy;
          const colorClass = pct >= 70 ? 'success' : pct >= 50 ? 'warning' : 'error';
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);">
              <div style="flex:1;">
                <span style="font-weight:500;">${info.icon} ${info.name}</span>
                <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">${data.totalAnswered}题</span>
              </div>
              <div style="width:200px;">
                <div class="progress-bar"><div class="progress-fill ${colorClass}" style="width:${Math.max(pct, 3)}%"></div></div>
              </div>
              <span style="font-weight:600;margin-left:12px;color:${FK.utils.accuracyColor(pct)};">${pct}%</span>
            </div>
          `;
        }).join('')}
        ${Object.values(summary.byType).every(d => d.totalAnswered === 0) ? '<p style="text-align:center;color:var(--text-muted);padding:20px;">暂无数据</p>' : ''}
      </div>
    `;
  },

  _tabReadiness(readiness, weakAreas) {
    return `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><span class="card-title">考试准备度</span></div>
        <div style="text-align:center;padding:20px;">
          <div style="font-size:48px;font-weight:700;color:${FK.utils.accuracyColor(readiness.overall)};">${readiness.overall}%</div>
          <div style="color:var(--text-secondary);">综合准备度</div>
        </div>
        ${Object.entries(readiness).filter(([k]) => k !== 'overall').map(([paper, data]) => {
          const color = data.score >= 70 ? 'var(--success)' : data.score >= 50 ? 'var(--warning)' : 'var(--error)';
          return `
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-weight:500;">${paper}</span><span style="color:${color};font-weight:600;">${data.score}%</span>
              </div>
              <div class="progress-bar"><div class="progress-fill ${data.score >= 70 ? 'success' : data.score >= 50 ? 'warning' : 'error'}" style="width:${Math.max(data.score, 3)}%"></div></div>
            </div>
          `;
        }).join('')}
      </div>
      ${weakAreas.length > 0 ? `
        <div class="card">
          <div class="card-header"><span class="card-title">⚠️ 需加强的知识点（正确率 < 60%）</span></div>
          ${weakAreas.map(w => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
              <div><strong>${w.subjectShortName}</strong> · ${w.knowledgePoint}</div>
              <div style="text-align:right;">
                <span class="badge badge-error">${w.mastery}%</span>
                <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">${w.totalAnswered}题/对${w.totalCorrect}</span>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  },

  _renderSubjectChart(masteries) {
    setTimeout(() => {
      const canvas = document.getElementById('chart-subjects-bar');
      if (!canvas || typeof Chart === 'undefined') return;

      const entries = Object.entries(masteries).filter(([, m]) => m.totalAnswered > 0);
      const labels = entries.map(([key]) => {
        const def = (FK_SEED_DATA.subjects || {})[key];
        return def?.shortName || key;
      });
      const data = entries.map(([, m]) => m.mastery);

      new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: '掌握度 %',
            data,
            backgroundColor: data.map(v =>
              v >= 70 ? 'rgba(45,139,78,0.7)' : v >= 50 ? 'rgba(245,166,35,0.7)' : 'rgba(211,47,47,0.7)'
            ),
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } }
        }
      });
    }, 100);
  },

  _renderTrendChart(dailyStats) {
    setTimeout(() => {
      const canvas = document.getElementById('chart-trend');
      if (!canvas || typeof Chart === 'undefined') return;

      new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: dailyStats.map(d => d.date.slice(5)),
          datasets: [
            {
              label: '答题数',
              data: dailyStats.map(d => d.totalAnswered),
              borderColor: 'rgba(196, 30, 58, 0.8)',
              backgroundColor: 'rgba(196, 30, 58, 0.1)',
              fill: true,
              tension: 0.3,
              yAxisID: 'y'
            },
            {
              label: '正确率%',
              data: dailyStats.map(d => d.totalAnswered > 0 ? Math.round((d.totalCorrect / d.totalAnswered) * 100) : null),
              borderColor: 'rgba(45, 139, 78, 0.8)',
              backgroundColor: 'rgba(45, 139, 78, 0.1)',
              fill: false,
              tension: 0.3,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            y: { beginAtZero: true, position: 'left', title: { display: true, text: '答题数' } },
            y1: { beginAtZero: true, max: 100, position: 'right', title: { display: true, text: '正确率%' }, grid: { drawOnChartArea: false } }
          }
        }
      });
    }, 100);
  }
};
