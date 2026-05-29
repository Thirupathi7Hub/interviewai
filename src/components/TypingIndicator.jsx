import { Zap } from 'lucide-react';

export default function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-full btn-gold flex items-center justify-center shadow-gold-sm">
        <Zap size={14} fill="black" strokeWidth={0} />
      </div>
      <div className="chat-ai px-5 py-4 flex items-center gap-1.5">
        <div className="dot" />
        <div className="dot" />
        <div className="dot" />
      </div>
    </div>
  );
}
