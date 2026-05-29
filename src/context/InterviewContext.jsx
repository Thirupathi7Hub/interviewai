import { createContext, useContext, useState, useCallback, useRef } from 'react';
import client from '../api/client';

const InterviewContext = createContext();

export function InterviewProvider({ children }) {
  const [activeSession, setActiveSession] = useState(null);
  const [history, setHistory]             = useState([]);
  const [historyStats, setHistoryStats]   = useState({ total: 0, avgScore: 0, bestScore: 0 });
  const [lastFeedback, setLastFeedback]   = useState(null);

  // Ref-backed session so guards read the LATEST value synchronously
  const activeSessionRef       = useRef(null);
  const nextQuestionPromiseRef = useRef(null);  // holds in-flight next-question fetch

  const setSession = (data) => {
    activeSessionRef.current = data;
    setActiveSession(data);
  };

  // ── startInterview ─────────────────────────────────────────────────────────
  const startInterview = async (type, domain, totalQuestions = 5, difficulty = 'intermediate') => {
    setLastFeedback(null);
    nextQuestionPromiseRef.current = null;
    try {
      const res = await client.post('/interview/start', { type, domain, totalQuestions, difficulty });
      const sessionData = {
        id:              res.data.interviewId,
        type,
        domain,
        difficulty,
        currentQuestion: res.data.question,
        questionIndex:   res.data.questionIndex,
        totalQuestions:  res.data.totalQuestions,
        qa: [],
      };
      setSession(sessionData);
      return sessionData;
    } catch (err) {
      console.error('Failed to start interview', err);
      throw err;
    }
  };

  // ── submitAnswer ───────────────────────────────────────────────────────────
  // Step 1 → POST /evaluate  : 1 AI call, returns feedback instantly
  // Step 2 → POST /next-question : fires in background while user reads feedback
  const submitAnswer = async (answer) => {
    if (!activeSessionRef.current) return null;
    try {
      const session = activeSessionRef.current;

      // STEP 1: Evaluate only (fast)
      const evalRes = await client.post('/interview/evaluate', {
        interviewId:   session.id,
        answer,
        questionIndex: session.questionIndex,
      });

      const { evaluation, isComplete, isFollowUp, nextIndex, results } = evalRes.data;

      const updatedQA = [
        ...session.qa,
        { question: session.currentQuestion, answer, evaluation },
      ];

      if (isComplete) {
        setSession(null);
        setLastFeedback(results);
        return { isComplete: true, results, evaluation };
      }

      // STEP 2: Fire next-question in background — don't await here
      nextQuestionPromiseRef.current = client.post('/interview/next-question', {
        interviewId: session.id,
        nextIndex,
        isFollowUp,
      });

      setSession({ ...session, qa: updatedQA });
      return { isComplete: false, evaluation };
    } catch (err) {
      console.error('Failed to submit answer', err);
      throw err;
    }
  };

  // ── advanceToNextQuestion ──────────────────────────────────────────────────
  // Call when user clicks "Next Question" — awaits the background promise.
  // If already resolved, returns instantly. If still loading, waits briefly.
  const advanceToNextQuestion = async () => {
    if (!nextQuestionPromiseRef.current) return null;
    try {
      const res = await nextQuestionPromiseRef.current;
      nextQuestionPromiseRef.current = null;
      const { nextQuestion, nextIndex, totalQuestions } = res.data;
      setSession({
        ...activeSessionRef.current,
        currentQuestion: nextQuestion,
        questionIndex:   nextIndex,
        totalQuestions:  totalQuestions || activeSessionRef.current.totalQuestions,
      });
      return nextQuestion;
    } catch (err) {
      console.error('Failed to get next question', err);
      throw err;
    }
  };

  // ── endInterviewEarly ──────────────────────────────────────────────────────
  const endInterviewEarly = async () => {
    if (!activeSessionRef.current) return null;
    try {
      const res = await client.post('/interview/end', { interviewId: activeSessionRef.current.id });
      setSession(null);
      nextQuestionPromiseRef.current = null;
      setLastFeedback(res.data.results);
      return res.data.results;
    } catch (err) {
      console.error('Failed to end interview early', err);
      throw err;
    }
  };

  // ── clearSession ───────────────────────────────────────────────────────────
  const clearSession = () => {
    setSession(null);
    setLastFeedback(null);
    nextQuestionPromiseRef.current = null;
  };

  // ── fetchHistory ───────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      const res = await client.get('/interview/history');
      setHistory(res.data.interviews);
      setHistoryStats(res.data.stats);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  }, []);

  return (
    <InterviewContext.Provider value={{
      activeSession,
      activeSessionRef,
      startInterview,
      submitAnswer,
      advanceToNextQuestion,
      endInterviewEarly,
      clearSession,
      history,
      historyStats,
      fetchHistory,
      lastFeedback,
      setLastFeedback,
    }}>
      {children}
    </InterviewContext.Provider>
  );
}

export const useInterview = () => useContext(InterviewContext);
