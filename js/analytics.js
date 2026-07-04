// analytics.js — 统计分析引擎（带缓存，避免重复计算）
window.FK = window.FK || {};

FK.analytics = {
  _cache: {},
  _cacheTime: 0,
  _CACHE_TTL: 2000, // 缓存2秒

  // 缓存机制
  _getCached(key, computeFn) {
    const now = Date.now();
    if (this._cacheTime && (now - this._cacheTime) < this._CACHE_TTL && this._cache[key] !== undefined) {
      return this._cache[key];
    }
    const result = computeFn();
    this._cache[key] = result;
    this._cacheTime = now;
    return result;
  },

  // 清除缓存（答题后调用）
  invalidate() {
    this._cache = {};
    this._cacheTime = 0;
  },

  // 快速获取科目掌握度（从进度数据直接算，不走知识点）
  calcSubjectMastery(subject) {
    const progress = FK.storage.getProgress();
    const sp = progress.subjects[subject];
    if (!sp || sp.totalAnswered === 0) {
      return { mastery: 0, totalAnswered: 0, totalCorrect: 0, label: '未练习' };
    }
    const pct = Math.round((sp.totalCorrect / Math.max(sp.totalAnswered, 1)) * 100);
    return {
      mastery: pct,
      totalAnswered: sp.totalAnswered,
      totalCorrect: sp.totalCorrect,
      label: FK.utils.masteryLabel(pct)
    };
  },

  // 获取所有科目掌握度（缓存）
  getAllSubjectMasteries() {
    return this._getCached('masteries', () => {
      const subjects = window.FK_SEED_DATA?.subjects || {};
      const result = {};
      for (const key of Object.keys(subjects)) {
        result[key] = this.calcSubjectMastery(key);
      }
      return result;
    });
  },

  // 获取薄弱环节（缓存）
  getWeakAreas() {
    return this._getCached('weakAreas', () => {
      const progress = FK.storage.getProgress();
      const weak = [];

      for (const [subjectKey, sp] of Object.entries(progress.subjects)) {
        if (!sp || sp.totalAnswered === 0) continue;
        for (const [kpName, kp] of Object.entries(sp.knowledgePoints || {})) {
          if (kp.totalAnswered >= 3) {
            const pct = Math.round((kp.totalCorrect / Math.max(kp.totalAnswered, 1)) * 100);
            if (pct < 60) {
              const subjDef = (FK_SEED_DATA.subjects || {})[subjectKey];
              weak.push({
                subject: subjectKey,
                subjectShortName: subjDef?.shortName || subjectKey,
                knowledgePoint: kpName,
                mastery: pct,
                totalAnswered: kp.totalAnswered,
                totalCorrect: kp.totalCorrect
              });
            }
          }
        }
      }
      weak.sort((a, b) => a.mastery - b.mastery);
      return weak;
    });
  },

  // 获取学习建议
  getRecommendations() {
    const weakAreas = this.getWeakAreas();
    const readiness = this.getReadiness();
    const progress = FK.storage.getProgress();
    const summary = FK.models.getSummary(progress);
    const recs = [];

    if (weakAreas.length > 0) {
      const top = weakAreas.slice(0, 3);
      recs.push({ type: 'weak', title: '薄弱环节需加强', detail: `重点练习：${top.map(w => w.subjectShortName + '·' + w.knowledgePoint).join('、')}`, action: '开始复习', route: '#review' });
    }

    for (const [paper, data] of Object.entries(readiness)) {
      if (paper === 'overall') continue;
      if (data.score > 0 && data.score < 50) {
        recs.push({ type: 'readiness', title: `${paper}准备度低（${data.score}%）`, detail: '建议增加该试卷科目的练习量', action: `加强${paper}`, route: '#subjects' });
      }
    }

    if (summary.streak?.current >= 7) {
      recs.push({ type: 'encourage', title: `🔥 连续打卡 ${summary.streak.current} 天`, detail: '坚持就是胜利！保持节奏', action: null });
    }
    return recs.slice(0, 5);
  },

  // 每日统计（缓存）
  getDailyStats(days = 30) {
    return this._getCached('dailyStats_' + days, () => {
      const progress = FK.storage.getProgress();
      const today = FK.utils.today();
      const start = FK.utils.addDays(today, -days + 1);
      const map = {};
      for (const r of progress.dailyRecords) map[r.date] = r;

      const stats = [];
      for (let i = 0; i < days; i++) {
        const date = FK.utils.addDays(start, i);
        const r = map[date];
        stats.push({
          date,
          totalAnswered: r?.totalAnswered || 0,
          totalCorrect: r?.totalCorrect || 0,
          accuracy: r?.totalAnswered > 0 ? Math.round((r.totalCorrect / r.totalAnswered) * 100) : 0,
          totalTimeMin: r ? Math.round(r.totalTimeSec / 60) : 0
        });
      }
      return stats;
    });
  },

  // 趋势
  getTrend() {
    const stats = this.getDailyStats(28);
    const recent = stats.slice(-7);
    const prev = stats.slice(-14, -7);
    const rT = recent.reduce((s, d) => s + d.totalAnswered, 0);
    const pT = prev.reduce((s, d) => s + d.totalAnswered, 0);
    const rC = recent.reduce((s, d) => s + d.totalCorrect, 0);
    const pC = prev.reduce((s, d) => s + d.totalCorrect, 0);
    const rA = rT > 0 ? Math.round((rC / rT) * 100) : 0;
    const pA = pT > 0 ? Math.round((pC / pT) * 100) : 0;
    const delta = rA - pA;
    return {
      recent7: { total: rT, correct: rC, accuracy: rA },
      previous7: { total: pT, correct: pC, accuracy: pA },
      delta,
      direction: delta > 5 ? 'improving' : delta < -5 ? 'declining' : 'stable'
    };
  },

  // 考试准备度
  getReadiness() {
    return this._getCached('readiness', () => {
      const papers = window.FK_SEED_DATA?.papers || {};
      const masteries = this.getAllSubjectMasteries();
      const result = {};
      for (const [name, data] of Object.entries(papers)) {
        let sum = 0, cnt = 0;
        for (const s of data.subjects) {
          const m = masteries[s];
          if (m && m.totalAnswered > 0) { sum += m.mastery; cnt++; }
        }
        result[name] = {
          score: cnt > 0 ? Math.round(sum / cnt) : 0,
          subjects: Object.fromEntries(data.subjects.map(s => [s, masteries[s]?.mastery || 0])),
          label: cnt > 0 ? Math.round(sum / cnt) + '%' : '无数据'
        };
      }
      const scores = Object.values(result).map(r => r.score).filter(s => s > 0);
      result.overall = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return result;
    });
  }
};

// 答题后自动清除缓存
FK.utils.on('answer-recorded', () => FK.analytics.invalidate());
FK.utils.on('data-imported', () => FK.analytics.invalidate());
FK.utils.on('question-updated', () => FK.analytics.invalidate());
