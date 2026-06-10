import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Sparkles, FileText, Trash2, Loader2,
  ChevronRight, ArrowLeft, CheckCircle2, User, Briefcase
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { useInterview } from '../context/InterviewContext';
import client from '../api/client';

export default function ResumeUploadPage() {
  const navigate = useNavigate();
  const { startInterview } = useInterview();

  const [resumeCtx, setResumeCtx] = useState(null);
  const [fileName,  setFileName]  = useState('');
  const [uploading, setUploading] = useState(false);
  const [starting,  setStarting]  = useState(false);
  const [error,     setError]     = useState('');
  const [dragOver,  setDragOver]  = useState(false);
  const fileRef = useRef(null);

  const handleUpload = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') { setError('PDF files only.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('File too large — max 5 MB.'); return; }
    setError(''); setUploading(true);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url
      ).toString();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const page    = await pdf.getPage(p);
        const content = await page.getTextContent();
        fullText += content.items.map(i => i.str).join(' ') + '\n';
      }
      if (!fullText.trim() || fullText.trim().length < 50) {
        setError('Could not extract text. Try a text-based (non-scanned) PDF.'); return;
      }
      const res = await client.post('/resume/parse', { text: fullText, fileName: file.name });
      setResumeCtx(res.data);
      setFileName(file.name);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to read PDF. Try another file.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, []);

  const handleStart = async () => {
    if (!resumeCtx || starting) return;
    setStarting(true);
    try {
      await startInterview('Resume', 'Resume Interview', 5, 'intermediate', resumeCtx);
      navigate('/session');
    } catch {
      setError('Failed to start interview. Please try again.');
      setStarting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="min-h-screen bg-[#0a0a0a]"
    >
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Back */}
        <motion.button
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors group"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Dashboard
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-widest mb-4">
            <Sparkles size={12} /> AI Personalised
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
            Resume-Based Interview
          </h1>
          <p className="text-gray-400 text-sm">
            Upload your resume and the AI will ask questions tailored specifically to <em>you</em>
          </p>
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ── Upload State ── */}
          {!resumeCtx && (
            <motion.div key="upload"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}
            >
              {/* Drop Zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]); }}
                onClick={() => !uploading && fileRef.current?.click()}
                className={`rounded-3xl border-2 border-dashed p-16 text-center cursor-pointer transition-all duration-300 ${
                  dragOver
                    ? 'border-purple-500 bg-purple-500/10 scale-[1.01]'
                    : 'border-white/10 hover:border-purple-500/40 hover:bg-white/2'
                }`}
              >
                <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                  onChange={e => handleUpload(e.target.files[0])} />

                {uploading ? (
                  <div className="flex flex-col items-center gap-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                      className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500"
                    />
                    <p className="text-white font-bold text-lg">Reading your resume…</p>
                    <p className="text-gray-500 text-sm">Extracting skills &amp; experience</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="w-20 h-20 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center"
                    >
                      <Upload size={32} className="text-purple-400" />
                    </motion.div>
                    <div>
                      <p className="text-white font-bold text-xl">Drop your resume PDF here</p>
                      <p className="text-gray-500 text-sm mt-1">or click to browse · PDF only · Max 5 MB</p>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-red-400 text-sm mt-4 font-medium">{error}</p>
                )}
              </div>

              {/* Info chips */}
              <div className="flex flex-wrap gap-3 justify-center mt-6">
                {[
                  '🎯 Questions tailored to your skills',
                  '🔒 Not stored — session only',
                  '⚡ AI analyses in seconds',
                ].map(t => (
                  <span key={t} className="text-xs text-gray-400 bg-white/3 border border-white/8 px-3 py-1.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Resume Parsed — Preview + Start ── */}
          {resumeCtx && (
            <motion.div key="preview"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}
            >
              {/* Success banner */}
              <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-green-500/8 border border-green-500/20">
                <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-green-300 font-bold text-sm">Resume parsed successfully!</p>
                  <p className="text-gray-500 text-xs">{fileName}</p>
                </div>
                <button onClick={() => { setResumeCtx(null); setFileName(''); setError(''); }}
                  className="text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Candidate info */}
              <div className="glass rounded-3xl border border-purple-500/20 p-6 mb-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                    <User size={18} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-black text-lg">{resumeCtx.candidateName || 'Candidate'}</p>
                    <p className="text-gray-500 text-xs">{resumeCtx.skills?.length || 0} skills detected</p>
                  </div>
                </div>

                {/* Skills */}
                {resumeCtx.skills?.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-2.5">
                      <Briefcase size={13} className="text-purple-400" />
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Detected Skills</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {resumeCtx.skills.map(s => (
                        <span key={s}
                          className="text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full capitalize">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-green-400 font-semibold py-3 px-4 bg-green-500/8 rounded-2xl border border-green-500/15">
                  <Sparkles size={12} />
                  All questions will be fully tailored to your background
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mb-4 font-medium">{error}</p>}

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleStart} disabled={starting}
                className="w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)', color: 'white' }}
              >
                {starting
                  ? <><Loader2 size={16} className="animate-spin" /> Starting your interview…</>
                  : <><Sparkles size={16} /> Start Personalised Interview <ChevronRight size={16} /></>
                }
              </motion.button>
              <p className="text-xs text-gray-600 text-center mt-2">
                Your resume is used only for this session — not stored
              </p>
            </motion.div>
          )}

        </AnimatePresence>

      </main>
    </motion.div>
  );
}
