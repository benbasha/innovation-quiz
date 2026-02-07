const Quiz = (() => {
  let currentRound = [];
  let currentIndex = 0;
  let roundScore = 0;
  let wrongAnswers = [];
  let answered = false;
  let optionMap = []; // maps displayed index -> original index

  function shuffleOptions(question) {
    // Create index array [0,1,2,3], shuffle it
    const indices = [0, 1, 2, 3];
    shuffle(indices);
    optionMap = indices;
    return {
      options: indices.map(i => question.options[i]),
      correctDisplay: indices.indexOf(question.correct)
    };
  }

  function buildRound(allQuestions, questionProgress) {
    const failed = [];
    const unseen = [];
    const passed = [];

    const progressMap = {};
    questionProgress.forEach(qp => { progressMap[qp.question_id] = qp; });

    allQuestions.forEach(q => {
      const p = progressMap[q.id];
      if (!p) unseen.push(q);
      else if (p.status === 'failed') failed.push(q);
      else passed.push(q);
    });

    shuffle(failed);
    shuffle(unseen);
    shuffle(passed);

    const round = [];

    // Up to 5 failed questions
    const failedPick = failed.slice(0, 5);
    round.push(...failedPick);

    // Fill with unseen
    const remaining = 10 - round.length;
    round.push(...unseen.slice(0, remaining));

    // If still not enough, add passed for review
    if (round.length < 10) {
      const need = 10 - round.length;
      round.push(...passed.slice(0, need));
    }

    // If we have fewer than 10 total questions, just use what we have
    shuffle(round);
    return round;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async function startRound() {
    const state = App.state;

    // Check for active round to resume
    if (state.activeRound) {
      currentRound = state.activeRound.questions;
      currentIndex = state.activeRound.currentIndex;
      roundScore = state.activeRound.score;
      wrongAnswers = state.activeRound.wrongAnswers || [];
      showCurrentQuestion();
      UI.showScreen('quiz');
      return;
    }

    const allQuestions = await Storage.loadQuestions();
    const { questionProgress } = await Storage.loadProgress(state.username);

    currentRound = buildRound(allQuestions, questionProgress);
    currentIndex = 0;
    roundScore = 0;
    wrongAnswers = [];

    if (currentRound.length === 0) {
      alert('אין שאלות זמינות. בקשו ליצור שאלות חדשות.');
      return;
    }

    // Save active round
    await Storage.saveActiveRound(state.username, {
      questions: currentRound,
      currentIndex: 0,
      score: 0,
      wrongAnswers: []
    });

    state.activeRound = { questions: currentRound, currentIndex: 0, score: 0, wrongAnswers: [] };
    showCurrentQuestion();
    UI.showScreen('quiz');
  }

  function showCurrentQuestion() {
    answered = false;
    const question = currentRound[currentIndex];
    const shuffled = shuffleOptions(question);

    const dots = currentRound.map((_, i) => {
      if (i < currentIndex) {
        const wasWrong = wrongAnswers.some(w => w.questionId === currentRound[i].id);
        return wasWrong ? 'wrong' : 'correct';
      }
      if (i === currentIndex) return 'current';
      return '';
    });

    // Pass question with shuffled options
    const displayQuestion = {
      ...question,
      options: shuffled.options,
      correct: shuffled.correctDisplay
    };
    UI.renderQuestion(currentIndex, currentRound.length, displayQuestion, dots);
  }

  async function answerQuestion(selectedIdx) {
    if (answered) return;
    answered = true;

    const question = currentRound[currentIndex];
    // selectedIdx is in shuffled space, compare against shuffled correct
    const correctDisplayIdx = optionMap.indexOf(question.correct);
    const isCorrect = selectedIdx === correctDisplayIdx;

    if (isCorrect) {
      roundScore++;
    } else {
      // Store the original index for the results review screen
      wrongAnswers.push({ questionId: question.id, selectedIdx: optionMap[selectedIdx] });
    }

    UI.showAnswer(selectedIdx, correctDisplayIdx, question.explanation, isCorrect);

    // Record in Supabase
    await Storage.recordAnswer(App.state.username, question.id, isCorrect);

    // Update active round
    const activeRound = {
      questions: currentRound,
      currentIndex: currentIndex + 1,
      score: roundScore,
      wrongAnswers
    };
    App.state.activeRound = activeRound;
    await Storage.saveActiveRound(App.state.username, activeRound);
  }

  async function nextQuestion() {
    currentIndex++;

    if (currentIndex >= currentRound.length) {
      // Round complete
      const questionIds = currentRound.map(q => q.id);
      await Storage.completeRound(App.state.username, roundScore, currentRound.length, questionIds);
      App.state.activeRound = null;

      const allQuestions = await Storage.loadQuestions();
      UI.renderResults(roundScore, currentRound.length, wrongAnswers, allQuestions);
      UI.showScreen('results');
      return;
    }

    showCurrentQuestion();
  }

  async function exitQuiz() {
    // Round is already saved, just go to dashboard
    await App.showDashboard();
  }

  return { startRound, answerQuestion, nextQuestion, exitQuiz };
})();
