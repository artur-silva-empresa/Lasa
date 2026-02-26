/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          850: '#151e2e',
          950: '#020617',
        }
      },
      animation: {
        'in': 'animateIn 0.2s ease-out',
      },
    }
  },
  plugins: [],
}
