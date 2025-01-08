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
      },
      keyframes: {
        zoom: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.1)' }
        }
      }
    },
  },
  plugins: [],
} 