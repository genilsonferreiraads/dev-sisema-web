/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'bounce-delay-1': 'bounce 1s infinite -0.3s',
        'bounce-delay-2': 'bounce 1s infinite -0.15s',
        'bounce-delay-3': 'bounce 1s infinite',
      },
    },
  },
  plugins: [],
}

