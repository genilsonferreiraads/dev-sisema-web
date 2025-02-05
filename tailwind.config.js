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
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        fadeInScale: 'fadeInScale 0.3s ease-out forwards',
        'kenburns': 'kenburns 20s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'border-flow': 'border-flow 3s linear infinite',
        'border-glow': 'border-glow 2s ease-in-out infinite',
        'corner-pulse': 'corner-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        zoom: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.1)' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
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
        },
        kenburns: {
          '0%': {
            transform: 'scale(1.1) translate(0, 0)',
          },
          '50%': {
            transform: 'scale(1.2) translate(-1%, -1%)',
          },
          '100%': {
            transform: 'scale(1.1) translate(0, 0)',
          }
        },
        'border-flow': {
          '0%': { 
            backgroundPosition: '0% 0%',
            filter: 'hue-rotate(0deg) brightness(1)',
          },
          '25%': {
            backgroundPosition: '100% 0%',
            filter: 'hue-rotate(5deg) brightness(1.2)',
          },
          '50%': {
            backgroundPosition: '100% 100%',
            filter: 'hue-rotate(10deg) brightness(1.1)',
          },
          '75%': {
            backgroundPosition: '0% 100%',
            filter: 'hue-rotate(5deg) brightness(1.2)',
          },
          '100%': {
            backgroundPosition: '0% 0%',
            filter: 'hue-rotate(0deg) brightness(1)',
          }
        },
        'border-glow': {
          '0%, 100%': {
            opacity: 0.5,
            transform: 'scale(1)',
          },
          '50%': {
            opacity: 1,
            transform: 'scale(1.02)',
          }
        },
        'corner-pulse': {
          '0%, 100%': {
            transform: 'scale(1)',
            opacity: 0.5,
            filter: 'blur(3px)',
          },
          '50%': {
            transform: 'scale(1.5)',
            opacity: 1,
            filter: 'blur(2px)',
          }
        },
      },
      backgroundImage: {
        'radial-dark': 'radial-gradient(circle at center, transparent 0%, rgba(30, 30, 30, 0.8) 100%)',
        'texture': 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100\' height=\'100\' filter=\'url(%23noise)\' opacity=\'0.08\'/%3E%3C/svg%3E")',
      },
    },
  },
  plugins: [],
}

