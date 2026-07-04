// models.js — 数据模型定义与默认值
window.FK = window.FK || {};

FK.models = {
  // 创建默认进度对象
  createDefaultProgress() {
    return {
      version: 1,
      questions: {},       // { questionId: QuestionProgress }
      subjects: {},        // { subjectName: SubjectProgress }
      questionTypes: {},   // { questionType: TypeProgress }
      dailyRecords: [],    // [{ date, totalAnswered, totalCorrect, totalTimeSec, subjectsStudied }]
      dailyTests: [],      // [{ date, questionIds, completed, score, totalQuestions, ... }]
      streak: {
        current: 0,
        longest: 0,
        lastStudyDate: null
      },
      settings: {
        userName: '',
        dailyQuestionCount: 20,
        subjects: [],      // enabled subjects (empty = all)
        questionTypeMix: {
          single_choice: 0.4,
          multiple_choice: 0.3,
          indefinite_choice: 0.2,
          case_analysis: 0.1
        },
        timedMode: false,
        timePerQuestionSec: 120
      }
    };
  },

  // 创建单题进度
  createQuestionProgress(questionId) {
    return {
      questionId,
      attemptCount: 0,
      correctCount: 0,
      lastAttemptAt: null,
      history: [],           // [{ date, selectedAnswer, correct, timeSpentSec }]
      easeFactor: 2.5,
      intervalDays: 0,
      nextReviewDate: null,
      reviewCount: 0
    };
  },

  // 创建科目进度
  createSubjectProgress() {
    return {
      totalAnswered: 0,
      totalCorrect: 0,
      knowledgePoints: {}   // { kpName: { totalAnswered, totalCorrect } }
    };
  },

  // 创建题型进度
  createTypeProgress() {
    return {
      totalAnswered: 0,
      totalCorrect: 0
    };
  },

  // 创建每日记录
  createDailyRecord(date) {
    return {
      date,
      totalAnswered: 0,
      totalCorrect: 0,
      totalTimeSec: 0,
      subjectsStudied: []
    };
  },

  // 确保科目进度存在
  ensureSubjectProgress(progress, subject) {
    if (!progress.subjects[subject]) {
      progress.subjects[subject] = this.createSubjectProgress();
    }
    return progress.subjects[subject];
  },

  // 确保题型进度存在
  ensureTypeProgress(progress, type) {
    if (!progress.questionTypes[type]) {
      progress.questionTypes[type] = this.createTypeProgress();
    }
    return progress.questionTypes[type];
  },

  // 确保题目进度存在
  ensureQuestionProgress(progress, questionId) {
    if (!progress.questions[questionId]) {
      progress.questions[questionId] = this.createQuestionProgress(questionId);
    }
    return progress.questions[questionId];
  },

  // 确保知识点进度存在
  ensureKnowledgePointProgress(subjectProgress, kp) {
    if (!subjectProgress.knowledgePoints[kp]) {
      subjectProgress.knowledgePoints[kp] = { totalAnswered: 0, totalCorrect: 0 };
    }
    return subjectProgress.knowledgePoints[kp];
  },

  // 确保当日记录存在
  ensureDailyRecord(progress, date) {
    let record = progress.dailyRecords.find(r => r.date === date);
    if (!record) {
      record = this.createDailyRecord(date);
      progress.dailyRecords.push(record);
    }
    return record;
  },

  // 获取进度概览
  getSummary(progress) {
    const totalAnswered = Object.values(progress.questions).reduce((s, q) => s + q.attemptCount, 0);
    const totalCorrect = Object.values(progress.questions).reduce((s, q) => s + q.correctCount, 0);
    const uniqueQuestions = new Set(
      Object.entries(progress.questions)
        .filter(([, q]) => q.attemptCount > 0)
        .map(([id]) => id)
    ).size;
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

    // 各题型统计
    const byType = {};
    for (const [type, tp] of Object.entries(progress.questionTypes)) {
      byType[type] = {
        totalAnswered: tp.totalAnswered,
        totalCorrect: tp.totalCorrect,
        accuracy: tp.totalAnswered > 0 ? Math.round((tp.totalCorrect / tp.totalAnswered) * 100) : 0
      };
    }

    // 各科目统计
    const bySubject = {};
    for (const [subj, sp] of Object.entries(progress.subjects)) {
      bySubject[subj] = {
        totalAnswered: sp.totalAnswered,
        totalCorrect: sp.totalCorrect,
        accuracy: sp.totalAnswered > 0 ? Math.round((sp.totalCorrect / sp.totalAnswered) * 100) : 0
      };
    }

    return {
      totalAnswered,
      totalCorrect,
      uniqueQuestions,
      accuracy,
      streak: progress.streak,
      byType,
      bySubject
    };
  }
};
