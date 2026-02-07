const App = (() => {
  const state = {
    username: null,
    activeRound: null
  };

  async function init() {
    try {
      Storage.init();
      await UI.loadMetadata();

      // Hash routing
      window.addEventListener('hashchange', handleRoute);
      await handleRoute();
    } catch (e) {
      console.error('Init failed:', e);
      document.getElementById('loading').innerHTML = `
        <div style="text-align:center;padding:40px;direction:rtl">
          <p style="color:#ef4444;font-size:16px;margin-bottom:8px">שגיאה בטעינה</p>
          <p style="color:#6b7280;font-size:14px">${e.message}</p>
        </div>
      `;
    }
  }

  async function handleRoute() {
    const hash = window.location.hash || '#/';

    if (hash === '#/' || hash === '') {
      await goHome();
    } else if (hash.startsWith('#/dashboard')) {
      if (!state.username) {
        window.location.hash = '#/';
        return;
      }
      await showDashboard();
    } else if (hash === '#/quiz') {
      // Quiz is managed by Quiz module, not direct navigation
      if (!state.username) window.location.hash = '#/';
    } else if (hash === '#/results') {
      // Results managed by Quiz module
      if (!state.username) window.location.hash = '#/';
    } else {
      window.location.hash = '#/';
    }
  }

  async function goHome() {
    state.username = null;
    state.activeRound = null;

    try {
      const users = await Storage.loadAllUsers();
      UI.renderUserSelect(users);
      UI.showScreen('user-select');
    } catch (e) {
      console.error('Failed to load users:', e);
      document.getElementById('loading').innerHTML = `
        <div style="text-align:center;padding:40px;direction:rtl">
          <p style="color:#ef4444;font-size:16px;margin-bottom:8px">שגיאה בטעינה</p>
          <p style="color:#6b7280;font-size:14px">${e.message}</p>
        </div>
      `;
    }
  }

  async function selectUser(username) {
    state.username = username;
    window.location.hash = '#/dashboard';
  }

  async function showDashboard() {
    if (!state.username) {
      window.location.hash = '#/';
      return;
    }

    UI.showScreen('loading');

    const [allQuestions, progress] = await Promise.all([
      Storage.loadQuestions(),
      Storage.loadProgress(state.username)
    ]);

    state.activeRound = progress.user.active_round;

    UI.renderDashboard(state.username, progress.user.stats, progress.questionProgress, allQuestions);
    UI.showScreen('dashboard');
  }

  // Boot
  document.addEventListener('DOMContentLoaded', init);

  return { state, goHome, selectUser, showDashboard };
})();
