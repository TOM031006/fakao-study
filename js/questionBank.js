// questionBank.js — 题库内存索引与查询
window.FK = window.FK || {};

FK.questionBank = {
  questions: [],           // 全部题目数组
  indexBySubject: {},      // Map<subject, [question]>
  indexByKnowledgePoint: {}, // Map<knowledgePoint, [question]>
  indexByType: {},         // Map<type, [question]>
  indexById: {},           // Map<id, question>

  // 初始化题库（种子题 + 自定义题）
  init() {
    const all = FK.storage.getAllQuestions();
    this.questions = all;
    this._rebuildIndex();
    return this.getStats();
  },

  // 重建所有索引
  _rebuildIndex() {
    this.indexById = {};
    this.indexBySubject = {};
    this.indexByKnowledgePoint = {};
    this.indexByType = {};

    for (const q of this.questions) {
      this.indexById[q.id] = q;

      // 按科目
      if (q.subject) {
        if (!this.indexBySubject[q.subject]) this.indexBySubject[q.subject] = [];
        this.indexBySubject[q.subject].push(q);
      }

      // 按知识点
      if (q.knowledgePoint) {
        if (!this.indexByKnowledgePoint[q.knowledgePoint]) this.indexByKnowledgePoint[q.knowledgePoint] = [];
        this.indexByKnowledgePoint[q.knowledgePoint].push(q);
      }

      // 按题型
      if (q.type) {
        if (!this.indexByType[q.type]) this.indexByType[q.type] = [];
        this.indexByType[q.type].push(q);
      }
    }
  },

  // 根据 ID 获取题目（含自动调整后的难度）
  getById(id) {
    const q = this.indexById[id] || null;
    if (q) {
      const progress = FK.storage.getProgress();
      const override = progress.difficultyOverrides?.[id];
      if (override) q._effectiveDifficulty = override;
      else q._effectiveDifficulty = q.difficulty || 3;
    }
    return q;
  },

  // 根据条件查询题目 ID 列表
  query({ subject, knowledgePoint, type, examType, paper, difficulty, excludeIds, yearMin, yearMax, limit }) {
    let candidates = null;

    // 如果指定了 subject，从科目索引取
    if (subject && this.indexBySubject[subject]) {
      candidates = [...this.indexBySubject[subject]];
    }

    // 如果指定了 knowledgePoint，取交集
    if (knowledgePoint && this.indexByKnowledgePoint[knowledgePoint]) {
      const kpSet = new Set(this.indexByKnowledgePoint[knowledgePoint]);
      if (candidates !== null) {
        candidates = candidates.filter(q => kpSet.has(q));
      } else {
        candidates = [...this.indexByKnowledgePoint[knowledgePoint]];
      }
    }

    // 如果没指定科目或知识点，用全部题目
    if (candidates === null) {
      candidates = [...this.questions];
    }

    // 过滤条件
    if (type) {
      candidates = candidates.filter(q => q.type === type);
    }
    if (examType) {
      candidates = candidates.filter(q => q.examType === examType);
    }
    if (paper) {
      candidates = candidates.filter(q => q.paper === paper);
    }
    if (difficulty) {
      candidates = candidates.filter(q => q.difficulty === difficulty);
    }
    if (excludeIds && excludeIds.length > 0) {
      const exclSet = new Set(excludeIds);
      candidates = candidates.filter(q => !exclSet.has(q.id));
    }
    if (yearMin) {
      candidates = candidates.filter(q => q.year >= yearMin);
    }
    if (yearMax) {
      candidates = candidates.filter(q => q.year <= yearMax);
    }

    // 返回 ID 数组
    const ids = candidates.map(q => q.id);
    return limit ? ids.slice(0, limit) : ids;
  },

  // 获取所有科目
  getAllSubjects() {
    const subjects = window.FK_SEED_DATA?.subjects || {};
    return Object.keys(subjects).map(key => ({
      key,
      ...subjects[key],
      questionCount: (this.indexBySubject[key] || []).length
    }));
  },

  // 获取某科目的知识点列表
  getKnowledgePoints(subject) {
    const subjectDef = (window.FK_SEED_DATA?.subjects || {})[subject];
    if (!subjectDef) return [];
    return subjectDef.knowledgePoints.map(kp => ({
      name: kp,
      questionCount: (this.indexByKnowledgePoint[kp] || []).length
    }));
  },

  // 获取题库统计
  getStats() {
    const stats = {
      total: this.questions.length,
      bySubject: {},
      byType: {},
      byYear: {},
      byExamType: { objective: 0, subjective: 0 }
    };

    for (const q of this.questions) {
      if (q.subject) {
        stats.bySubject[q.subject] = (stats.bySubject[q.subject] || 0) + 1;
      }
      if (q.type) {
        stats.byType[q.type] = (stats.byType[q.type] || 0) + 1;
      }
      if (q.year) {
        stats.byYear[q.year] = (stats.byYear[q.year] || 0) + 1;
      }
      if (q.examType) {
        stats.byExamType[q.examType] = (stats.byExamType[q.examType] || 0) + 1;
      }
    }

    return stats;
  },

  // 搜索题目（标题模糊匹配）
  search(keyword) {
    if (!keyword || keyword.trim() === '') return [];
    const kw = keyword.toLowerCase();
    return this.questions.filter(q =>
      q.content?.stem?.toLowerCase().includes(kw) ||
      q.tags?.some(t => t.toLowerCase().includes(kw)) ||
      q.knowledgePoint?.toLowerCase().includes(kw) ||
      q.subject?.toLowerCase().includes(kw)
    );
  }
};
