import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Send, Mic, MicOff, ChevronLeft, Clock, Camera, CameraOff, User, MonitorPlay
} from 'lucide-react';
import { useInterview } from '../context/InterviewContext';
import { useProctoring } from '../hooks/useProctoring';
import { useAIConfidence } from '../hooks/useAIConfidence';
import ProctoringOverlay from '../components/ProctoringOverlay';

function useTimer(initial = 0) {
  const [seconds, setSeconds] = useState(initial);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return { display: `${mm}:${ss}`, running, setRunning };
}

export default function InterviewSessionPage() {
  const navigate = useNavigate();
  const { activeSession, activeSessionRef, submitAnswer, endInterviewEarly } = useInterview();

  // Guard: redirect to /select if no active session — but NOT while ending (race condition)
  const isEndingRef = useRef(false);
  useEffect(() => {
    if (!isEndingRef.current && !activeSessionRef.current && !activeSession) {
      navigate('/select', { replace: true });
    }
  }, [activeSession, activeSessionRef, navigate]);

  const [aiCharacter, setAiCharacter] = useState(null); // 'male' or 'female'
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [quickFeedback, setQuickFeedback] = useState(null); // { verdict, quickFeedback, score }
  
  // Media states
  const [cameraOn, setCameraOn] = useState(true);
  const [isListening, setIsListening] = useState(false);
  
  const videoRef       = useRef(null);
  const chatBottomRef  = useRef(null);
  const timer          = useTimer(0);
  const recognitionRef = useRef(null);

  // ── Real-time proctoring (heuristic — face position, tab switch) ─────────
  const proctoringEnabled = !!aiCharacter && cameraOn;
  const { confidenceScore, alert: proctoringAlert, violationCount, shouldEnd } = useProctoring({
    videoRef,
    enabled: proctoringEnabled,
  });

  // ── AI-powered confidence (NVIDIA nemotron vision — every 15s) ────────────
  const { aiScore, emotion, engagement, eyeContact, insight, isAnalyzing } = useAIConfidence({
    videoRef,
    enabled: proctoringEnabled,
  });

  // Auto-end session when proctoring terminates it
  useEffect(() => {
    if (shouldEnd) handleEndEarly();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldEnd]);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setInput((prev) => prev + transcriptPart + ' ');
          } else {
            currentTranscript += transcriptPart;
          }
        }
        // If we want real-time interim results we can display them, but appending final is safer for input field
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      // Cancel any ongoing speech so it doesn't interfere with microphone
      window.speechSynthesis?.cancel();
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  // Text to Speech — picks the best neural voice available (Gemini-like quality)
  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Voice priority lists — ordered best → fallback
    const femaleVoices = [
      'Google UK English Female',    // Chrome (best neural)
      'Google US English',           // Chrome alternate
      'Microsoft Aria Online (Natural) - English (United States)',
      'Microsoft Jenny Online (Natural) - English (United States)',
      'Microsoft Sonia Online (Natural) - English (United Kingdom)',
      'Samantha',                    // macOS / Safari
      'Karen',                       // macOS
      'Moira',                       // macOS
      'Microsoft Zira Desktop - English (United States)',
    ];

    const maleVoices = [
      'Google UK English Male',
      'Microsoft Guy Online (Natural) - English (United States)',
      'Microsoft Ryan Online (Natural) - English (United Kingdom)',
      'Microsoft Davis Online (Natural) - English (United States)',
      'Alex',                        // macOS
      'Daniel',                      // macOS / iOS UK
      'Fred',
      'Microsoft David Desktop - English (United States)',
      'Microsoft Mark Desktop - English (United States)',
    ];

    const voices = window.speechSynthesis.getVoices();
    const priorityList = aiCharacter === 'female' ? femaleVoices : maleVoices;

    let chosen = null;

    // 1. Try priority list (exact name match)
    for (const name of priorityList) {
      const v = voices.find(v => v.name === name);
      if (v) { chosen = v; break; }
    }

    // 2. Fallback: any online/neural English voice of the right gender hint
    if (!chosen) {
      const genderHint = aiCharacter === 'female' ? ['female', 'woman', 'girl'] : ['male', 'man', 'guy'];
      chosen = voices.find(v =>
        v.lang.startsWith('en') &&
        genderHint.some(h => v.name.toLowerCase().includes(h))
      );
    }

    // 3. Fallback: any English voice that sounds "online" / high quality
    if (!chosen) {
      chosen = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('online'))
            || voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('natural'))
            || voices.find(v => v.lang.startsWith('en'));
    }

    if (chosen) utterance.voice = chosen;

    // Gemini Live-style tuning: calm, clear, slightly slower
    utterance.rate   = 0.92;   // Slightly slower = more natural / less robotic
    utterance.pitch  = 0.95;   // Slightly lower pitch = warmer tone
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [aiCharacter]);

  // Speak AI messages when they arrive
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'ai') {
        // Delay slightly to ensure smooth transition
        setTimeout(() => speak(lastMsg.content), 300);
      }
    }
  }, [messages, speak]);

  // Ensure voices are loaded (some browsers need this)
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
    return () => window.speechSynthesis?.cancel(); // Stop talking on unmount
  }, []);

  // Setup Camera
  useEffect(() => {
    if (aiCharacter && cameraOn) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Error accessing camera:", err);
          setCameraOn(false);
        });
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }
    
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [aiCharacter, cameraOn]);

  // Start interview when character is selected
  useEffect(() => {
    if (aiCharacter && activeSession && messages.length === 0) {
      timer.setRunning(true);
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // For resume-based interviews don't mention the raw domain (candidate name)
      const isResume  = activeSession.type === 'Resume';
      const greeting  = isResume
        ? `Hello! I'm your AI interviewer. I've reviewed your resume and I'll be asking questions tailored specifically to your background and experience. Let's begin.`
        : `Hello! I'm your AI interviewer. We'll be conducting a ${activeSession.type} interview for ${activeSession.domain}. Let's begin.`;

      setMessages([{
        id: 'initial', role: 'ai',
        content: `${greeting}\n\n${activeSession.currentQuestion}`,
        time: now,
      }]);
    }
  }, [aiCharacter, activeSession]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleSend = async () => {
    if (!input.trim() || typing) return;
    
    // Stop listening if we submit
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { id: Date.now(), role: 'user', content: input.trim(), time: now };
    
    setMessages(m => [...m, userMsg]);
    setInput('');
    setTyping(true);
    setQuickFeedback(null);

    try {
      const res = await submitAnswer(userMsg.content);
      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Show quick feedback overlay from evaluation
      if (res.evaluation) {
        const fb = res.evaluation;
        setQuickFeedback({
          verdict: fb.verdict || (fb.score >= 75 ? 'Excellent' : fb.score >= 60 ? 'Good' : fb.score >= 40 ? 'Satisfactory' : 'Needs Improvement'),
          text: fb.quickFeedback || (fb.score >= 60 ? 'Good answer! You covered the key concept.' : 'Keep going, you are on the right track!'),
          score: fb.score,
        });
        // Auto-dismiss after 4 seconds
        setTimeout(() => setQuickFeedback(null), 4000);
      }
      
      if (res.isComplete) {
        setMessages(m => [...m, { id: Date.now() + 1, role: 'ai', content: "Thank you! That concludes our interview. I'll now generate your feedback report.", time: aiTime }]);
        setTimeout(() => navigate('/feedback'), 3000);
      } else {
        setMessages(m => [...m, { id: Date.now() + 1, role: 'ai', content: res.nextQuestion, time: aiTime }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(m => [...m, { id: Date.now() + 1, role: 'ai', content: "Sorry, I had trouble processing that. Could you try again?", time: now }]);
    } finally {
      setTyping(false);
    }
  };

  const handleEndEarly = async () => {
    isEndingRef.current = true;          // prevent session guard from firing
    if (isListening) recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    setTyping(true);
    try {
      await endInterviewEarly();
      navigate('/feedback');
    } catch (err) {
      console.error(err);
      isEndingRef.current = false;
      setTyping(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!activeSession) return null;

  // Character Selection Screen
  if (!aiCharacter) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-white mb-2">Choose Your Interviewer</h1>
            <p className="text-gray-400">Select an AI avatar for your face-to-face interview session.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAiCharacter('female')}
              className="glass rounded-3xl p-6 border border-white/10 hover:border-gold-500/50 flex flex-col items-center gap-4 transition-all"
            >
              <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white/5">
                <img src="/avatars/female.png" alt="Female Interviewer" className="w-full h-full object-cover" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white">Sarah</h3>
                <p className="text-sm text-gray-400">Senior Technical Recruiter</p>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAiCharacter('male')}
              className="glass rounded-3xl p-6 border border-white/10 hover:border-gold-500/50 flex flex-col items-center gap-4 transition-all"
            >
              <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white/5">
                <img src="/avatars/male.png" alt="Male Interviewer" className="w-full h-full object-cover" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white">David</h3>
                <p className="text-sm text-gray-400">Engineering Manager</p>
              </div>
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  const progress = Math.min((activeSession.questionIndex) / activeSession.totalQuestions, 1);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden relative"
    >
      {/* Background — professional office room */}
      <div className="absolute inset-0 z-0">
        <img
          src="/interview_bg.png"
          alt="Interview Room"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/55 to-[#0a0a0a]/20" />
      </div>

      {/* ── Proctoring Overlay ───────────────────────────────────────────── */}
      <ProctoringOverlay
        confidenceScore={confidenceScore}
        alert={proctoringAlert}
        violationCount={violationCount}
        onEndSession={handleEndEarly}
        aiScore={aiScore}
        emotion={emotion}
        engagement={engagement}
        eyeContact={eyeContact}
        insight={insight}
        isAnalyzing={isAnalyzing}
      />

      {/* ── Quick Feedback Overlay ─────────────────────────────────────── */}
      <AnimatePresence>
        {quickFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
          >
            <div className={`rounded-2xl border px-5 py-4 backdrop-blur-xl shadow-2xl flex items-start gap-4 ${
              quickFeedback.verdict === 'Excellent' ? 'bg-green-500/20 border-green-500/40' :
              quickFeedback.verdict === 'Good'      ? 'bg-blue-500/20 border-blue-500/40' :
              quickFeedback.verdict === 'Satisfactory' ? 'bg-yellow-500/20 border-yellow-500/40' :
              'bg-orange-500/20 border-orange-500/40'
            }`}>
              {/* Verdict badge */}
              <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-xs leading-tight ${
                quickFeedback.verdict === 'Excellent'    ? 'bg-green-500 text-white' :
                quickFeedback.verdict === 'Good'         ? 'bg-blue-500 text-white' :
                quickFeedback.verdict === 'Satisfactory' ? 'bg-yellow-500 text-black' :
                'bg-orange-500 text-white'
              }`}>
                <span className="text-lg font-black">{quickFeedback.score}</span>
                <span className="text-[9px] opacity-80">/100</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    quickFeedback.verdict === 'Excellent'    ? 'text-green-400' :
                    quickFeedback.verdict === 'Good'         ? 'text-blue-400' :
                    quickFeedback.verdict === 'Satisfactory' ? 'text-yellow-400' :
                    'text-orange-400'
                  }`}>{quickFeedback.verdict}</span>
                  <span className="text-gray-600 text-xs">·</span>
                  <span className="text-gray-500 text-xs">{aiCharacter === 'female' ? 'Sarah' : 'David'} says</span>
                </div>
                <p className="text-white text-sm leading-relaxed">{quickFeedback.text}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="relative z-10 flex-shrink-0 bg-black/40 backdrop-blur-md border-b border-white/5 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/select')}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-sm font-semibold text-white tracking-wide">REC</span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">Question {activeSession.questionIndex + 1}/{activeSession.totalQuestions}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/50 border border-white/10">
              <Clock size={13} className="text-gold-400" />
              <span className="text-sm font-mono font-bold text-white tabular-nums">{timer.display}</span>
            </div>
            
            {/* End Interview Button */}
            <button 
              onClick={handleEndEarly}
              disabled={typing}
              className="text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 px-3 sm:px-4 py-1.5 rounded-lg transition-all"
            >
              End Session
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl mx-auto w-full p-4 gap-4">
        
        {/* Left Side: Video & Subtitles */}
        <div className="flex-1 flex flex-col justify-end relative">
          
          {/* ── Interviewer Avatar Card (center-top) ─────────────────────── */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
            {/* Speaking ring */}
            <div className={`relative rounded-full transition-all duration-300 ${
              isSpeaking
                ? 'p-1 bg-gradient-to-br from-gold-400 via-gold-500 to-amber-600 shadow-[0_0_24px_6px_rgba(245,158,11,0.45)] avatar-ring-pulse'
                : 'p-1 bg-white/10'
            }`}>
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-2 border-black/40">
                <img
                  src={`/avatars/${aiCharacter}.png`}
                  alt={aiCharacter === 'female' ? 'Sarah' : 'David'}
                  className={`w-full h-full object-cover object-top transition-all duration-500 ${
                    isSpeaking ? 'avatar-beating' : ''
                  }`}
                />
              </div>
              {/* Live speaking pulse dot */}
              {isSpeaking && (
                <span className="absolute bottom-1 right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-gold-500" />
                </span>
              )}
            </div>

            {/* Name + status badge */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-bold text-white drop-shadow-lg">
                {aiCharacter === 'female' ? 'Sarah' : 'David'}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all ${
                isSpeaking
                  ? 'bg-gold-500/20 border border-gold-500/40 text-gold-400'
                  : 'bg-white/5 border border-white/10 text-gray-500'
              }`}>
                {isSpeaking ? '🎙 Speaking…' : 'AI Interviewer'}
              </span>
            </div>
          </div>

          {/* User PIP Camera */}
          <div className="absolute top-4 right-4 w-32 h-40 md:w-48 md:h-64 bg-black rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl z-20">
            {cameraOn ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <User size={32} className="text-gray-600" />
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-medium text-white flex items-center gap-1">
              You
            </div>
          </div>

          {/* Current Question Subtitle Overlay */}
          <div className="mb-4">
            <AnimatePresence mode="wait">
              <motion.div 
                key={typing ? 'typing' : messages.length}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="inline-block bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl max-w-3xl"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                    typing ? 'bg-blue-500/20' : 'bg-gold-500/20'
                  }`}>
                    <MonitorPlay size={18} className={typing ? 'text-blue-400' : 'text-gold-400'} />
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${
                      typing ? 'text-blue-400' : 'text-gold-400'
                    }`}>
                      {typing ? 'AI Thinking...' : (aiCharacter === 'female' ? 'Sarah' : 'David')}
                    </h4>

                    {typing ? (
                      // Thinking / Analyzing state
                      <div>
                        <p className="text-gray-300 text-base md:text-lg leading-relaxed font-medium italic">
                          Analyzing your response and preparing the next question...
                        </p>
                        <div className="flex items-center gap-3 mt-4">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
                          </div>
                          <span className="text-xs text-gray-500">This may take a few seconds with AI</span>
                        </div>
                      </div>
                    ) : (
                      // Show last AI message
                      <p className="text-white text-lg md:text-xl leading-relaxed font-medium">
                        {messages.filter(m => m.role === 'ai').slice(-1)[0]?.content ?? 'Starting interview...'}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Right Side: Transcript & Input */}
        <div className="w-full md:w-96 flex flex-col bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-white/5 bg-black/20">
            <h3 className="text-sm font-semibold text-white">Live Transcript</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-gold-500 text-black font-medium' 
                    : 'bg-white/10 text-gray-200'
                }`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-500 mt-1.5 px-1">{msg.time}</span>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          {/* Controls & Input */}
          <div className="p-4 bg-black/40 border-t border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setCameraOn(!cameraOn)}
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                  cameraOn ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                }`}
              >
                {cameraOn ? <Camera size={16} /> : <CameraOff size={16} />}
                {cameraOn ? 'Camera On' : 'Camera Off'}
              </button>
              <button
                onClick={toggleListening}
                className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                  isListening 
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/25 animate-pulse' 
                    : 'bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                {isListening ? 'Stop Mic' : 'Use Mic'}
              </button>
            </div>

            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={isListening ? "Listening..." : "Type or speak your answer..."}
                rows={2}
                className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-gold-500/50 transition-colors"
                disabled={typing}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || typing}
                className="w-12 flex-shrink-0 bg-gold-500 text-black rounded-xl flex items-center justify-center hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
            
            {/* Live Answer Quality Meter */}
            <div className="mt-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Live Quality Meter</span>
                <span className="text-[10px] text-gray-400">{input.trim().split(/\s+/).filter(w => w.length > 0).length} words</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex">
                {(() => {
                  const words = input.trim().split(/\s+/).filter(w => w.length > 0).length;
                  const percent = Math.min((words / 60) * 100, 100);
                  let color = 'bg-red-500';
                  if (words >= 20) color = 'bg-yellow-500';
                  if (words >= 40) color = 'bg-blue-500';
                  if (words >= 60) color = 'bg-green-500';
                  return (
                    <div 
                      className={`h-full ${color} transition-all duration-300 ease-out`} 
                      style={{ width: `${percent}%` }}
                    />
                  );
                })()}
              </div>
              <p className="text-[9px] text-gray-500 mt-1 text-center">
                {input.trim().split(/\s+/).filter(w => w.length > 0).length < 20 
                  ? "Too short. Add more detail." 
                  : input.trim().split(/\s+/).filter(w => w.length > 0).length < 40 
                  ? "Good start. Elaborate further." 
                  : "Great length! Ensure technical accuracy."}
              </p>
            </div>
          </div>
        </div>
        
      </div>
    </motion.div>
  );
}
