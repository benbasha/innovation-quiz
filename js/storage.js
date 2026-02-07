const Storage = (() => {
  const SUPABASE_URL = 'https://hweszziqetebzogkeqwk.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3ZXN6emlxZXRlYnpvZ2tlcXdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTEwMjMsImV4cCI6MjA4NjAyNzAyM30.Hn8jJUrSENqeWc8eXv-XBzgJuE22OWX62XDKKE5qljA';

  let sb;

  function init() {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  async function loadAllUsers() {
    const { data, error } = await sb.from('user_progress').select('*').order('username');
    if (error) throw error;
    return data;
  }

  async function loadQuestions() {
    const { data, error } = await sb.from('questions').select('*');
    if (error) throw error;
    return data || [];
  }

  async function loadProgress(username) {
    const { data: userRow, error: e1 } = await sb
      .from('user_progress')
      .select('*')
      .eq('username', username)
      .single();
    if (e1) throw e1;

    const { data: qProgress, error: e2 } = await sb
      .from('question_progress')
      .select('*')
      .eq('username', username);
    if (e2) throw e2;

    return { user: userRow, questionProgress: qProgress || [] };
  }

  async function recordAnswer(username, questionId, isCorrect) {
    // Upsert question_progress
    const { data: existing } = await sb
      .from('question_progress')
      .select('*')
      .eq('username', username)
      .eq('question_id', questionId)
      .maybeSingle();

    const attempts = (existing?.attempts || 0) + 1;
    const correctCount = (existing?.correct_count || 0) + (isCorrect ? 1 : 0);
    const status = isCorrect ? 'passed' : 'failed';

    if (existing) {
      await sb
        .from('question_progress')
        .update({ status, attempts, correct_count: correctCount, last_attempt: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await sb
        .from('question_progress')
        .insert({ username, question_id: questionId, status, attempts, correct_count: correctCount });
    }

    // Update user stats
    const { data: user } = await sb
      .from('user_progress')
      .select('stats')
      .eq('username', username)
      .single();

    const stats = user.stats;
    stats.totalAttempted += 1;
    if (isCorrect) {
      stats.totalCorrect += 1;
      stats.currentStreak += 1;
      if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak;
      }
    } else {
      stats.currentStreak = 0;
    }

    await sb
      .from('user_progress')
      .update({ stats, updated_at: new Date().toISOString() })
      .eq('username', username);
  }

  async function saveActiveRound(username, roundData) {
    await sb
      .from('user_progress')
      .update({ active_round: roundData, updated_at: new Date().toISOString() })
      .eq('username', username);
  }

  async function completeRound(username, score, total, questionIds) {
    // Insert round record
    await sb
      .from('rounds')
      .insert({ username, score, total, question_ids: questionIds });

    // Update user stats
    const { data: user } = await sb
      .from('user_progress')
      .select('stats')
      .eq('username', username)
      .single();

    const stats = user.stats;
    stats.roundsCompleted += 1;
    if (score === total) stats.perfectRounds += 1;

    // Clear active round
    await sb
      .from('user_progress')
      .update({ stats, active_round: null, updated_at: new Date().toISOString() })
      .eq('username', username);
  }

  return { init, loadAllUsers, loadQuestions, loadProgress, recordAnswer, saveActiveRound, completeRound };
})();
