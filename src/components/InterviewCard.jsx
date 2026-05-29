import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function InterviewCard({ icon: Icon, title, description, badge, onClick, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 * index, duration: 0.45 }}
      onClick={onClick}
      className="glass card-hover rounded-2xl p-8 border border-white/8 flex flex-col gap-5 cursor-pointer group relative overflow-hidden"
    >
      {/* Glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top left, rgba(245,158,11,0.06) 0%, transparent 70%)' }} />

      {/* Badge */}
      {badge && (
        <span className="absolute top-4 right-4 text-xs font-semibold px-2.5 py-1 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400">
          {badge}
        </span>
      )}

      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-gold-500/10 border border-gold-500/15 flex items-center justify-center group-hover:bg-gold-500/20 transition-colors duration-300">
        <Icon size={28} className="text-gold-400" />
      </div>

      {/* Content */}
      <div className="flex-1">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>

      {/* CTA */}
      <button className="btn-gold w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 group-hover:shadow-gold-md">
        Start Interview
        <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
      </button>
    </motion.div>
  );
}
