// router.js — 基于 hash 的 SPA 路由
window.FK = window.FK || {};

FK.router = {
  routes: {},
  currentRoute: null,
  contentEl: null,

  // 初始化路由
  init(contentElementId) {
    this.contentEl = document.getElementById(contentElementId);
    if (!this.contentEl) {
      console.error('Content element not found:', contentElementId);
      return;
    }

    window.addEventListener('hashchange', () => this._handleRoute());
    this._handleRoute();
  },

  // 注册路由
  register(path, handler) {
    this.routes[path] = handler;
  },

  // 导航到指定路由
  navigate(hash) {
    if (location.hash !== hash) {
      location.hash = hash;
    } else {
      this._handleRoute();
    }
  },

  // 处理当前路由
  _handleRoute() {
    const hash = location.hash.slice(1) || 'dashboard'; // 去掉 #，默认 dashboard
    const [path, ...params] = hash.split('/');

    // 高亮导航项
    this._highlightNav(path);

    // 查找处理器
    let handler = this.routes[hash]; // 先精确匹配

    if (!handler) {
      // 尝试匹配 /practice/:subject 这样的模式
      handler = this.routes['practice/:subject'] && path === 'practice'
        ? (el) => this.routes['practice/:subject'](el, params[0])
        : null;
    }

    if (!handler) {
      handler = this.routes[path];
    }

    if (handler) {
      this.currentRoute = hash;
      handler(this.contentEl);
    } else {
      this._render404(this.contentEl);
    }
  },

  // 高亮当前导航
  _highlightNav(currentPath) {
    document.querySelectorAll('.nav-item').forEach(item => {
      const itemPath = item.dataset.route;
      item.classList.remove('active');
      if (itemPath === currentPath || item.dataset.routePath === currentPath) {
        item.classList.add('active');
      }
    });
  },

  // 404 页面
  _render404(el) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h2>页面未找到</h2>
        <p>请通过左侧导航栏访问功能页面</p>
        <button class="btn btn-primary" onclick="FK.router.navigate('#dashboard')">返回仪表盘</button>
      </div>
    `;
  }
};
