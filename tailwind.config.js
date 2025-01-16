/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        imperio: {
          primary: '#1a1a1a',
          secondary: '#ffd700',
          accent: '#c0c0c0'
        }
      },
      animation: {
        'zoom': 'zoom 0.3s ease-in-out',
        'wave-1': 'wave-expand 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave-2': 'wave-expand 4s cubic-bezier(0.4, 0, 0.6, 1) infinite 0.8s',
        'wave-3': 'wave-expand 4s cubic-bezier(0.4, 0, 0.6, 1) infinite 1.6s',
        'wave-4': 'wave-expand 4s cubic-bezier(0.4, 0, 0.6, 1) infinite 2.4s',
        'wave-5': 'wave-expand 4s cubic-bezier(0.4, 0, 0.6, 1) infinite 3.2s',
        'wave-6': 'wave-expand 4s cubic-bezier(0.4, 0, 0.6, 1) infinite 4s',
        'pulse-ring': 'pulse-ring 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 3s ease-in-out infinite',
        fadeInScale: 'fadeInScale 0.3s ease-out forwards'
      },
      keyframes: {
        zoom: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.1)' }
        },
        'wave-expand': {
          '0%': { 
            transform: 'scale(0.1) rotate(0deg)',
            opacity: '0.95',
            filter: 'blur(0px)',
            borderWidth: '8px'
          },
          '30%': {
            opacity: '0.8',
            filter: 'blur(0.5px)',
            borderWidth: '7px',
            transform: 'scale(3) rotate(120deg)'
          },
          '60%': {
            opacity: '0.5',
            filter: 'blur(1px)',
            borderWidth: '6px',
            transform: 'scale(6) rotate(240deg)'
          },
          '100%': { 
            transform: 'scale(9) rotate(360deg)',
            opacity: '0.2',
            filter: 'blur(2px)',
            borderWidth: '4px'
          }
        },
        'pulse-ring': {
          '0%': {
            transform: 'scale(0.1)',
            opacity: '0.8',
          },
          '50%': {
            transform: 'scale(0.2)',
            opacity: '0.6',
          },
          '100%': {
            transform: 'scale(0.1)',
            opacity: '0.8',
          }
        },
        'glow': {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(225,170,30,0.4), 0 0 40px rgba(225,170,30,0.3), 0 0 60px rgba(225,170,30,0.2)',
          },
          '50%': {
            boxShadow: '0 0 30px rgba(225,170,30,0.5), 0 0 60px rgba(225,170,30,0.4), 0 0 90px rgba(225,170,30,0.3)',
          }
        },
        fadeInScale: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        }
      }
    },
  },
  plugins: [],
}

