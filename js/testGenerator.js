// testGenerator.js — 每日出卷算法
window.FK = window.FK || {};

FK.testGenerator = {
  // 生成今日测试
  // options: { count, subjects, excludeTodayTestIds }
  generate(options = {}) {
    const progress = FK.storage.getProgress();
    const settings = progress.settings;
    const today = FK.utils.today();

    const count = options.count || settings.dailyQuestionCount || 20;
    const enabledSubjects = options.subjects || settings.subjects || [];
    const mix = settings.questionTypeMix;

    // 1. 构建候选池
    let candidateIds;

    if (enabledSubjects.length > 0) {
      // 从指定科目中选取
      candidateIds = [];
      for (const subject of enabledSubjects) {
        const ids = FK.questionBank.query({ subject });
        candidateIds.push(...ids);
      }
    } else {
      // 全部题目（客观+主观）
      candidateIds = FK.questionBank.query({});
    }

    if (candidateIds.length === 0) {
      return []; // 题库中还没有题目
    }

    // 去重
    candidateIds = [...new Set(candidateIds)];

    // 排除今天已经做过的
    const todayTest = FK.storage.getTodayTest();
    const excludeIds = todayTest?.questionIds || [];
    candidateIds = candidateIds.filter(id => !excludeIds.includes(id));

    // 2. 为每个候选题目打分
    const scored = candidateIds.map(id => {
      const score = this._scoreQuestion(id, progress, today);
      const question = FK.questionBank.getById(id);
      return { id, score, type: question?.type || 'single_choice' };
    });

    // 3. 按分值降序排列
    scored.sort((a, b) => b.score - a.score);

    // 4. 分类：客观题优先，主观题在后
    const objectiveTypes = ['single_choice', 'multiple_choice', 'indefinite_choice'];
    const subjectiveTypes = ['essay', 'case_analysis'];

    const objScored = scored.filter(s => objectiveTypes.includes(s.type));
    const subjScored = scored.filter(s => subjectiveTypes.includes(s.type));

    const used = new Set();
    const selected = [];

    // 客观题占80%，主观题占20%
    const objCount = Math.min(objScored.length, Math.round(count * 0.8));
    const subjCount = Math.min(subjScored.length, count - objCount);

    // 先选客观题（按题型配额）
    const objMix = {
      single_choice: Math.round(objCount * (mix.single_choice || 0.45)),
      multiple_choice: Math.round(objCount * (mix.multiple_choice || 0.35)),
      indefinite_choice: Math.round(objCount * (mix.indefinite_choice || 0.2))
    };
    const objByType = {};

    for (const item of objScored) {
      if (selected.length >= objCount) break;
      const quota = objMix[item.type] || Math.floor(objCount / 3);
      if ((objByType[item.type] || 0) < quota && !used.has(item.id)) {
        selected.push(item.id);
        used.add(item.id);
        objByType[item.type] = (objByType[item.type] || 0) + 1;
      }
    }
    // 填满客观题名额
    for (const item of objScored) {
      if (selected.length >= objCount) break;
      if (!used.has(item.id)) { selected.push(item.id); used.add(item.id); }
    }

    // 再选主观题
    for (const item of subjScored) {
      if (selected.length >= objCount + subjCount) break;
      if (!used.has(item.id)) { selected.push(item.id); used.add(item.id); }
    }

    // 填满总名额
    for (const item of scored) {
      if (selected.length >= count) break;
      if (!used.has(item.id)) { selected.push(item.id); used.add(item.id); }
    }

    // 5. 客观题在前打乱 + 主观题在后打乱（保持先后顺序）
    const objSelected = selected.slice(0, objCount);
    const subjSelected = selected.slice(objCount);
    const result = [...FK.utils.shuffle(objSelected), ...FK.utils.shuffle(subjSelected)];

    return result;
  },

  // 对单个题目打分
  _scoreQuestion(id, progress, today) {
    let score = 0;
    const qp = progress.questions[id];
    const question = FK.questionBank.getById(id);

    if (!qp || qp.attemptCount === 0) {
      // 从未做过：基础分 + 新奇加分
      score += 10;
      return score;
    }

    // SR 到期加分
    if (qp.nextReviewDate && qp.nextReviewDate <= today) {
      const overdueDays = FK.utils.daysBetween(qp.nextReviewDate, today);
      score += 50 + Math.min(overdueDays * 5, 50);
    }

    // 薄弱知识点加分
    if (question?.knowledgePoint) {
      const progress2 = FK.storage.getProgress();
      const sp = progress2.subjects[question.subject];
      if (sp) {
        const kp = sp.knowledgePoints[question.knowledgePoint];
        if (kp && kp.totalAnswered >= 3) {
          const kpAccuracy = kp.totalCorrect / Math.max(kp.totalAnswered, 1);
          if (kpAccuracy < 0.6) {
            score += 30;
          }
        }
      }
    }

    // 最近做过扣分
    if (qp.lastAttemptAt) {
      const lastDate = qp.lastAttemptAt.substring(0, 10);
      const daysSince = FK.utils.daysBetween(lastDate, today);
      if (daysSince <= 2) {
        score -= 20;
      }
    }

    // 已掌握扣分
    if (qp.attemptCount >= 3) {
      const accuracy = qp.correctCount / qp.attemptCount;
      if (accuracy > 0.9) {
        score -= 40;
      }
    }

    // 题目难度适中加分
    if (question?.difficulty === 3) {
      score += 5;
    }

    return score;
  },

  // 生成分科练习题目
  generateSubjectPractice(subject, { count = 10, type, knowledgePoint } = {}) {
    const ids = FK.questionBank.query({
      subject,
      type,
      knowledgePoint,
      limit: count * 3 // 多取一些用于打乱
    });

    const shuffled = FK.utils.shuffle(ids);
    return shuffled.slice(0, count);
  },

  // 获取错题列表（用于错题复习）
  getWrongQuestions(subject) {
    const progress = FK.storage.getProgress();
    const wrongIds = [];

    for (const [id, qp] of Object.entries(progress.questions)) {
      if (qp.attemptCount > 0) {
        const accuracy = qp.correctCount / qp.attemptCount;
        if (accuracy < 0.7) { // 正确率低于70%的需要复习
          const question = FK.questionBank.getById(id);
          if (question && (!subject || question.subject === subject)) {
            wrongIds.push({
              id,
              accuracy: Math.round(accuracy * 100),
              wrongCount: qp.attemptCount - qp.correctCount,
              lastAttempt: qp.lastAttemptAt
            });
          }
        }
      }
    }

    // 错误多的优先
    wrongIds.sort((a, b) => b.wrongCount - a.wrongCount);
    return wrongIds;
  }
};
