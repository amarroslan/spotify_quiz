import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getQuizData, login, logout, saveQuizAttempt } from './api';
import { buildQuestions } from './quiz';
import type { QuizQuestion } from './types/quiz';
import type { QuizData } from './types/spotify';

const signOut = (): Promise<unknown> => logout().catch(() => null).finally(() => window.location.reload());

function Brand() {
  return <div className="brand"><span className="brand-mark"><i /><i /><i /></span><div><span className="brand-kicker">your frequency</span><strong>LISTENING QUIZ</strong></div></div>;
}

function ListeningVisual({ imageUrl }: { imageUrl?: string }) {
  return <div className="listening-visual" aria-hidden="true">{imageUrl && <img className="album-art" src={imageUrl} alt="" loading="lazy" decoding="async" />}<span className="color-blob blob-pink" /><span className="color-blob blob-green" /><span className="color-blob blob-yellow" /><span className="color-blob blob-purple" /><span className="record-lines" /><span className="record-center" /><div className="visual-caption"><div><span>ON REPEAT</span><strong>Your recent rotation</strong></div><b className="waveform"><i /><i /><i /><i /><i /><i /><i /></b></div></div>;
}

function Landing({ onLogin, authError }: { onLogin: () => void; authError: string | null }) {
  return <main className="page-shell landing-page"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><header className="topbar"><Brand /></header><section className="landing-grid"><div className="landing-copy"><div className="eyebrow"><span /> THE PERSONAL MUSIC QUIZ</div><h1>Your listening history has a lot to <em>say.</em></h1><p>Connect Spotify and find out how well you really know your own soundtrack.</p>{authError && <p className="auth-error" role="alert">Spotify sign-in did not complete. Please try again.</p>}<button className="spotify-button" onClick={onLogin}><span className="button-orb" /> Continue with Spotify <b>-&gt;</b></button><small>Read-only access to your profile, top items, and recently played tracks.</small></div><ListeningVisual /></section></main>;
}

function ScoreRing({ score, total }: { score: number; total: number }) {
  const percentage = total ? Math.round((score / total) * 100) : 0;
  return <div className="score-ring" style={{ '--score': `${percentage * 3.6}deg` } as CSSProperties}><div><strong>{score}</strong><span>/{total}</span></div></div>;
}

function Result({ score, total, displayName, onRestart, onSignOut }: { score: number; total: number; displayName: string; onRestart: () => void; onSignOut: () => Promise<unknown> }) {
  return <main className="page-shell result-page"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><header className="topbar"><Brand /><button className="ghost-button" onClick={onSignOut}>Sign out</button></header><section className="result-content"><div className="confetti" aria-hidden="true">* . * . * . *</div><p className="eyebrow centered-eyebrow">SESSION COMPLETE</p><h1>{displayName}, that was your <em>frequency.</em></h1><ScoreRing score={score} total={total} /><p className="result-copy">{score >= total * .75 ? 'You know your listening habits really well.' : 'Your soundtrack still has a few surprises left.'}</p><div className="result-actions"><button className="spotify-button" onClick={onRestart}>Play again <b>-&gt;</b></button><button className="ghost-button" onClick={onSignOut}>Disconnect Spotify</button></div></section></main>;
}

function App() {
  const [data, setData] = useState<QuizData | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const authError = new URLSearchParams(window.location.search).get('auth_error');
  const questions = useMemo(() => data ? buildQuestions(data) : [], [data]);

  useEffect(() => {
    getQuizData().then(setData).catch((requestError) => {
      if (requestError.status !== 401) setError(requestError.message);
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (selected) nextButtonRef.current?.focus(); }, [selected]);
  useEffect(() => { if (finished && data) void saveQuizAttempt(score, questions.length).catch(() => null); }, [finished]);

  if (loading) return <main className="page-shell centered-state" role="status" aria-live="polite"><div className="loading-mark"><i /><i /><i /></div><p>Reading your listening signal...</p></main>;
  if (error) return <main className="page-shell centered-state"><p className="error-copy" role="alert">{error}</p><button className="spotify-button" onClick={() => window.location.reload()}>Try again</button></main>;
  if (!data) return <Landing onLogin={login} authError={authError} />;
  if (!questions.length) return <main className="page-shell centered-state"><Brand /><p>We need a little more Spotify listening history to build your quiz.</p><button className="ghost-button" onClick={signOut}>Sign out</button></main>;

  const displayName = data.profile?.display_name || 'listener';
  if (finished) return <Result score={score} total={questions.length} displayName={displayName} onRestart={() => { setQuestionIndex(0); setScore(0); setSelected(null); setFinished(false); }} onSignOut={signOut} />;

  const question: QuizQuestion = questions[questionIndex];
  const answer = (choice: string) => { if (selected) return; setSelected(choice); if (choice === question.answer) setScore((current) => current + 1); };
  const next = () => { if (questionIndex + 1 >= questions.length) setFinished(true); else { setQuestionIndex((current) => current + 1); setSelected(null); } };
  const progress = ((questionIndex + 1) / questions.length) * 100;

  const artwork = data.topTracks[0]?.album?.images?.[0]?.url || data.topArtists[0]?.images?.[0]?.url;
  return <main className="page-shell quiz-page"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><header className="topbar"><Brand /><div className="topbar-actions"><div className="mini-progress"><span>{String(questionIndex + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}</span><i><b style={{ width: `${progress}%` }} /></i></div><button className="ghost-button" onClick={signOut}>Sign out</button></div></header><section className="quiz-intro"><div><div className="eyebrow"><span /> A QUIZ ABOUT YOU</div><h1>How well do you know your <em>Spotify,</em> {displayName}?</h1><p>Six questions drawn from your real listening history. No judgement - just vibes.</p><div className="signal-note">o <span>BUILT FROM YOUR LISTENING SIGNAL</span></div></div><ListeningVisual imageUrl={artwork} /></section><section className="quiz-card"><div className="card-glow" /><div className="card-progress"><b style={{ width: `${progress}%` }} /></div><div className="question-meta"><span>QUESTION {String(questionIndex + 1).padStart(2, '0')} <i>/ {String(questions.length).padStart(2, '0')}</i></span><span><em>{score}</em> CORRECT</span></div><div className="question-title"><span className="question-icon">~</span><h2>{question.prompt}</h2></div><div className="answers">{question.choices.map((choice: string, index: number) => { const state = selected ? (choice === question.answer ? 'correct' : choice === selected ? 'wrong' : 'muted') : ''; return <button key={choice} className={`answer-option ${state}`} aria-pressed={selected === choice} aria-disabled={Boolean(selected)} disabled={Boolean(selected)} onClick={() => answer(choice)}><span className="answer-index">{String.fromCharCode(65 + index)}</span><strong>{choice}</strong><span className="answer-state">{state === 'correct' ? 'OK' : state === 'wrong' ? 'X' : '+'}</span></button>; })}</div>{selected && <div className="feedback"><div><span className="feedback-icon">{selected === question.answer ? 'OK' : 'X'}</span><div><strong>{selected === question.answer ? "That's right." : `Not quite - it was ${question.answer}.`}</strong><p>{question.detail}</p></div></div><button ref={nextButtonRef} className="next-button" onClick={next}>{questionIndex + 1 === questions.length ? 'See results' : 'Next question'} <b>-&gt;</b></button></div>}</section><p className="privacy-note">Your quiz uses your Spotify data only for this session. <button onClick={signOut}>Disconnect Spotify</button></p></main>;
}

export default App;
