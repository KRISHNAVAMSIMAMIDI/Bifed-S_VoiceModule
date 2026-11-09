/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070c18',
          900: '#0b1329',
          800: '#111e3f',
          700: '#1c2e5c',
        },
        slate: {
          850: '#151f32',
          900: '#0f172a',
          950: '#090e1a'
        }
      }
    },
  },
  plugins: [],
}
