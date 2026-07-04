// spacedRepetition.js — SM-2 间隔重复算法
window.FK = window.FK || {};

FK.spacedRepetition = {
  // SM-2 算法核心
  // quality: 0-5 评分
  //   5 = 完美回忆（快速正确）
  //   4 = 正确，稍有犹豫
  //   3 = 正确，但很困难
  //   2 = 错误，但正确答案看起来熟悉
  //   1 = 完全错误
  //   0 = 完全没印象

  MIN_EASE_FACTOR: 1.3,
  MAX_EASE_FACTOR: 2.5,
  INITIAL_EASE_FACTOR: 2.5,

  // 根据答题结果计算 quality
  calcQuality(correct, timeSpentSec, avgTimeSec) {
    if (correct) {
      if (timeSpentSec < 30) return 5;       // 快速正确
      if (timeSpentSec < 90) return 4;       // 正常正确
      return 3;                               // 较慢但正确
    } else {
      return 1;                               // 错误
    }
  },

  // 更新 SR 数据
  // 返回 { easeFactor, intervalDays, nextReviewDate, reviewCount }
  update(currentData, quality) {
    const today = FK.utils.today();

    let { easeFactor = this.INITIAL_EASE_FACTOR, intervalDays = 0, reviewCount = 0 } = currentData || {};

    if (quality >= 3) {
      // 正确：按间隔重复
      if (reviewCount === 0) {
        intervalDays = 1;
      } else if (reviewCount === 1) {
        intervalDays = 6;
      } else {
        intervalDays = Math.round(intervalDays * easeFactor);
      }
      reviewCount++;
    } else {
      // 错误：重置
      intervalDays = 1;
      reviewCount = 0;
    }

    // 更新简易因子
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(this.MIN_EASE_FACTOR, Math.min(this.MAX_EASE_FACTOR, easeFactor));

    // 计算下次复习日期
    const nextReviewDate = FK.utils.addDays(today, intervalDays);

    return {
      easeFactor: Math.round(easeFactor * 100) / 100,
      intervalDays,
      nextReviewDate,
      reviewCount
    };
  },

  // 获取今天到期的题目 ID 列表（从进度数据）
  getDueQuestions(progress, limit) {
    const today = FK.utils.today();
    const due = [];

    for (const [id, qp] of Object.entries(progress.questions)) {
      if (qp.attemptCount === 0) {
        // 从未做过 → 优先
        due.push({ id, priority: 10, nextReviewDate: null });
      } else if (qp.nextReviewDate && qp.nextReviewDate <= today) {
        // 到期需要复习 → 按过期间隔排序（逾期越久越优先）
        const overdueDays = FK.utils.daysBetween(qp.nextReviewDate, today);
        due.push({ id, priority: 50 + overdueDays * 5, nextReviewDate: qp.nextReviewDate });
      }
    }

    // 按优先级降序排列
    due.sort((a, b) => b.priority - a.priority);

    return limit ? due.slice(0, limit) : due;
  },

  // 获取题目当前 SR 状态
  getStatus(questionId, progress) {
    const qp = progress.questions[questionId];
    if (!qp || qp.attemptCount === 0) return null;

    const today = FK.utils.today();
    return {
      easeFactor: qp.easeFactor,
      intervalDays: qp.intervalDays,
      nextReviewDate: qp.nextReviewDate,
      reviewCount: qp.reviewCount,
      isDue: qp.nextReviewDate ? qp.nextReviewDate <= today : true,
      accuracy: qp.attemptCount > 0 ? Math.round((qp.correctCount / qp.attemptCount) * 100) : 0
    };
  }
};
