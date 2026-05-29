import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

export default function ChatMessage({ role, content, time }) {
  const isAI = role === 'ai';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isAI ? 'justify-start' : 'justify-end'}`}
    >
      {isAI && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full btn-gold flex items-center justify-center shadow-gold-sm mt-1">
          <Zap size={14} fill="black" strokeWidth={0} />
        </div>
      )}

      <div className={`max-w-[75%] ${isAI ? 'chat-ai' : 'chat-user'} px-4 py-3 relative`}>
        {isAI && (
          <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-wider mb-1">AI InterviewPrep</p>
        )}
        <p className="text-sm leading-relaxed text-gray-100">{content}</p>
        {time && <p className="text-[10px] text-gray-500 mt-1.5 text-right">{time}</p>}
      </div>

      {!isAI && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold mt-1">
          AS
        </div>
      )}
    </motion.div>
  );
}
