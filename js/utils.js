// utils.js — 工具函数
window.FK = window.FK || {};

FK.utils = {
  // 安全地从 localStorage 读取 JSON
  getJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('localStorage read error:', key, e);
      return fallback;
    }
  },

  // 安全地写入 localStorage
  setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('localStorage write error:', key, e);
      if (e.name === 'QuotaExceededError') {
        alert('存储空间不足！请在设置中导出数据备份，然后清理旧记录。');
      }
      return false;
    }
  },

  // 存到 localStorage 的进度专用 key
  saveProgress(progress) {
    return this.setJSON('fk_progress', progress);
  },

  // 读取进度
  loadProgress() {
    return this.getJSON('fk_progress', null);
  },

  // 保存自定义题目
  saveCustomQuestions(questions) {
    return this.setJSON('fk_custom_questions', questions);
  },

  // 读取自定义题目
  loadCustomQuestions() {
    return this.getJSON('fk_custom_questions', []);
  },

  // 格式化日期 YYYY-MM-DD
  formatDate(date) {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  // 获取今天的日期字符串
  today() {
    return this.formatDate(new Date());
  },

  // 日期加减天数
  addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return this.formatDate(d);
  },

  // 两个日期之间的天数差
  daysBetween(d1, d2) {
    const a = new Date(d1);
    const b = new Date(d2);
    return Math.floor((b - a) / (1000 * 60 * 60 * 24));
  },

  // Fisher-Yates 洗牌
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // 生成唯一 ID
  generateId(prefix) {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${ts}_${rand}`;
  },

  // HTML 转义（防 XSS）
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // 深拷贝
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  // 防抖
  debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // 百分比格式化
  percent(numerator, denominator) {
    if (!denominator || denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100);
  },

  // 触发自定义事件
  emit(eventName, detail) {
    window.dispatchEvent(new CustomEvent(`fk:${eventName}`, { detail }));
  },

  // 监听自定义事件
  on(eventName, handler) {
    window.addEventListener(`fk:${eventName}`, handler);
  },

  // 取消监听
  off(eventName, handler) {
    window.removeEventListener(`fk:${eventName}`, handler);
  },

  // 将选择题选项字母转为数组
  parseAnswerString(str) {
    if (!str) return [];
    // 支持 "ABC", "A,B,C", "A、B、C" 等格式
    return str.replace(/[,，、、\s]/g, '').split('').filter(c => /[A-Za-z]/.test(c)).map(c => c.toUpperCase());
  },

  // 获取题目难度标签（彩色星级）
  difficultyLabel(level) {
    const stars = { 1: '★☆☆☆☆', 2: '★★☆☆☆', 3: '★★★☆☆', 4: '★★★★☆', 5: '★★★★★' };
    const colors = { 1: '#4CAF50', 2: '#8BC34A', 3: '#FF9800', 4: '#F44336', 5: '#C41E3A' };
    return { stars: stars[level] || '★★★☆☆', color: colors[level] || '#FF9800' };
  },

  // HTML格式的难度星级
  difficultyStars(level) {
    const d = this.difficultyLabel(level);
    return `<span style="color:${d.color};font-size:14px;letter-spacing:1px;" title="难度 ${level}/5">${d.stars}</span>`;
  },

  // 根据正确率自动计算难度
  autoDifficulty(correctRate, attemptCount) {
    if (attemptCount < 3) return null; // 数据不足，不调整
    if (correctRate >= 90) return 1;
    if (correctRate >= 75) return 2;
    if (correctRate >= 55) return 3;
    if (correctRate >= 30) return 4;
    return 5;
  },

  // 获取正确率颜色
  accuracyColor(pct) {
    if (pct >= 80) return 'var(--success)';
    if (pct >= 60) return 'var(--warning)';
    return 'var(--error)';
  },

  // 获取掌握度标签
  masteryLabel(pct) {
    if (pct >= 85) return '已掌握';
    if (pct >= 70) return '较熟练';
    if (pct >= 50) return '一般';
    if (pct >= 30) return '薄弱';
    return '需加强';
  }
};
