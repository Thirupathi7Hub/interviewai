import { motion } from 'framer-motion';

export default function StatCard({ icon: Icon, label, value, sub, color = 'gold', index = 0 }) {
  const colors = {
    gold:  { ring: 'border-gold-500/20',  iconBg: 'bg-gold-500/10',  iconColor: 'text-gold-400' },
    blue:  { ring: 'border-blue-500/20',  iconBg: 'bg-blue-500/10',  iconColor: 'text-blue-400' },
    green: { ring: 'border-green-500/20', iconBg: 'bg-green-500/10', iconColor: 'text-green-400' },
  };
  const c = colors[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index, duration: 0.45 }}
      className={`glass card-hover rounded-2xl p-6 border ${c.ring} flex flex-col gap-4`}
    >
      <div className={`w-11 h-11 rounded-xl ${c.iconBg} flex items-center justify-center`}>
        <Icon size={22} className={c.iconColor} />
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
        <p className="text-sm font-medium text-gray-300 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </motion.div>
  );
}
