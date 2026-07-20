// storage.js — localStorage 封装层
window.FK = window.FK || {};

FK.storage = {
  KEYS: {
    PROGRESS: 'fk_progress',
    CUSTOM_QUESTIONS: 'fk_custom_questions'
  },

  // ===== 进度管理 =====

  getProgress() {
    const saved = FK.utils.getJSON(this.KEYS.PROGRESS, null);
    if (saved && saved.version === 1) {
      return saved;
    }
    // 返回新进度或尝试迁移旧数据
    if (saved) {
      console.warn('Progress version mismatch, resetting. Old version:', saved.version);
    }
    return FK.models.createDefaultProgress();
  },

  saveProgress(progress) {
    return FK.utils.setJSON(this.KEYS.PROGRESS, progress);
  },

  // 记录单次作答
  recordAnswer({ questionId, subject, knowledgePoint, questionType, selectedAnswer, correct, timeSpentSec }) {
    const progress = this.getProgress();
    const today = FK.utils.today();

    // 更新题目进度
    const qp = FK.models.ensureQuestionProgress(progress, questionId);
    qp.attemptCount++;
    if (correct) qp.correctCount++;
    qp.lastAttemptAt = new Date().toISOString();
    qp.history.push({ date: today, selectedAnswer, correct, timeSpentSec });

    // 更新科目进度
    if (subject) {
      const sp = FK.models.ensureSubjectProgress(progress, subject);
      sp.totalAnswered++;
      if (correct) sp.totalCorrect++;

      if (knowledgePoint) {
        const kp = FK.models.ensureKnowledgePointProgress(sp, knowledgePoint);
        kp.totalAnswered++;
        if (correct) kp.totalCorrect++;
      }
    }

    // 更新题型进度
    if (questionType) {
      const tp = FK.models.ensureTypeProgress(progress, questionType);
      tp.totalAnswered++;
      if (correct) tp.totalCorrect++;
    }

    // 更新每日记录
    const record = FK.models.ensureDailyRecord(progress, today);
    record.totalAnswered++;
    if (correct) record.totalCorrect++;
    record.totalTimeSec += (timeSpentSec || 0);
    if (subject && !record.subjectsStudied.includes(subject)) {
      record.subjectsStudied.push(subject);
    }

    // 更新连续打卡
    this._updateStreak(progress, today);

    // 保存
    const saved = this.saveProgress(progress);

    // 自动调整难度
    if (correct !== undefined && qp.attemptCount >= 3) {
      const rate = Math.round((qp.correctCount / qp.attemptCount) * 100);
      const autoDiff = FK.utils.autoDifficulty(rate, qp.attemptCount);
      if (autoDiff !== null) {
        if (!progress.difficultyOverrides) progress.difficultyOverrides = {};
        progress.difficultyOverrides[questionId] = autoDiff;
      }
    }

    // 通知
    if (saved) {
      FK.utils.emit('answer-recorded', {
        questionId, subject, knowledgePoint, correct,
        summary: FK.models.getSummary(progress)
      });
    }

    return progress;
  },

  // 更新间隔重复数据
  updateSR(questionId, srData) {
    const progress = this.getProgress();
    const qp = FK.models.ensureQuestionProgress(progress, questionId);
    qp.easeFactor = srData.easeFactor;
    qp.intervalDays = srData.intervalDays;
    qp.nextReviewDate = srData.nextReviewDate;
    qp.reviewCount = srData.reviewCount;
    this.saveProgress(progress);
  },

  // 记录每日测试
  saveDailyTest(testData) {
    const progress = this.getProgress();
    const existing = progress.dailyTests.findIndex(t => t.date === testData.date);
    if (existing >= 0) {
      progress.dailyTests[existing] = testData;
    } else {
      progress.dailyTests.push(testData);
    }
    this.saveProgress(progress);
  },

  // 获取今日测试
  getTodayTest() {
    const progress = this.getProgress();
    const today = FK.utils.today();
    return progress.dailyTests.find(t => t.date === today) || null;
  },

  // ===== 连续打卡 =====

  _updateStreak(progress, today) {
    if (!progress.streak) {
      progress.streak = { current: 0, longest: 0, lastStudyDate: null };
    }

    const { lastStudyDate } = progress.streak;

    if (!lastStudyDate) {
      // 第一次
      progress.streak.current = 1;
      progress.streak.longest = 1;
    } else if (lastStudyDate === today) {
      // 同一天，不改变 streak
    } else {
      const yesterday = FK.utils.addDays(today, -1);
      if (lastStudyDate === yesterday) {
        // 连续打卡
        progress.streak.current++;
        if (progress.streak.current > progress.streak.longest) {
          progress.streak.longest = progress.streak.current;
        }
      } else {
        // 中断了
        progress.streak.current = 1;
      }
    }

    progress.streak.lastStudyDate = today;
  },

  // ===== 自定义题库管理 =====

  getCustomQuestions() {
    return FK.utils.loadCustomQuestions();
  },

  addCustomQuestions(questions) {
    const existing = this.getCustomQuestions();
    const merged = [...existing];
    const existingIds = new Set(merged.map(q => q.id));

    for (const q of questions) {
      if (!existingIds.has(q.id)) {
        merged.push(q);
        existingIds.add(q.id);
      } else {
        // 覆盖已有题目（编辑模式）
        const idx = merged.findIndex(e => e.id === q.id);
        if (idx >= 0) merged[idx] = q;
      }
    }

    FK.utils.saveCustomQuestions(merged);
    FK.utils.emit('questions-imported', { count: questions.length });
    return merged;
  },

  // 更新/编辑单道题目
  updateQuestion(id, updates) {
    const all = this.getAllQuestions();
    let question = all.find(q => q.id === id);
    if (!question) return null;

    // 深拷贝后合并更新
    const updated = FK.utils.deepClone(question);
    if (updates.subject !== undefined) updated.subject = updates.subject;
    if (updates.knowledgePoint !== undefined) updated.knowledgePoint = updates.knowledgePoint;
    if (updates.type !== undefined) updated.type = updates.type;
    if (updates.year !== undefined) updated.year = updates.year;
    if (updates.difficulty !== undefined) updated.difficulty = updates.difficulty;
    if (updates.paper !== undefined) updated.paper = updates.paper;
    if (updates.content) {
      if (updates.content.stem !== undefined) updated.content.stem = updates.content.stem;
      if (updates.content.answer !== undefined) updated.content.answer = updates.content.answer;
      if (updates.content.explanation !== undefined) updated.content.explanation = updates.content.explanation;
      if (updates.content.options !== undefined) updated.content.options = updates.content.options;
    }
    // 清除自动生成的 ID，用原有 ID
    updated.id = id;
    delete updated._needsReview;

    // 保存到自定义题库（会覆盖同ID的）
    const custom = this.getCustomQuestions();
    const idx = custom.findIndex(q => q.id === id);
    if (idx >= 0) {
      custom[idx] = updated;
    } else {
      custom.push(updated);
    }
    FK.utils.saveCustomQuestions(custom);

    FK.questionBank.init(); // 重建索引
    FK.utils.emit('question-updated', { id });
    return updated;
  },

  // 删除自定义题目
  deleteQuestion(id) {
    const custom = this.getCustomQuestions();
    const filtered = custom.filter(q => q.id !== id);
    if (filtered.length === custom.length) return false; // 没找到
    FK.utils.saveCustomQuestions(filtered);
    FK.questionBank.init();
    FK.utils.emit('question-deleted', { id });
    return true;
  },

  // 获取所有题目（种子 + 批量 + 自定义，自定义优先覆盖同ID）
  getAllQuestions() {
    const sources = [
      window.FK_SEED_DATA?.jurisprudenceQuestions || [],
      window.FK_SEED_DATA?.wuda2025 || [],
      window.FK_SEED_DATA?.wuda2024 || [],
      window.FK_SEED_DATA?.civilQuestions || [],
      window.FK_SEED_DATA?.xianfaCards2 || []
    ];
    const custom = this.getCustomQuestions();
    const customIds = new Set(custom.map(q => q.id));
    const result = [...custom];
    for (const src of sources) {
      for (const q of src) {
        if (!customIds.has(q.id)) result.push(q);
      }
    }
    return result;
  },

  // ===== 设置管理 =====

  getSettings() {
    const progress = this.getProgress();
    return progress.settings;
  },

  saveSettings(settings) {
    const progress = this.getProgress();
    progress.settings = { ...progress.settings, ...settings };
    this.saveProgress(progress);
    FK.utils.emit('settings-updated', progress.settings);
  },

  // ===== 数据导出/导入 =====

  exportAllData() {
    const progress = this.getProgress();
    const custom = this.getCustomQuestions();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      progress,
      customQuestions: custom
    };
  },

  importAllData(data) {
    if (!data || !data.progress) {
      throw new Error('无效的备份文件');
    }
    this.saveProgress(data.progress);
    if (data.customQuestions) {
      FK.utils.saveCustomQuestions(data.customQuestions);
    }
    FK.utils.emit('data-imported', {});
    return true;
  },

  // ===== 重置 =====

  resetProgress() {
    const confirmed = confirm('确定要重置所有学习进度吗？此操作不可恢复！\n\n建议先导出数据备份。');
    if (!confirmed) return false;

    localStorage.removeItem(this.KEYS.PROGRESS);
    FK.utils.emit('progress-reset', {});
    return true;
  },

  resetAll() {
    const confirmed = confirm('确定要清除所有数据（包括题库和进度）吗？此操作不可恢复！\n\n建议先导出数据备份。');
    if (!confirmed) return false;

    localStorage.removeItem(this.KEYS.PROGRESS);
    localStorage.removeItem(this.KEYS.CUSTOM_QUESTIONS);
    FK.utils.emit('all-reset', {});
    return true;
  }
};
