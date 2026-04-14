/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nexus: {
          50: '#f0f4ff',
          100: '#dde8ff',
          200: '#c3d4fe',
          300: '#9ab6fd',
          400: '#698efb',
          500: '#4465f8',
          600: '#2d43ed',
          700: '#2432da',
          800: '#2129b0',
          900: '#21288b',
          950: '#161854',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
