import { createContext, useContext, useState, useCallback, useRef } from 'react';
import client from '../api/client';

const InterviewContext = createContext();

export function InterviewProvider({ children }) {
  const [activeSession, setActiveSession] = useState(null);
  const [history, setHistory]             = useState([]);
  const [historyStats, setHistoryStats]   = useState({ total: 0, avgScore: 0, bestScore: 0 });
  const [lastFeedback, setLastFeedback]   = useState(null);

  // Ref-backed session so InterviewSessionPage guard reads the LATEST value
  // synchronously (avoids the race window between setState and re-render).
  const activeSessionRef = useRef(null);
  const setSession = (data) => {
    activeSessionRef.current = data;
    setActiveSession(data);
  };

  // ── startInterview ─────────────────────────────────────────────────────────
  const startInterview = async (type, domain, totalQuestions = 5, difficulty = 'intermediate', resumeContext = null) => {
    setLastFeedback(null);
    try {
      const res = await client.post('/interview/start', { type, domain, totalQuestions, difficulty, resumeContext });
      const sessionData = {
        id:              res.data.interviewId,
        type,
        domain,
        difficulty,
        currentQuestion: res.data.question,
        questionIndex:   res.data.questionIndex,
        totalQuestions:  res.data.totalQuestions,
        hasResume:       res.data.hasResume || false,
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
  const submitAnswer = async (answer) => {
    if (!activeSessionRef.current) return null;
    try {
      const res = await client.post('/interview/answer', {
        interviewId:   activeSessionRef.current.id,
        answer,
        questionIndex: activeSessionRef.current.questionIndex,
      });

      const updatedQA = [
        ...activeSessionRef.current.qa,
        { question: activeSessionRef.current.currentQuestion, answer, evaluation: res.data.evaluation },
      ];

      if (res.data.isComplete) {
        setSession(null);
        setLastFeedback(res.data.results);
        return { isComplete: true, results: res.data.results, evaluation: res.data.evaluation };
      } else {
        setSession({
          ...activeSessionRef.current,
          currentQuestion: res.data.nextQuestion,
          questionIndex:   res.data.nextIndex,
          totalQuestions:  res.data.totalQuestions || activeSessionRef.current.totalQuestions,
          qa: updatedQA,
        });
        return { isComplete: false, evaluation: res.data.evaluation, nextQuestion: res.data.nextQuestion };
      }
    } catch (err) {
      console.error('Failed to submit answer', err);
      throw err;
    }
  };

  // ── endInterviewEarly ──────────────────────────────────────────────────────
  const endInterviewEarly = async () => {
    if (!activeSessionRef.current) return null;
    try {
      const res = await client.post('/interview/end', { interviewId: activeSessionRef.current.id });
      setSession(null);
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
