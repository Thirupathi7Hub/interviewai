/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        surface: {
          DEFAULT: '#111111',
          card:    '#1a1a1a',
          border:  '#2a2a2a',
          hover:   '#222222',
        },
      },
      animation: {
        'fade-in':      'fadeIn 0.5s ease forwards',
        'slide-up':     'slideUp 0.5s ease forwards',
        'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'bounce-dot':   'bounceDot 1.2s infinite ease-in-out',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        bounceDot: {
          '0%, 80%, 100%': { transform: 'scale(0)', opacity: '0.3' },
          '40%':           { transform: 'scale(1)', opacity: '1' },
        },
      },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        'gold-sm': '0 0 15px rgba(245,158,11,0.2)',
        'gold-md': '0 0 30px rgba(245,158,11,0.3)',
        'card':    '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
