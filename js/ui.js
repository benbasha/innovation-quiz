const UI = (() => {
  let metadata = null;

  async function loadMetadata() {
    if (!metadata) {
      const res = await fetch('data/metadata.json');
      metadata = await res.json();
    }
    return metadata;
  }

  function getUserMeta(username) {
    if (!metadata) return { color: '#6366f1', emoji: username[0] };
    const u = metadata.users.find(u => u.name === username);
    return u || { color: '#6366f1', emoji: username[0] };
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // User Selection Screen
  function renderUserSelect(users) {
    const el = document.getElementById('user-select');
    const meta = metadata;

    el.innerHTML = `
      <div class="app-title">
        <h1>ניהול חדשנות</h1>
        <p>ד"ר גלעד גולוב — בחר/י משתמש</p>
      </div>
      <div class="user-grid">
        ${users.map(u => {
          const m = getUserMeta(u.username);
          const s = u.stats;
          const accuracy = s.totalAttempted > 0 ? Math.round((s.totalCorrect / s.totalAttempted) * 100) : 0;
          return `
            <div class="user-card" data-user="${u.username}">
              <div class="avatar" style="background:${m.color}">${m.emoji}</div>
              <div class="name">${u.username}</div>
              <div class="mini-stat">${s.totalAttempted > 0 ? accuracy + '% דיוק' : 'חדש'}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    el.querySelectorAll('.user-card').forEach(card => {
      card.addEventListener('click', () => {
        App.selectUser(card.dataset.user);
      });
    });
  }

  // Dashboard Screen
  function renderDashboard(username, stats, questionProgress, allQuestions) {
    const el = document.getElementById('dashboard');
    const m = getUserMeta(username);
    const accuracy = stats.totalAttempted > 0 ? Math.round((stats.totalCorrect / stats.totalAttempted) * 100) : 0;

    // Per-lecture progress
    const lectureStats = {};
    for (let i = 1; i <= 6; i++) {
      const lectureQs = allQuestions.filter(q => q.lecture === i);
      const answered = questionProgress.filter(qp => {
        const q = allQuestions.find(aq => aq.id === qp.question_id);
        return q && q.lecture === i && qp.status === 'passed';
      });
      lectureStats[i] = { total: lectureQs.length, passed: answered.length };
    }

    const totalQs = allQuestions.length;
    const passedQs = questionProgress.filter(qp => qp.status === 'passed').length;
    const overallPct = totalQs > 0 ? Math.round((passedQs / totalQs) * 100) : 0;

    // Progress ring
    const circumference = 2 * Math.PI * 65;
    const offset = circumference - (overallPct / 100) * circumference;

    // Check active round
    const hasActiveRound = App.state.activeRound != null;

    // Check if no questions
    const noQuestions = allQuestions.length === 0;

    // Check if all questions done (passed + no failed)
    const failedCount = questionProgress.filter(qp => qp.status === 'failed').length;
    const unseenCount = totalQs - questionProgress.length;
    const allDone = !noQuestions && unseenCount === 0 && failedCount === 0;

    el.innerHTML = `
      <div class="dash-header">
        <button class="back-btn" id="dash-back">&larr;</button>
        <div class="user-info">
          <div class="avatar-sm" style="background:${m.color}">${m.emoji}</div>
          <span class="user-name">${username}</span>
        </div>
      </div>

      <div class="progress-ring-container">
        <div class="progress-ring-wrap">
          <svg width="160" height="160">
            <circle class="progress-ring-bg" cx="80" cy="80" r="65"/>
            <circle class="progress-ring-fill" cx="80" cy="80" r="65"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${offset}"/>
          </svg>
          <div class="progress-ring-text">
            <span class="pct">${overallPct}%</span>
            <span class="label">${passedQs}/${totalQs} שאלות</span>
          </div>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">${stats.totalCorrect}</div>
          <div class="stat-label">נכונות</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${accuracy}%</div>
          <div class="stat-label">דיוק</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.bestStreak}</div>
          <div class="stat-label">רצף שיא</div>
        </div>
      </div>

      <div class="section-title">התקדמות לפי הרצאה</div>
      <div class="lecture-bars">
        ${[1,2,3,4,5,6].map(i => {
          const ls = lectureStats[i];
          const pct = ls.total > 0 ? Math.round((ls.passed / ls.total) * 100) : 0;
          const title = metadata?.lectures?.[i] || 'הרצאה ' + i;
          return `
            <div class="lecture-bar">
              <div class="bar-header">
                <span class="bar-title">${title}</span>
                <span class="bar-count">${ls.passed}/${ls.total}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" style="width:${pct}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${noQuestions ? `
        <div class="no-questions-notice">
          אין עדיין שאלות במאגר.<br>
          בקשו מבן להריץ את ה-GitHub Action כדי ליצור שאלות.
        </div>
      ` : ''}

      ${allDone ? `
        <div class="no-questions-notice">
          כל השאלות הושלמו! בקשו מבן ליצור עוד שאלות דרך GitHub Actions.
        </div>
      ` : ''}

      <button class="start-btn" id="start-round" ${noQuestions ? 'disabled' : ''}>
        ${hasActiveRound ? 'המשך סיבוב' : 'התחל סיבוב'}
      </button>
      ${hasActiveRound ? '<div class="resume-notice">יש סיבוב פתוח בהמתנה</div>' : ''}
    `;

    document.getElementById('dash-back').addEventListener('click', () => {
      App.goHome();
    });

    document.getElementById('start-round').addEventListener('click', () => {
      if (!noQuestions) Quiz.startRound();
    });
  }

  // Quiz Screen
  function renderQuestion(questionIndex, total, question, dots) {
    const el = document.getElementById('quiz');
    const importanceLabel = {
      'exam-explicit': 'יהיה במבחן',
      'remember': 'תזכרו',
      'important': 'חשוב',
      'general': 'כללי'
    };
    const importanceClass = question.importance === 'exam-explicit' ? 'exam' : question.importance === 'remember' ? 'remember' : '';

    el.innerHTML = `
      <div class="quiz-header">
        <button class="quiz-close" id="quiz-exit">&times;</button>
        <span class="quiz-progress-text">${questionIndex + 1} / ${total}</span>
      </div>

      <div class="progress-dots">
        ${dots.map((d, i) => `<div class="dot ${d}"></div>`).join('')}
      </div>

      <div class="question-card" id="q-card">
        <div class="question-meta">
          <span class="tag">הרצאה ${question.lecture}</span>
          <span class="tag ${importanceClass}">${importanceLabel[question.importance] || question.importance}</span>
        </div>
        <div class="question-text">${question.question}</div>
      </div>

      <div class="options-list" id="options-list">
        ${question.options.map((opt, i) => `
          <button class="option-btn" data-idx="${i}">${opt}</button>
        `).join('')}
      </div>

      <div id="explanation-area"></div>
      <div id="next-area"></div>
    `;

    document.getElementById('quiz-exit').addEventListener('click', () => {
      Quiz.exitQuiz();
    });

    el.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Quiz.answerQuestion(parseInt(btn.dataset.idx));
      });
    });
  }

  function showAnswer(selectedIdx, correctIdx, explanation, isCorrect) {
    const buttons = document.querySelectorAll('.option-btn');
    const card = document.getElementById('q-card');

    buttons.forEach((btn, i) => {
      btn.disabled = true;
      if (i === correctIdx) {
        btn.classList.add('correct');
      } else if (i === selectedIdx && !isCorrect) {
        btn.classList.add('wrong');
      } else {
        btn.classList.add('dimmed');
      }
    });

    card.classList.add(isCorrect ? 'pulse-green' : 'pulse-red');

    const expArea = document.getElementById('explanation-area');
    expArea.innerHTML = `
      <div class="explanation ${isCorrect ? 'correct-bg' : 'wrong-bg'}">
        <div class="exp-label">${isCorrect ? 'נכון!' : 'לא נכון'}</div>
        <div>${explanation}</div>
      </div>
    `;

    const nextArea = document.getElementById('next-area');
    nextArea.innerHTML = `<button class="next-btn" id="next-btn">הבא</button>`;
    document.getElementById('next-btn').addEventListener('click', () => {
      Quiz.nextQuestion();
    });
  }

  // Results Screen
  function renderResults(score, total, wrongAnswers, allQuestions) {
    const el = document.getElementById('results');
    const pct = Math.round((score / total) * 100);
    let grade, msg;
    if (pct === 100) { grade = 'perfect'; msg = 'מושלם! 🔥'; }
    else if (pct >= 70) { grade = 'good'; msg = 'כל הכבוד!'; }
    else if (pct >= 50) { grade = 'medium'; msg = 'לא רע, ממשיכים!'; }
    else { grade = 'low'; msg = 'צריך לחזור על החומר'; }

    el.innerHTML = `
      <div class="results-container">
        <div class="results-score">
          <div class="score-circle ${grade}">
            <div class="score-num">${score}</div>
            <div class="score-of">מתוך ${total}</div>
          </div>
          <div class="score-msg">${msg}</div>
        </div>

        ${wrongAnswers.length > 0 ? `
          <div class="review-section">
            <h3>שאלות שטעית בהן</h3>
            ${wrongAnswers.map(w => {
              const q = allQuestions.find(aq => aq.id === w.questionId);
              if (!q) return '';
              return `
                <div class="review-card">
                  <div class="review-q">${q.question}</div>
                  <div class="review-answer your-answer">התשובה שלך: ${q.options[w.selectedIdx]}</div>
                  <div class="review-answer correct-answer">התשובה הנכונה: ${q.options[q.correct]}</div>
                  <div class="review-exp">${q.explanation}</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <div class="result-buttons">
          <button class="btn-primary" id="new-round">סיבוב חדש</button>
          <button class="btn-secondary" id="go-dashboard">דשבורד</button>
        </div>
      </div>
    `;

    document.getElementById('new-round').addEventListener('click', () => {
      Quiz.startRound();
    });

    document.getElementById('go-dashboard').addEventListener('click', () => {
      App.showDashboard();
    });

    if (pct === 100) launchConfetti();
  }

  function launchConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899'];
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = (1.5 + Math.random() * 2) + 's';
      piece.style.animationDelay = (Math.random() * 0.8) + 's';
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      piece.style.width = (6 + Math.random() * 8) + 'px';
      piece.style.height = (6 + Math.random() * 8) + 'px';
      container.appendChild(piece);
    }

    setTimeout(() => container.remove(), 4000);
  }

  return { loadMetadata, showScreen, renderUserSelect, renderDashboard, renderQuestion, showAnswer, renderResults };
})();
